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
    if (query.includes('search(query')) data.search = { results: { hits: ((answers.search ?? []) as object[]).map(document => ({ document })) } }
    else if (query.includes('insert_user_book(')) data.insert_user_book = { id: 4242 }
    else if (query.includes('insert_list_book')) data.insert_list_book = { id: 9 }
    else if (query.includes('delete_list_book')) data.delete_list_book = { id: 9 }
    else if (query.includes('lists(where')) data.me = [{ lists: [{ list_books: answers.onList ?? [] }] }]
    else if (query.includes('lists(limit')) data.me = [{ lists: answers.lists ?? [] }]
    else if (query.includes('user_books(where: {book_id')) data.me = [{ user_books: answers.already ?? [] }]
    else if (query.includes('update_user_book_read')) data.update_user_book_read = { id: 1 }
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

  const texts = (await as.query(api.library.allEntries, {})).map(e => e.text).sort()
  expect(texts).toEqual(['Edited on Hardcover.', 'Mine first.'])
})

test('tags come in on journals, follow edits there, and go out with the note when changed here', async () => {
  const calls = fakeHardcover()
  const { t, as, userId } = await setup()
  const save = (items: any[]) => t.mutation(internal.hardcover.saveJournal, { userId, items })
  const note = { journalId: 5, hardcoverBookId: 1, kind: 'note' as const, text: 'Tagged there.', tags: ['Theme'] }
  await save([note])
  await save([{ ...note, tags: ['Theme', 'Feminism'] }])
  const [entry] = await t.run(ctx => ctx.db.query('entries').collect())
  expect(entry.tags).toEqual(['Theme', 'Feminism'])
  await flushTimers(t.action(internal.hardcover.flush, {}))
  expect(writes(calls)).toEqual([])

  await as.mutation(api.entries.setTags, { id: entry._id, tags: [' Feminism', 'feminism', 'Grief', ''] })
  await as.mutation(api.entries.setTags, { id: entry._id, tags: ['Feminism', 'Grief'] })
  expect((await t.run(ctx => ctx.db.get(entry._id)))?.tags).toEqual(['Feminism', 'Grief'])
  // The old copy, still on Hardcover until it's deleted, mustn't undo the change.
  await save([note])
  expect((await t.run(ctx => ctx.db.get(entry._id)))?.tags).toEqual(['Feminism', 'Grief'])

  await flushTimers(t.action(internal.hardcover.flush, {}))
  const sent = writes(calls)
  expect(sent.filter(c => c.query.includes('delete_reading_journal(')).map(c => c.variables.id)).toEqual([5])
  const inserts = sent.filter(c => c.query.includes('insert_reading_journal'))
  expect(inserts).toHaveLength(1)
  expect(inserts[0].variables.object.tags).toEqual([
    { category: 'general', spoiler: false, tag: 'Feminism' },
    { category: 'general', spoiler: false, tag: 'Grief' },
  ])
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

  expect(journalObject({ kind: 'summary', text: 'S', createdAt: 0 }, 3)).toMatchObject({ event: 'note', metadata: {}, tags: [] })
  expect(mapJournal({ id: 1, event: 'note', entry: 'x', book_id: 2, taggings: [{ tag: { tag: ' Theme ' } }, { tag: null }] })?.tags).toEqual(['Theme'])
  expect(progressChanged(50, 51)).toBe(false)
  expect(progressChanged(50, 52)).toBe(true)
})

const readsBook = (user_book_reads: unknown[], status_id = 3) => ({
  id: 10, status_id, date_added: '2020-01-01', edition: { pages: 200 },
  book: { id: 1, title: 'Book One', pages: 200, cached_contributors: [{ author: { name: 'An Author' } }] },
  user_book_reads,
})

test('every read comes in with its dates, oldest first, and the import fills in books it already had', async () => {
  fakeHardcover({
    library: [readsBook([{ id: 2, started_at: '2023-01-01', finished_at: '2023-02-01' }, { id: 1, started_at: '2020-01-01', finished_at: '2020-03-01' }])],
  })
  const { t, as, userId } = await setup()
  await flushTimers(t.action(internal.hardcover.importFor, { userId }))
  const [book] = await as.query(api.library.myBooks, {})
  expect(book.readings).toEqual([
    { hardcoverId: 1, startedAt: Date.UTC(2020, 0, 1), finishedAt: Date.UTC(2020, 2, 1) },
    { hardcoverId: 2, startedAt: Date.UTC(2023, 0, 1), finishedAt: Date.UTC(2023, 1, 1) },
  ])
})

