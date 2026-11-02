import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, type MutationCtx, type QueryCtx } from './_generated/server'
import { guideFor } from './guides'
import type { Guide } from './lib/guide'
import { crossed, milestonesFor } from './lib/milestones'

const SNOOZE_MS = 24 * 60 * 60_000

const notesOf = (ctx: QueryCtx, readId: Id<'reads'>) =>
  ctx.db.query('buddyQueue').withIndex('by_read', q => q.eq('readId', readId)).collect()

/** Called on every progress write. Queues a note for a milestone crossed, and lets an older one go unasked. */
export async function checkMilestones(ctx: MutationCtx, read: Doc<'reads'>, from: number, to: number) {
  const guide = await guideFor(ctx, read.workId)
  const milestone = crossed(milestonesFor(guide?.state === 'ready' ? guide.guide as Guide : null), from, to)
  if (!milestone) return
  const notes = await notesOf(ctx, read._id)
  if (notes.some(n => n.milestoneKey === milestone.key)) return
  for (const n of notes) if (n.state === 'pending' || n.state === 'snoozed') await ctx.db.patch(n._id, { state: 'passed' })
  await ctx.db.insert('buddyQueue', {
    userId: read.userId, readId: read._id, milestoneKey: milestone.key, percent: milestone.percent, text: milestone.text,
    state: 'pending', createdAt: Date.now(),
  })
}

/** The note to show on the book, if one is waiting and not snoozed. */
export async function waitingNote(ctx: QueryCtx, readId: Id<'reads'>) {
  const now = Date.now()
  const note = (await notesOf(ctx, readId)).find(n => n.state === 'pending' || (n.state === 'snoozed' && (n.snoozedUntil ?? 0) <= now))
  return note ? { id: note._id, percent: note.percent, text: note.text } : null
}

async function mine(ctx: MutationCtx, noteId: Id<'buddyQueue'>) {
  const userId = await getAuthUserId(ctx)
  const note = await ctx.db.get(noteId)
  if (!userId || !note || note.userId !== userId) throw new ConvexError('That note is not yours')
  return note
}

/** Puts the note into the conversation as the buddy's question, where the reader answers it. */
export const answer = mutation({
  args: { noteId: v.id('buddyQueue') },
  handler: async (ctx, { noteId }) => {
    const note = await mine(ctx, noteId)
    await ctx.db.insert('buddyTurns', { userId: note.userId, readId: note.readId, role: 'buddy', text: note.text, state: 'done', createdAt: Date.now() })
    await ctx.db.patch(noteId, { state: 'answered' })
  },
})

export const snooze = mutation({
  args: { noteId: v.id('buddyQueue') },
  handler: async (ctx, { noteId }) => {
    await mine(ctx, noteId)
    await ctx.db.patch(noteId, { state: 'snoozed', snoozedUntil: Date.now() + SNOOZE_MS })
  },
})

export const pass = mutation({
  args: { noteId: v.id('buddyQueue') },
  handler: async (ctx, { noteId }) => {
    await mine(ctx, noteId)
    await ctx.db.patch(noteId, { state: 'passed' })
  },
})
