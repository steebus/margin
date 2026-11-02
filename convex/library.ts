import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { positionOf, toBook } from './lib/books'

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
    return {
      book: toBook(read, work),
      entries: entries.map(e => ({ id: e._id, kind: e.kind, text: e.text, position: positionOf(e.pos) })),
    }
  },
})

/** The newest entries across the whole library, for the Desk and the drawer. */
export const recentEntries = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const entries = await ctx.db.query('entries').withIndex('by_user', q => q.eq('userId', userId)).order('desc').take(200)
    return Promise.all(entries.map(async e => {
      const read = await ctx.db.get(e.readId)
      const work = read && await ctx.db.get(read.workId)
      const position = positionOf(e.pos)
      return {
        id: e._id,
        kind: e.kind,
        text: e.text,
        where: [work?.title, position].filter(Boolean).join(', '),
        slug: work?.slug ?? null,
      }
    }))
  },
})

export const logProgress = mutation({
  args: { readId: v.id('reads'), percent: v.number() },
  handler: async (ctx, { readId, percent }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to log progress')
    const read = await ctx.db.get(readId)
    if (!read || read.userId !== userId) throw new ConvexError('That book is not on your shelves')
    if (!Number.isFinite(percent)) throw new ConvexError('Progress must be a number')
    const clamped = Math.min(100, Math.max(0, Math.round(percent)))
    const work = await ctx.db.get(read.workId)
    const page = work?.pages ? Math.round((clamped / 100) * work.pages) : undefined
    await ctx.db.patch(readId, { progress: { percent: clamped, page } })
    await ctx.db.insert('progressLog', { userId, readId, at: Date.now(), percent: clamped, page, origin: 'manual' })
  },
})