test('the hourly pull brings in a date changed on Hardcover, and one cleared there clears here', async () => {
  fakeHardcover({ library: [readsBook([{ id: 1, started_at: '2021-05-05', finished_at: null }], 2)] })
  const { t, as, readId } = await setup()
  await t.run(async ctx => {
    await ctx.db.patch(readId, { startedAt: 5, readings: [{ hardcoverId: 1, startedAt: 5, finishedAt: 9 }] })
    await ctx.db.insert('integrations', { userId: (await ctx.db.get(readId))!.userId, provider: 'hardcover', hardcoverUserId: 1, cursor: '2020-01-01T00:00:00Z' })
  })
  await flushTimers(t.action(internal.hardcover.reconcile, {}))
  const [book] = await as.query(api.library.myBooks, {})
  expect(book.readings).toEqual([{ hardcoverId: 1, startedAt: Date.UTC(2021, 4, 5) }])
  expect(book.startedAt).toBe(Date.UTC(2021, 4, 5))
})

test('a change still waiting to send is not overwritten by the pull', async () => {
  fakeHardcover({ library: [readsBook([{ id: 1, started_at: '2021-05-05' }], 2)] })
  const { t, as, readId, userId } = await setup()
  await as.mutation(api.library.saveReadings, { readId, readings: [{ startedAt: Date.UTC(2024, 0, 1) }] })
  await t.run(ctx => ctx.db.insert('integrations', { userId, provider: 'hardcover', hardcoverUserId: 1, cursor: '2020-01-01T00:00:00Z' }))
  // Hold the outbox row back, as if the send hasn't happened yet.
  await t.run(async ctx => { for (const r of await ctx.db.query('hardcoverOutbox').collect()) await ctx.db.patch(r._id, { nextAt: Date.now() + 3_600_000 }) })
  await flushTimers(t.action(internal.hardcover.reconcile, {}))
  expect((await as.query(api.library.myBooks, {}))[0].startedAt).toBe(Date.UTC(2024, 0, 1))
})

test('edited reads go to Hardcover: changed dates, a new read, a removed one, and a cleared date', async () => {
  const calls = fakeHardcover({ remote: { edition: { pages: 200 }, book: { pages: 200 }, user_book_reads: [{ id: 3 }] } })
  const { t, as, readId } = await setup()
  await t.run(ctx => ctx.db.patch(readId, { readings: [{ hardcoverId: 1, startedAt: 1000 }, { hardcoverId: 2, startedAt: 2000 }, { hardcoverId: 3, startedAt: 3000 }] }))
  await as.mutation(api.library.saveReadings, {
    readId,
    readings: [
      { hardcoverId: 1, startedAt: Date.UTC(2020, 0, 1) },
      { hardcoverId: 3, startedAt: Date.UTC(2021, 0, 1), finishedAt: Date.UTC(2021, 1, 1) },
      { startedAt: Date.UTC(2024, 0, 1) },
    ],
  })
  await flushTimers(t.action(internal.hardcover.flush, {}))
  const sent = writes(calls)

  expect(sent.filter(c => c.query.includes('delete_user_book_read')).map(c => c.variables.id)).toEqual([2])
  const updates = sent.filter(c => c.query.includes('update_user_book_read'))
  expect(updates.map(c => c.variables.id)).toEqual([1, 3])
  expect(updates[0].variables.object).toEqual({ started_at: '2020-01-01', finished_at: null })
  expect(updates[1].variables.object).toEqual({ started_at: '2021-01-01', finished_at: '2021-02-01' })
  expect(sent.filter(c => c.query.includes('insert_user_book_read'))[0].variables.read).toMatchObject({ started_at: '2024-01-01', finished_at: null, progress_pages: 20 })

  const after = await t.run(ctx => ctx.db.get(readId))
  expect(after!.deletedReadings).toEqual([])
  expect(after!.readings!.at(-1)!.hardcoverId).toBe(1)
})

test('a read with no id takes over the one Hardcover already has, rather than adding a twin', async () => {
  const calls = fakeHardcover()
  const { t, as, readId } = await setup()
  await as.mutation(api.library.setStatus, { readId, status: 'read' })
  await flushTimers(t.action(internal.hardcover.flush, {}))
  expect(writes(calls).filter(c => c.query.includes('insert_user_book_read'))).toEqual([])
  expect((await t.run(ctx => ctx.db.get(readId)))!.readings!.at(-1)!.hardcoverId).toBe(55)
})

