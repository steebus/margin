import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, query, type MutationCtx } from './_generated/server'
import { savePlayNotes } from './playbooks'

// The review stack (/review): books an import couldn't place, one card at a time.

const mine = async (ctx: MutationCtx, id: Id<'reviewItems'>) => {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError('Sign in first')
  const item = await ctx.db.get(id)
  if (!item || item.userId !== userId) throw new ConvexError('That card is not yours')
  return { userId, item }
}

export const waiting = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const rows = await ctx.db.query('reviewItems').withIndex('by_user_state', q => q.eq('userId', userId).eq('state', 'waiting')).collect()
    return rows.map(r => ({ id: r._id, source: r.source, title: r.title, author: r.author, isbn: r.isbn ?? null, status: r.status ?? null, notes: r.notes.length }))
  },
})

/** Left out: never asked again, even when the import runs again. */
export const leave = mutation({
  args: { id: v.id('reviewItems') },
  handler: async (ctx, { id }) => {
    await mine(ctx, id)
    await ctx.db.patch(id, { state: 'left' })
  },
})

/** The card's book is now on the shelves (added with books.addBooks): its notes are saved to it. */
export const placed = mutation({
  args: { id: v.id('reviewItems'), readId: v.id('reads') },
  handler: async (ctx, { id, readId }) => {
    const { userId, item } = await mine(ctx, id)
    if (item.state !== 'waiting') return 0
    const saved = await savePlayNotes(ctx, userId, readId, item.sourceId, item.notes)
    await ctx.db.patch(id, { state: 'added' })
    return saved
  },
})
