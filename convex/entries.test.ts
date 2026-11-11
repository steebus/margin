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

test('the Desk gets when each entry was written, newest first, without the words', async () => {
  const { t, as, readId } = await setup()
  expect(await t.query(api.library.entryDates, {})).toEqual([])
  const first = await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'First.', page: 1 })
  const second = await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Second.', page: 2 })
  const dates = await as.query(api.library.entryDates, {})
  expect(dates.map(d => d.id)).toEqual([second.id, first.id])
  expect(Object.keys(dates[0]).sort()).toEqual(['createdAt', 'id'])
  // A different reader's notes aren't in it.
  const other = await t.run(ctx => ctx.db.insert('users', { name: 'Someone else' }))
  expect(await t.withIdentity({ subject: `${other}|session` }).query(api.library.entryDates, {})).toEqual([])
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

test('a note can sit under its excerpt, only on the same book, and outlives it', async () => {
  const { t: db, as, readId, } = await setup()
  const { id } = await as.mutation(api.entries.addEntry, { readId, kind: 'excerpt', text: 'A line.', page: 3, origin: 'camera' })
  const { id: noteId } = await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'My thought.', parentId: id })

  const found = await as.query(api.library.bookBySlug, { slug: 'book-1' })
  expect(found?.entries.find(e => e.id === noteId)?.parentId).toBe(id)
  expect((await db.run(ctx => ctx.db.get(id)))?.origin).toBe('camera')

  const otherRead = await db.run(async ctx => {
    const read = (await ctx.db.get(readId))!
    const workId = await ctx.db.insert('works', { slug: 'book-2', title: 'Book Two', authors: [], isbns: [], subjects: [] })
    return ctx.db.insert('reads', { ...read, _id: undefined, _creationTime: undefined, workId } as never)
  })
  await expect(as.mutation(api.entries.addEntry, { readId: otherRead, kind: 'note', text: 'Wrong book.', parentId: id })).rejects.toThrow()

  await as.mutation(api.entries.removeEntry, { id })
  const after = await as.query(api.library.bookBySlug, { slug: 'book-1' })
  expect(after?.entries.map(e => e.text)).toEqual(['My thought.'])
  expect(after?.entries[0].parentId).toBeNull()
})

test('an entry opens with its book and the notes under it, only for its owner', async () => {
  const { t, as, readId } = await setup()
  const { id } = await as.mutation(api.entries.addEntry, { readId, kind: 'excerpt', text: 'A line.', page: 3 })
  await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'My thought.', parentId: id })

  const found = await as.query(api.entries.entry, { id })
  expect(found).toMatchObject({ kind: 'excerpt', text: 'A line.', page: 3, position: 'Page 3', book: { slug: 'book-1' }, children: [{ text: 'My thought.' }] })
  expect(await as.query(api.entries.entry, { id: 'not-an-id' })).toBeNull()

  const otherId = await t.run(ctx => ctx.db.insert('users', { name: 'Sam' }))
  expect(await t.withIdentity({ subject: `${otherId}|session` }).query(api.entries.entry, { id })).toBeNull()
})

test('editing an entry changes its words and place, and sends it to Hardcover again', async () => {
  const { t, as, readId } = await setup()
  const { id } = await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'First go.', page: 3 })
  await t.run(ctx => ctx.db.patch(id, { hardcoverJournalId: 77 }))

  await as.mutation(api.entries.updateEntry, { id, text: '  Second go.  ', chapter: '4' })
  const found = await as.query(api.entries.entry, { id })
  expect(found).toMatchObject({ text: 'Second go.', page: null, chapter: '4', position: 'Chapter 4' })

  const outbox = await t.run(ctx => ctx.db.query('hardcoverOutbox').collect())
  expect(outbox.map(r => r.kind).sort()).toEqual(['deleteJournal', 'entry'])
  expect(outbox.find(r => r.kind === 'deleteJournal')?.journalId).toBe(77)
  expect((await t.run(ctx => ctx.db.get(id)))?.hardcoverJournalId).toBeUndefined()

  // Saving the same words again changes nothing and sends nothing.
  await as.mutation(api.entries.updateEntry, { id, text: 'Second go.', chapter: '4' })
  expect(await t.run(ctx => ctx.db.query('hardcoverOutbox').collect())).toHaveLength(2)
})

