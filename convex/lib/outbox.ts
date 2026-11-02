import { internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

/** Queues a book's state for Hardcover. There's one row per book, always pushing its latest state. */
export async function enqueueRead(ctx: MutationCtx, userId: Id<'users'>, readId: Id<'reads'>) {
  const read = await ctx.db.get(readId)
  if (!read?.hardcoverUserBookId) return
  const now = Date.now()
  const row = await ctx.db.query('hardcoverOutbox').withIndex('by_read', q => q.eq('readId', readId)).filter(q => q.eq(q.field('kind'), 'read')).first()
  if (row) await ctx.db.patch(row._id, { version: row.version + 1, attempts: 0, nextAt: now, lastError: undefined })
  else await ctx.db.insert('hardcoverOutbox', { userId, kind: 'read', readId, version: 1, attempts: 0, nextAt: now })
  await ctx.scheduler.runAfter(0, internal.hardcover.flush, {})
}

export async function enqueueEntry(ctx: MutationCtx, userId: Id<'users'>, entryId: Id<'entries'>, readId: Id<'reads'>) {
  const read = await ctx.db.get(readId)
  if (!read?.hardcoverUserBookId) return
  await ctx.db.insert('hardcoverOutbox', { userId, kind: 'entry', entryId, version: 1, attempts: 0, nextAt: Date.now() })
  await ctx.scheduler.runAfter(0, internal.hardcover.flush, {})
}

/** A deleted entry: drops anything still queued for it, and removes it from Hardcover if it got there. */
export async function enqueueJournalDelete(ctx: MutationCtx, userId: Id<'users'>, entryId: Id<'entries'>, journalId?: number) {
  const queued = await ctx.db.query('hardcoverOutbox').withIndex('by_user', q => q.eq('userId', userId)).filter(q => q.eq(q.field('entryId'), entryId)).collect()
  for (const row of queued) await ctx.db.delete(row._id)
  if (journalId === undefined) return
  await ctx.db.insert('hardcoverOutbox', { userId, kind: 'deleteJournal', journalId, version: 1, attempts: 0, nextAt: Date.now() })
  await ctx.scheduler.runAfter(0, internal.hardcover.flush, {})
}

/** A book added in Margin: goes to Hardcover, which gives back the id that later changes are sent under. */
export async function enqueueAdd(ctx: MutationCtx, userId: Id<'users'>, readId: Id<'reads'>) {
  await ctx.db.insert('hardcoverOutbox', { userId, kind: 'addBook', readId, version: 1, attempts: 0, nextAt: Date.now() })
  await ctx.scheduler.runAfter(0, internal.hardcover.flush, {})
}

export async function enqueueList(ctx: MutationCtx, userId: Id<'users'>, readId: Id<'reads'>, shelfId: Id<'shelves'>, on: boolean) {
  await ctx.db.insert('hardcoverOutbox', { userId, kind: on ? 'listBook' : 'unlistBook', readId, shelfId, version: 1, attempts: 0, nextAt: Date.now() })
  await ctx.scheduler.runAfter(0, internal.hardcover.flush, {})
}

/** After n failures, wait 2^n minutes, up to an hour. */
export const retryDelayMs = (attempts: number) => Math.min(2 ** attempts, 60) * 60_000
