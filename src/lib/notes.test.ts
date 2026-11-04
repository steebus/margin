import { expect, test } from 'vitest'
import { filterNotes, groupNotes, noteYears, sortByWritten } from './notes'

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

test('notes filter by kind, book status, years and words together', () => {
  const at = (y: number) => Date.UTC(y, 5, 1)
  const notes = [
    { id: 1, kind: 'excerpt', text: 'A storm came', where: 'A', slug: 'a', createdAt: at(2019) },
    { id: 2, kind: 'note', text: 'Calm sea', where: 'A', slug: 'a', createdAt: at(2024) },
    { id: 3, kind: 'note', text: 'Storm again', where: 'B', slug: 'b', createdAt: at(2025) },
  ]
  const status = (slug: string | null) => (slug === 'a' ? 'read' : 'reading')
  const ids = (f: Parameters<typeof filterNotes>[2]) => filterNotes(notes, status, f).map(n => n.id)
  expect(ids({ words: ['storm'] })).toEqual([1, 3])
  expect(ids({ words: [], kind: 'note' })).toEqual([2, 3])
  expect(ids({ words: [], status: 'read' })).toEqual([1, 2])
  expect(ids({ words: [], from: 2020, to: 2024 })).toEqual([2])
  expect(noteYears(notes)).toEqual([2025, 2024, 2019])
})
