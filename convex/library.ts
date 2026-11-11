import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { internal } from './_generated/api'
import { mutation, query, type MutationCtx } from './_generated/server'
import { datesFrom, edited, positionOf, progressAt, readingsAfter, readingsOf, toBook } from './lib/books'
import { askForReflection, waitingPrompt } from './lib/reflection'
import { movedIn, windowEnd } from './lib/activity'
import { GENRES, genresOf } from './lib/genres'
import { enqueueRead } from './lib/outbox'
import { checkMilestones, waitingNote } from './milestones'
import { depthOf, guideFor } from './guides'

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

/** The book being read that the reader last logged progress or wrote on. Null when nothing's being read. */
export const latestRead = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const reading = await ctx.db.query('reads').withIndex('by_user_status', q => q.eq('userId', userId).eq('status', 'reading')).collect()
    let latest: { readId: Id<'reads'>; at: number } | null = null
    for (const read of reading) {
      const logged = await ctx.db.query('progressLog').withIndex('by_read', q => q.eq('readId', read._id)).order('desc').first()
      const wrote = await ctx.db.query('entries').withIndex('by_read', q => q.eq('readId', read._id)).order('desc').first()
      const at = Math.max(logged?.at ?? 0, wrote?.createdAt ?? 0, read.startedAt ?? 0)
      if (!latest || at > latest.at) latest = { readId: read._id, at }
    }
    return latest?.readId ?? null
  },
})

/**
 * The Desk's window (Steve, 2026-11-04): each book in hand's progress logs since `since`, plus the one before it so
 * the line starts where the book stood, the books put on the TBR, and how many notes were written.
 */
export const activity = query({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const byStatus = (status: Doc<'reads'>['status']) => ctx.db.query('reads').withIndex('by_user_status', q => q.eq('userId', userId).eq('status', status)).collect()
    const reading = await byStatus('reading')
    const finished = (await byStatus('read')).filter(r => (r.finishedAt ?? 0) >= since)
    // Everything that could have moved in the window: books in hand, paused ones, and those finished in it.
    const moving = [...reading, ...await byStatus('paused'), ...finished]
    const logs = await Promise.all(moving.map(async read => {
      const inside = await ctx.db.query('progressLog').withIndex('by_read', q => q.eq('readId', read._id).gte('at', since)).collect()
      const before = await ctx.db.query('progressLog').withIndex('by_read', q => q.eq('readId', read._id).lt('at', since)).order('desc').first()
      return { read, logs: [...(before ? [before] : []), ...inside].map(l => ({ at: l.at, percent: l.percent })) }
    }))
    // No clock in a query: the window's own end stands in for now.
    const end = windowEnd(since)
    let pages = 0
    let audioSeconds = 0
    for (const { read, logs: mine } of logs) {
      const moved = movedIn(mine, since, end, read.startedAt ?? null)
      if (!moved) continue
      const found = await ctx.db.get(read.workId)
      const work = found && edited(found, read)
      if (read.format === 'audio') audioSeconds += moved * (work?.audioSeconds ?? 0)
      else pages += moved * (work?.pages ?? 0)
    }
    const tbr = await ctx.db.query('reads').withIndex('by_user_status', q => q.eq('userId', userId).eq('status', 'tbr')).collect()
    const added = await Promise.all(tbr.filter(r => (r.addedAt ?? 0) >= since).map(async r => {
      const found = await ctx.db.get(r.workId)
      const work = found && edited(found, r)
      return work && { slug: work.slug, title: work.title, author: work.authors[0] ?? 'Unknown author', pages: work.pages ?? null, subjects: work.subjects, genres: r.edits?.genres ?? genresOf(work.tags, work.subjects), addedAt: r.addedAt! }
    }))
    const notes = await ctx.db.query('entries').withIndex('by_user', q => q.eq('userId', userId).gte('createdAt', since)).collect()
    return {
      logs: logs.filter(l => l.read.status === 'reading').map(l => ({ readId: l.read._id, logs: l.logs })),
      pages: Math.round(pages),
      audioSeconds: Math.round(audioSeconds),
      finished: finished.length,
      added: added.filter(a => a !== null).sort((a, b) => b.addedAt - a.addedAt),
      notes: notes.filter(e => e.kind !== 'review').length,
    }
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
    const past = await ctx.db.query('pastArt').withIndex('by_work', q => q.eq('workId', work._id)).order('desc').collect()
    const prompt = await waitingPrompt(ctx, read._id)
    const note = await waitingNote(ctx, read._id)
    const guide = await guideFor(ctx, work._id)
    return {
      book: toBook(read, work),
      // As Hardcover has it, so the edit page can show what a correction replaces and put it back.
      edits: read.edits ?? null,
      original: { title: work.title, authors: work.authors, pages: work.pages ?? null, year: work.year ?? null, genres: genresOf(work.tags, work.subjects) },
      cover: {
        choice: read.artChoice ?? 'drawing',
        hasDrawing: !!work.artSmallUrl,
        hasRealCover: !!work.coverUrl,
        state: art?.state ?? null,
        error: art?.error ?? null,
        // Every drawing this book has had, the current one first, for the reader to choose between.
        drawings: [
          ...(work.artSmallUrl && work.artLargeUrl ? [{ id: null, small: work.artSmallUrl, large: work.artLargeUrl }] : []),
          ...past.map(p => ({ id: p._id, small: p.smallUrl, large: p.largeUrl })),
        ],
      },
      prompt: prompt && { id: prompt._id, question: prompt.question! },
      note,
      guide: guide && { depth: depthOf(guide), state: guide.state },
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
        tags: e.tags ?? [],
        where: [work?.title, position].filter(Boolean).join(', '),
        slug: work?.slug ?? null,
      }
    }))
  },
})

