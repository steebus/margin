import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action, internalAction, internalMutation, internalQuery, mutation, query, type ActionCtx } from './_generated/server'
import { parseAnnotations, type KoboNote } from './lib/kobo'
import { enqueueEntry } from './lib/outbox'

// Kobo, read-only (docs/superpowers/specs/2026-11-04-kobo-pull-design.md). Books are linked from the bookmarklet's
// list on /settings/integrations/kobo; this pulls each linked book's annotations with Steve's session cookie.

const ANNOTATIONS = 'https://readingservices.kobo.com/api/v3/content'
export const SIGN_IN_AGAIN = 'Kobo needs signing in again: paste a fresh cookie.'
const pace = () => new Promise(resolve => setTimeout(resolve, Number(process.env.KOBO_PACE_MS ?? 1000)))

const signedIn = async (ctx: Parameters<typeof getAuthUserId>[0]) => {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError('Sign in first')
  return userId
}

export const saveCookie = mutation({
  args: { cookie: v.string() },
  handler: async (ctx, { cookie }) => {
    const userId = await signedIn(ctx)
    const value = cookie.trim().replace(/^cookie:\s*/i, '')
    if (!value) throw new ConvexError('Paste the cookie first')
    const row = await ctx.db.query('koboLinks').withIndex('by_user', q => q.eq('userId', userId)).first()
    if (row) await ctx.db.patch(row._id, { cookie: value, lastError: undefined })
    else await ctx.db.insert('koboLinks', { userId, cookie: value })
  },
})

export const forget = mutation({
  args: {},
  handler: async ctx => {
    const userId = await signedIn(ctx)
    const row = await ctx.db.query('koboLinks').withIndex('by_user', q => q.eq('userId', userId)).first()
    if (row) await ctx.db.delete(row._id)
  },
})

/** How Kobo stands, for Settings. Never the cookie. */
export const status = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const row = await ctx.db.query('koboLinks').withIndex('by_user', q => q.eq('userId', userId)).first()
    const reads = await ctx.db.query('reads').withIndex('by_user_status', q => q.eq('userId', userId)).collect()
    return {
      connected: !!row,
      lastPullAt: row?.lastPullAt ?? null,
      lastError: row?.lastError ?? null,
      lastReport: row?.lastReport ?? null,
      linked: reads.filter(r => r.koboId).length,
    }
  },
})

/** Remembers which Kobo book each read is. */
export const link = mutation({
  args: { links: v.array(v.object({ readId: v.id('reads'), koboId: v.string() })) },
  handler: async (ctx, { links }) => {
    const userId = await signedIn(ctx)
    for (const { readId, koboId } of links) {
      const read = await ctx.db.get(readId)
      if (!read || read.userId !== userId) throw new ConvexError('That book is not on your shelves')
      if (!/^[0-9a-f-]{36}$/i.test(koboId)) throw new ConvexError('That is not a Kobo book id')
      if (read.koboId !== koboId) await ctx.db.patch(readId, { koboId })
    }
  },
})

export const pullState = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const row = await ctx.db.query('koboLinks').withIndex('by_user', q => q.eq('userId', userId)).first()
    const reads = await ctx.db.query('reads').withIndex('by_user_status', q => q.eq('userId', userId)).collect()
    const books = await Promise.all(reads.filter(r => r.koboId).map(async r => ({ readId: r._id, koboId: r.koboId!, title: (await ctx.db.get(r.workId))?.title ?? 'a book' })))
    return row ? { linkId: row._id, cookie: row.cookie, books } : null
  },
})

export const linkedUsers = internalQuery({
  args: {},
  handler: async ctx => (await ctx.db.query('koboLinks').collect()).map(r => r.userId),
})

