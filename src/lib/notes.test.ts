import { expect, test } from 'vitest'
import { groupNotes, sortByWritten } from './notes'

const DAY = 86_400_000
const book = (slug: string, title: string, finishedAt: number | null) =>
  ({ slug, title, status: 'read' as const, finishedAt, startedAt: null, addedAt: null })
const books = [book('a', 'Zebra', 3 * DAY), book('b', 'Apple', 1 * DAY), book('c', 'Mango', null)]
const entries = [
  { id: 1, slug: 'a', createdAt: 10 },
  { id: 2, slug: 'b', createdAt: 30 },
  { id: 3, slug: 'a', createdAt: 20 },
  { id: 4, slug: 'c', createdAt: 5 },
  { id: 5, slug: null, createdAt: 40 },
]

test('notes sort by when they were written, either way', () => {
  expect(sortByWritten(entries).map(e => e.id)).toEqual([5, 2, 3, 1, 4])
  expect(sortByWritten(entries, 'asc').map(e => e.id)).toEqual([4, 1, 3, 2, 5])
})

test('grouped notes put the book last written in first, newest note first within it', () => {
  const groups = groupNotes(entries, books)
  expect(groups.map(g => g.book.slug)).toEqual(['b', 'a', 'c'])
  expect(groups[1].list.map(e => e.id)).toEqual([3, 1])
})

test('grouped notes can follow the date read, with undated books last, or the title', () => {
  expect(groupNotes(entries, books, 'read').map(g => g.book.slug)).toEqual(['a', 'b', 'c'])
  expect(groupNotes(entries, books, 'read', 'asc').map(g => g.book.slug)).toEqual(['b', 'a', 'c'])
  expect(groupNotes(entries, books, 'title').map(g => g.book.title)).toEqual(['Apple', 'Mango', 'Zebra'])
})
