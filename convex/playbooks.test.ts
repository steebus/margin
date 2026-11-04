// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'

const setup = async () => {
  const t = convexTest(schema, import.meta.glob('./**/*.ts'))
  const userId = await t.run(ctx => ctx.db.insert('users', { name: 'Steve' }))
  const as = t.withIdentity({ subject: `${userId}|session` })
  const readId = await t.run(async ctx => {
    const workId = await ctx.db.insert('works', { slug: 'book-1', title: 'Book One', authors: ['An Author'], isbns: [], subjects: [] })
    return ctx.db.insert('reads', { userId, workId, status: 'read', progress: { percent: 100 }, format: 'ebook', tagIds: [], shelfIds: [], hardcoverUserBookId: 10 })
  })
  return { t, as, userId, readId }
}

const notes = [
  { page: 15, highlight: 'A made-up line.', note: 'A made-up thought.', at: Date.parse('March 26, 2026') },
  { page: 9, highlight: '', note: 'On hidden words.', at: null },
]

test('Play Books notes are saved once, dated as they were made, and go to Hardcover', async () => {
  const { t, as, readId } = await setup()
  expect(await as.mutation(api.playbooks.saveNotes, { readId, volumeId: 'VOL', notes })).toBe(3)
  expect(await as.mutation(api.playbooks.saveNotes, { readId, volumeId: 'VOL', notes })).toBe(0)
  const saved = await t.run(ctx => ctx.db.query('entries').collect())
  const excerpt = saved.find(e => e.kind === 'excerpt')!
  expect(excerpt).toMatchObject({ text: 'A made-up line.', origin: 'playbooks', pos: { page: 15 }, createdAt: Date.parse('March 26, 2026') })
  expect(saved.filter(e => e.kind === 'note').map(e => [e.text, e.parentId ?? null])).toEqual([['A made-up thought.', excerpt._id], ['On hidden words.', null]])
  expect(await t.run(ctx => ctx.db.query('hardcoverOutbox').collect())).toHaveLength(3)
})

test('a note already in takes its source date on the next import', async () => {
  const { t, as, readId } = await setup()
  await as.mutation(api.playbooks.saveNotes, { readId, volumeId: 'VOL', notes })
  await t.run(async ctx => { for (const e of await ctx.db.query('entries').collect()) await ctx.db.patch(e._id, { createdAt: 1 }) })
  expect(await as.mutation(api.playbooks.saveNotes, { readId, volumeId: 'VOL', notes })).toBe(0)
  const excerpt = (await t.run(ctx => ctx.db.query('entries').collect())).find(e => e.kind === 'excerpt')!
  expect(excerpt.createdAt).toBe(Date.parse('March 26, 2026'))
})

test('a book waits in review once, is left out for good, or is placed with its notes', async () => {
  const { t, as, readId } = await setup()
  const card = { sourceId: 'VOL', title: 'Book One', author: 'An Author', notes }
  expect(await as.mutation(api.playbooks.queue, { items: [card, { ...card, sourceId: 'VOL2', title: 'Two' }] })).toBe(2)
  expect(await as.mutation(api.playbooks.queue, { items: [card] })).toBe(1)
  const [first, second] = await as.query(api.review.waiting, {})
  expect(first).toMatchObject({ title: 'Book One', notes: 2, status: null })

  await as.mutation(api.review.leave, { id: second.id })
  expect(await as.mutation(api.playbooks.queue, { items: [{ ...card, sourceId: 'VOL2', title: 'Two' }] })).toBe(0)

  expect(await as.mutation(api.review.placed, { id: first.id, readId })).toBe(3)
  expect(await as.query(api.review.waiting, {})).toEqual([])
  expect(await t.run(ctx => ctx.db.query('entries').collect())).toHaveLength(3)
})

test("another reader's card or book can't be touched", async () => {
  const { t, as, readId } = await setup()
  await as.mutation(api.playbooks.queue, { items: [{ sourceId: 'VOL', title: 'Book One', author: '', notes }] })
  const [card] = await as.query(api.review.waiting, {})
  const other = t.withIdentity({ subject: `${await t.run(ctx => ctx.db.insert('users', { name: 'Someone' }))}|session` })
  await expect(other.mutation(api.review.leave, { id: card.id })).rejects.toThrow()
  await expect(other.mutation(api.playbooks.saveNotes, { readId, volumeId: 'VOL', notes })).rejects.toThrow()
})
