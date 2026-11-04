// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const KOBO_ID = '72d6536c-353d-4406-8dfe-f58f2ed16f3f'
const page = { annotations: [{ id: 'k1', type: 'note', highlightedText: 'A made-up line.', noteText: 'A made-up thought.', location: { span: { chapterTitle: 'One', percentageOfBook: 0.25 } } }], nextPageOffsetToken: null }

/** A stand-in for Kobo. Nothing here reaches the real site. */
function fakeKobo(status = 200) {
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url)
    return url.includes('readingservices.kobo.com') ? new Response(JSON.stringify(page), { status }) : new Response('{}', { status: 500 })
  }))
  return urls
}

beforeEach(() => { process.env.KOBO_PACE_MS = '0' })
afterEach(() => vi.unstubAllGlobals())

const setup = async () => {
  const t = convexTest(schema, import.meta.glob('./**/*.ts'))
  const userId = await t.run(ctx => ctx.db.insert('users', { name: 'Steve' }))
  const as = t.withIdentity({ subject: `${userId}|session` })
  const readId = await t.run(async ctx => {
    const workId = await ctx.db.insert('works', { slug: 'book-1', title: 'Book One', authors: ['An Author'], isbns: [], subjects: [] })
    return ctx.db.insert('reads', { userId, workId, status: 'reading', progress: { percent: 10 }, format: 'ebook', tagIds: [], shelfIds: [], hardcoverUserBookId: 10 })
  })
  await as.mutation(api.kobo.saveCookie, { cookie: 'cookie: secret=1' })
  await as.mutation(api.kobo.link, { links: [{ readId, koboId: KOBO_ID }] })
  return { t, as, userId, readId }
}

const entriesOf = (t: Awaited<ReturnType<typeof setup>>['t']) => t.run(ctx => ctx.db.query('entries').collect())
const outbox = (t: Awaited<ReturnType<typeof setup>>['t']) => t.run(ctx => ctx.db.query('hardcoverOutbox').filter(q => q.eq(q.field('kind'), 'entry')).collect())

test('a pull saves the highlight and its note under it, for Hardcover, and a second pull adds nothing', async () => {
  const { t, as } = await setup()
  const urls = fakeKobo()
  expect(await as.action(api.kobo.pull, {})).toEqual({ books: 1, highlights: 2, error: null })
  expect(urls[0]).toBe(`https://readingservices.kobo.com/api/v3/content/${KOBO_ID}/annotations`)
  const saved = await entriesOf(t)
  const excerpt = saved.find(e => e.kind === 'excerpt')!
  expect(excerpt).toMatchObject({ text: 'A made-up line.', origin: 'kobo', pos: { percent: 25, chapter: 'One' } })
  expect(saved.find(e => e.kind === 'note')).toMatchObject({ text: 'A made-up thought.', parentId: excerpt._id })
  expect(await outbox(t)).toHaveLength(2)

  expect(await as.action(api.kobo.pull, {})).toEqual({ books: 1, highlights: 0, error: null })
  expect(await entriesOf(t)).toHaveLength(2)
  expect(await outbox(t)).toHaveLength(2)
  expect(await as.query(api.kobo.status, {})).toMatchObject({ connected: true, linked: 1, lastReport: { books: 1, highlights: 0 } })
})

test('a refused cookie saves nothing and asks for a fresh one, and Settings never sees the cookie', async () => {
  const { t, as } = await setup()
  fakeKobo(403)
  expect((await as.action(api.kobo.pull, {})).error).toMatch(/signing in again/)
  expect(await entriesOf(t)).toHaveLength(0)
  const shown = await as.query(api.kobo.status, {})
  expect(shown?.lastError).toMatch(/signing in again/)
  expect(JSON.stringify(shown)).not.toContain('secret')
  const stored = await t.run(ctx => ctx.db.query('koboLinks').first())
  expect(stored?.cookie).toBe('secret=1')
})

test("another reader's book can't be linked", async () => {
  const { t, readId } = await setup()
  const other = await t.run(ctx => ctx.db.insert('users', { name: 'Someone' }))
  await expect(t.withIdentity({ subject: `${other}|session` }).mutation(api.kobo.link, { links: [{ readId, koboId: KOBO_ID }] })).rejects.toThrow()
})

test('entries written before a book reached Hardcover are sent once it does', async () => {
  const { t, as, userId } = await setup()
  const fresh = await t.run(async ctx => {
    const workId = await ctx.db.insert('works', { slug: 'book-2', title: 'Book Two', authors: [], isbns: [], subjects: [] })
    return ctx.db.insert('reads', { userId, workId, status: 'reading', progress: { percent: 0 }, format: 'ebook', tagIds: [], shelfIds: [] })
  })
  fakeKobo()
  await as.mutation(api.entries.addEntry, { readId: fresh, kind: 'note', text: 'Early.' })
  expect(await outbox(t)).toHaveLength(0)
  await t.mutation(internal.hardcover.linkRead, { readId: fresh, hardcoverUserBookId: 99 })
  expect(await outbox(t)).toHaveLength(1)
})