test('a logged page goes to Hardcover exactly, not rounded through percent', () => {
  expect(progressFields(25, { pages: 1000 }, null, { page: 246 })).toEqual({ progress_pages: 246 })
  expect(progressFields(25, { audio_seconds: 1000 }, null, { seconds: 251 })).toEqual({ progress_seconds: 251 })
  expect(progressFields(100, { pages: 1000 }, null, { page: 246 })).toEqual({ progress_pages: 1000 })
})

const piranesi = { id: '175280', title: 'Piranesi', author_names: ['Susanna Clarke'], release_year: 2020, pages: 245, isbns: ['9781526622433'], genres: ['Fantasy'], image: { url: 'https://a/p.jpg' }, users_count: 9000 }
const studyGuide = { id: '984550', title: 'Piranesi by Susanna Clarke', author_names: ['Someone Else'], pages: 13, users_count: 2 }

test('search puts the book itself above its study guides, and says what is already here', async () => {
  fakeHardcover({ search: [studyGuide, piranesi] })
  const { as } = await setup()
  const found = await as.action(api.books.search, { q: 'Piranesi' })
  expect(found.map(f => f.book.hardcoverId)).toEqual([175280, 984550])
  expect(found[0]).toMatchObject({ onShelves: false, book: { title: 'Piranesi', authors: ['Susanna Clarke'], pages: 245, subjects: ['Fantasy'] } })
  await expect(convexTest(schema, import.meta.glob('./**/*.ts')).action(api.books.search, { q: 'x' })).rejects.toThrow()
})

const addable = { hardcoverId: 175280, slug: 'piranesi-clarke-3rna', title: 'Piranesi', authors: ['Susanna Clarke'], isbns: [], subjects: ['Fantasy'], pages: 245 }

test('a new book lands on the shelves and goes to Hardcover with its source, and adding it again changes nothing', async () => {
  const calls = fakeHardcover()
  const { t, as, outbox } = await setup()
  const [first] = await as.mutation(api.books.addBooks, { books: [addable], status: 'tbr', source: { kind: 'social', who: '@bookish', url: 'https://www.instagram.com/p/x/' } })
  expect(first).toMatchObject({ slug: 'piranesi-clarke-3rna', added: true })
  await flushTimers(t.action(internal.hardcover.flush, {}))

  expect(writes(calls).find(c => c.query.includes('insert_user_book('))?.variables.object).toMatchObject({ book_id: 175280, status_id: 1, recommended_by: '@bookish' })
  expect(await outbox()).toEqual([])
  const book = (await as.query(api.library.myBooks, {})).find(b => b.slug === addable.slug)!
  expect(book).toMatchObject({ status: 'tbr', recommendedBy: '@bookish', pages: 245 })
  expect((await t.run(ctx => ctx.db.get(book.readId)))!.hardcoverUserBookId).toBe(4242)
  expect(await t.run(ctx => ctx.db.query('people').collect())).toMatchObject([{ name: '@bookish' }])

  const [again] = await as.mutation(api.books.addBooks, { books: [addable], status: 'read' })
  expect(again.added).toBe(false)
  expect((await as.query(api.library.myBooks, {})).find(b => b.slug === addable.slug)!.status).toBe('tbr')
})

test('a book already on Hardcover is linked, not added twice', async () => {
  const calls = fakeHardcover({ already: [{ id: 777 }] })
  const { t, as } = await setup()
  await as.mutation(api.books.addBooks, { books: [addable], status: 'tbr' })
  await flushTimers(t.action(internal.hardcover.flush, {}))
  expect(writes(calls).filter(c => c.query.includes('insert_user_book('))).toEqual([])
  const book = (await as.query(api.library.myBooks, {})).find(b => b.slug === addable.slug)!
  expect((await t.run(ctx => ctx.db.get(book.readId)))!.hardcoverUserBookId).toBe(777)
})

test('a failed add keeps the book here and tries again', async () => {
  fakeHardcover({ errors: [{ message: 'nope' }] })
  const { t, as, outbox } = await setup()
  await as.mutation(api.books.addBooks, { books: [addable], status: 'tbr' })
  await flushTimers(t.action(internal.hardcover.flush, {}))
  expect((await as.query(api.library.myBooks, {})).some(b => b.slug === addable.slug)).toBe(true)
  expect(await outbox()).toMatchObject([{ kind: 'addBook', attempts: 1 }])
})

