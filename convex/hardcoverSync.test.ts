// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import { journalObject, mapJournal, progressChanged, progressFields, readFields } from './lib/hardcover'
import { retryDelayMs } from './lib/outbox'
import schema from './schema'

type Call = { query: string; variables: Record<string, any> }

/** A stand-in for Hardcover. Nothing here ever reaches the real API. */
function fakeHardcover(answers: Record<string, unknown> = {}) {
  const calls: Call[] = []
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    const { query, variables } = JSON.parse(init.body)
    calls.push({ query, variables })
    const data: Record<string, unknown> = {}
    if (query.includes('update_user_book_read')) data.update_user_book_read = { id: 1 }
    else if (query.includes('insert_user_book_read')) data.insert_user_book_read = { id: 1 }
    else if (query.includes('update_user_book(')) data.update_user_book = { id: 1 }
    else if (query.includes('insert_reading_journal')) data.insert_reading_journal = { id: 777 }
    else if (query.includes('delete_reading_journal')) data.delete_reading_journal = { id: 777 }
    else if (query.includes('updated_at')) Object.assign(data, { me: [{ user_books: [] }], reading_journals: [] }, answers.sync as object)
    else if (query.includes('reading_journals')) data.reading_journals = answers.journals ?? []
    else if (query.includes('edition { pages audio_seconds }')) data.me = [{ user_books: [answers.remote ?? { edition: { pages: 200 }, book: { pages: 200 }, user_book_reads: [{ id: 55 }] }] }]
    else if (query.includes('{ me { id } }')) data.me = [{ id: 59320 }]
    else data.me = [{ user_books: answers.library ?? [] }]
    return new Response(JSON.stringify(answers.errors ? { errors: answers.errors } : { data }))
  }))
  return calls
}

const writes = (calls: Call[]) => calls.filter(c => c.query.trim().startsWith('mutation'))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.stubEnv('HARDCOVER_API_KEY', 'test-token')
  vi.stubEnv('HARDCOVER_PACE_MS', '0')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const flushTimers = <T>(run: Promise<T>) => vi.runAllTimersAsync().then(() => run)

const setup = async () => {
  const t = convexTest(schema, import.meta.glob('./**/*.ts'))
  const userId = await t.run(ctx => ctx.db.insert('users', { name: 'Steve' }))
  const as = t.withIdentity({ subject: `${userId}|session` })
  await t.mutation(internal.hardcover.saveBooks, {
    userId,
    items: [{
      work: { hardcoverId: 1, slug: 'book-1', title: 'Book One', authors: ['An Author'], isbns: [], subjects: [], pages: 200 },
      read: { hardcoverUserBookId: 10, status: 'reading', percent: 10, format: 'print', owned: false },
    }],
  })
  const [{ readId }] = await as.query(api.library.myBooks, {})
  const outbox = () => t.run(ctx => ctx.db.query('hardcoverOutbox').collect())
  const clearScheduled = async () => { await vi.runAllTimersAsync() }
  return { t, as, userId, readId, outbox, clearScheduled }
}

test('logging progress reaches Hardcover as pages, and empties the outbox', async () => {
  const calls = fakeHardcover()
  const { t, as, readId, outbox } = await setup()
  await as.mutation(api.library.logProgress, { readId, percent: 50 })
  expect(await outbox()).toHaveLength(1)

  await flushTimers(t.action(internal.hardcover.flush, {}))
  const sent = writes(calls)
  expect(sent.find(c => c.query.includes('update_user_book('))?.variables).toEqual({ id: 10, object: { status_id: 2, rating: null } })
  expect(sent.find(c => c.query.includes('update_user_book_read'))?.variables).toMatchObject({ id: 55, object: { progress_pages: 100 } })
  expect(await outbox()).toEqual([])
})

test('an audiobook is sent in seconds, and a book with no read record gets one', async () => {
  const calls = fakeHardcover({ remote: { edition: { audio_seconds: 1000 }, book: { pages: 300 }, user_book_reads: [] } })
  const { t, as, readId } = await setup()
  await as.mutation(api.library.logProgress, { readId, percent: 25 })
  await flushTimers(t.action(internal.hardcover.flush, {}))
  expect(writes(calls).find(c => c.query.includes('insert_user_book_read'))?.variables).toMatchObject({ id: 10, read: { progress_seconds: 250 } })
})

