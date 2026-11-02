// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { afterEach, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')
const setup = () => convexTest(schema, modules)
type T = ReturnType<typeof setup>

const reader = async (t: T, name = 'Steve') => {
  const userId = await t.run(ctx => ctx.db.insert('users', { name }))
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) }
}

const item = (id: number, read: Record<string, unknown> = {}) => ({
  work: { hardcoverId: id, slug: `book-${id}`, title: `Book ${id}`, authors: ['An Author'], isbns: [], subjects: [], pages: 200 },
  read: { hardcoverUserBookId: id * 10, status: 'reading' as const, percent: 10, format: 'print' as const, owned: false, addedAt: Date.UTC(2024, 5, 1), ...read },
})

afterEach(() => vi.unstubAllGlobals())

test('signed out, there is nothing to see and nothing can be done', async () => {
  const t = setup()
  const { userId, as } = await reader(t)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item(1)] })
  const [{ readId }] = await as.query(api.library.myBooks, {})

  expect(await t.query(api.library.myBooks, {})).toEqual([])
  expect(await t.query(api.library.allEntries, {})).toEqual([])
  expect(await t.query(api.library.bookBySlug, { slug: 'book-1' })).toBeNull()
  await expect(t.mutation(api.library.logProgress, { readId, percent: 50 })).rejects.toThrow()
  await expect(t.action(api.hardcover.importLibrary, {})).rejects.toThrow()
})

test('importing twice creates no duplicates and keeps what the reader did since', async () => {
  const t = setup()
  const { userId, as } = await reader(t)
  expect(await t.mutation(internal.hardcover.saveBooks, { userId, items: [item(1), item(2)] })).toEqual({ added: 2, existing: 0, notes: 0 })

  const before = await as.query(api.library.myBooks, {})
  await as.mutation(api.library.logProgress, { readId: before[0].readId, percent: 62 })

  expect(await t.mutation(internal.hardcover.saveBooks, { userId, items: [item(1), item(2), item(3)] })).toEqual({ added: 1, existing: 2, notes: 0 })
  const after = await as.query(api.library.myBooks, {})
  expect(after).toHaveLength(3)
  expect(after.find(b => b.readId === before[0].readId)?.percent).toBe(62)
})

test('a slug never changes on re-import, though other facts update', async () => {
  const t = setup()
  const { userId, as } = await reader(t)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item(1)] })
  const changed = item(1)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [{ ...changed, work: { ...changed.work, slug: 'renamed', title: 'New title' } }] })
  const [book] = await as.query(api.library.myBooks, {})
  expect(book).toMatchObject({ slug: 'book-1', title: 'New title' })
})

test('readers share a work but never see or change each other\'s reads', async () => {
  const t = setup()
  const steve = await reader(t, 'Steve')
  const sam = await reader(t, 'Sam')
  await t.mutation(internal.hardcover.saveBooks, { userId: steve.userId, items: [item(1)] })
  await t.mutation(internal.hardcover.saveBooks, { userId: sam.userId, items: [item(1, { hardcoverUserBookId: 99 })] })
  await t.mutation(internal.hardcover.saveBooks, { userId: steve.userId, items: [item(2)] })

  expect(await t.run(ctx => ctx.db.query('works').collect())).toHaveLength(2)
  expect(await sam.as.query(api.library.myBooks, {})).toHaveLength(1)
  expect(await sam.as.query(api.library.bookBySlug, { slug: 'book-2' })).toBeNull()

  const steveBook = (await steve.as.query(api.library.myBooks, {}))[0]
  await expect(sam.as.mutation(api.library.logProgress, { readId: steveBook.readId, percent: 90 })).rejects.toThrow()
  expect((await steve.as.query(api.library.bookBySlug, { slug: steveBook.slug }))?.book.percent).toBe(10)
})

test('logging progress is kept in range, works out the page, and is written to the log', async () => {
  const t = setup()
  const { userId, as } = await reader(t)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item(1)] })
  const [{ readId }] = await as.query(api.library.myBooks, {})

  await as.mutation(api.library.logProgress, { readId, percent: 50.4 })
  expect((await as.query(api.library.myBooks, {}))[0]).toMatchObject({ percent: 50, page: 101 })
  await as.mutation(api.library.logProgress, { readId, percent: 400 })
  expect((await as.query(api.library.myBooks, {}))[0].percent).toBe(100)
  await expect(as.mutation(api.library.logProgress, { readId, percent: Number.NaN })).rejects.toThrow()

  expect(await t.run(ctx => ctx.db.query('progressLog').collect())).toHaveLength(2)
})

