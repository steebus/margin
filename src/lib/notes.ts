import { dateOf } from './shelf'
import type { Book } from './books'

export const NOTE_SORTS = {
  book: { label: 'Book last written in', dir: 'desc' },
  written: { label: 'Date written', dir: 'desc' },
  read: { label: 'Date read', dir: 'desc' },
  title: { label: 'Book title', dir: 'asc' },
} as const
export type NoteSort = keyof typeof NOTE_SORTS
export type NoteDir = 'asc' | 'desc'

type Entry = { slug: string | null; createdAt: number }
type BookDates = Pick<Book, 'slug' | 'title' | 'status' | 'finishedAt' | 'startedAt' | 'addedAt'>

/** Every note on its own, by when it was written. */
export function sortByWritten<E extends Entry>(entries: E[], dir: NoteDir = 'desc') {
  const sign = dir === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => (a.createdAt - b.createdAt) * sign)
}

/**
 * Notes gathered under their books. Within a book the newest note comes first; the books themselves follow the sort.
 * Books with no date for the sort go last, either way.
 */
export function groupNotes<E extends Entry, B extends BookDates>(entries: E[], books: B[], sort: Exclude<NoteSort, 'written'> = 'book', dir?: NoteDir) {
  const bySlug = new Map(books.map(b => [b.slug, b]))
  const groups = new Map<string, { book: B; list: E[] }>()
  for (const e of sortByWritten(entries)) {
    const book = e.slug ? bySlug.get(e.slug) : undefined
    if (!book) continue
    const group = groups.get(book.slug) ?? { book, list: [] }
    group.list.push(e)
    groups.set(book.slug, group)
  }
  const sign = (dir ?? NOTE_SORTS[sort].dir) === 'asc' ? 1 : -1
  const value = (g: { book: B; list: E[] }): number | string | null =>
    sort === 'title' ? g.book.title : sort === 'read' ? dateOf(g.book) : g.list[0].createdAt
  return [...groups.values()].sort((a, b) => {
    const x = value(a)
    const y = value(b)
    if (x === null || y === null) return x === y ? a.book.title.localeCompare(b.book.title) : x === null ? 1 : -1
    const order = typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)
    return order * sign || a.book.title.localeCompare(b.book.title)
  })
}
