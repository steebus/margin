import { expect, test } from 'vitest'
import type { Book } from './books'
import { dateOf, daysToRead, filterBooks, groupBooks, mergeSearch, parseSaved, savedFilter, sortBooks } from './shelf'

const day = (text: string) => Date.parse(text)
const book = (over: Partial<Book>) => ({
  title: 'A', author: 'Ann Lee', status: 'read', format: 'print', rating: null, pages: null, published: null, subjects: [], genres: [],
  addedAt: null, startedAt: null, finishedAt: null, ...over,
}) as Book

test('a shelf sorts by date finished or added, and keeps books with no date last', () => {
  const books = [
    book({ title: 'None' }),
    book({ title: 'Old', finishedAt: day('2020-01-01') }),
    book({ title: 'New', finishedAt: day('2024-01-01') }),
  ]
  expect(sortBooks(books).map(b => b.title)).toEqual(['New', 'Old', 'None'])
  expect(sortBooks(books, 'recent', 'asc').map(b => b.title)).toEqual(['Old', 'New', 'None'])
  expect(dateOf(book({ status: 'tbr', addedAt: 5, finishedAt: 9 }))).toBe(5)
})

test('authors sort by surname', () => {
  const books = [book({ author: 'Zed Adams' }), book({ author: 'Ann Young' })]
  expect(sortBooks(books, 'author').map(b => b.author)).toEqual(['Zed Adams', 'Ann Young'])
})

test('a same-day read is one day, and dates the wrong way round are no answer', () => {
  expect(daysToRead({ startedAt: day('2024-03-01'), finishedAt: day('2024-03-01') })).toBe(1)
  expect(daysToRead({ startedAt: day('2024-03-01'), finishedAt: day('2024-03-08') })).toBe(8)
  expect(daysToRead({ startedAt: day('2024-03-08'), finishedAt: day('2024-03-01') })).toBeNull()
  expect(daysToRead({ startedAt: null, finishedAt: day('2024-03-01') })).toBeNull()
})

test('search matches every word across title, author and genre, and filters narrow it', () => {
  const books = [
    book({ title: 'Dune', author: 'Frank Herbert', genres: ['Science Fiction'], rating: 5, format: 'audio' }),
    book({ title: 'Emma', author: 'Jane Austen', genres: ['Classics'], rating: 3 }),
    book({ title: 'Unrated' }),
  ]
  expect(filterBooks(books, { q: 'herbert dune' }).map(b => b.title)).toEqual(['Dune'])
  expect(filterBooks(books, { q: 'science' }).map(b => b.title)).toEqual(['Dune'])
  expect(filterBooks(books, { rating: '4' }).map(b => b.title)).toEqual(['Dune'])
  expect(filterBooks(books, { rating: 'none' }).map(b => b.title)).toEqual(['Unrated'])
  expect(filterBooks(books, { format: 'audio' }).map(b => b.title)).toEqual(['Dune'])
  expect(filterBooks(books, { genre: 'Classics' }).map(b => b.title)).toEqual(['Emma'])
})

test('groups read newest first, and books missing the fact go last', () => {
  const books = [
    book({ title: 'A', finishedAt: day('2023-05-02') }),
    book({ title: 'B', finishedAt: day('2024-02-01') }),
    book({ title: 'C', finishedAt: day('2023-05-20') }),
    book({ title: 'D' }),
  ]
  expect(groupBooks(books, 'month').map(g => [g.label, g.books.map(b => b.title).join('')])).toEqual([
    ['February 2024', 'B'], ['May 2023', 'AC'], ['Not known', 'D'],
  ])
  expect(groupBooks(books, 'year').map(g => g.label)).toEqual(['2024', '2023', 'Not known'])
})

test('days to read and published group into bands', () => {
  const quick = book({ startedAt: day('2024-01-01'), finishedAt: day('2024-01-03') })
  const slow = book({ startedAt: day('2024-01-01'), finishedAt: day('2024-09-03') })
  expect(groupBooks([slow, quick], 'days').map(g => g.label)).toEqual(['Under a week', 'Longer than three months'])
  expect(groupBooks([book({ published: 1965 }), book({ published: 2001 })], 'published').map(g => g.label)).toEqual(['2000s', '1960s'])
})

test('a smart shelf keeps its filter and status, and the URL can still override it', () => {
  const saved = parseSaved(savedFilter({ genre: 'Horror', sort: 'rating' }, 'read'))
  expect(saved).toMatchObject({ genre: 'Horror', sort: 'rating', status: 'read' })
  expect(mergeSearch(saved, { sort: 'title', q: undefined })).toMatchObject({ genre: 'Horror', sort: 'title' })
  expect(parseSaved('not json')).toEqual({})
  expect(parseSaved('{"sort":"nonsense","status":"nonsense"}')).toEqual({ sort: undefined, status: undefined })
})
