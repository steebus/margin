import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, internalQuery, mutation, type MutationCtx, type QueryCtx } from './_generated/server'
import { GUIDE_VERSION, type Depth } from './lib/guide'

// A guide that hasn't arrived after this long has failed somewhere, and the buddy stops waiting for it.
export const GUIDE_WAIT_MS = 10 * 60_000

const rank = (g: Doc<'guides'>) => (g.state === 'ready' ? 4 : g.state === 'writing' ? 2 : 0) + (depthOf(g) === 'deep' ? 1 : 0)
export const depthOf = (g: Doc<'guides'>): Depth => g.depth ?? 'deep'

/** The work's best guide: a ready one over one being written, deep over light, and a failed one only if that's all. */
export async function guideFor(ctx: QueryCtx, workId: Id<'works'>) {
  const all = await ctx.db.query('guides').withIndex('by_work', q => q.eq('workId', workId)).collect()
  return all.sort((x, y) => rank(y) - rank(x) || y.createdAt - x.createdAt)[0] ?? null
}

/** Starts the research the reader chose. Nothing if the book already has a guide at least that deep, or one on its way. */
export async function requestGuide(ctx: MutationCtx, userId: Id<'users'>, read: Doc<'reads'>, depth: Depth) {
  const all = await ctx.db.query('guides').withIndex('by_work', q => q.eq('workId', read.workId)).collect()
  const live = all.filter(g => g.state !== 'failed')
  if (live.some(g => g.state === 'writing' || depthOf(g) === 'deep' || depth === 'light')) return
  const guideId = await ctx.db.insert('guides', { workId: read.workId, userId, state: 'writing', depth, version: GUIDE_VERSION, createdAt: Date.now() })
  await ctx.scheduler.runAfter(0, internal.guideNode.write, { guideId })
}

const depth = v.union(v.literal('light'), v.literal('deep'))

/** The reader opts into a guide for a book, or goes deeper on one. Costs real money; the buddy page says how much. */
export const request = mutation({
  args: { readId: v.id('reads'), depth },
  handler: async (ctx, { readId, depth }) => {
    const userId = await getAuthUserId(ctx)
    const read = await ctx.db.get(readId)
    if (!userId || !read || read.userId !== userId) throw new ConvexError('That book is not on your shelves')
    await requestGuide(ctx, userId, read, depth)
  },
})

/** Whether the buddy should hold its reply for a guide still being written. */
export const stillWriting = (guide: Doc<'guides'> | null, now: number) =>
  guide?.state === 'writing' && now - guide.createdAt < GUIDE_WAIT_MS

export const facts = internalQuery({
  args: { guideId: v.id('guides') },
  handler: async (ctx, { guideId }) => {
    const guide = await ctx.db.get(guideId)
    const work = guide && await ctx.db.get(guide.workId)
    if (!work) return null
    return { title: work.title, authors: work.authors, year: work.year, pages: work.pages, isbn: work.isbns[0], depth: depthOf(guide!) }
  },
})

const usage = v.object({ input: v.number(), output: v.number(), cacheRead: v.number(), cacheWrite: v.number(), searches: v.number() })

export const save = internalMutation({
  args: { guideId: v.id('guides'), guide: v.optional(v.any()), error: v.optional(v.string()), usage },
  handler: async (ctx, { guideId, guide, error, usage }) => {
    await ctx.db.patch(guideId, guide ? { state: 'ready', guide, usage } : { state: 'failed', error, usage })
  },
})

/**
 * Researches a guide by hand, for any book, finished ones included: for the eval set, where a reader who knows the
 * ending checks what each position lets through. `convex run guides:research '{readId, depth}'`.
 */
export const research = internalMutation({
  args: { readId: v.id('reads'), depth },
  handler: async (ctx, { readId, depth }) => {
    const read = await ctx.db.get(readId)
    if (!read) return
    // Unlike a reader's request, a deeper guide doesn't stop a lighter one: the eval compares them side by side.
    const all = await ctx.db.query('guides').withIndex('by_work', q => q.eq('workId', read.workId)).collect()
    if (all.some(g => g.state !== 'failed' && depthOf(g) === depth)) return
    const guideId = await ctx.db.insert('guides', { workId: read.workId, userId: read.userId, state: 'writing', depth, version: GUIDE_VERSION, createdAt: Date.now() })
    await ctx.scheduler.runAfter(0, internal.guideNode.write, { guideId })
  },
})

/** A guide as stored, for the eval script: the book's best, or the one at the depth asked for. */
export const show = internalQuery({
  args: { readId: v.id('reads'), depth: v.optional(depth) },
  handler: async (ctx, { readId, depth: wanted }) => {
    const read = await ctx.db.get(readId)
    const work = read && await ctx.db.get(read.workId)
    if (!work) return null
    const all = await ctx.db.query('guides').withIndex('by_work', q => q.eq('workId', work._id)).collect()
    const guide = wanted ? all.filter(g => depthOf(g) === wanted).sort((x, y) => y.createdAt - x.createdAt)[0] : await guideFor(ctx, work._id)
    return guide && { title: work.title, author: work.authors[0] ?? 'Unknown', depth: depthOf(guide), state: guide.state, guide: guide.guide ?? null, error: guide.error ?? null, usage: guide.usage ?? null }
  },
})
