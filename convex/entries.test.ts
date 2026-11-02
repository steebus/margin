// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api, internal } from './_generated/api'
import { entryKey, normaliseText } from './lib/entryKey'
import schema from './schema'

const setup = async () => {
  const t = convexTest(schema, import.meta.glob('./**/*.ts'))
  const userId = await t.run(ctx => ctx.db.insert('users', { name: 'Steve' }))
  const as = t.withIdentity({ subject: `${userId}|session` })
  await t.mutation(internal.hardcover.saveBooks, {
    userId,
    items: [{
      work: { hardcoverId: 1, slug: 'book-1', title: 'Book One', authors: ['An Author'], isbns: [], subjects: [] },
      read: { hardcoverUserBookId: 10, status: 'reading', percent: 0, format: 'print', owned: false },
    }],
  })
  const [{ readId }] = await as.query(api.library.myBooks, {})
  return { t, as, readId }
}

test('a saved entry appears on its book and in the drawer, with its place', async () => {
  const { as, readId } = await setup()
  await as.mutation(api.entries.addEntry, { readId, kind: 'excerpt', text: '  A line I liked.  ', page: 41 })

  const found = await as.query(api.library.bookBySlug, { slug: 'book-1' })
  expect(found?.entries).toMatchObject([{ kind: 'excerpt', text: 'A line I liked.', position: 'Page 41' }])
  expect(await as.query(api.library.allEntries, {})).toMatchObject([{ text: 'A line I liked.', where: 'Book One, Page 41', slug: 'book-1' }])
})

test('saving the same words twice keeps one, but another page or kind is a new entry', async () => {
  const { as, readId } = await setup()
  const first = await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Same thought.', page: 5 })
  const again = await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'same   THOUGHT.', page: 5 })
  expect(first.duplicate).toBe(false)
  expect(again).toEqual({ id: first.id, duplicate: true })
  await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Same thought.', page: 6 })
  await as.mutation(api.entries.addEntry, { readId, kind: 'excerpt', text: 'Same thought.', page: 5 })
  expect(await as.query(api.library.allEntries, {})).toHaveLength(3)
})

test('bad input is refused', async () => {
  const { as, readId } = await setup()
  const add = (fields: { text?: string; page?: number; percent?: number }) =>
    as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Words', ...fields })
  await expect(add({ text: '   ' })).rejects.toThrow()
  await expect(add({ text: 'x'.repeat(20_001) })).rejects.toThrow()
  await expect(add({ page: 0 })).rejects.toThrow()
  await expect(add({ page: 1.5 })).rejects.toThrow()
  await expect(add({ percent: 101 })).rejects.toThrow()
})

test('only the owner can add to a read or remove an entry, and signed out nobody can', async () => {
  const { t, as, readId } = await setup()
  const { id } = await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Mine.' })
  const otherId = await t.run(ctx => ctx.db.insert('users', { name: 'Sam' }))
  const other = t.withIdentity({ subject: `${otherId}|session` })

  await expect(other.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Theirs.' })).rejects.toThrow()
  await expect(other.mutation(api.entries.removeEntry, { id })).rejects.toThrow()
  await expect(t.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Anon.' })).rejects.toThrow()
  await expect(t.mutation(api.entries.removeEntry, { id })).rejects.toThrow()

  await as.mutation(api.entries.removeEntry, { id })
  expect(await as.query(api.library.allEntries, {})).toEqual([])
})

test('the key ignores spacing, capitals and curly quotes, but not the words or the place', () => {
  expect(normaliseText('  It’s  A\nLine ')).toBe("it's a line")
  const key = entryKey('w1', 'note', 'A line', { page: 3 })
  expect(entryKey('w1', 'note', 'a   LINE', { page: 3 })).toBe(key)
  expect(entryKey('w1', 'note', 'A line!', { page: 3 })).not.toBe(key)
  expect(entryKey('w1', 'note', 'A line', { page: 4 })).not.toBe(key)
  expect(entryKey('w2', 'note', 'A line', { page: 3 })).not.toBe(key)
})
