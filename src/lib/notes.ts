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

export type NoteFilter = { kind?: string; status?: string; from?: number; to?: number; words: string[] }
type Filterable = { kind: string; text: string; question?: string | null; where: string; slug: string | null; createdAt: number }

/** The notes that pass every filter: kind, the book's status, the years they were written in, and the search words. */
export function filterNotes<E extends Filterable>(entries: E[], statusOf: (slug: string | null) => string | undefined, f: NoteFilter) {
  return entries.filter(e => {
    if (f.kind && e.kind !== f.kind) return false
    if (f.status && statusOf(e.slug) !== f.status) return false
    const year = new Date(e.createdAt).getUTCFullYear()
    if (f.from && year < f.from) return false
    if (f.to && year > f.to) return false
    const text = `${e.text} ${e.question ?? ''} ${e.where}`.toLowerCase()
    return f.words.every(w => text.includes(w))
  })
}

/** The years notes were written in, newest first, for the date filter. */
export const noteYears = (entries: { createdAt: number }[]) =>
  [...new Set(entries.map(e => new Date(e.createdAt).getUTCFullYear()))].sort((a, b) => b - a)
