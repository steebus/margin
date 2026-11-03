import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from './_generated/server'
import { positionOf } from './lib/books'
import { bookPack, costOf, MAX_NOTES, SPEND_ALERT, toMessages, visibleTo, type Found } from './lib/buddy'
import { guideCost, guideText, guideUpTo, type Guide } from './lib/guide'
import { depthOf, guideFor, stillWriting } from './guides'

const MAX_LENGTH = 10_000

const turnsOf = (ctx: { db: MutationCtx['db'] | { query: MutationCtx['db']['query'] } }, readId: Id<'reads'>) =>
  ctx.db.query('buddyTurns').withIndex('by_read', q => q.eq('readId', readId)).collect()

/** The conversation about one book, and whether the buddy is able to answer. */
export const thread = query({
  args: { readId: v.id('reads') },
  handler: async (ctx, { readId }) => {
    const userId = await getAuthUserId(ctx)
    const read = await ctx.db.get(readId)
    if (!userId || read?.userId !== userId) return null
    const turns = await turnsOf(ctx, readId)
    const guide = await guideFor(ctx, read.workId)
    return {
      ready: !!process.env.ANTHROPIC_API_KEY,
      // The book's guide, which the reader opts into (lib/guide.ts DEPTHS). Null when there isn't one.
      guide: guide && { depth: depthOf(guide), state: guide.state },
      turns: turns.map(t => ({ id: t._id, role: t.role, text: t.text, state: t.state })),
    }
  },
})

async function mine(ctx: MutationCtx, readId: Id<'reads'>) {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError('Sign in to talk about this book')
  const read = await ctx.db.get(readId)
  if (!read || read.userId !== userId) throw new ConvexError('That book is not on your shelves')
  return { userId, read }
}

/** A reply on its way. Only one at a time, or the conversation would talk over itself. */
async function ask(ctx: MutationCtx, userId: Id<'users'>, readId: Id<'reads'>) {
  const turnId = await ctx.db.insert('buddyTurns', { userId, readId, role: 'buddy', text: '', state: 'writing', createdAt: Date.now() })
  await ctx.scheduler.runAfter(0, internal.buddyNode.reply, { turnId })
}

const busy = (turns: Doc<'buddyTurns'>[]) => turns.some(t => t.state === 'writing')

/** The buddy's opening question, when the reader asks for it. Never automatic, because every reply costs money. */
export const start = mutation({
  args: { readId: v.id('reads') },
  handler: async (ctx, { readId }) => {
    const { userId } = await mine(ctx, readId)
    if ((await turnsOf(ctx, readId)).length) return
    await ask(ctx, userId, readId)
  },
})

export const say = mutation({
  args: { readId: v.id('reads'), text: v.string() },
  handler: async (ctx, { readId, text }) => {
    const { userId } = await mine(ctx, readId)
    const words = text.trim()
    if (!words) throw new ConvexError('There are no words to send')
    if (words.length > MAX_LENGTH) throw new ConvexError('That is too long to send in one go')
    if (busy(await turnsOf(ctx, readId))) throw new ConvexError('Your buddy is still answering')
    await ctx.db.insert('buddyTurns', { userId, readId, role: 'reader', text: words, state: 'done', createdAt: Date.now() })
    await ask(ctx, userId, readId)
  },
})

/** Tries again after a reply failed. The failed one stays out of the conversation. */
export const retry = mutation({
  args: { readId: v.id('reads') },
  handler: async (ctx, { readId }) => {
    const { userId } = await mine(ctx, readId)
    const turns = await turnsOf(ctx, readId)
    if (busy(turns)) return
    for (const turn of turns) if (turn.state === 'failed') await ctx.db.delete(turn._id)
    await ask(ctx, userId, readId)
  },
})

