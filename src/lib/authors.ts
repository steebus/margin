import { slugify } from '../../convex/lib/hardcover'
import type { Book } from './books'

export const authorSlug = (name: string) => slugify(name) || 'author'

/** An author as the shelves know them: their books here, and what the reader has made of them. Null if none. */
export function authorOf(books: Book[], slug: string) {
  const theirs = books.filter(b => b.authors.some(a => authorSlug(a) === slug))
  if (!theirs.length) return null
  const name = theirs.flatMap(b => b.authors).find(a => authorSlug(a) === slug)!
  const read = theirs.filter(b => b.readings.some(r => r.finishedAt) || b.status === 'read')
  const rated = theirs.flatMap(b => (b.rating === null ? [] : [b.rating]))
  const genres = new Map<string, number>()
  for (const b of theirs) for (const g of b.genres) genres.set(g, (genres.get(g) ?? 0) + 1)
  return {
    name,
    books: theirs,
    read: read.length,
    pages: read.reduce((sum, b) => sum + (b.pages ?? 0), 0),
    rating: rated.length ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10 : null,
    genres: [...genres].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([g]) => g),
    // The other people they wrote with, here.
    with: [...new Set(theirs.flatMap(b => b.authors).filter(a => authorSlug(a) !== slug && a !== 'Unknown author'))],
  }
}
