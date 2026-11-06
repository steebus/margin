// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const book = (id: number, title: string, status: 'read' | 'reading' | 'tbr', tags: { name: string; kind: 'genre' | 'tag'; count?: number }[], finished?: string) => ({
  work: { hardcoverId: id, slug: `b${id}`, title, authors: ['A'], isbns: [], subjects: [], tags },
  read: { hardcoverUserBookId: id, status, percent: status === 'read' ? 100 : 0, format: 'print' as const, owned: false, finishedAt: finished ? Date.parse(finished) : undefined },
})

const setup = async () => {
  const t = convexTest(schema, import.meta.glob('./**/*.ts'))
  const userId = await t.run(ctx => ctx.db.insert('users', { name: 'Steve' }))
  const as = t.withIdentity({ subject: `${userId}|session` })
  await t.mutation(internal.hardcover.saveBooks, {
    userId,
    items: [
      book(1, 'The Second Sex', 'read', [{ name: 'Feminism', kind: 'tag', count: 4 }], '2021-03-01'),
      book(2, 'Red Rising', 'read', [{ name: 'Science Fiction', kind: 'genre' }], '2026-02-01'),
      book(3, 'Women & Power', 'tbr', [{ name: 'feminism', kind: 'tag', count: 2 }]),
    ],
  })
  const books = await as.query(api.library.myBooks, {})
  const readOf = (title: string) => books.find(b => b.title === title)!.readId
  return { t, as, readOf }
}

test('a topic page is a timeline of its books and the notes that mention it, newest first, with the TBR apart', async () => {
  const { as, readOf } = await setup()
  await as.mutation(api.entries.addEntry, { readId: readOf('Red Rising'), kind: 'note', text: 'Mustang carries the feminism here.', page: 212 })
  const page = await as.query(api.topics.page, { slug: 'feminism' })
  expect(page?.name).toBe('Feminism')
  expect(page?.items.map(i => i.kind === 'book' ? i.book.title : i.entry.text)).toEqual(['Mustang carries the feminism here.', 'Red Rising', 'The Second Sex'])
  const red = page!.items.find(i => i.kind === 'book' && i.book.title === 'Red Rising')
  expect(red?.kind === 'book' && red.book.why).toBe('your note mentions it, p. 212')
  expect(page?.tbr.map(b => b.title)).toEqual(['Women & Power'])
  expect(await as.query(api.topics.forBook, { readId: readOf('Red Rising') })).toContainEqual({ slug: 'feminism', name: 'Feminism', key: 'feminism' })
})

test('tagging a note puts its book on the topic; reserved labels never become topics', async () => {
  const { as, readOf } = await setup()
  const { id } = await as.mutation(api.entries.addEntry, { readId: readOf('Red Rising'), kind: 'note', text: 'Power.' })
  await as.mutation(api.entries.setTags, { id, tags: ['Theme', 'Class'] })
  const names = (await as.query(api.topics.list, {})).map(t => t.name)
  expect(names).toContain('Class')
  expect(names).not.toContain('Theme')
  const suggestions = await as.query(api.topics.tagNames, {})
  expect(suggestions.slice(0, 3).map(s => s.reserved)).toEqual([true, true, true])
})

test('hiding takes a topic out of the list and the graph, and unhiding brings it back', async () => {
  const { as } = await setup()
  expect((await as.query(api.topics.graph, {})).nodes.map(n => n.id)).toContain('topic:feminism')
  await as.mutation(api.topics.hide, { slug: 'feminism' })
  expect((await as.query(api.topics.list, {})).map(t => t.slug)).not.toContain('feminism')
  expect((await as.query(api.topics.graph, {})).nodes.map(n => n.id)).not.toContain('topic:feminism')
  expect((await as.query(api.topics.page, { slug: 'feminism' }))?.hidden).toBe(true)
  const [hidden] = await as.query(api.topics.hidden, {})
  expect(hidden.name).toBe('Feminism')
  await as.mutation(api.topics.unhide, { key: hidden.key })
  expect((await as.query(api.topics.list, {})).map(t => t.slug)).toContain('feminism')
})

test('one-book topics stay off the graph, and an unknown topic is null', async () => {
  const { as } = await setup()
  expect((await as.query(api.topics.graph, {})).nodes.map(n => n.id)).not.toContain('topic:science-fiction')
  expect(await as.query(api.topics.page, { slug: 'nothing-like-this' })).toBeNull()
})
