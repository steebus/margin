import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action, internalQuery, mutation, query, type MutationCtx } from './_generated/server'
import { datesFrom, readingsAfter } from './lib/books'
import { slugify } from './lib/hardcover'
import { enqueueAdd, enqueueList } from './lib/outbox'
import { searchHardcover, type Found } from './hardcover'

const status = v.union(v.literal('tbr'), v.literal('reading'), v.literal('paused'), v.literal('read'), v.literal('dnf'))
const hit = v.object({
  hardcoverId: v.number(),
  slug: v.string(),
  title: v.string(),
  authors: v.array(v.string()),
  year: v.optional(v.number()),
  isbns: v.array(v.string()),
  coverUrl: v.optional(v.string()),
  pages: v.optional(v.number()),
  subjects: v.array(v.string()),
})
const source = v.object({
  kind: v.union(v.literal('social'), v.literal('person'), v.literal('other')),
  who: v.optional(v.string()),
  url: v.optional(v.string()),
})

export const shelved = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const reads = await ctx.db.query('reads').withIndex('by_user_status', q => q.eq('userId', userId)).collect()
    const works = await Promise.all(reads.map(read => ctx.db.get(read.workId)))
    return works.flatMap(work => (work?.hardcoverId ? [work.hardcoverId] : []))
  },
})

/** Finds books on Hardcover, most read first, saying which are on the reader's shelves already. */
export const search = action({
  args: { q: v.string() },
  handler: async (ctx, { q }): Promise<{ book: Found; onShelves: boolean }[]> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to search')
    const words = q.trim()
    if (!words) return []
    const [found, mine] = await Promise.all([searchHardcover(words), ctx.runQuery(internal.books.shelved, { userId })])
    return found.map(book => ({ book, onShelves: mine.includes(book.hardcoverId) }))
  },
})

/** Finds or makes the person a recommendation came from, so what came from them can be gathered up (SPEC 3.1). */
async function personFor(ctx: MutationCtx, userId: Id<'users'>, name: string) {
  const known = await ctx.db.query('people').withIndex('by_user_name', q => q.eq('userId', userId).eq('name', name)).first()
  return known?._id ?? ctx.db.insert('people', { userId, name, slug: slugify(name) || 'someone' })
}

/**
 * Puts books on the reader's shelves, and sends them to Hardcover. Safe to repeat: a book already here stays as it
 * is. Saving never waits on Hardcover. It's an outbox row that retries, like every other change.
 */
export const addBooks = mutation({
  args: { books: v.array(hit), status, listId: v.optional(v.id('shelves')), source: v.optional(source) },
  handler: async (ctx, { books, status: wanted, listId, source: from }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to add a book')
    const list = listId && await ctx.db.get(listId)
    if (listId && list?.userId !== userId) throw new ConvexError('That list is not yours')
    const who = from?.who?.trim()
    const personId = who ? await personFor(ctx, userId, who) : undefined
    const now = Date.now()
    const results: { slug: string; added: boolean }[] = []

    for (const book of books) {
      const known = await ctx.db.query('works').withIndex('by_hardcover', q => q.eq('hardcoverId', book.hardcoverId)).first()
      const workId = known?._id ?? await ctx.db.insert('works', book)
      const mine = await ctx.db.query('reads').withIndex('by_user_work', q => q.eq('userId', userId).eq('workId', workId)).first()
      let readId = mine?._id
      if (!readId) {
        const readings = readingsAfter([], wanted, now)
        readId = await ctx.db.insert('reads', {
          userId,
          workId,
          status: wanted,
          addedAt: now,
          ...datesFrom(readings, wanted),
          readings,
          progress: { percent: wanted === 'read' ? 100 : 0 },
          format: 'print',
          source: from ? { kind: from.kind, who, personId, url: from.url, date: now } : undefined,
          tagIds: [],
          shelfIds: [],
        })
        await enqueueAdd(ctx, userId, readId)
      }
      const read = (await ctx.db.get(readId))!
      if (listId && !read.shelfIds.includes(listId)) {
        await ctx.db.patch(readId, { shelfIds: [...read.shelfIds, listId] })
        await enqueueList(ctx, userId, readId, listId, true)
      }
      results.push({ slug: known?.slug ?? book.slug, added: !mine })
    }
    return results
  },
})

/** The reader's lists. */
export const myLists = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const rows = await ctx.db.query('shelves').withIndex('by_user_slug', q => q.eq('userId', userId)).collect()
    return rows.map(s => ({ id: s._id, slug: s.slug, name: s.name })).sort((a, b) => a.name.localeCompare(b.name))
  },
})

export const setOnList = mutation({
  args: { readId: v.id('reads'), listId: v.id('shelves'), on: v.boolean() },
  handler: async (ctx, { readId, listId, on }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to change this')
    const [read, list] = await Promise.all([ctx.db.get(readId), ctx.db.get(listId)])
    if (!read || read.userId !== userId || !list || list.userId !== userId) throw new ConvexError('That is not yours')
    if (read.shelfIds.includes(listId) === on) return
    await ctx.db.patch(readId, { shelfIds: on ? [...read.shelfIds, listId] : read.shelfIds.filter(id => id !== listId) })
    await enqueueList(ctx, userId, readId, listId, on)
  },
})
