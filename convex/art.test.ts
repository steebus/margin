// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import { MAX_HINT } from './lib/artPrompt'
import schema from './schema'

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }))
afterEach(() => vi.useRealTimers())

const setup = async () => {
  const t = convexTest(schema, import.meta.glob('./**/*.ts'))
  const userId = await t.run(ctx => ctx.db.insert('users', { name: 'Steve' }))
  const as = t.withIdentity({ subject: `${userId}|session` })
  await t.mutation(internal.hardcover.saveBooks, {
    userId,
    items: [{
      work: { hardcoverId: 1, slug: 'book-1', title: 'Book One', authors: ['An Author'], isbns: [], subjects: [], coverUrl: 'https://assets.hardcover.app/a.jpg' },
      read: { hardcoverUserBookId: 10, status: 'read', percent: 100, format: 'print', owned: false },
    }],
  })
  const [{ readId }] = await as.query(api.library.myBooks, {})
  const workId = (await t.run(ctx => ctx.db.query('works').first()))!._id
  const file = () => t.run(ctx => ctx.storage.store(new Blob(['image'])))
  const save = async (scene = 'A chair.') => t.mutation(internal.art.saveArt, { workId, small: await file(), large: await file(), model: 'm', scene, prompt: 'p' })
  return { t, as, userId, readId, workId, save }
}

test('a book shows its drawing once it has one, and needingArt stops listing it', async () => {
  const { t, as, save } = await setup()
  expect((await as.query(api.library.myBooks, {}))[0].art).toBeNull()
  expect(await t.query(internal.art.needingArt, {})).toHaveLength(1)

  await save()
  const [book] = await as.query(api.library.myBooks, {})
  expect(book.art?.small).toBeTruthy()
  expect(book.art?.large).toBeTruthy()
  expect(await t.query(internal.art.needingArt, {})).toEqual([])
})

test('choosing the real cover hides the drawing without deleting it, and it can be switched back', async () => {
  const { as, readId, save } = await setup()
  await save()
  await as.mutation(api.art.setArtChoice, { readId, choice: 'cover' })
  let found = await as.query(api.library.bookBySlug, { slug: 'book-1' })
  expect(found?.book.art).toBeNull()
  expect(found?.cover).toMatchObject({ choice: 'cover', hasDrawing: true })

  await as.mutation(api.art.setArtChoice, { readId, choice: 'drawing' })
  found = await as.query(api.library.bookBySlug, { slug: 'book-1' })
  expect(found?.book.art).not.toBeNull()
})

test('a choice belongs to one reader; another reader of the same book keeps theirs', async () => {
  const { t, as, readId, save } = await setup()
  await save()
  const samId = await t.run(ctx => ctx.db.insert('users', { name: 'Sam' }))
  const sam = t.withIdentity({ subject: `${samId}|session` })
  await t.mutation(internal.hardcover.saveBooks, {
    userId: samId,
    items: [{
      work: { hardcoverId: 1, slug: 'book-1', title: 'Book One', authors: [], isbns: [], subjects: [] },
      read: { hardcoverUserBookId: 20, status: 'tbr', percent: 0, format: 'print', owned: false },
    }],
  })
  await as.mutation(api.art.setArtChoice, { readId, choice: 'cover' })
  expect((await sam.query(api.library.myBooks, {}))[0].art).not.toBeNull()
  await expect(sam.mutation(api.art.setArtChoice, { readId, choice: 'drawing' })).rejects.toThrow()
})

test('regenerating queues a drawing, keeps the old one meanwhile, and switches back to the drawing', async () => {
  const { t, as, readId, workId, save } = await setup()
  await save('A chair.')
  await as.mutation(api.art.setArtChoice, { readId, choice: 'cover' })
  await as.mutation(api.art.regenerate, { readId, hint: '  a lamp at night  ' })

  const found = await as.query(api.library.bookBySlug, { slug: 'book-1' })
  expect(found?.cover).toMatchObject({ state: 'queued', choice: 'drawing', hasDrawing: true })
  expect(found?.book.art).not.toBeNull()

  const scheduled = await t.run(ctx => ctx.db.system.query('_scheduled_functions').collect())
  expect(scheduled.at(-1)?.args[0]).toEqual({ workId, hint: 'a lamp at night' })
})

test('only one regeneration at a time, but a stuck one can be retried after a while', async () => {
  const { as, readId } = await setup()
  await as.mutation(api.art.regenerate, { readId })
  await expect(as.mutation(api.art.regenerate, { readId })).rejects.toThrow()
  vi.setSystemTime(Date.now() + 6 * 60_000)
  await expect(as.mutation(api.art.regenerate, { readId })).resolves.toBeNull()
})

test('regeneration needs an owner and a sensible direction', async () => {
  const { t, as, readId } = await setup()
  await expect(t.mutation(api.art.regenerate, { readId })).rejects.toThrow()
  await expect(as.mutation(api.art.regenerate, { readId, hint: 'x'.repeat(MAX_HINT + 1) })).rejects.toThrow()
  const samId = await t.run(ctx => ctx.db.insert('users', { name: 'Sam' }))
  await expect(t.withIdentity({ subject: `${samId}|session` }).mutation(api.art.regenerate, { readId })).rejects.toThrow()
})

test('a failed regeneration keeps the old drawing and says what went wrong', async () => {
  const { t, as, readId, workId, save } = await setup()
  await save('A chair.')
  await as.mutation(api.art.regenerate, { readId })
  await t.mutation(internal.art.artFailed, { workId, error: 'Gemini declined to draw this one.' })
  const found = await as.query(api.library.bookBySlug, { slug: 'book-1' })
  expect(found?.cover).toMatchObject({ state: 'failed', error: 'Gemini declined to draw this one.', hasDrawing: true })
  expect(found?.book.art).not.toBeNull()
})

test('a new drawing replaces the old files, so storage does not grow', async () => {
  const { t, save } = await setup()
  await save('A chair.')
  await save('A lamp.')
  const files = await t.run(ctx => ctx.db.system.query('_storage').collect())
  expect(files).toHaveLength(2)
  const [row] = await t.run(ctx => ctx.db.query('workArt').collect())
  expect(row).toMatchObject({ state: 'ready', scene: 'A lamp.' })
})

test('the generator is told what to avoid, including this book\'s last subject', async () => {
  const { t, workId, save } = await setup()
  await save('A chair.')
  expect(await t.query(internal.art.bookFacts, { workId })).toMatchObject({ title: 'Book One', previous: 'A chair.', avoid: [] })
})
