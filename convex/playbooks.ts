import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { mutation, type MutationCtx } from './_generated/server'
import { wordsKey } from './lib/entryKey'
import { saveImported } from './lib/imported'
import type { PlayNote } from './lib/playbooks'

// Play Books, read in the reader's browser (docs/superpowers/specs/2026-11-04-play-books-design.md). These save what
// the page found: notes on a book, and books it couldn't place, which wait in /review.

export const playNote = v.object({ page: v.union(v.number(), v.null()), highlight: v.string(), note: v.string(), at: v.union(v.number(), v.null()) })

const signedIn = async (ctx: MutationCtx) => {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError('Sign in first')
  return userId
}

/** Saves a book's Play Books notes, keyed so running the import again adds nothing. */
export async function savePlayNotes(ctx: MutationCtx, userId: Id<'users'>, readId: Id<'reads'>, volumeId: string, notes: PlayNote[]) {
  const read = await ctx.db.get(readId)
  if (!read || read.userId !== userId) throw new ConvexError('That book is not on your shelves')
  return saveImported(ctx, userId, readId, 'playbooks', notes.map(n => ({
    key: `playbooks:${volumeId}:${n.page ?? ''}:${wordsKey(n.highlight || n.note)}`,
    text: n.highlight,
    note: n.note,
    page: n.page ?? undefined,
    at: n.at ?? undefined,
  })))
}

export const saveNotes = mutation({
  args: { readId: v.id('reads'), volumeId: v.string(), notes: v.array(playNote) },
  handler: async (ctx, { readId, volumeId, notes }) => savePlayNotes(ctx, await signedIn(ctx), readId, volumeId, notes),
})

/** Puts books in /review. A card already waiting gets the latest notes; one added or left out stays as it is. */
export const queue = mutation({
  args: {
    items: v.array(v.object({
      sourceId: v.string(), title: v.string(), author: v.string(), isbn: v.optional(v.string()),
      status: v.optional(v.union(v.literal('read'), v.literal('reading'), v.literal('tbr'))), notes: v.array(playNote),
    })),
  },
  handler: async (ctx, { items }) => {
    const userId = await signedIn(ctx)
    let queued = 0
    for (const item of items) {
      const known = await ctx.db.query('reviewItems').withIndex('by_user_source', q => q.eq('userId', userId).eq('source', 'playbooks').eq('sourceId', item.sourceId)).first()
      if (known?.state === 'waiting') await ctx.db.patch(known._id, { notes: item.notes, status: item.status ?? known.status })
      else if (!known) await ctx.db.insert('reviewItems', { userId, source: 'playbooks', ...item, state: 'waiting', createdAt: Date.now() })
      if (!known || known.state === 'waiting') queued++
    }
    return queued
  },
})