/** Everything the reply needs. The spoiler rule is applied here, on the server, from the read itself. */
export const context = internalQuery({
  args: { turnId: v.id('buddyTurns') },
  handler: async (ctx, { turnId }) => {
    const turn = await ctx.db.get(turnId)
    const read = turn && await ctx.db.get(turn.readId)
    const work = read && await ctx.db.get(read.workId)
    if (!turn || !read || !work) return null
    const entries = await ctx.db.query('entries').withIndex('by_read', q => q.eq('readId', read._id)).order('desc').take(MAX_NOTES)
    const reads = await ctx.db.query('reads').withIndex('by_user_status', q => q.eq('userId', read.userId).eq('status', 'read')).collect()
    const otherBooks = (await Promise.all(reads.filter(r => r._id !== read._id).map(async r => {
      const other = await ctx.db.get(r.workId)
      return other && { title: other.title, author: other.authors[0] ?? 'Unknown', rating: r.rating }
    }))).filter(b => b !== null)
    const turns = (await turnsOf(ctx, read._id)).filter(t => t._id !== turnId)
    const visibility = visibleTo(read)
    const guide = await guideFor(ctx, work._id)
    return {
      waitForGuide: stillWriting(guide, Date.now()),
      // The spoiler rule, in the data: the guide is cut at the reader's place before the model ever sees it.
      guide: guide?.state === 'ready' ? guideText(guideUpTo(guide.guide as Guide, visibility), visibility.finished) : null,
      pack: bookPack({
        title: work.title,
        authors: work.authors,
        year: work.year,
        subjects: work.subjects,
        visibility,
        notes: entries.map(e => ({ kind: e.kind, text: e.text, position: positionOf(e.pos), question: e.question })),
        otherBooks,
      }),
      messages: toMessages(turns),
    }
  },
})

const FOUND_LIMIT = 8

/** search_entries, for the buddy: the reader's own writing, across every book, best match first. */
export const searchEntries = internalQuery({
  args: { turnId: v.id('buddyTurns'), query: v.string() },
  handler: async (ctx, { turnId, query }): Promise<Found[]> => {
    const turn = await ctx.db.get(turnId)
    const read = turn && await ctx.db.get(turn.readId)
    const words = query.trim().slice(0, 200)
    if (!read || !words) return []
    const entries = await ctx.db.query('entries')
      .withSearchIndex('search_text', q => q.search('text', words).eq('userId', read.userId))
      .take(FOUND_LIMIT)
    return Promise.all(entries.map(async e => {
      const other = await ctx.db.get(e.readId)
      const work = other && await ctx.db.get(other.workId)
      return { title: work?.title ?? 'Unknown', author: work?.authors[0] ?? 'Unknown', kind: e.kind, text: e.text, position: positionOf(e.pos), current: other?.workId === read.workId }
    }))
  },
})

export const writeSoFar = internalMutation({
  args: { turnId: v.id('buddyTurns'), text: v.string() },
  handler: async (ctx, { turnId, text }) => {
    await ctx.db.patch(turnId, { text })
  },
})

export const finishTurn = internalMutation({
  args: {
    turnId: v.id('buddyTurns'),
    text: v.string(),
    state: v.union(v.literal('done'), v.literal('failed')),
    usage: v.optional(v.object({ input: v.number(), output: v.number(), cacheRead: v.number(), cacheWrite: v.number() })),
  },
  handler: async (ctx, { turnId, text, state, usage }) => {
    await ctx.db.patch(turnId, { text, state, usage })
  },
})

/** For Settings: what the buddy has cost this calendar month, and whether it has passed the agreed alert. */
export const monthSpend = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const now = new Date()
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    const turns = await ctx.db.query('buddyTurns').withIndex('by_user', q => q.eq('userId', userId).gte('createdAt', start)).collect()
    const guides = await ctx.db.query('guides').withIndex('by_user', q => q.eq('userId', userId).gte('createdAt', start)).collect()
    const dollars = turns.reduce((sum, t) => sum + (t.usage ? costOf(t.usage) : 0), 0)
      + guides.reduce((sum, g) => sum + (g.usage ? guideCost(g.usage, depthOf(g)) : 0), 0)
    return { dollars, alert: SPEND_ALERT, over: dollars >= SPEND_ALERT }
  },
})
