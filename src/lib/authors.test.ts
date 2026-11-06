import { expect, test } from 'vitest'
import { authorOf } from './authors'
import type { Book } from './books'

const book = (title: string, authors: string[], over: Partial<Book> = {}) =>
  ({ title, slug: title, authors, author: authors[0], status: 'tbr', pages: 100, rating: null, genres: [], readings: [], ...over }) as Book

test('an author gathers every book they wrote or co-wrote, with what was read of them', () => {
  const books = [
    book('Good Omens', ['Terry Pratchett', 'Neil Gaiman'], { status: 'read', rating: 4, pages: 400, genres: ['Fantasy', 'Humour'] }),
    book('Mort', ['Terry Pratchett'], { status: 'read', rating: 5, pages: 300, genres: ['Fantasy'] }),
    book('Snuff', ['Terry Pratchett']),
    book('Coraline', ['Neil Gaiman']),
  ]
  const terry = authorOf(books, 'terry-pratchett')!
  expect(terry.name).toBe('Terry Pratchett')
  expect(terry.books.map(b => b.title)).toEqual(['Good Omens', 'Mort', 'Snuff'])
  expect([terry.read, terry.pages, terry.rating]).toEqual([2, 700, 4.5])
  expect(terry.genres).toEqual(['Fantasy', 'Humour'])
  expect(terry.with).toEqual(['Neil Gaiman'])
  expect(authorOf(books, 'nobody')).toBeNull()
})