/**
 * When each entry was written, newest first, and nothing else. The Desk only needs to know whether there are notes,
 * which was written on this date, and which one to offer; it then asks for that one note's words by id. So it no
 * longer downloads every note ever written, or hears about every edit to one.
 */
export const entryDates = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const entries = await ctx.db.query('entries').withIndex('by_user', q => q.eq('userId', userId)).order('desc').collect()
    return entries.map(e => ({ id: e._id, createdAt: e.createdAt }))
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
  const before = readingsOf(read)
  const readings = readingsAfter(before, status, Date.now())
  // Starting a finished book again is a re-read, and a re-read starts at the beginning, not on the last page.
  const rereading = status === 'reading' && (read.status === 'read' || !!before.at(-1)?.finishedAt)
  await ctx.db.patch(read._id, {
    status,
    readings,
    ...datesFrom(readings, status),
    ...(status === 'read' ? { progress: { ...read.progress, percent: 100 } } : rereading ? { progress: { percent: 0 } } : {}),
  })
  if (status === 'read') await askForReflection(ctx, userId, read._id)
}

/** Logs a place in the book: a page, a time in seconds, or a percent. The last page finishes it. */
export const logProgress = mutation({
  args: {
    readId: v.id('reads'), percent: v.optional(v.number()), page: v.optional(v.number()), seconds: v.optional(v.number()),
    // When it was written, for a place that waited offline. Older than the book's latest log, it goes in the history
    // but doesn't move the book.
    writtenAt: v.optional(v.number()),
  },
  handler: async (ctx, { readId, percent, page, seconds, writtenAt }) => {
    const { userId, read } = await mine(ctx, readId)
    const found = await ctx.db.get(read.workId)
    const work = found && edited(found, read)
    const progress = progressAt({ percent, page, seconds }, work?.pages, work?.audioSeconds)
    if (!progress) throw new ConvexError('That place does not fit this book')
    const at = Math.min(writtenAt ?? Date.now(), Date.now())
    const latest = writtenAt === undefined ? null : await ctx.db.query('progressLog').withIndex('by_read', q => q.eq('readId', readId)).order('desc').first()
    await ctx.db.insert('progressLog', { userId, readId, at, percent: progress.percent, page: progress.page, origin: 'manual' })
    if (latest && latest.at > at) return { finished: false }
    await ctx.db.patch(readId, { progress })
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
  args: {
    readId: v.id('reads'),
    status: v.union(v.literal('tbr'), v.literal('reading'), v.literal('paused'), v.literal('read'), v.literal('dnf')),
    // Finished some time unknown, as an import says: marked read without stamping today as the finish, and with no
    // reflection question, since it wasn't finished just now.
    undated: v.optional(v.boolean()),
  },
  handler: async (ctx, { readId, status, undated }) => {
    const { userId, read } = await mine(ctx, readId)
    if (read.status === status) return
    if (undated && status === 'read') await ctx.db.patch(readId, { status, progress: { ...read.progress, percent: 100 } })
    else await changeStatus(ctx, userId, read, status)
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

/**
 * Deletes a book from the shelves: its reads, notes, progress and buddy talk, all of it. On Hardcover the book and its
 * journal go too, by explicit id, through the outbox. Nothing here can be undone.
 */
export const deleteBook = mutation({
  args: { readId: v.id('reads') },
  handler: async (ctx, { readId }) => {
    const { userId, read } = await mine(ctx, readId)
    const work = await ctx.db.get(read.workId)
    const entries = await ctx.db.query('entries').withIndex('by_read', q => q.eq('readId', readId)).collect()
    // Anything still waiting to reach Hardcover for this book is moot now.
    const entryIds = new Set<string>(entries.map(e => e._id))
    const queued = await ctx.db.query('hardcoverOutbox').withIndex('by_user', q => q.eq('userId', userId)).collect()
    for (const row of queued) if (row.readId === readId || (row.entryId && entryIds.has(row.entryId))) await ctx.db.delete(row._id)
    if (read.hardcoverUserBookId) {
      await ctx.db.insert('hardcoverOutbox', { userId, kind: 'deleteBook', userBookId: read.hardcoverUserBookId, bookId: work?.hardcoverId, version: 1, attempts: 0, nextAt: Date.now() })
      await ctx.scheduler.runAfter(0, internal.hardcover.flush, {})
    }
    for (const table of ['progressLog', 'entries', 'buddyTurns', 'buddyQueue', 'corrections', 'reflectionPrompts'] as const) {
      for (const row of await ctx.db.query(table).withIndex('by_read', q => q.eq('readId', readId)).collect()) await ctx.db.delete(row._id)
    }
    await ctx.db.delete(readId)
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

/**
 * The review written on finishing a book: its words and its stars together. The words are the one `review` entry a read
 * has, kept apart from the notes. Both go to Hardcover with the book's next push.
 */
export const saveReview = mutation({
  args: { readId: v.id('reads'), text: v.string(), rating: v.union(v.number(), v.null()) },
  handler: async (ctx, { readId, text, rating }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to change this')
    const read = await ctx.db.get(readId)
    if (!read || read.userId !== userId) throw new ConvexError('That book is not on your shelves')
    if (read.status !== 'read') throw new ConvexError('Finish the book to review it')
    if (rating !== null && !(rating >= 0.5 && rating <= 5 && rating * 2 === Math.round(rating * 2))) throw new ConvexError('A rating is from half a star to five, in half stars')
    const words = text.trim()
    if (words.length > 20000) throw new ConvexError('That is too long for a review')
    const entries = await ctx.db.query('entries').withIndex('by_read', q => q.eq('readId', readId)).collect()
    const review = entries.find(e => e.kind === 'review')
    if (review && words) await ctx.db.patch(review._id, { text: words })
    else if (review) await ctx.db.delete(review._id)
    else if (words) await ctx.db.insert('entries', { userId, readId, kind: 'review', text: words, pos: {}, origin: 'manual', originKey: `margin-review:${readId}`, createdAt: Date.now() })
    await ctx.db.patch(readId, { rating: rating ?? undefined })
    await enqueueRead(ctx, userId, readId)
  },
})

const clean = (s: string) => s.trim().replace(/\s+/g, ' ')

/**
 * The reader's corrections to a book: title, authors, pages, year, genres and topics (Steve, 2026-11-06). Kept on the
 * read, never sent to Hardcover. A field left out, or set back to what Hardcover has, goes back to following Hardcover.
 */
export const editBook = mutation({
  args: {
    readId: v.id('reads'),
    title: v.optional(v.string()),
    authors: v.optional(v.array(v.string())),
    pages: v.optional(v.number()),
    year: v.optional(v.number()),
    genres: v.optional(v.array(v.string())),
    topicsAdded: v.optional(v.array(v.string())),
    topicsRemoved: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { readId, ...change }) => {
    const { read } = await mine(ctx, readId)
    const work = await ctx.db.get(read.workId)
    if (!work) throw new ConvexError('That book is not on your shelves')
    const title = change.title === undefined ? undefined : clean(change.title)
    if (title === '') throw new ConvexError('A book needs a title')
    const authors = change.authors?.map(clean).filter(Boolean)
    if (authors && !authors.length) throw new ConvexError('A book needs an author')
    const whole = (n: number | undefined, what: string, max: number) => {
      if (n !== undefined && !(Number.isInteger(n) && n > 0 && n <= max)) throw new ConvexError(`That isn't a ${what}`)
      return n
    }
    const pages = whole(change.pages, 'page count', 20000)
    const year = whole(change.year, 'year', new Date().getFullYear() + 5)
    const genres = change.genres && [...new Set(change.genres)]
    if (genres?.some(g => !(g in GENRES))) throw new ConvexError("That genre isn't one of Margin's")
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
    const edits = {
      title: title === work.title ? undefined : title,
      authors: authors && !same(authors, work.authors) ? authors : undefined,
      pages: pages === work.pages ? undefined : pages,
      year: year === work.year ? undefined : year,
      genres: genres && !same(genres, genresOf(work.tags, work.subjects)) ? genres : undefined,
      topicsAdded: change.topicsAdded?.map(clean).filter(Boolean),
      topicsRemoved: change.topicsRemoved,
    }
    // No genres is a choice; no topics added or removed is just no edit.
    const kept = Object.fromEntries(Object.entries(edits).filter(([key, value]) => value !== undefined && (key === 'genres' || !Array.isArray(value) || value.length > 0)))
    await ctx.db.patch(readId, { edits: Object.keys(kept).length ? kept : undefined })
  },
})