test('a page or a time is kept exactly, and the very last page finishes the book', async () => {
  const t = setup()
  const { userId, as } = await reader(t)
  const audio = item(2)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [{ ...item(1), work: { ...item(1).work, pages: 1000 } }, { ...audio, work: { ...audio.work, pages: undefined, audioSeconds: 36_000 } }] })
  const of = async (slug: string) => (await as.query(api.library.myBooks, {})).find(b => b.slug === slug)!
  const { readId } = await of('book-1')

  await as.mutation(api.library.logProgress, { readId, page: 996 })
  expect(await of('book-1')).toMatchObject({ page: 996, percent: 99, status: 'reading' })

  const listening = await of('book-2')
  await as.mutation(api.library.logProgress, { readId: listening.readId, seconds: 9000 })
  expect(await of('book-2')).toMatchObject({ seconds: 9000, percent: 25 })
  await expect(as.mutation(api.library.logProgress, { readId: listening.readId, page: 10 })).rejects.toThrow()

  await as.mutation(api.library.logProgress, { readId, page: 1000 })
  const done = await of('book-1')
  expect(done).toMatchObject({ percent: 100, status: 'read' })
  expect(done.finishedAt).toBeTruthy()
})

test('logging a book from the TBR starts it', async () => {
  const t = setup()
  const { userId, as } = await reader(t)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item(1, { status: 'tbr', percent: 0 })] })
  const [{ readId }] = await as.query(api.library.myBooks, {})
  await as.mutation(api.library.logProgress, { readId, page: 10 })
  expect((await as.query(api.library.myBooks, {}))[0].status).toBe('reading')
})

test('how a book is logged is remembered for that book', async () => {
  const t = setup()
  const { userId, as } = await reader(t)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item(1), item(2)] })
  const books = await as.query(api.library.myBooks, {})
  await as.mutation(api.library.setProgressUnit, { readId: books.find(b => b.slug === 'book-1')!.readId, unit: 'percent' })
  const after = await as.query(api.library.myBooks, {})
  expect(after.find(b => b.slug === 'book-1')!.progressUnit).toBe('percent')
  expect(after.find(b => b.slug === 'book-2')!.progressUnit).toBeNull()
})

test('reads can be edited: dates change, one can go, and it must make sense', async () => {
  const t = setup()
  const { userId, as } = await reader(t)
  const first = { hardcoverId: 501, startedAt: Date.UTC(2020, 0, 1), finishedAt: Date.UTC(2020, 1, 1) }
  const second = { hardcoverId: 502, startedAt: Date.UTC(2023, 0, 1), finishedAt: Date.UTC(2023, 1, 1) }
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item(1, { status: 'read', percent: 100, readings: [first, second], startedAt: second.startedAt, finishedAt: second.finishedAt })] })
  const [{ readId, readings }] = await as.query(api.library.myBooks, {})
  expect(readings).toHaveLength(2)

  await expect(as.mutation(api.library.saveReadings, { readId, readings: [{ startedAt: 10, finishedAt: 5 }] })).rejects.toThrow()
  await expect(as.mutation(api.library.saveReadings, { readId, readings: [{}] })).rejects.toThrow()
  await expect(as.mutation(api.library.saveReadings, { readId, readings: [{ hardcoverId: 999, startedAt: 10 }] })).rejects.toThrow()

  const moved = Date.UTC(2023, 2, 1)
  await as.mutation(api.library.saveReadings, { readId, readings: [{ ...second, finishedAt: moved }] })
  const [book] = await as.query(api.library.myBooks, {})
  expect(book.finishedAt).toBe(moved)
  expect(book.readings).toEqual([{ ...second, finishedAt: moved }])
  expect((await t.run(ctx => ctx.db.get(readId)))!.deletedReadings).toEqual([501])
})

test('starting a finished book again is a re-read, and finishing closes it', async () => {
  const t = setup()
  const { userId, as } = await reader(t)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item(1, { status: 'read', percent: 100, finishedAt: 100, readings: [{ hardcoverId: 1, finishedAt: 100 }] })] })
  const [{ readId }] = await as.query(api.library.myBooks, {})
  await as.mutation(api.library.setStatus, { readId, status: 'reading' })
  let [book] = await as.query(api.library.myBooks, {})
  expect(book.readings).toHaveLength(2)
  expect(book.finishedAt).toBeNull()
  await as.mutation(api.library.setStatus, { readId, status: 'read' })
  ;[book] = await as.query(api.library.myBooks, {})
  expect(book.readings).toHaveLength(2)
  expect(book.readings[1].finishedAt).toBeTruthy()
})