test('an edit is refused when it is empty, a copy of another entry, or someone else’s', async () => {
  const { t, as, readId } = await setup()
  const { id } = await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'One.' })
  await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Two.' })
  await expect(as.mutation(api.entries.updateEntry, { id, text: '  ' })).rejects.toThrow()
  await expect(as.mutation(api.entries.updateEntry, { id, text: 'Two.' })).rejects.toThrow()
  await expect(as.mutation(api.entries.updateEntry, { id, text: 'Fine.', page: 0 })).rejects.toThrow()
  const otherId = await t.run(ctx => ctx.db.insert('users', { name: 'Sam' }))
  await expect(t.withIdentity({ subject: `${otherId}|session` }).mutation(api.entries.updateEntry, { id, text: 'Mine now.' })).rejects.toThrow()
})

test("an entry with no place given is at the reader's last known page, and a note on an excerpt sits with it", async () => {
  const { as, readId } = await setup()
  await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Before starting.' })
  await as.mutation(api.library.logProgress, { readId, percent: 30 })
  await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'At thirty.' })
  const { id } = await as.mutation(api.entries.addEntry, { readId, kind: 'excerpt', text: 'Earlier line.', page: 12 })
  await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'About that line.', parentId: id })
  await as.mutation(api.entries.addEntry, { readId, kind: 'summary', text: 'The whole thing.' })
  const entries = (await as.query(api.library.bookBySlug, { slug: 'book-1' }))!.entries
  const at = (text: string) => entries.find(e => e.text === text)!.position
  expect(at('Before starting.')).toBe('')
  expect(at('At thirty.')).toBe('30%')
  expect(at('About that line.')).toBe('Page 12')
  expect(at('The whole thing.')).toBe('')
})

test('an excerpt can carry its note in the same write, and only an excerpt can', async () => {
  const { as, readId } = await setup()
  const { id } = await as.mutation(api.entries.addEntry, { readId, kind: 'excerpt', text: 'Shared words.', page: 7, origin: 'share', note: '  Mine.  ' })
  const found = await as.query(api.library.bookBySlug, { slug: 'book-1' })
  expect(found?.entries.find(e => e.kind === 'note')).toMatchObject({ text: 'Mine.', parentId: id, position: 'Page 7' })
  await expect(as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'A note.', note: 'On a note.' })).rejects.toThrow()
})

test('the latest book is the one being read that was last written on', async () => {
  const { t, as, readId } = await setup()
  const other = await t.run(async ctx => {
    const read = (await ctx.db.get(readId))!
    const workId = await ctx.db.insert('works', { slug: 'book-2', title: 'Book Two', authors: [], isbns: [], subjects: [] })
    return ctx.db.insert('reads', { ...read, _id: undefined, _creationTime: undefined, workId } as never)
  })
  await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'First.' })
  await new Promise(r => setTimeout(r, 5))
  await as.mutation(api.entries.addEntry, { readId: other, kind: 'note', text: 'Later.' })
  expect(await as.query(api.library.latestRead, {})).toBe(other)
})

test('a note written offline keeps the time it was written, never a time in the future', async () => {
  const { t, as, readId } = await setup()
  const hourAgo = Date.now() - 3_600_000

  await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Written on the train', writtenAt: hourAgo })
  await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'Clock was wrong', writtenAt: Date.now() + 86_400_000 })
  const made = await t.run(ctx => ctx.db.query('entries').collect())
  expect(made.find(e => e.text === 'Written on the train')?.createdAt).toBe(hourAgo)
  expect(made.find(e => e.text === 'Clock was wrong')!.createdAt).toBeLessThanOrEqual(Date.now())
})
