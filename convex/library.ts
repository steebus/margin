import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx } from './_generated/server'
import { datesFrom, positionOf, progressAt, readingsAfter, readingsOf, toBook } from './lib/books'
import { askForReflection, waitingPrompt } from './lib/reflection'
import { enqueueRead } from './lib/outbox'
import { checkMilestones, waitingNote } from './milestones'

/** Every book on the signed-in reader's shelves. Empty when signed out. */
export const myBooks = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const reads = await ctx.db.query('reads').withIndex('by_user_status', q => q.eq('userId', userId)).collect()
    const books = await Promise.all(reads.map(async read => {
      const work = await ctx.db.get(read.workId)
      return work && toBook(read, work)
    }))
    return books.filter(book => book !== null)
  },
})

/** One book and its entries, or null if it isn't on this reader's shelves. */
export const bookBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const work = await ctx.db.query('works').withIndex('by_slug', q => q.eq('slug', slug)).first()
    if (!work) return null
    const read = await ctx.db.query('reads').withIndex('by_user_work', q => q.eq('userId', userId).eq('workId', work._id)).first()
    if (!read) return null
    const entries = await ctx.db.query('entries').withIndex('by_read', q => q.eq('readId', read._id)).collect()
    const art = await ctx.db.query('workArt').withIndex('by_work', q => q.eq('workId', work._id)).first()
    const prompt = await waitingPrompt(ctx, read._id)
    const note = await waitingNote(ctx, read._id)
    return {
      book: toBook(read, work),
      cover: {
        choice: read.artChoice ?? 'drawing',
        hasDrawing: !!work.artSmallUrl,
        hasRealCover: !!work.coverUrl,
        state: art?.state ?? null,
        error: art?.error ?? null,
      },
      prompt: prompt && { id: prompt._id, question: prompt.question! },
      note,
      entries: entries.map(e => ({ id: e._id, kind: e.kind, text: e.text, question: e.question ?? null, parentId: e.parentId ?? null, position: positionOf(e.pos), createdAt: e.createdAt })),
    }
  },
})

/** Every entry in the library, newest first, for the Desk, the drawer, the notes and the pile. */
export const allEntries = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const entries = await ctx.db.query('entries').withIndex('by_user', q => q.eq('userId', userId)).order('desc').collect()
    const works = new Map<string, Doc<'works'> | null>()
    return Promise.all(entries.map(async e => {
      let work = works.get(e.readId)
      if (work === undefined) {
        const read = await ctx.db.get(e.readId)
        work = read && await ctx.db.get(read.workId)
        works.set(e.readId, work)
      }
      const position = positionOf(e.pos)
      return {
        id: e._id,
        kind: e.kind,
        text: e.text,
        question: e.question ?? null,
        position,
        createdAt: e.createdAt,
        where: [work?.title, position].filter(Boolean).join(', '),
        slug: work?.slug ?? null,
      }
    }))
  },
})

/** Everything of the reader's, to take away (SPEC 2). */
export const exportAll = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to export your library')
    const reads = await ctx.db.query('reads').withIndex('by_user_status', q => q.eq('userId', userId)).collect()
    const books = (await Promise.all(reads.map(async read => {
      const work = await ctx.db.get(read.workId)
      return work && toBook(read, work)
    }))).filter(book => book !== null)
    const entries = await ctx.db.query('entries').withIndex('by_user', q => q.eq('userId', userId)).collect()
    const lists = await ctx.db.query('shelves').withIndex('by_user_slug', q => q.eq('userId', userId)).collect()
    return {
      exportedAt: Date.now(),
      books,
      lists: lists.map(l => ({ id: l._id, name: l.name })),
      entries: entries.map(e => ({
        id: e._id,
        readId: e.readId,
        kind: e.kind,
        text: e.text,
        question: e.question ?? null,
        parentId: e.parentId ?? null,
        position: positionOf(e.pos),
        pos: e.pos,
        origin: e.origin,
        createdAt: e.createdAt,
      })),
    }
  },
})

async function mine(ctx: MutationCtx, readId: Id<'reads'>) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError('Sign in to change this')
  const read = await ctx.db.get(readId)
  if (!read || read.userId !== userId) throw new ConvexError('That book is not on your shelves')
  return { userId, read }
}

type Status = Doc<'reads'>['status']