test('an export holds every book and entry, and only the reader\'s own', async () => {
  const t = setup()
  const { userId, as } = await reader(t)
  const other = await reader(t, 'Someone else')
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item(1)] })
  await t.mutation(internal.hardcover.saveBooks, { userId: other.userId, items: [{ ...item(2), read: { ...item(2).read, hardcoverUserBookId: 99 } }] })
  const [{ readId }] = await as.query(api.library.myBooks, {})
  await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Mine.' })

  const all = await as.query(api.library.exportAll, {})
  expect(all.books.map(b => b.slug)).toEqual(['book-1'])
  expect(all.entries).toMatchObject([{ text: 'Mine.', kind: 'note', readId }])
  await expect(t.query(api.library.exportAll, {})).rejects.toThrow()
})

test('a smart shelf saves under a free address, survives list syncs, and only goes when asked', async () => {
  const t = setup()
  const { userId, as } = await reader(t)
  const other = await reader(t, 'Someone else')
  expect(await as.mutation(api.books.saveView, { name: 'Great horror', filter: '{}' })).toBe('great-horror')
  expect(await as.mutation(api.books.saveView, { name: 'Great horror', filter: '{}' })).toBe('great-horror-2')
  expect(await as.mutation(api.books.saveView, { name: 'Read', filter: '{}' })).toBe('shelf-read')
  await expect(as.mutation(api.books.saveView, { name: '  ', filter: '{}' })).rejects.toThrow()

  await t.mutation(internal.hardcover.saveLists, { userId, lists: [{ hardcoverListId: 5, name: 'Own', slug: 'own', bookIds: [] }] })
  const lists = await as.query(api.books.myLists, {})
  expect(lists).toHaveLength(4)
  const view = lists.find(l => l.slug === 'great-horror')!
  const list = lists.find(l => l.slug === 'own')!
  await expect(other.as.mutation(api.books.removeView, { id: view.id })).rejects.toThrow()
  await expect(as.mutation(api.books.removeView, { id: list.id })).rejects.toThrow()
  await as.mutation(api.books.removeView, { id: view.id })
  expect(await as.query(api.books.myLists, {})).toHaveLength(3)
})

test('the import walks every page of Hardcover and saves the books', async () => {
  vi.stubEnv('HARDCOVER_API_KEY', 'test-token')
  vi.stubEnv('HARDCOVER_PACE_MS', '0')
  const library = [{ id: 5, status_id: 2, book: { id: 50, title: 'From Hardcover' } }, { id: 6, status_id: 6, book: { id: 60 } }]
  const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
    const { query } = JSON.parse(init.body)
    const data = query.includes('{ me { id } }') ? { me: [{ id: 1 }] } : query.includes('reading_journals') ? { reading_journals: [{ id: 9, event: 'note', entry: 'A note.', book_id: 50 }] } : { me: [{ user_books: library }] }
    return new Response(JSON.stringify({ data }))
  })
  vi.stubGlobal('fetch', fetchMock)
  const t = setup()
  const { as } = await reader(t)

  expect(await as.action(api.hardcover.importLibrary, {})).toEqual({ added: 1, existing: 0, notes: 1 })
  const [book] = await as.query(api.library.myBooks, {})
  expect(book).toMatchObject({ title: 'From Hardcover', status: 'reading', author: 'Unknown author' })
  vi.unstubAllEnvs()
})

test('crossing a milestone leaves one note on the book, and answering it starts the conversation', async () => {
  const t = setup()
  const { userId, as } = await reader(t)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item(1, { percent: 5 })] })
  const [{ readId }] = await as.query(api.library.myBooks, {})

  await as.mutation(api.library.logProgress, { readId, percent: 8 })
  expect((await as.query(api.library.bookBySlug, { slug: 'book-1' }))?.note).toBeNull()

  await as.mutation(api.library.logProgress, { readId, percent: 30 })
  const note = (await as.query(api.library.bookBySlug, { slug: 'book-1' }))!.note!
  expect(note.percent).toBe(25)

  await as.mutation(api.library.logProgress, { readId, percent: 20 })
  await as.mutation(api.library.logProgress, { readId, percent: 30 })
  expect(await t.run(ctx => ctx.db.query('buddyQueue').collect())).toHaveLength(1)

  await as.mutation(api.milestones.answer, { noteId: note.id })
  expect((await as.query(api.library.bookBySlug, { slug: 'book-1' }))?.note).toBeNull()
  expect((await as.query(api.buddy.thread, { readId }))?.turns.map(t => t.text)).toEqual([note.text])

  await as.mutation(api.library.logProgress, { readId, percent: 55 })
  const later = (await as.query(api.library.bookBySlug, { slug: 'book-1' }))!.note!
  await as.mutation(api.milestones.snooze, { noteId: later.id })
  expect((await as.query(api.library.bookBySlug, { slug: 'book-1' }))?.note).toBeNull()
})