test('lists come in from Hardcover, and a deleted list goes', async () => {
  fakeHardcover({ library: [], lists: [{ id: 5, name: 'Own', slug: 'own', list_books: [{ book_id: 1 }] }, { id: 6, name: 'Read', slug: 'read', list_books: [] }] })
  const { t, as, userId } = await setup()
  await t.run(ctx => ctx.db.insert('integrations', { userId, provider: 'hardcover', hardcoverUserId: 1, cursor: '2020-01-01T00:00:00Z' }))
  await flushTimers(t.action(internal.hardcover.reconcile, {}))
  const lists = await as.query(api.books.myLists, {})
  expect(lists.map(l => [l.name, l.slug])).toEqual([['Own', 'own'], ['Read', 'list-read']])
  expect((await as.query(api.library.myBooks, {}))[0].shelfIds).toEqual([lists[0].id])

  await t.mutation(internal.hardcover.saveLists, { userId, lists: [{ hardcoverListId: 6, name: 'Read', slug: 'list-read', bookIds: [] }] })
  expect((await as.query(api.books.myLists, {})).map(l => l.name)).toEqual(['Read'])
  expect((await as.query(api.library.myBooks, {}))[0].shelfIds).toEqual([])
})

test('a reply without lists never empties them', async () => {
  fakeHardcover()
  const { t, as, userId } = await setup()
  await t.mutation(internal.hardcover.saveLists, { userId, lists: [{ hardcoverListId: 5, name: 'Own', slug: 'own', bookIds: [1] }] })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { me: [{ user_books: [] }] } }))))
  await t.run(ctx => ctx.db.insert('integrations', { userId, provider: 'hardcover', hardcoverUserId: 1, cursor: '2020-01-01T00:00:00Z' }))
  await flushTimers(t.action(internal.hardcover.reconcile, {}))
  expect(await as.query(api.books.myLists, {})).toHaveLength(1)
})

test('putting a book on a list and taking it off both reach Hardcover', async () => {
  const calls = fakeHardcover({ onList: [{ id: 31 }] })
  const { t, as, readId, userId } = await setup()
  await t.mutation(internal.hardcover.saveLists, { userId, lists: [{ hardcoverListId: 5, name: 'Own', slug: 'own', bookIds: [] }] })
  const [{ id: listId }] = await as.query(api.books.myLists, {})

  await as.mutation(api.books.setOnList, { readId, listId, on: true })
  await flushTimers(t.action(internal.hardcover.flush, {}))
  expect(writes(calls).find(c => c.query.includes('insert_list_book'))?.variables.object).toEqual({ book_id: 1, list_id: 5 })

  await as.mutation(api.books.setOnList, { readId, listId, on: false })
  await flushTimers(t.action(internal.hardcover.flush, {}))
  expect(writes(calls).find(c => c.query.includes('delete_list_book'))?.variables).toEqual({ id: 31 })
})

test('the sync only writes what moved, whatever order the fields come in', async () => {
  const { changes } = await import('./hardcover')
  const doc = { status: 'reading', progress: { percent: 10, page: 20 }, rating: undefined }
  expect(changes(doc, { status: 'reading', progress: { page: 20, percent: 10 }, rating: undefined })).toBe(false)
  expect(changes(doc, { progress: { percent: 11, page: 20 } })).toBe(true)
  expect(changes(doc, { rating: 4 })).toBe(true)
  expect(changes(doc, { startedAt: undefined })).toBe(false)
})

test('deleting a book removes everything of it here, then the book and its journal on Hardcover, and it stays gone', async () => {
  const calls = fakeHardcover()
  const { t, as, userId, readId, outbox } = await setup()
  await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'A thought.' })
  await as.mutation(api.library.logProgress, { readId, percent: 30 })
  await as.mutation(api.library.deleteBook, { readId })

  expect(await as.query(api.library.myBooks, {})).toEqual([])
  expect(await t.run(ctx => ctx.db.query('entries').collect())).toEqual([])
  expect(await t.run(ctx => ctx.db.query('progressLog').collect())).toEqual([])
  expect((await outbox()).map(r => [r.kind, r.userBookId, r.bookId])).toEqual([['deleteBook', 10, 1]])

  // A pull before the deletion is sent doesn't bring it back.
  await t.mutation(internal.hardcover.saveBooks, {
    userId,
    items: [{ work: { hardcoverId: 1, slug: 'book-1', title: 'Book One', authors: ['An Author'], isbns: [], subjects: [] }, read: { hardcoverUserBookId: 10, status: 'reading', percent: 10, format: 'print', owned: false } }],
  })
  expect(await as.query(api.library.myBooks, {})).toEqual([])

  await flushTimers(t.action(internal.hardcover.flush, {}))
  expect(writes(calls).map(c => [c.query.match(/delete_\w+/)?.[0], c.variables.id])).toEqual([['delete_reading_journals_for_book', 1], ['delete_user_book', 10]])
  expect(await outbox()).toEqual([])
})