/** Saves a book's annotations, skipping any already in. Each goes to Hardcover as usual. Returns how many were new. */
export const saveNotes = internalMutation({
  args: {
    userId: v.id('users'),
    readId: v.id('reads'),
    notes: v.array(v.object({ id: v.string(), text: v.string(), note: v.string(), chapter: v.optional(v.string()), percent: v.optional(v.number()) })),
  },
  handler: async (ctx, { userId, readId, notes }) => {
    const known = async (originKey: string) =>
      ctx.db.query('entries').withIndex('by_user_origin_key', q => q.eq('userId', userId).eq('originKey', originKey)).first()
    let added = 0
    for (const n of notes) {
      const pos = { percent: n.percent, chapter: n.chapter }
      const insert = async (kind: 'excerpt' | 'note', text: string, originKey: string, parentId?: Id<'entries'>) => {
        const id = await ctx.db.insert('entries', { userId, readId, kind, text, parentId, pos, origin: 'kobo', originKey, createdAt: Date.now() })
        await enqueueEntry(ctx, userId, id, readId)
        added++
        return id
      }
      const key = `kobo:${n.id}`
      if (!n.text) {
        if (!await known(key)) await insert('note', n.note, key)
        continue
      }
      const excerptId = (await known(key))?._id ?? await insert('excerpt', n.text, key)
      if (n.note && !await known(`${key}:note`)) await insert('note', n.note, `${key}:note`, excerptId)
    }
    return added
  },
})

export const record = internalMutation({
  args: { linkId: v.id('koboLinks'), error: v.optional(v.string()), report: v.optional(v.object({ books: v.number(), highlights: v.number() })) },
  handler: async (ctx, { linkId, error, report }) => {
    await ctx.db.patch(linkId, { lastError: error, ...(report ? { lastReport: report, lastPullAt: Date.now() } : {}) })
  },
})

/** Pulls every linked book's annotations. Stops at the first refusal or surprise, keeping what's already saved. */
async function pullFor(ctx: ActionCtx, userId: Id<'users'>) {
  const state = await ctx.runQuery(internal.kobo.pullState, { userId })
  if (!state) throw new ConvexError('Paste your Kobo cookie in Settings first')
  let highlights = 0
  let error: string | undefined
  for (const [i, book] of state.books.entries()) {
    if (i) await pace()
    let res: Response
    try {
      res = await fetch(`${ANNOTATIONS}/${book.koboId}/annotations`, { headers: { cookie: state.cookie, 'user-agent': 'margin/1.0' }, redirect: 'manual' })
    } catch {
      error = "Couldn't reach Kobo. Try again later."
      break
    }
    if (res.status === 401 || res.status === 403 || (res.status >= 300 && res.status < 400)) { error = SIGN_IN_AGAIN; break }
    if (!res.ok) { error = `Kobo refused the notes for ${book.title} (${res.status}).`; break }
    let notes: KoboNote[], more: boolean
    try {
      ;({ notes, more } = parseAnnotations(await res.json()))
    } catch {
      error = `Kobo's notes for ${book.title} weren't in the shape Margin expects, so nothing was saved for it.`
      break
    }
    highlights += await ctx.runMutation(internal.kobo.saveNotes, { userId, readId: book.readId, notes })
    // ponytail: Kobo's paging parameter is unknown (every book so far fits one page); say so rather than guess.
    if (more) error = `Kobo sent more than one page of notes for ${book.title}; only the first came in.`
  }
  await ctx.runMutation(internal.kobo.record, { linkId: state.linkId, error, report: error === SIGN_IN_AGAIN ? undefined : { books: state.books.length, highlights } })
  return { books: state.books.length, highlights, error: error ?? null }
}

export const pull = action({
  args: {},
  handler: async (ctx): Promise<{ books: number; highlights: number; error: string | null }> => pullFor(ctx, await signedIn(ctx)),
})

/** Daily. A cookie that's stopped working is left alone until a fresh one is pasted. */
export const pullAll = internalAction({
  args: {},
  handler: async ctx => {
    for (const userId of await ctx.runQuery(internal.kobo.linkedUsers, {})) {
      const state = await ctx.runQuery(internal.kobo.pullState, { userId })
      if (!state || !state.books.length) continue
      const link = await ctx.runQuery(internal.kobo.lastError, { userId })
      if (link === SIGN_IN_AGAIN) continue
      await pullFor(ctx, userId)
    }
  },
})

export const lastError = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => (await ctx.db.query('koboLinks').withIndex('by_user', q => q.eq('userId', userId)).first())?.lastError ?? null,
})
