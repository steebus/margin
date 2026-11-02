import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { action, internalAction, internalMutation, internalQuery, query, type ActionCtx } from './_generated/server'
import { entryKey } from './lib/entryKey'
import { askForReflection } from './lib/reflection'
import { checkMilestones } from './milestones'
import {
  JOURNAL_FIELDS, journalObject, LIBRARY_QUERY, LISTS_QUERY, listSlug, mapJournal, mapSearch, mapUserBook, newUserBook, progressChanged, SEARCH_QUERY, progressFields, readFields, readingDates, statusId,
  type HardcoverJournal, type HardcoverList, type HardcoverUserBook, type SearchDocument,
} from './lib/hardcover'
import { enqueueRead, retryDelayMs } from './lib/outbox'

const PAGE = 100
const CLAIM = 3
const CURSOR_OVERLAP_MS = 60_000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
// One request every 4.5 seconds. Hardcover reports a limit of 15, without saying over what period.
export const pace = () => sleep(Number(process.env.HARDCOVER_PACE_MS ?? 4500))

export type Found = ReturnType<typeof mapSearch>[number]

export async function searchHardcover(words: string): Promise<Found[]> {
  const data = await gql<{ search: { results?: { hits?: { document: SearchDocument }[] } } }>(SEARCH_QUERY, { q: words })
  return mapSearch((data.search?.results?.hits ?? []).map(h => h.document))
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const key = process.env.HARDCOVER_API_KEY
  if (!key) throw new ConvexError('Hardcover is not connected: HARDCOVER_API_KEY is missing.')
  const url = process.env.HARDCOVER_API_URL || 'https://api.hardcover.app/v1/graphql'
  const send = () => fetch(url, {
    method: 'POST',
    headers: { authorization: /^bearer /i.test(key) ? key : `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  let res = await send()
  if (res.status === 429) {
    await sleep(60_000)
    res = await send()
  } else if (res.status >= 500) {
    // Hardcover's gateway has the odd bad moment. One more go saves a failed import or push.
    await sleep(5_000)
    res = await send()
  }
  if (!res.ok) throw new ConvexError(`Hardcover answered ${res.status}.`)
  const json = await res.json()
  if (json.errors) throw new ConvexError(`Hardcover refused the request: ${String(json.errors[0]?.message ?? 'unknown').slice(0, 160)}`)
  return json.data as T
}

const message = (e: unknown) => {
  const data = (e as { data?: unknown })?.data
  return (typeof data === 'string' ? data : String((e as Error)?.message ?? e)).slice(0, 200)
}

// ---------- Reading from Hardcover ----------

const status = v.union(v.literal('tbr'), v.literal('reading'), v.literal('paused'), v.literal('read'), v.literal('dnf'))
const format = v.union(v.literal('print'), v.literal('ebook'), v.literal('audio'))
const bookItem = v.object({
  work: v.object({
    hardcoverId: v.number(),
    slug: v.string(),
    title: v.string(),
    authors: v.array(v.string()),
    year: v.optional(v.number()),
    isbns: v.array(v.string()),
    coverUrl: v.optional(v.string()),
    pages: v.optional(v.number()),
    audioSeconds: v.optional(v.number()),
    subjects: v.array(v.string()),
  }),
  read: v.object({
    hardcoverUserBookId: v.number(),
    status,
    addedAt: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    percent: v.number(),
    progressKnown: v.optional(v.boolean()),
    page: v.optional(v.number()),
    seconds: v.optional(v.number()),
    readings: v.optional(v.array(v.object({ hardcoverId: v.optional(v.number()), startedAt: v.optional(v.number()), finishedAt: v.optional(v.number()) }))),
    format,
    owned: v.boolean(),
    rating: v.optional(v.number()),
    recommendedBy: v.optional(v.string()),
    review: v.optional(v.object({ text: v.string(), at: v.optional(v.number()) })),
  }),
})

/**
 * Saves books from Hardcover. An import leaves existing reads alone. A sync (`update`) applies what changed,
 * unless Margin has a change of its own still waiting to send.
 */
// A write wakes every screen reading that row, so the sync only writes what moved. Exported for its test.
const stable = (value: unknown) => JSON.stringify(value, (_, x) =>
  x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a < b ? -1 : 1)) : x)
export const changes = (doc: object, patch: object) =>
  Object.entries(patch).some(([k, v]) => stable(v) !== stable((doc as Record<string, unknown>)[k]))

export const saveBooks = internalMutation({
  args: { userId: v.id('users'), items: v.array(bookItem), update: v.optional(v.boolean()) },
  handler: async (ctx, { userId, items, update }) => {
    let added = 0
    let existing = 0
    let notes = 0
    for (const { work, read } of items) {
      const known = await ctx.db.query('works').withIndex('by_hardcover', q => q.eq('hardcoverId', work.hardcoverId)).first()
      const { slug: _slug, ...metadata } = work
      // A slug never changes once minted, because links depend on it.
      const workId = known?._id ?? await ctx.db.insert('works', work)
      if (known && changes(known, metadata)) await ctx.db.patch(known._id, metadata)

      const mine = await ctx.db.query('reads').withIndex('by_user_work', q => q.eq('userId', userId).eq('workId', workId)).first()
      let readId = mine?._id
      if (mine) {
        existing++
        const waiting = await ctx.db.query('hardcoverOutbox').withIndex('by_read', q => q.eq('readId', mine._id)).first()
        if (update && !waiting) {
          const percent = read.progressKnown !== false && progressChanged(mine.progress.percent, read.percent) ? read.percent : mine.progress.percent
          const patch = {
            status: read.status,
            rating: read.rating,
            // When Hardcover sent its reads they're the truth, so a date cleared there clears here.
            startedAt: read.readings ? read.startedAt : read.startedAt ?? mine.startedAt,
            finishedAt: read.status !== 'read' ? undefined : read.readings ? read.finishedAt : read.finishedAt ?? mine.finishedAt,
            ...(read.readings ? { readings: read.readings } : {}),
            progress: percent === mine.progress.percent ? mine.progress : { percent, page: read.page, seconds: read.seconds },
            hardcoverUserBookId: read.hardcoverUserBookId,
          }
          if (changes(mine, patch)) await ctx.db.patch(mine._id, patch)
          if (percent !== mine.progress.percent) {
            await ctx.db.insert('progressLog', { userId, readId: mine._id, at: Date.now(), percent, page: read.page, origin: 'hardcover' })
            await checkMilestones(ctx, mine, mine.progress.percent, percent)
          }
          if (mine.status !== 'read' && read.status === 'read') await askForReflection(ctx, userId, mine._id)
        } else if (!update && !mine.readings && read.readings) {
          // An import leaves a read alone, but fills in the reads it had never brought over.
          await ctx.db.patch(mine._id, { readings: read.readings, startedAt: read.startedAt ?? mine.startedAt, finishedAt: read.finishedAt ?? mine.finishedAt })
        }
      } else {
        readId = await ctx.db.insert('reads', {
          userId,
          workId,
          status: read.status,
          addedAt: read.addedAt,
          startedAt: read.startedAt,
          finishedAt: read.finishedAt,
          progress: { percent: read.percent, page: read.page, seconds: read.seconds },
          readings: read.readings,
          format: read.format,
          ownership: read.owned ? 'owned' : undefined,
          rating: read.rating,
          source: read.recommendedBy ? { kind: 'person', who: read.recommendedBy } : undefined,
          tagIds: [],
          shelfIds: [],
          hardcoverUserBookId: read.hardcoverUserBookId,
        })
        added++
        // Only a sync means it was just finished. An import is history, and isn't asked about (SPEC 3.5).
        if (update && read.status === 'read') await askForReflection(ctx, userId, readId)
      }

      if (read.review && readId) {
        const originKey = `hardcover-review:${read.hardcoverUserBookId}`
        const review = await ctx.db.query('entries').withIndex('by_user_origin_key', q => q.eq('userId', userId).eq('originKey', originKey)).first()
        if (review) {
          if (review.text !== read.review.text) await ctx.db.patch(review._id, { text: read.review.text })
        } else {
          await ctx.db.insert('entries', {
            userId, readId, kind: 'review', text: read.review.text, pos: {}, origin: 'hardcover', originKey, createdAt: read.review.at ?? Date.now(),
          })
          notes++
        }
      }
    }
    return { added, existing, notes }
  },
})

/** Saves quotes and notes. Matches on Hardcover's id, then on book, words and place, so nothing arrives twice. */
export const saveJournal = internalMutation({
  args: {
    userId: v.id('users'),
    items: v.array(v.object({
      journalId: v.number(),
      hardcoverBookId: v.number(),
      kind: v.union(v.literal('excerpt'), v.literal('note')),
      text: v.string(),
      page: v.optional(v.number()),
      percent: v.optional(v.number()),
      at: v.optional(v.number()),
    })),
  },
  handler: async (ctx, { userId, items }) => {
    let added = 0
    for (const item of items) {
      const known = await ctx.db.query('entries').withIndex('by_user_journal', q => q.eq('userId', userId).eq('hardcoverJournalId', item.journalId)).first()
      if (known) {
        if (known.text !== item.text) await ctx.db.patch(known._id, { text: item.text })
        continue
      }
      const work = await ctx.db.query('works').withIndex('by_hardcover', q => q.eq('hardcoverId', item.hardcoverBookId)).first()
      const read = work && await ctx.db.query('reads').withIndex('by_user_work', q => q.eq('userId', userId).eq('workId', work._id)).first()
      if (!work || !read) continue
      const pos = { page: item.page, percent: item.percent }
      const originKey = entryKey(work._id, item.kind, item.text, pos)
      // Margin sends summaries and reflections as notes, so one on its way back may be either.
      const keys = item.kind === 'note' ? [originKey, entryKey(work._id, 'summary', item.text, pos), entryKey(work._id, 'reflection', item.text, pos)] : [originKey]
      let same = null
      for (const key of keys) same ??= await ctx.db.query('entries').withIndex('by_user_origin_key', q => q.eq('userId', userId).eq('originKey', key)).first()
      if (same) {
        await ctx.db.patch(same._id, { hardcoverJournalId: item.journalId })
        continue
      }
      await ctx.db.insert('entries', {
        userId, readId: read._id, kind: item.kind, text: item.text, pos, origin: 'hardcover', originKey,
        hardcoverJournalId: item.journalId, createdAt: item.at ?? Date.now(),
      })
      added++
    }
    return { added }
  },
})

const mapped = (page: HardcoverUserBook[]) => page.map(mapUserBook).filter(item => item !== null)
const quotes = (page: HardcoverJournal[]) => page.map(mapJournal).filter(item => item !== null)

/** Brings the reader's Hardcover library in, with notes and reviews, and starts the sync. Safe to run again. */
export const importLibrary = action({
  args: {},
  handler: async (ctx): Promise<Totals> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to import your library')
    return ctx.runAction(internal.hardcover.importFor, { userId })
  },
})

type Totals = { added: number; existing: number; notes: number }

/** The import itself. Only reads from Hardcover. */
export const importFor = internalAction({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }): Promise<Totals> => {
    const startedAt = Date.now()
    const totals = { added: 0, existing: 0, notes: 0 }

    for (let offset = 0; ; offset += PAGE) {
      const data = await gql<{ me: { user_books: HardcoverUserBook[] }[] }>(LIBRARY_QUERY, { limit: PAGE, offset })
      const page = data.me?.[0]?.user_books ?? []
      const result: typeof totals = await ctx.runMutation(internal.hardcover.saveBooks, { userId, items: mapped(page) })
      totals.added += result.added
      totals.existing += result.existing
      totals.notes += result.notes
      if (page.length < PAGE) break
      await pace()
    }

    await pace()
    const me = await gql<{ me: { id: number }[] }>('{ me { id } }')
    const hardcoverUserId = me.me[0].id
    for (let offset = 0; ; offset += PAGE) {
      await pace()
      const data = await gql<{ reading_journals: HardcoverJournal[] }>(
        `query($u: Int!, $o: Int!) { reading_journals(where: {user_id: {_eq: $u}, event: {_in: ["quote", "note"]}}, limit: ${PAGE}, offset: $o, order_by: {id: asc}) { ${JOURNAL_FIELDS} } }`,
        { u: hardcoverUserId, o: offset },
      )
      const page = data.reading_journals ?? []
      const result: { added: number } = await ctx.runMutation(internal.hardcover.saveJournal, { userId, items: quotes(page) })
      totals.notes += result.added
      if (page.length < PAGE) break
    }

    await pace()
    await pullLists(ctx, userId)
    await ctx.runMutation(internal.hardcover.connect, { userId, hardcoverUserId, cursor: new Date(startedAt - CURSOR_OVERLAP_MS).toISOString() })
    return totals
  },
})

async function pullLists(ctx: ActionCtx, userId: Id<'users'>) {
  const data = await gql<{ me: { lists?: HardcoverList[] }[] }>(LISTS_QUERY)
  const lists = data.me?.[0]?.lists
  // A reply with no lists field says nothing, and mustn't read as "every list was deleted".
  if (!Array.isArray(lists)) return
  await ctx.runMutation(internal.hardcover.saveLists, {
    userId,
    lists: lists.map(l => ({
      hardcoverListId: l.id,
      name: l.name?.trim() || 'Untitled list',
      slug: listSlug(l),
      bookIds: (l.list_books ?? []).flatMap(b => (b.book_id ? [b.book_id] : [])),
    })),
  })
}

/** Makes Margin's lists match Hardcover's. A book with a list change still waiting to send keeps what it has. */
export const saveLists = internalMutation({
  args: { userId: v.id('users'), lists: v.array(v.object({ hardcoverListId: v.number(), name: v.string(), slug: v.string(), bookIds: v.array(v.number()) })) },
  handler: async (ctx, { userId, lists }) => {
    const shelves = await ctx.db.query('shelves').withIndex('by_user_slug', q => q.eq('userId', userId)).collect()
    const idFor = new Map<number, Id<'shelves'>>()
    for (const list of lists) {
      const known = shelves.find(s => s.hardcoverListId === list.hardcoverListId)
      if (known) {
        if (known.name !== list.name) await ctx.db.patch(known._id, { name: list.name })
        idFor.set(list.hardcoverListId, known._id)
      } else {
        idFor.set(list.hardcoverListId, await ctx.db.insert('shelves', { userId, slug: list.slug, name: list.name, hardcoverListId: list.hardcoverListId }))
      }
    }
    const gone = shelves.filter(s => s.hardcoverListId && !idFor.has(s.hardcoverListId))
    const waiting = new Set((await ctx.db.query('hardcoverOutbox').withIndex('by_user', q => q.eq('userId', userId)).collect())
      .filter(row => row.kind === 'listBook' || row.kind === 'unlistBook').map(row => row.readId))
    const reads = await ctx.db.query('reads').withIndex('by_user_status', q => q.eq('userId', userId)).collect()
    for (const read of reads) {
      if (waiting.has(read._id)) continue
      const work = await ctx.db.get(read.workId)
      const shelfIds = lists.filter(l => work?.hardcoverId && l.bookIds.includes(work.hardcoverId)).map(l => idFor.get(l.hardcoverListId)!)
      const same = shelfIds.length === read.shelfIds.length && shelfIds.every(id => read.shelfIds.includes(id))
      if (!same) await ctx.db.patch(read._id, { shelfIds })
    }
    for (const shelf of gone) await ctx.db.delete(shelf._id)
  },
})

export const connect = internalMutation({
  args: { userId: v.id('users'), hardcoverUserId: v.number(), cursor: v.string() },
  handler: async (ctx, { userId, hardcoverUserId, cursor }) => {
    const row = await ctx.db.query('integrations').withIndex('by_user', q => q.eq('userId', userId)).first()
    if (row) await ctx.db.patch(row._id, { hardcoverUserId, cursor, lastSyncAt: Date.now(), lastError: undefined })
    else await ctx.db.insert('integrations', { userId, provider: 'hardcover', hardcoverUserId, cursor, lastSyncAt: Date.now() })
  },
})

export const connections = internalQuery({
  args: {},
  handler: ctx => ctx.db.query('integrations').withIndex('by_provider', q => q.eq('provider', 'hardcover')).collect(),
})

export const recordSync = internalMutation({
  args: { id: v.id('integrations'), cursor: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, { id, cursor, error }) => {
    await ctx.db.patch(id, { ...(cursor ? { cursor, lastSyncAt: Date.now() } : {}), lastError: error })
  },
})

/**
 * Hourly, the whole library: Hardcover doesn't date its read records, so a date changed there can't be spotted
 * by the two-minute check. Only reads from Hardcover. A change of Margin's still waiting to send wins, as ever.
 */
export const reconcile = internalAction({
  args: {},
  handler: async ctx => {
    for (const link of await ctx.runQuery(internal.hardcover.connections, {})) {
      try {
        for (let offset = 0; ; offset += PAGE) {
          const data = await gql<{ me: { user_books: HardcoverUserBook[] }[] }>(LIBRARY_QUERY, { limit: PAGE, offset })
          const page = data.me?.[0]?.user_books ?? []
          await ctx.runMutation(internal.hardcover.saveBooks, { userId: link.userId, items: mapped(page), update: true })
          if (page.length < PAGE) break
          await pace()
        }
        await pace()
        await pullLists(ctx, link.userId)
      } catch (e) {
        await ctx.runMutation(internal.hardcover.recordSync, { id: link._id, error: message(e) })
      }
    }
  },
})

const USER_BOOK_FIELDS = LIBRARY_QUERY.slice(LIBRARY_QUERY.indexOf('id status_id'), LIBRARY_QUERY.lastIndexOf('} }'))

/** Every 2 minutes: what changed on Hardcover comes in, and anything stuck in the outbox gets another go. */
export const syncAll = internalAction({
  args: {},
  handler: async ctx => {
    for (const link of await ctx.runQuery(internal.hardcover.connections, {})) {
      const startedAt = Date.now()
      try {
        const data = await gql<{ me: { user_books: HardcoverUserBook[] }[]; reading_journals: (HardcoverJournal & { book_id: number })[] }>(
          `query($since: timestamptz!, $sinceLocal: timestamp!, $u: Int!) {
            me { user_books(where: {updated_at: {_gt: $since}}, limit: ${PAGE}, order_by: {updated_at: asc}) { ${USER_BOOK_FIELDS} } }
            reading_journals(where: {user_id: {_eq: $u}, updated_at: {_gt: $sinceLocal}}, limit: ${PAGE}, order_by: {updated_at: asc}) { ${JOURNAL_FIELDS} }
          }`,
          { since: link.cursor, sinceLocal: link.cursor, u: link.hardcoverUserId },
        )
        const books = data.me?.[0]?.user_books ?? []
        const journal = data.reading_journals ?? []

        // A journal event such as progress can mean a book changed without its own record moving.
        const seen = new Set(books.map(b => b.book?.id))
        const others = [...new Set(journal.filter(j => !quotes([j]).length).map(j => j.book_id))].filter(id => id && !seen.has(id))
        if (others.length) {
          await pace()
          const more = await gql<{ me: { user_books: HardcoverUserBook[] }[] }>(
            `query($ids: [Int!]!) { me { user_books(where: {book_id: {_in: $ids}}) { ${USER_BOOK_FIELDS} } } }`,
            { ids: others },
          )
          books.push(...(more.me?.[0]?.user_books ?? []))
        }

        if (books.length) await ctx.runMutation(internal.hardcover.saveBooks, { userId: link.userId, items: mapped(books), update: true })
        const items = quotes(journal)
        if (items.length) await ctx.runMutation(internal.hardcover.saveJournal, { userId: link.userId, items })

        // If a page came back full there's more, so only move as far as what was actually seen.
        const full = books.length >= PAGE || journal.length >= PAGE
        const cursor = full ? link.cursor : new Date(startedAt - CURSOR_OVERLAP_MS).toISOString()
        await ctx.runMutation(internal.hardcover.recordSync, { id: link._id, cursor })
      } catch (e) {
        await ctx.runMutation(internal.hardcover.recordSync, { id: link._id, error: message(e) })
      }
    }
    await ctx.runAction(internal.hardcover.flush, {})
  },
})

// ---------- Sending to Hardcover ----------

/** Takes the next few due rows and hides them for a while, so two runs can't both send the same note. */
export const claim = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now()
    const rows = await ctx.db.query('hardcoverOutbox').withIndex('by_next', q => q.lte('nextAt', now)).take(CLAIM)
    for (const row of rows) await ctx.db.patch(row._id, { nextAt: now + 5 * 60_000 })
    const more = (await ctx.db.query('hardcoverOutbox').withIndex('by_next', q => q.lte('nextAt', now)).first()) !== null
    return { rows, more }
  },
})

export const readState = internalQuery({
  args: { readId: v.id('reads') },
  handler: async (ctx, { readId }) => ctx.db.get(readId),
})

export const bookState = internalQuery({
  args: { readId: v.id('reads'), shelfId: v.optional(v.id('shelves')) },
  handler: async (ctx, { readId, shelfId }) => {
    const read = await ctx.db.get(readId)
    const work = read && await ctx.db.get(read.workId)
    const shelf = shelfId && await ctx.db.get(shelfId)
    return read && { read, hardcoverBookId: work?.hardcoverId, hardcoverListId: shelf?.hardcoverListId }
  },
})

/** Keeps the id Hardcover gave a book added here, and sends anything that happened to it in the meantime. */
export const linkRead = internalMutation({
  args: { readId: v.id('reads'), hardcoverUserBookId: v.number() },
  handler: async (ctx, { readId, hardcoverUserBookId }) => {
    const read = await ctx.db.get(readId)
    if (!read) return
    await ctx.db.patch(readId, { hardcoverUserBookId })
    if (read.status !== 'tbr' || read.rating) await enqueueRead(ctx, read.userId, readId)
  },
})

export const entryState = internalQuery({
  args: { entryId: v.id('entries') },
  handler: async (ctx, { entryId }) => {
    const entry = await ctx.db.get(entryId)
    const read = entry && await ctx.db.get(entry.readId)
    const work = read && await ctx.db.get(read.workId)
    return entry && { entry, hardcoverBookId: work?.hardcoverId }
  },
})

export const finish = internalMutation({
  args: { id: v.id('hardcoverOutbox'), version: v.number(), entryId: v.optional(v.id('entries')), journalId: v.optional(v.number()) },
  handler: async (ctx, { id, version, entryId, journalId }) => {
    if (entryId && journalId) {
      const entry = await ctx.db.get(entryId)
      if (entry) await ctx.db.patch(entryId, { hardcoverJournalId: journalId })
    }
    const row = await ctx.db.get(id)
    // Changed while sending: leave it due, so the newer state goes too.
    if (row && row.version === version) await ctx.db.delete(id)
  },
})

/** Keeps Hardcover's id for a read it just created, so the next push updates it instead of adding another. */
// ponytail: matched by position, so removing an earlier read mid-push could misfile it. The hourly pull corrects that.
export const saveReadingId = internalMutation({
  args: { readId: v.id('reads'), index: v.number(), hardcoverId: v.number() },
  handler: async (ctx, { readId, index, hardcoverId }) => {
    const read = await ctx.db.get(readId)
    if (!read?.readings?.[index] || read.readings[index].hardcoverId) return
    await ctx.db.patch(readId, { readings: read.readings.map((r, i) => (i === index ? { ...r, hardcoverId } : r)) })
  },
})

export const clearDeleted = internalMutation({
  args: { readId: v.id('reads'), ids: v.array(v.number()) },
  handler: async (ctx, { readId, ids }) => {
    const read = await ctx.db.get(readId)
    if (read) await ctx.db.patch(readId, { deletedReadings: (read.deletedReadings ?? []).filter(id => !ids.includes(id)) })
  },
})

export const fail = internalMutation({
  args: { id: v.id('hardcoverOutbox'), version: v.number(), error: v.string() },
  handler: async (ctx, { id, version, error }) => {
    const row = await ctx.db.get(id)
    if (!row || row.version !== version) return
    const attempts = row.attempts + 1
    await ctx.db.patch(id, { attempts, nextAt: Date.now() + retryDelayMs(attempts), lastError: error })
  },
})

type HardcoverLength = { pages?: number | null; audio_seconds?: number | null }
type HardcoverRead = { id: number; finished_at?: string | null }

const check = (result: { error?: string | null; errors?: unknown } | null | undefined, what: string) => {
  if (!result) throw new ConvexError(`Hardcover did not confirm ${what}.`)
  if (result.error) throw new ConvexError(`Hardcover refused ${what}: ${result.error}`.slice(0, 200))
  if (result.errors && (!Array.isArray(result.errors) || result.errors.length)) throw new ConvexError(`Hardcover refused ${what}: ${JSON.stringify(result.errors)}`.slice(0, 200))
}

/** Sends the outbox a few rows at a time, and carries on until it's empty. */
export const flush = internalAction({
  args: {},
  handler: async ctx => {
    const { rows, more } = await ctx.runMutation(internal.hardcover.claim, {})
    for (const row of rows) {
      try {
        if (row.kind === 'read' && row.readId) {
          const read = await ctx.runQuery(internal.hardcover.readState, { readId: row.readId })
          if (read?.hardcoverUserBookId) {
            await pace()
            const data = await gql<{ me: { user_books: { edition?: HardcoverLength; book?: HardcoverLength; user_book_reads?: HardcoverRead[] }[] }[] }>(
              `query($id: Int!) { me { user_books(where: {id: {_eq: $id}}) { edition { pages audio_seconds } book { pages audio_seconds } user_book_reads(order_by: {id: desc}, limit: 1) { id finished_at } } } }`,
              { id: read.hardcoverUserBookId },
            )
            const remote = data.me?.[0]?.user_books?.[0]
            if (!remote) throw new ConvexError('That book is no longer on Hardcover.')
            await pace()
            const book = await gql<{ update_user_book: { error?: string } }>(
              'mutation($id: Int!, $object: UserBookUpdateInput!) { update_user_book(id: $id, object: $object) { id error } }',
              { id: read.hardcoverUserBookId, object: { status_id: statusId(read.status), rating: read.rating ?? null } },
            )
            check(book.update_user_book, 'the book')

            const gone = read.deletedReadings ?? []
            for (const id of gone) {
              await pace()
              await gql('mutation($id: Int!) { delete_user_book_read(id: $id) { id } }', { id })
            }
            if (gone.length) await ctx.runMutation(internal.hardcover.clearDeleted, { readId: row.readId, ids: gone })

            if (read.readings?.length) {
              // Every read goes, each with its own dates. Only the latest carries the progress.
              for (const [index, reading] of read.readings.entries()) {
                const latest = index === read.readings.length - 1
                const object = {
                  ...(latest && read.status !== 'tbr' ? progressFields(read.progress.percent, remote.edition, remote.book, { page: read.progress.page, seconds: read.progress.seconds }) : null),
                  ...readingDates(reading),
                }
                await pace()
                // A latest read with no id may be Hardcover's own, from before Margin kept ids: never add a twin of it.
                const theirs = remote.user_book_reads?.[0]?.id
                const id = reading.hardcoverId ?? (latest && theirs && !read.readings.some(r => r.hardcoverId === theirs) ? theirs : undefined)
                if (id) {
                  const update = await gql<{ update_user_book_read: { error?: string } }>(
                    'mutation($id: Int!, $object: DatesReadInput!) { update_user_book_read(id: $id, object: $object) { id error } }',
                    { id, object },
                  )
                  check(update.update_user_book_read, 'the read')
                  if (!reading.hardcoverId) await ctx.runMutation(internal.hardcover.saveReadingId, { readId: row.readId, index, hardcoverId: id })
                } else {
                  const insert = await gql<{ insert_user_book_read: { id?: number; error?: string } }>(
                    'mutation($id: Int!, $read: DatesReadInput!) { insert_user_book_read(user_book_id: $id, user_book_read: $read) { id error } }',
                    { id: read.hardcoverUserBookId, read: object },
                  )
                  check(insert.insert_user_book_read, 'the read')
                  if (insert.insert_user_book_read.id) await ctx.runMutation(internal.hardcover.saveReadingId, { readId: row.readId, index, hardcoverId: insert.insert_user_book_read.id })
                }
              }
            } else if (read.status !== 'tbr') {
              const fields = readFields(
                { status: read.status, percent: read.progress.percent, page: read.progress.page, seconds: read.progress.seconds, startedAt: read.startedAt, finishedAt: read.finishedAt },
                remote.edition, remote.book,
              )
              await pace()
              const existing = remote.user_book_reads?.[0]
              if (existing) {
                const update = await gql<{ update_user_book_read: { error?: string } }>(
                  'mutation($id: Int!, $object: DatesReadInput!) { update_user_book_read(id: $id, object: $object) { id error } }',
                  { id: existing.id, object: fields },
                )
                check(update.update_user_book_read, 'the progress')
              } else {
                const insert = await gql<{ insert_user_book_read: { error?: string } }>(
                  'mutation($id: Int!, $read: DatesReadInput!) { insert_user_book_read(user_book_id: $id, user_book_read: $read) { id error } }',
                  { id: read.hardcoverUserBookId, read: fields },
                )
                check(insert.insert_user_book_read, 'the progress')
              }
            }
          }
          await ctx.runMutation(internal.hardcover.finish, { id: row._id, version: row.version })
        } else if (row.kind === 'addBook' && row.readId) {
          const state = await ctx.runQuery(internal.hardcover.bookState, { readId: row.readId })
          if (state?.hardcoverBookId && !state.read.hardcoverUserBookId) {
            await pace()
            const onHardcover = await gql<{ me: { user_books?: { id: number }[] }[] }>(
              'query($b: Int!) { me { user_books(where: {book_id: {_eq: $b}}, limit: 1) { id } } }',
              { b: state.hardcoverBookId },
            )
            // Already there, perhaps from another device: never add it twice.
            let id = onHardcover.me?.[0]?.user_books?.[0]?.id
            if (!id) {
              await pace()
              const made = await gql<{ insert_user_book: { id?: number; error?: string } }>(
                'mutation($object: UserBookCreateInput!) { insert_user_book(object: $object) { id error } }',
                { object: newUserBook({ hardcoverBookId: state.hardcoverBookId, status: state.read.status, who: state.read.source?.who, addedAt: state.read.addedAt, rating: state.read.rating }) },
              )
              check(made.insert_user_book, 'the new book')
              id = made.insert_user_book.id
              if (!id) throw new ConvexError('Hardcover did not say what it called the new book.')
            }
            await ctx.runMutation(internal.hardcover.linkRead, { readId: row.readId, hardcoverUserBookId: id })
          }
          await ctx.runMutation(internal.hardcover.finish, { id: row._id, version: row.version })
        } else if ((row.kind === 'listBook' || row.kind === 'unlistBook') && row.readId) {
          const state = await ctx.runQuery(internal.hardcover.bookState, { readId: row.readId, shelfId: row.shelfId })
          if (state?.hardcoverBookId && state.hardcoverListId) {
            await pace()
            if (row.kind === 'listBook') {
              const added = await gql<{ insert_list_book: { id?: number; error?: string } }>(
                'mutation($object: ListBookInput!) { insert_list_book(object: $object) { id } }',
                { object: { book_id: state.hardcoverBookId, list_id: state.hardcoverListId } },
              )
              check(added.insert_list_book, 'the list')
            } else {
              const found = await gql<{ me: { lists?: { list_books?: { id: number }[] }[] }[] }>(
                'query($l: Int!, $b: Int!) { me { lists(where: {id: {_eq: $l}}) { list_books(where: {book_id: {_eq: $b}}) { id } } } }',
                { l: state.hardcoverListId, b: state.hardcoverBookId },
              )
              for (const entry of found.me?.[0]?.lists?.[0]?.list_books ?? []) {
                await pace()
                await gql('mutation($id: Int!) { delete_list_book(id: $id) { id } }', { id: entry.id })
              }
            }
          }
          await ctx.runMutation(internal.hardcover.finish, { id: row._id, version: row.version })
        } else if (row.kind === 'entry' && row.entryId) {
          const state = await ctx.runQuery(internal.hardcover.entryState, { entryId: row.entryId })
          let journalId: number | undefined
          if (state?.hardcoverBookId && !state.entry.hardcoverJournalId) {
            const { entry } = state
            await pace()
            const data = await gql<{ insert_reading_journal: { id?: number; errors?: unknown } }>(
              'mutation($object: ReadingJournalCreateType!) { insert_reading_journal(object: $object) { id errors } }',
              { object: journalObject({ kind: entry.kind, text: entry.text, page: entry.pos.page, percent: entry.pos.percent, createdAt: entry.createdAt }, state.hardcoverBookId) },
            )
            check(data.insert_reading_journal, 'the note')
            journalId = data.insert_reading_journal.id
          }
          await ctx.runMutation(internal.hardcover.finish, { id: row._id, version: row.version, entryId: row.entryId, journalId })
        } else if (row.kind === 'deleteJournal' && row.journalId !== undefined) {
          await pace()
          await gql('mutation($id: Int!) { delete_reading_journal(id: $id) { id } }', { id: row.journalId })
          await ctx.runMutation(internal.hardcover.finish, { id: row._id, version: row.version })
        } else {
          await ctx.runMutation(internal.hardcover.finish, { id: row._id, version: row.version })
        }
      } catch (e) {
        await ctx.runMutation(internal.hardcover.fail, { id: row._id, version: row.version, error: message(e) })
      }
    }
    if (more || rows.length === CLAIM) await ctx.scheduler.runAfter(0, internal.hardcover.flush, {})
  },
})

/** For Settings: when it last checked, what's waiting, and anything wrong. */
export const syncStatus = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const link = await ctx.db.query('integrations').withIndex('by_user', q => q.eq('userId', userId)).first()
    const waiting = await ctx.db.query('hardcoverOutbox').withIndex('by_user', q => q.eq('userId', userId)).take(100)
    return {
      lastSyncAt: link?.lastSyncAt ?? null,
      lastError: link?.lastError ?? waiting.find(w => w.lastError)?.lastError ?? null,
      pending: waiting.length,
    }
  },
})
