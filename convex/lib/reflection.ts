import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/** Starts writing the question for a finished book. Once per read, so marking it finished again never re-asks. */
export async function askForReflection(ctx: MutationCtx, userId: Id<'users'>, readId: Id<'reads'>) {
  const asked = await ctx.db.query('reflectionPrompts').withIndex('by_read', q => q.eq('readId', readId)).first()
  if (asked) return
  const promptId = await ctx.db.insert('reflectionPrompts', { userId, readId, state: 'writing', createdAt: Date.now() })
  await ctx.scheduler.runAfter(0, internal.reflect.write, { promptId })
}

export const waitingPrompt = (ctx: QueryCtx, readId: Id<'reads'>) =>
  ctx.db.query('reflectionPrompts').withIndex('by_read', q => q.eq('readId', readId)).filter(q => q.eq(q.field('state'), 'waiting')).first()

type Facts = { title: string; authors: string[]; year?: number; subjects: string[]; rating?: number; notes: { kind: string; text: string }[] }

/** Asks the small text model for one question, in the buddy's voice (SPEC 3.3), built on what the reader wrote. */
export function questionPrompt(book: Facts) {
  const notes = book.notes.length ? `\nWhat the reader wrote while reading it:\n${book.notes.map(n => `- (${n.kind}) ${n.text.slice(0, 400)}`).join('\n')}\n` : ''
  return `You are a knowledgeable, Socratic reading companion. A reader has just finished this book.

Book: "${book.title}" by ${book.authors.join(', ') || 'an unknown author'}${book.year ? ` (${book.year})` : ''}
Genres: ${book.subjects.join(', ') || 'unknown'}
${book.rating ? `Their rating: ${book.rating} out of 5\n` : ''}${notes}
Write ONE question that asks them to sum up and reflect on the book as a whole: what it was doing, what it changed in how they see something, or why it landed the way it did. They've finished, so the whole book is fair game.

Rules:
- One question only, at most 35 words. No greeting, no praise, no preamble.
- Be specific to this book. Avoid anything that could be asked of any book, such as "what was your favourite part?".
- If they wrote notes, build on one of them.
- If you don't really know this book, ask from its title, genres and their notes instead of inventing plot.
- It can't be answered with yes or no.

Reply with JSON only: {"question": "..."}`
}

/** The question out of the model's reply, or null if there isn't a usable one. */
export function parseQuestion(reply: string): string | null {
  try {
    const question = (JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] ?? '') as { question?: unknown }).question
    return typeof question === 'string' && question.trim().length >= 10 ? question.trim().slice(0, 400) : null
  } catch {
    return null
  }
}

/** Used when the model can't answer, so finishing a book always gets its question. */
export const fallbackQuestion = (title: string) => `Now you've finished ${title}, what is it you'll carry away from it, and why that?`
