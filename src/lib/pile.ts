import type { Book } from './books'
import { daysBetween } from './shelf'

type Note = { kind: string; text: string }

// What sums a book up best: what the reader concluded, then what they wrote along the way.
const ORDER = ['reflection', 'summary', 'review', 'note', 'excerpt']

/** The one line beside a book in the pile, from entries given newest first. */
export const pileNote = <T extends Note>(entries: T[]) =>
  ORDER.map(kind => entries.find(e => e.kind === kind)).find(e => !!e) ?? null

export type PileRow = { key: string; book: Book; finishedAt: number | null; days: number | null }

/** One spine per finish, so a re-read sits in the pile twice. Newest on top; books with no date at the bottom. */
export function pileOf(books: Book[]): PileRow[] {
  const rows = books.filter(b => b.status === 'read' || b.readings.some(r => r.finishedAt)).flatMap((book): PileRow[] => {
    const finished = book.readings.filter(r => r.finishedAt)
    return finished.length
      ? finished.map((r, i) => ({ key: `${book.slug}-${i}`, book, finishedAt: r.finishedAt!, days: daysBetween(r.startedAt, r.finishedAt) }))
      : [{ key: book.slug, book, finishedAt: null, days: null }]
  })
  return rows.sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0) || a.book.title.localeCompare(b.book.title))
}

const seedOf = (text: string) => [...text].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 7)

/** How a book lies in the pile: thick as its page count, with a width and offset that never change between visits. */
export function spineOf(slug: string, pages: number | null) {
  const seed = seedOf(slug)
  return {
    height: Math.round(34 + Math.min(pages ?? 300, 1200) / 28),
    width: 78 + (seed % 23),
    look: seed % 5 === 0 ? 'band' : seed % 3 === 0 ? 'outline' : 'solid',
    shift: (seed >> 8) % 100,
  }
}