/** The dates, the reads and the reflection question all follow from a change of status, however it was made. */
async function changeStatus(ctx: MutationCtx, userId: Id<'users'>, read: Doc<'reads'>, status: Status) {
  const readings = readingsAfter(readingsOf(read), status, Date.now())
  await ctx.db.patch(read._id, {
    status,
    readings,
    ...datesFrom(readings, status),
    ...(status === 'read' ? { progress: { ...read.progress, percent: 100 } } : {}),
  })
  if (status === 'read') await askForReflection(ctx, userId, read._id)
}

/** Logs a place in the book: a page, a time in seconds, or a percent. The last page finishes it. */
export const logProgress = mutation({
  args: { readId: v.id('reads'), percent: v.optional(v.number()), page: v.optional(v.number()), seconds: v.optional(v.number()) },
  handler: async (ctx, { readId, percent, page, seconds }) => {
    const { userId, read } = await mine(ctx, readId)
    const work = await ctx.db.get(read.workId)
    const progress = progressAt({ percent, page, seconds }, work?.pages, work?.audioSeconds)
    if (!progress) throw new ConvexError('That place does not fit this book')
    await ctx.db.patch(readId, { progress })
    await ctx.db.insert('progressLog', { userId, readId, at: Date.now(), percent: progress.percent, page: progress.page, origin: 'manual' })
    await checkMilestones(ctx, read, read.progress.percent, progress.percent)
    const next = progress.percent === 100 ? 'read' : read.status === 'tbr' || read.status === 'paused' ? 'reading' : read.status
    if (next !== read.status) await changeStatus(ctx, userId, { ...read, progress }, next)
    await enqueueRead(ctx, userId, readId)
    return { finished: next === 'read' && read.status !== 'read' }
  },
})

/** Remembers how this book gets logged. Nothing to tell Hardcover. */
export const setProgressUnit = mutation({
  args: { readId: v.id('reads'), unit: v.union(v.literal('page'), v.literal('time'), v.literal('percent')) },
  handler: async (ctx, { readId, unit }) => {
    await mine(ctx, readId)
    await ctx.db.patch(readId, { progressUnit: unit })
  },
})

export const setStatus = mutation({
  args: { readId: v.id('reads'), status: v.union(v.literal('tbr'), v.literal('reading'), v.literal('paused'), v.literal('read'), v.literal('dnf')) },
  handler: async (ctx, { readId, status }) => {
    const { userId, read } = await mine(ctx, readId)
    if (read.status === status) return
    await changeStatus(ctx, userId, read, status)
    await enqueueRead(ctx, userId, readId)
  },
})

/** Replaces a book's reads with the reader's edits. A read they removed is removed from Hardcover too. */
export const saveReadings = mutation({
  args: { readId: v.id('reads'), readings: v.array(v.object({ hardcoverId: v.optional(v.number()), startedAt: v.optional(v.number()), finishedAt: v.optional(v.number()) })) },
  handler: async (ctx, { readId, readings }) => {
    const { userId, read } = await mine(ctx, readId)
    const known = readingsOf(read).flatMap(r => (r.hardcoverId ? [r.hardcoverId] : []))
    for (const r of readings) {
      if (r.hardcoverId && !known.includes(r.hardcoverId)) throw new ConvexError('That read is not on this book')
      if (!r.startedAt && !r.finishedAt) throw new ConvexError('A read needs a start or a finish date')
      if (r.startedAt && r.finishedAt && r.finishedAt < r.startedAt) throw new ConvexError('A read can not finish before it starts')
    }
    const kept = readings.flatMap(r => (r.hardcoverId ? [r.hardcoverId] : []))
    const ordered = [...readings].sort((x, y) => (x.startedAt ?? x.finishedAt!) - (y.startedAt ?? y.finishedAt!))
    await ctx.db.patch(readId, {
      readings: ordered,
      deletedReadings: [...(read.deletedReadings ?? []), ...known.filter(id => !kept.includes(id))],
      ...datesFrom(ordered, read.status),
    })
    await enqueueRead(ctx, userId, readId)
  },
})

export const setRating = mutation({
  args: { readId: v.id('reads'), rating: v.union(v.number(), v.null()) },
  handler: async (ctx, { readId, rating }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to change this')
    const read = await ctx.db.get(readId)
    if (!read || read.userId !== userId) throw new ConvexError('That book is not on your shelves')
    if (rating !== null && !(rating >= 0.5 && rating <= 5 && rating * 2 === Math.round(rating * 2))) throw new ConvexError('A rating is from half a star to five, in half stars')
    await ctx.db.patch(readId, { rating: rating ?? undefined })
    await enqueueRead(ctx, userId, readId)
  },
})
