import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from './_generated/server'
import { positionOf } from './lib/books'
import { bookPack, CORRECTION_WORDS, costOf, LAG_STEP, MAX_LAG, MAX_NOTES, SPEND_ALERT, toMessages, topicsLine, visibleTo, type Found, type TopicFound } from './lib/buddy'
import { topicKey } from './lib/topics'
import { libraryTopics } from './topics'
import { guideCost, guideText, guideUpTo, type Guide } from './lib/guide'
import { depthOf, guideFor, stillWriting } from './guides'
import { entryKey } from './lib/entryKey'
import { enqueueEntry } from './lib/outbox'

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

/**
 * Keeps one question and the reader's answer to it as a note on the book, at the place that set the buddy asking:
 * its milestone when it came from one, else where the reader is now. Saved only when the reader chooses to.
 */
export const saveExchange = mutation({
  args: { turnId: v.id('buddyTurns') },
  handler: async (ctx, { turnId }) => {
    const answer = await ctx.db.get(turnId)
    if (!answer || answer.role !== 'reader' || answer.state !== 'done') throw new ConvexError('There is nothing there to save')
    const { userId, read } = await mine(ctx, answer.readId)
    const turns = await turnsOf(ctx, read._id)
    const at = turns.findIndex(t => t._id === turnId)
    const question = turns.slice(0, at).findLast(t => t.role === 'buddy' && t.state === 'done')
    if (!question) throw new ConvexError('There is no question to save with that')
    const milestone = (await ctx.db.query('buddyQueue').withIndex('by_read', q => q.eq('readId', read._id)).collect()).find(n => n.text === question.text)
    const here = read.progress.percent > 0 && read.progress.percent < 100 ? read.progress.percent : undefined
    const percent = milestone?.percent ?? here
    const pos = percent === undefined ? {} : { percent }
    const originKey = entryKey(read.workId, 'note', `${question.text}\n${answer.text}`, pos)
    const same = await ctx.db.query('entries').withIndex('by_user_origin_key', q => q.eq('userId', userId).eq('originKey', originKey)).first()
    if (same) return { id: same._id, duplicate: true }
    const id = await ctx.db.insert('entries', { userId, readId: read._id, kind: 'note', text: answer.text, question: question.text, pos, origin: 'manual', originKey, createdAt: Date.now() })
    await enqueueEntry(ctx, userId, id, read._id)
    return { id, duplicate: false }
  },
})

/** The book's guide for its reader: cut at their place, as the buddy sees it, and nothing beyond. */
export const guideSoFar = query({
  args: { readId: v.id('reads') },
  handler: async (ctx, { readId }) => {
    const userId = await getAuthUserId(ctx)
    const read = await ctx.db.get(readId)
    if (!userId || read?.userId !== userId) return null
    const guide = await guideFor(ctx, read.workId)
    if (guide?.state !== 'ready') return null
    const visibility = visibleTo(read)
    return guideText(guideUpTo(guide.guide as Guide, { ...visibility, percent: Math.max(0, visibility.percent - (read.guideLag ?? 0)) }), visibility.finished)
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

/**
 * The reader says the buddy got something wrong: not reached yet, or not so in their edition. It's kept for this read
 * and never said again; "not yet" also moves the guide and milestones later. Their objection goes into the
 * conversation, so the buddy can take it back.
 */
export const correct = mutation({
  args: { turnId: v.id('buddyTurns'), kind: v.union(v.literal('notYet'), v.literal('edition')) },
  handler: async (ctx, { turnId, kind }) => {
    const turn = await ctx.db.get(turnId)
    if (!turn || turn.role !== 'buddy' || turn.state !== 'done') throw new ConvexError('There is nothing there to correct')
    const { userId, read } = await mine(ctx, turn.readId)
    const turns = await turnsOf(ctx, read._id)
    if (busy(turns)) throw new ConvexError('Your buddy is still answering')
    await ctx.db.insert('corrections', { userId, readId: read._id, kind, quote: turn.text, createdAt: Date.now() })
    if (kind === 'notYet') await ctx.db.patch(read._id, { guideLag: Math.min(MAX_LAG, (read.guideLag ?? 0) + LAG_STEP) })
    await ctx.db.insert('buddyTurns', { userId, readId: read._id, role: 'reader', text: CORRECTION_WORDS[kind], state: 'done', createdAt: Date.now() })
    await ask(ctx, userId, read._id)
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
    const { topics } = await libraryTopics(ctx, read.userId)
    const mineTopics = topics.filter(t => t.books.some(b => b.readId === read._id)).map(t => t.name).slice(0, 12)
    return {
      waitForGuide: stillWriting(guide, Date.now()),
      // The spoiler rule, in the data: the guide is cut at the reader's place before the model ever sees it.
      // A reader who has said "not yet" is treated as that much earlier in the book than the guide thinks.
      guide: guide?.state === 'ready'
        ? guideText(guideUpTo(guide.guide as Guide, { ...visibility, percent: Math.max(0, visibility.percent - (read.guideLag ?? 0)) }), visibility.finished)
        : null,
      pack: [topicsLine(mineTopics), bookPack({
        title: work.title,
        authors: work.authors,
        year: work.year,
        subjects: work.subjects,
        visibility,
        notes: entries.map(e => ({ kind: e.kind, text: e.text, position: positionOf(e.pos), question: e.question })),
        otherBooks,
        corrections: (await ctx.db.query('corrections').withIndex('by_read', q => q.eq('readId', read._id)).collect()).map(c => ({ kind: c.kind, quote: c.quote })),
      })].filter(Boolean).join('\n\n'),
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

const TOPIC_LIMIT = 3
const TOPIC_NOTES = 6

/**
 * topic_links, for the buddy: the reader's other books and notes under a topic, dated. Hidden topics never appear.
 * Notes on the book being discussed are left out: the pack already has them, and none can run ahead of the reader.
 */
export const topicLinks = internalQuery({
  args: { turnId: v.id('buddyTurns'), topic: v.string() },
  handler: async (ctx, { turnId, topic }): Promise<TopicFound[]> => {
    const turn = await ctx.db.get(turnId)
    const read = turn && await ctx.db.get(turn.readId)
    const wanted = topicKey(topic.slice(0, 120))
    if (!read || !wanted) return []
    const { topics, books, entries } = await libraryTopics(ctx, read.userId)
    const exact = topics.filter(t => t.key === wanted)
    const near = topics.filter(t => t.key !== wanted && (t.key.includes(wanted) || wanted.includes(t.key)))
    return [...exact, ...near].slice(0, TOPIC_LIMIT).map(t => ({
      name: t.name,
      books: t.books.filter(b => b.readId !== read._id).map(b => books.get(b.readId)!)
        .map(b => ({ title: b.title, author: b.author, status: b.status, at: b.at }))
        .sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
      notes: t.entries.map(e => entries.get(e.id)!).filter(e => e.readId !== read._id)
        .sort((a, b) => b.createdAt - a.createdAt).slice(0, TOPIC_NOTES)
        .map(e => ({ title: books.get(e.readId)!.title, kind: e.kind, text: e.text, at: e.createdAt })),
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
