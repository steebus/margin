import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { askGemini } from './lib/gemini'
import { entryKey } from './lib/entryKey'
import { enqueueEntry } from './lib/outbox'
import { fallbackQuestion, parseQuestion, questionPrompt } from './lib/reflection'

const MAX_LENGTH = 20_000

export const facts = internalQuery({
  args: { promptId: v.id('reflectionPrompts') },
  handler: async (ctx, { promptId }) => {
    const prompt = await ctx.db.get(promptId)
    const read = prompt && await ctx.db.get(prompt.readId)
    const work = read && await ctx.db.get(read.workId)
    if (!read || !work) return null
    const entries = await ctx.db.query('entries').withIndex('by_read', q => q.eq('readId', read._id)).order('desc').take(20)
    return {
      title: work.title,
      authors: work.authors,
      year: work.year,
      subjects: work.subjects,
      rating: read.rating,
      notes: entries.map(e => ({ kind: e.kind, text: e.text })),
    }
  },
})

export const saveQuestion = internalMutation({
  args: { promptId: v.id('reflectionPrompts'), question: v.string() },
  handler: async (ctx, { promptId, question }) => {
    await ctx.db.patch(promptId, { question, state: 'waiting' })
  },
})

/** Writes the question. Costs a fraction of a penny, and falls back to a plain one rather than losing the moment. */
export const write = internalAction({
  args: { promptId: v.id('reflectionPrompts') },
  handler: async (ctx, { promptId }) => {
    const book = await ctx.runQuery(internal.reflect.facts, { promptId })
    if (!book) return
    let question: string | null = null
    try {
      question = parseQuestion(await askGemini([{ text: questionPrompt(book) }], 'Writing a question', 0.8))
    } catch (e) {
      console.error('Falling back to the plain question:', (e as { data?: unknown })?.data ?? e)
    }
    await ctx.runMutation(internal.reflect.saveQuestion, { promptId, question: question ?? fallbackQuestion(book.title) })
  },
})

/** Questions waiting for an answer, oldest first, for the Desk and the notes page. */
export const waiting = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const prompts = await ctx.db.query('reflectionPrompts').withIndex('by_user_state', q => q.eq('userId', userId).eq('state', 'waiting')).collect()
    const rows = await Promise.all(prompts.map(async p => {
      const read = await ctx.db.get(p.readId)
      const work = read && await ctx.db.get(read.workId)
      return work && { id: p._id, question: p.question!, title: work.title, slug: work.slug }
    }))
    return rows.filter(row => row !== null)
  },
})

export const answer = mutation({
  args: { promptId: v.id('reflectionPrompts'), text: v.string() },
  handler: async (ctx, { promptId, text }) => {
    const userId = await getAuthUserId(ctx)
    const prompt = await ctx.db.get(promptId)
    if (!userId || !prompt || prompt.userId !== userId) throw new ConvexError('That question is not yours')
    const words = text.trim()
    if (!words) throw new ConvexError('There are no words to save')
    if (words.length > MAX_LENGTH) throw new ConvexError('That is too long to save as one entry')
    const read = await ctx.db.get(prompt.readId)
    if (!read) throw new ConvexError('That book is not on your shelves')
    const pos = {}
    const id = await ctx.db.insert('entries', {
      userId, readId: read._id, kind: 'reflection', text: words, question: prompt.question, pos, origin: 'manual',
      originKey: entryKey(read.workId, 'reflection', words, pos), createdAt: Date.now(),
    })
    await ctx.db.patch(promptId, { state: 'answered' })
    await enqueueEntry(ctx, userId, id, read._id)
  },
})

export const skip = mutation({
  args: { promptId: v.id('reflectionPrompts') },
  handler: async (ctx, { promptId }) => {
    const userId = await getAuthUserId(ctx)
    const prompt = await ctx.db.get(promptId)
    if (!userId || !prompt || prompt.userId !== userId) throw new ConvexError('That question is not yours')
    await ctx.db.patch(promptId, { state: 'skipped' })
  },
})
