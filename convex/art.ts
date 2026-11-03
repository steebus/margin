import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalMutation, internalQuery, mutation, type MutationCtx } from './_generated/server'
import { MAX_HINT } from './lib/artPrompt'

const WORKING_FOR_MS = 5 * 60_000

const artRow = (ctx: MutationCtx, workId: Id<'works'>) => ctx.db.query('workArt').withIndex('by_work', q => q.eq('workId', workId)).first()

async function ownRead(ctx: MutationCtx, readId: Id<'reads'>) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError('Sign in to change this')
  const read = await ctx.db.get(readId)
  if (!read || read.userId !== userId) throw new ConvexError('That book is not on your shelves')
  return read
}

/** Puts a work's current drawing among its past ones, so a new one can take its place without losing it. */
async function keepCurrent(ctx: MutationCtx, row: { workId: Id<'works'>; small?: Id<'_storage'>; large?: Id<'_storage'>; scene?: string; createdAt: number }) {
  if (!row.small || !row.large) return
  const [smallUrl, largeUrl] = await Promise.all([ctx.storage.getUrl(row.small), ctx.storage.getUrl(row.large)])
  if (smallUrl && largeUrl) await ctx.db.insert('pastArt', { workId: row.workId, small: row.small, large: row.large, smallUrl, largeUrl, scene: row.scene, createdAt: row.createdAt })
}

/** Stores a finished drawing against its work. Any earlier one is kept among the past drawings. */
async function storeArt(
  ctx: MutationCtx,
  art: { workId: Id<'works'>; small: Id<'_storage'>; large: Id<'_storage'>; model: string; scene: string; prompt: string },
) {
  const [smallUrl, largeUrl] = await Promise.all([ctx.storage.getUrl(art.small), ctx.storage.getUrl(art.large)])
  if (!smallUrl || !largeUrl) throw new ConvexError('The drawing did not upload')
  const row = await artRow(ctx, art.workId)
  const fields = { state: 'ready' as const, small: art.small, large: art.large, model: art.model, scene: art.scene, prompt: art.prompt, error: undefined, createdAt: Date.now() }
  if (row) {
    await keepCurrent(ctx, row)
    await ctx.db.patch(row._id, fields)
  } else {
    await ctx.db.insert('workArt', { workId: art.workId, ...fields })
  }
  await ctx.db.patch(art.workId, { artSmallUrl: smallUrl, artLargeUrl: largeUrl })
}

// ---------- The reader's choices ----------

/** Draws a new picture for this book, with an optional direction. The old one stays until the new one is ready. */
export const regenerate = mutation({
  args: { readId: v.id('reads'), hint: v.optional(v.string()) },
  handler: async (ctx, { readId, hint }) => {
    const read = await ownRead(ctx, readId)
    const direction = hint?.trim() || undefined
    if (direction && direction.length > MAX_HINT) throw new ConvexError(`Keep the direction under ${MAX_HINT} characters`)
    const row = await artRow(ctx, read.workId)
    const now = Date.now()
    if (row?.state === 'queued' && now - row.createdAt < WORKING_FOR_MS) throw new ConvexError('A new drawing is already on its way')
    if (row) await ctx.db.patch(row._id, { state: 'queued', error: undefined, createdAt: now })
    else await ctx.db.insert('workArt', { workId: read.workId, state: 'queued', createdAt: now })
    await ctx.db.patch(readId, { artChoice: 'drawing' })
    await ctx.scheduler.runAfter(0, internal.artNode.generate, { workId: read.workId, hint: direction })
  },
})

/** Switches between the drawing and the cross-hatch of the real cover. Nothing is deleted either way. */
export const setArtChoice = mutation({
  args: { readId: v.id('reads'), choice: v.union(v.literal('drawing'), v.literal('cover')) },
  handler: async (ctx, { readId, choice }) => {
    await ownRead(ctx, readId)
    await ctx.db.patch(readId, { artChoice: choice })
  },
})

/** Puts a past drawing back on the cover. The one it replaces is kept in its place among the past ones. */
export const chooseArt = mutation({
  args: { readId: v.id('reads'), pastId: v.id('pastArt') },
  handler: async (ctx, { readId, pastId }) => {
    const read = await ownRead(ctx, readId)
    const past = await ctx.db.get(pastId)
    const row = await artRow(ctx, read.workId)
    if (!past || past.workId !== read.workId || !row) throw new ConvexError('That drawing does not belong to this book')
    await keepCurrent(ctx, row)
    await ctx.db.patch(row._id, { state: 'ready', small: past.small, large: past.large, scene: past.scene, error: undefined, createdAt: past.createdAt })
    await ctx.db.delete(pastId)
    await ctx.db.patch(read.workId, { artSmallUrl: past.smallUrl, artLargeUrl: past.largeUrl })
    await ctx.db.patch(readId, { artChoice: 'drawing' })
  },
})

// ---------- Used by the generator ----------

export const bookFacts = internalQuery({
  args: { workId: v.id('works') },
  handler: async (ctx, { workId }) => {
    const work = await ctx.db.get(workId)
    const row = await ctx.db.query('workArt').withIndex('by_work', q => q.eq('workId', workId)).first()
    const others = await ctx.db.query('workArt').withIndex('by_state', q => q.eq('state', 'ready')).order('desc').take(40)
    return work && {
      title: work.title,
      authors: work.authors,
      year: work.year,
      subjects: work.subjects,
      previous: row?.scene,
      avoid: others.filter(o => o.workId !== workId).map(o => o.scene).filter((s): s is string => !!s),
    }
  },
})

export const uploadUrl = internalMutation({ args: {}, handler: ctx => ctx.storage.generateUploadUrl() })

export const saveArt = internalMutation({
  args: { workId: v.id('works'), small: v.id('_storage'), large: v.id('_storage'), model: v.string(), scene: v.string(), prompt: v.string() },
  handler: (ctx, art) => storeArt(ctx, art),
})

/** A failed attempt keeps any earlier drawing. With none, the book carries on showing its cross-hatch. */
export const artFailed = internalMutation({
  args: { workId: v.id('works'), error: v.string() },
  handler: async (ctx, { workId, error }) => {
    const row = await artRow(ctx, workId)
    if (row) await ctx.db.patch(row._id, { state: 'failed', error: error.slice(0, 200) })
  },
})

// ---------- Used by the bulk script, through the Convex CLI ----------

/** Every work on someone's shelves with no finished drawing. */
export const needingArt = internalQuery({
  args: {},
  handler: async ctx => {
    const works = await ctx.db.query('works').collect()
    const done = new Set((await ctx.db.query('workArt').withIndex('by_state', q => q.eq('state', 'ready')).collect()).map(r => r.workId))
    return works.filter(w => !done.has(w._id)).map(w => ({ workId: w._id, title: w.title, authors: w.authors, year: w.year, subjects: w.subjects }))
  },
})

export const uploadUrls = internalMutation({
  args: { count: v.number() },
  handler: (ctx, { count }) => Promise.all(Array.from({ length: Math.min(count, 100) }, () => ctx.storage.generateUploadUrl())),
})

export const saveMany = internalMutation({
  args: {
    items: v.array(v.object({ workId: v.id('works'), small: v.id('_storage'), large: v.id('_storage'), model: v.string(), scene: v.string(), prompt: v.string() })),
  },
  handler: async (ctx, { items }) => {
    for (const item of items) await storeArt(ctx, item)
    return items.length
  },
})
