import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from './_generated/server'
import { GUIDE_VERSION } from './lib/guide'

// A guide that hasn't arrived after this long has failed somewhere, and the buddy stops waiting for it.
export const GUIDE_WAIT_MS = 10 * 60_000

export const guideFor = (ctx: QueryCtx, workId: Id<'works'>) =>
  ctx.db.query('guides').withIndex('by_work', q => q.eq('workId', workId)).first()

/** Starts the research for a book that has no guide yet. Finished books never get one (SPEC 3.5). */
export async function requestGuide(ctx: MutationCtx, userId: Id<'users'>, read: Doc<'reads'>) {
  const finished = read.status === 'read' || !!read.finishedAt || !!read.readings?.some(r => r.finishedAt)
  if (finished || await guideFor(ctx, read.workId)) return
  const guideId = await ctx.db.insert('guides', { workId: read.workId, userId, state: 'writing', version: GUIDE_VERSION, createdAt: Date.now() })
  await ctx.scheduler.runAfter(0, internal.guideNode.write, { guideId })
}

/** Whether the buddy should hold its reply for a guide still being written. */
export const stillWriting = (guide: Doc<'guides'> | null, now: number) =>
  guide?.state === 'writing' && now - guide.createdAt < GUIDE_WAIT_MS

export const facts = internalQuery({
  args: { guideId: v.id('guides') },
  handler: async (ctx, { guideId }) => {
    const guide = await ctx.db.get(guideId)
    const work = guide && await ctx.db.get(guide.workId)
    if (!work) return null
    return { title: work.title, authors: work.authors, year: work.year, pages: work.pages, isbn: work.isbns[0] }
  },
})

const usage = v.object({ input: v.number(), output: v.number(), cacheRead: v.number(), cacheWrite: v.number(), searches: v.number() })

export const save = internalMutation({
  args: { guideId: v.id('guides'), guide: v.optional(v.any()), error: v.optional(v.string()), usage },
  handler: async (ctx, { guideId, guide, error, usage }) => {
    await ctx.db.patch(guideId, guide ? { state: 'ready', guide, usage } : { state: 'failed', error, usage })
  },
})

/** Researches a guide ahead of time, for a book being read. Run by hand: `convex run guides:prepare`. */
export const prepare = internalMutation({
  args: { readId: v.id('reads') },
  handler: async (ctx, { readId }) => {
    const read = await ctx.db.get(readId)
    if (read) await requestGuide(ctx, read.userId, read)
  },
})

/**
 * For the eval set: researches a guide for any book, finished ones included, so a reader who knows the ending can
 * check what each position would let through. Costs about 87 cents. Run by hand: `convex run guides:research`.
 */
export const research = internalMutation({
  args: { readId: v.id('reads') },
  handler: async (ctx, { readId }) => {
    const read = await ctx.db.get(readId)
    if (!read || await guideFor(ctx, read.workId)) return
    const guideId = await ctx.db.insert('guides', { workId: read.workId, userId: read.userId, state: 'writing', version: GUIDE_VERSION, createdAt: Date.now() })
    await ctx.scheduler.runAfter(0, internal.guideNode.write, { guideId })
  },
})

/** A guide as stored, for the eval script. */
export const show = internalQuery({
  args: { readId: v.id('reads') },
  handler: async (ctx, { readId }) => {
    const read = await ctx.db.get(readId)
    const work = read && await ctx.db.get(read.workId)
    const guide = work && await guideFor(ctx, work._id)
    return guide && { title: work.title, author: work.authors[0] ?? 'Unknown', state: guide.state, guide: guide.guide ?? null, error: guide.error ?? null, usage: guide.usage ?? null }
  },
})
