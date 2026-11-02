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
  expect(await t.query(api.library.recentEntries, {})).toEqual([])
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
  expect((await as.query(api.library.myBooks, {}))[0]).toMatchObject({ percent: 50, page: 100 })
  await as.mutation(api.library.logProgress, { readId, percent: 400 })
  expect((await as.query(api.library.myBooks, {}))[0].percent).toBe(100)
  await expect(as.mutation(api.library.logProgress, { readId, percent: Number.NaN })).rejects.toThrow()

  expect(await t.run(ctx => ctx.db.query('progressLog').collect())).toHaveLength(2)
})

test('the shelf year comes from finishing, then starting, then adding', async () => {
  const t = setup()
  const { userId, as } = await reader(t)
  const items = [
    item(1, { finishedAt: Date.UTC(2023, 0, 5), startedAt: Date.UTC(2022, 0, 5) }),
    item(2, { startedAt: Date.UTC(2022, 0, 5) }),
    item(3),
  ]
  await t.mutation(internal.hardcover.saveBooks, { userId, items })
  const books = await as.query(api.library.myBooks, {})
  expect(Object.fromEntries(books.map(b => [b.slug, b.year]))).toEqual({ 'book-1': 2023, 'book-2': 2022, 'book-3': 2024 })
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