test('status and rating changes go to Hardcover, and finishing a book sends its finish date', async () => {
  const calls = fakeHardcover()
  const { t, as, readId } = await setup()
  await as.mutation(api.library.setRating, { readId, rating: 4.5 })
  await as.mutation(api.library.setStatus, { readId, status: 'read' })
  await flushTimers(t.action(internal.hardcover.flush, {}))

  expect(writes(calls).find(c => c.query.includes('update_user_book('))?.variables.object).toEqual({ status_id: 3, rating: 4.5 })
  const read = writes(calls).find(c => c.query.includes('update_user_book_read'))?.variables.object
  expect(read.progress_pages).toBe(200)
  expect(read.finished_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test('several quick changes to one book become one row, with the latest state', async () => {
  const calls = fakeHardcover()
  const { t, as, readId, outbox } = await setup()
  await as.mutation(api.library.logProgress, { readId, percent: 20 })
  await as.mutation(api.library.logProgress, { readId, percent: 30 })
  expect(await outbox()).toHaveLength(1)
  await flushTimers(t.action(internal.hardcover.flush, {}))
  expect(writes(calls).filter(c => c.query.includes('update_user_book_read')).map(c => c.variables.object.progress_pages)).toContain(60)
})

test('a failure keeps the change and backs off instead of losing it', async () => {
  fakeHardcover({ errors: [{ message: 'nope' }] })
  const { t, as, readId, outbox } = await setup()
  await as.mutation(api.library.logProgress, { readId, percent: 50 })
  await flushTimers(t.action(internal.hardcover.flush, {}))
  const [row] = await outbox()
  expect(row.attempts).toBe(1)
  expect(row.lastError).toContain('nope')
  expect(row.nextAt).toBeGreaterThan(Date.now())
  expect((await as.query(api.hardcover.syncStatus, {}))?.pending).toBe(1)
  expect(retryDelayMs(1)).toBe(120_000)
  expect(retryDelayMs(20)).toBe(3_600_000)
})

test('a new note goes to Hardcover privately and remembers its id; deleting it deletes it there', async () => {
  const calls = fakeHardcover()
  const { t, as, readId, outbox } = await setup()
  const { id } = await as.mutation(api.entries.addEntry, { readId, kind: 'excerpt', text: 'A line.', page: 7 })
  await flushTimers(t.action(internal.hardcover.flush, {}))

  const object = writes(calls).find(c => c.query.includes('insert_reading_journal'))?.variables.object
  expect(object).toMatchObject({ book_id: 1, event: 'quote', entry: 'A line.', privacy_setting_id: 3, metadata: { position: { type: 'pages', value: 7 } } })
  expect((await t.run(ctx => ctx.db.get(id)))?.hardcoverJournalId).toBe(777)

  await as.mutation(api.entries.removeEntry, { id })
  await flushTimers(t.action(internal.hardcover.flush, {}))
  expect(writes(calls).find(c => c.query.includes('delete_reading_journal'))?.variables).toEqual({ id: 777 })
  expect(await outbox()).toEqual([])
})

test('a note deleted before it was sent is never sent', async () => {
  const calls = fakeHardcover()
  const { t, as, readId, outbox } = await setup()
  const { id } = await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Oops.' })
  await as.mutation(api.entries.removeEntry, { id })
  expect(await outbox()).toEqual([])
  await flushTimers(t.action(internal.hardcover.flush, {}))
  expect(writes(calls)).toEqual([])
})

const remoteBook = (over: Record<string, unknown> = {}) => ({
  id: 10, status_id: 2, rating: 3, edition: { pages: 200 },
  book: { id: 1, title: 'Book One', pages: 200 },
  user_book_reads: [{ progress: 70 }],
  ...over,
})
const connect = (t: Awaited<ReturnType<typeof setup>>['t'], userId: any) =>
  t.mutation(internal.hardcover.connect, { userId, hardcoverUserId: 59320, cursor: '2026-01-01T00:00:00.000Z' })

test('a change on Hardcover comes into Margin and is logged, without being sent back', async () => {
  const calls = fakeHardcover({ sync: { me: [{ user_books: [remoteBook()] }] } })
  const { t, as, userId, outbox } = await setup()
  await connect(t, userId)
  await flushTimers(t.action(internal.hardcover.syncAll, {}))

  const [book] = await as.query(api.library.myBooks, {})
  expect(book).toMatchObject({ percent: 70, rating: 3 })
  const log = await t.run(ctx => ctx.db.query('progressLog').collect())
  expect(log).toMatchObject([{ percent: 70, origin: 'hardcover' }])
  expect(await outbox()).toEqual([])
  expect(writes(calls)).toEqual([])
})

test('a change waiting to send beats what Hardcover says', async () => {
  fakeHardcover({ sync: { me: [{ user_books: [remoteBook()] }] } })
  const { t, as, userId, readId } = await setup()
  await connect(t, userId)
  await as.mutation(api.library.logProgress, { readId, percent: 40 })
  await t.mutation(internal.hardcover.saveBooks, {
    userId,
    update: true,
    items: [{
      work: { hardcoverId: 1, slug: 'book-1', title: 'Book One', authors: [], isbns: [], subjects: [] },
      read: { hardcoverUserBookId: 10, status: 'read', percent: 100, progressKnown: true, format: 'print', owned: false },
    }],
  })
  expect((await as.query(api.library.myBooks, {}))[0]).toMatchObject({ percent: 40, status: 'reading' })
})

test('rounding differences and missing progress never change what Margin knows', async () => {
  fakeHardcover()
  const { t, as, userId } = await setup()
  const item = (read: Record<string, unknown>) => ({
    work: { hardcoverId: 1, slug: 'book-1', title: 'Book One', authors: [], isbns: [], subjects: [] },
    read: { hardcoverUserBookId: 10, status: 'reading' as const, format: 'print' as const, owned: false, percent: 0, ...read },
  })
  await t.mutation(internal.hardcover.saveBooks, { userId, update: true, items: [item({ percent: 11, progressKnown: true })] })
  expect((await as.query(api.library.myBooks, {}))[0].percent).toBe(10)
  await t.mutation(internal.hardcover.saveBooks, { userId, update: true, items: [item({ percent: 0, progressKnown: false })] })
  expect((await as.query(api.library.myBooks, {}))[0].percent).toBe(10)
})

test('notes come in once, match ones sent from Margin, and follow edits; other journal events are skipped', async () => {
  fakeHardcover()
  const { t, as, userId, readId } = await setup()
  const { id } = await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Mine first.' })
  const save = (items: any[]) => t.mutation(internal.hardcover.saveJournal, { userId, items })
  const note = { journalId: 5, hardcoverBookId: 1, kind: 'note' as const, text: 'From Hardcover.', page: 3 }

  expect(await save([note])).toEqual({ added: 1 })
  expect(await save([note])).toEqual({ added: 0 })
  expect(await save([{ ...note, text: 'Edited on Hardcover.' }])).toEqual({ added: 0 })
  expect(await save([{ journalId: 6, hardcoverBookId: 1, kind: 'note', text: 'mine   FIRST.' }])).toEqual({ added: 0 })
  expect((await t.run(ctx => ctx.db.get(id)))?.hardcoverJournalId).toBe(6)
  expect(await save([{ ...note, journalId: 7, hardcoverBookId: 999, text: 'Book not on my shelves.' }])).toEqual({ added: 0 })

  const texts = (await as.query(api.library.recentEntries, {})).map(e => e.text).sort()
  expect(texts).toEqual(['Edited on Hardcover.', 'Mine first.'])
})

test('a review comes in, follows edits, and can\'t be deleted from Margin', async () => {
  fakeHardcover()
  const { t, as, userId } = await setup()
  const item = (text: string) => ({
    work: { hardcoverId: 1, slug: 'book-1', title: 'Book One', authors: [], isbns: [], subjects: [] },
    read: { hardcoverUserBookId: 10, status: 'read' as const, percent: 100, format: 'print' as const, owned: false, review: { text } },
  })
  expect((await t.mutation(internal.hardcover.saveBooks, { userId, items: [item('Loved it.')] })).notes).toBe(1)
  expect((await t.mutation(internal.hardcover.saveBooks, { userId, items: [item('Loved it more.')] })).notes).toBe(0)
  const found = await as.query(api.library.bookBySlug, { slug: 'book-1' })
  expect(found?.entries).toMatchObject([{ kind: 'review', text: 'Loved it more.' }])
  await expect(as.mutation(api.entries.removeEntry, { id: found!.entries[0].id })).rejects.toThrow()
})

test('sync problems are reported and the cursor stays put, so nothing is missed', async () => {
  fakeHardcover({ errors: [{ message: 'down' }] })
  const { t, as, userId } = await setup()
  await connect(t, userId)
  await flushTimers(t.action(internal.hardcover.syncAll, {}))
  expect((await as.query(api.hardcover.syncStatus, {}))?.lastError).toContain('down')
  const [link] = await t.run(ctx => ctx.db.query('integrations').collect())
  expect(link.cursor).toBe('2026-01-01T00:00:00.000Z')
})

test('sync does nothing for readers who have not imported yet', async () => {
  const calls = fakeHardcover()
  const { t } = await setup()
  await flushTimers(t.action(internal.hardcover.syncAll, {}))
  expect(calls).toEqual([])
})

test('pure pieces: lengths, journal mapping and rounding', () => {
  expect(progressFields(50, { audio_seconds: 100 }, { pages: 300 })).toEqual({ progress_seconds: 50 })
  expect(progressFields(50, { pages: 100 }, { pages: 300 })).toEqual({ progress_pages: 50 })
  expect(progressFields(50, { pages: null }, { pages: 300 })).toEqual({ progress_pages: 150 })
  expect(progressFields(50, null, null)).toBeNull()
  expect(readFields({ status: 'reading', percent: 50, finishedAt: 1 }, { pages: 10 }).finished_at).toBeUndefined()

  expect(mapJournal({ id: 1, event: 'rated', entry: 'x', book_id: 2 })).toBeNull()
  expect(mapJournal({ id: 1, event: 'note', entry: '  ', book_id: 2 })).toBeNull()
  expect(mapJournal({ id: 1, event: 'quote', entry: 'Hi', book_id: 2, metadata: { position: { type: 'pages', value: 415, percent: 95 } } })).toMatchObject({ kind: 'excerpt', page: 415, percent: undefined })
  expect(mapJournal({ id: 1, event: 'note', entry: 'Hi', book_id: 2, metadata: { position: { type: 'seconds', value: 900, percent: 12.4 } } })).toMatchObject({ kind: 'note', page: undefined, percent: 12 })

  expect(journalObject({ kind: 'summary', text: 'S', createdAt: 0 }, 3)).toMatchObject({ event: 'note', metadata: {} })
  expect(progressChanged(50, 51)).toBe(false)
  expect(progressChanged(50, 52)).toBe(true)
})
