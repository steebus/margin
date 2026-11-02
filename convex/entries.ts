import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { positionOf, toBook } from './lib/books'
import { entryKey } from './lib/entryKey'
import { enqueueEntry, enqueueJournalDelete } from './lib/outbox'

const MAX_LENGTH = 20_000

const checkPosition = (page?: number, percent?: number) => {
  if (page !== undefined && !(Number.isInteger(page) && page > 0)) throw new ConvexError('The page must be a whole number')
  if (percent !== undefined && !(percent >= 0 && percent <= 100)) throw new ConvexError('The percentage must be between 0 and 100')
}

/** One entry, with its book and the notes attached to it. Null when it isn't the reader's. */
export const entry = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const entryId = ctx.db.normalizeId('entries', id)
    const e = entryId && await ctx.db.get(entryId)
    if (!e || e.userId !== userId) return null
    const read = await ctx.db.get(e.readId)
    const work = read && await ctx.db.get(read.workId)
    if (!read || !work) return null
    const parent = e.parentId ? await ctx.db.get(e.parentId) : null
    const children = await ctx.db.query('entries').withIndex('by_read', q => q.eq('readId', e.readId)).filter(q => q.eq(q.field('parentId'), e._id)).collect()
    const brief = (x: Doc<'entries'>) => ({ id: x._id, kind: x.kind, text: x.text, position: positionOf(x.pos) })
    return {
      id: e._id,
      kind: e.kind,
      text: e.text,
      question: e.question ?? null,
      page: e.pos.page ?? null,
      percent: e.pos.percent ?? null,
      chapter: e.pos.chapter ?? null,
      position: positionOf(e.pos),
      createdAt: e.createdAt,
      origin: e.origin,
      book: toBook(read, work),
      parent: parent && brief(parent),
      children: children.map(brief),
    }
  },
})

export const addEntry = mutation({
  args: {
    readId: v.id('reads'),
    kind: v.union(v.literal('excerpt'), v.literal('note'), v.literal('summary')),
    text: v.string(),
    page: v.optional(v.number()),
    percent: v.optional(v.number()),
    chapter: v.optional(v.string()),
    origin: v.optional(v.literal('camera')),
    // The excerpt this note belongs to.
    parentId: v.optional(v.id('entries')),
  },
  handler: async (ctx, { readId, kind, text, page, percent, chapter, origin, parentId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to save this')
    const read = await ctx.db.get(readId)
    if (!read || read.userId !== userId) throw new ConvexError('That book is not on your shelves')
    const words = text.trim()
    if (!words) throw new ConvexError('There are no words to save')
    if (words.length > MAX_LENGTH) throw new ConvexError('That is too long to save as one entry')
    checkPosition(page, percent)

    if (parentId) {
      const parent = await ctx.db.get(parentId)
      if (!parent || parent.readId !== readId) throw new ConvexError('That excerpt is not on this book')
    }

    const pos = { page, percent, chapter }
    const originKey = entryKey(read.workId, kind, words, pos)
    const same = await ctx.db.query('entries').withIndex('by_user_origin_key', q => q.eq('userId', userId).eq('originKey', originKey)).first()
    if (same) return { id: same._id, duplicate: true }
    const id = await ctx.db.insert('entries', { userId, readId, kind, text: words, parentId, pos, origin: origin ?? 'manual', originKey, createdAt: Date.now() })
    await enqueueEntry(ctx, userId, id, readId)
    return { id, duplicate: false }
  },
})

/**
 * Rewrites an entry's words or place. Hardcover has no edit for a journal entry that Margin can rely on,
 * so a changed entry there is taken down and sent again (SPEC 3.5).
 */
export const updateEntry = mutation({
  args: {
    id: v.id('entries'),
    text: v.string(),
    kind: v.optional(v.union(v.literal('excerpt'), v.literal('note'), v.literal('summary'))),
    page: v.optional(v.number()),
    percent: v.optional(v.number()),
    chapter: v.optional(v.string()),
  },
  handler: async (ctx, { id, text, kind, page, percent, chapter }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to change this')
    const entry = await ctx.db.get(id)
    if (!entry || entry.userId !== userId) throw new ConvexError('That entry is not yours')
    if (entry.kind === 'review') throw new ConvexError('Change your review on Hardcover')
    const words = text.trim()
    if (!words) throw new ConvexError('There are no words to save')
    if (words.length > MAX_LENGTH) throw new ConvexError('That is too long to save as one entry')
    checkPosition(page, percent)
    // A reflection stays a reflection: it keeps the question it answers.
    const nextKind = entry.kind === 'reflection' ? entry.kind : kind ?? entry.kind
    const pos = { ...entry.pos, page, percent, chapter: chapter?.trim() || undefined }
    const same = entry.text === words && entry.kind === nextKind
      && entry.pos.page === pos.page && entry.pos.percent === pos.percent && entry.pos.chapter === pos.chapter
    if (same) return

    const read = await ctx.db.get(entry.readId)
    if (!read) throw new ConvexError('That book is not on your shelves')
    const originKey = entryKey(read.workId, nextKind, words, pos)
    const other = await ctx.db.query('entries').withIndex('by_user_origin_key', q => q.eq('userId', userId).eq('originKey', originKey)).first()
    if (other && other._id !== id) throw new ConvexError('You already have that entry')

    await enqueueJournalDelete(ctx, userId, id, entry.hardcoverJournalId)
    await ctx.db.patch(id, { text: words, kind: nextKind, pos, originKey, hardcoverJournalId: undefined })
    await enqueueEntry(ctx, userId, id, entry.readId)
  },
})

export const removeEntry = mutation({
  args: { id: v.id('entries') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to change this')
    const entry = await ctx.db.get(id)
    if (!entry || entry.userId !== userId) throw new ConvexError('That entry is not yours')
    if (entry.kind === 'review') throw new ConvexError('Change your review on Hardcover')
    await enqueueJournalDelete(ctx, userId, id, entry.hardcoverJournalId)
    // Notes on a deleted excerpt are still the reader's thoughts, so they stay, on their own.
    const children = await ctx.db.query('entries').withIndex('by_read', q => q.eq('readId', entry.readId)).filter(q => q.eq(q.field('parentId'), id)).collect()
    for (const child of children) await ctx.db.patch(child._id, { parentId: undefined })
    await ctx.db.delete(id)
  },
})
