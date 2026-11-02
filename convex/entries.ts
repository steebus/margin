import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { mutation } from './_generated/server'
import { entryKey } from './lib/entryKey'
import { enqueueEntry, enqueueJournalDelete } from './lib/outbox'

const MAX_LENGTH = 20_000

export const addEntry = mutation({
  args: {
    readId: v.id('reads'),
    kind: v.union(v.literal('excerpt'), v.literal('note'), v.literal('summary')),
    text: v.string(),
    page: v.optional(v.number()),
    percent: v.optional(v.number()),
  },
  handler: async (ctx, { readId, kind, text, page, percent }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to save this')
    const read = await ctx.db.get(readId)
    if (!read || read.userId !== userId) throw new ConvexError('That book is not on your shelves')
    const words = text.trim()
    if (!words) throw new ConvexError('There are no words to save')
    if (words.length > MAX_LENGTH) throw new ConvexError('That is too long to save as one entry')
    if (page !== undefined && !(Number.isInteger(page) && page > 0)) throw new ConvexError('The page must be a whole number')
    if (percent !== undefined && !(percent >= 0 && percent <= 100)) throw new ConvexError('The percentage must be between 0 and 100')

    const pos = { page, percent }
    const originKey = entryKey(read.workId, kind, words, pos)
    const same = await ctx.db.query('entries').withIndex('by_user_origin_key', q => q.eq('userId', userId).eq('originKey', originKey)).first()
    if (same) return { id: same._id, duplicate: true }
    const id = await ctx.db.insert('entries', { userId, readId, kind, text: words, pos, origin: 'manual', originKey, createdAt: Date.now() })
    await enqueueEntry(ctx, userId, id, readId)
    return { id, duplicate: false }
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
    await ctx.db.delete(id)
  },
})
