import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { enqueueEntry } from './outbox'

/** One annotation from an import: the book's words (maybe hidden, so empty), the reader's note, and where. */
export type Imported = { key: string; text?: string; note?: string; page?: number; percent?: number; chapter?: string; at?: number }

/**
 * Saves an import's annotations to a read, skipping any already in by key. The words become an excerpt with the note
 * under it; a note on its own is a plain note. Each goes to Hardcover as usual. Returns how many entries were new.
 */
export async function saveImported(ctx: MutationCtx, userId: Id<'users'>, readId: Id<'reads'>, origin: 'kobo' | 'playbooks', items: Imported[]) {
  const known = (originKey: string) =>
    ctx.db.query('entries').withIndex('by_user_origin_key', q => q.eq('userId', userId).eq('originKey', originKey)).first()
  let added = 0
  for (const item of items) {
    const text = item.text?.trim() ?? ''
    const note = item.note?.trim() ?? ''
    const pos = { page: item.page, percent: item.percent, chapter: item.chapter }
    const insert = async (kind: 'excerpt' | 'note', words: string, originKey: string, parentId?: Id<'entries'>) => {
      const id = await ctx.db.insert('entries', { userId, readId, kind, text: words, parentId, pos, origin, originKey, createdAt: item.at ?? Date.now() })
      await enqueueEntry(ctx, userId, id, readId)
      added++
      return id
    }
    // One already in keeps its words, but takes the source's date, so early imports stamped with the day they came in
    // move back to when they were written.
    const redate = async (row: Doc<'entries'>) => {
      if (item.at && row.createdAt !== item.at) await ctx.db.patch(row._id, { createdAt: item.at })
      return row._id
    }
    const keep = async (kind: 'excerpt' | 'note', words: string, originKey: string, parentId?: Id<'entries'>) => {
      const row = await known(originKey)
      return row ? redate(row) : insert(kind, words, originKey, parentId)
    }
    if (!text) {
      if (note) await keep('note', note, item.key)
      continue
    }
    const excerptId = await keep('excerpt', text, item.key)
    if (note) await keep('note', note, `${item.key}:note`, excerptId)
  }
  return added
}
