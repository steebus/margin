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

export const LOOKS = [
  'cloth', 'paper', 'label', 'ribs', 'hatch', 'stripes', 'block', 'dots', 'pinstripe', 'frame',
  'penguin', 'diamonds', 'tooled', 'checks', 'stitched',
] as const
const UNKNOWN_PAGES = 300
const LINE = 18

/**
 * How a book lies in the pile. Thickness is its page count and nothing else. Its binding, width and offset come
 * from its slug, so they never change between visits. `lines` is how much of a note fits beside it.
 */
export function spineOf(slug: string, pages: number | null) {
  const seed = seedOf(slug)
  const height = Math.round(44 + Math.min(pages ?? UNKNOWN_PAGES, 1200) / 8)
  return {
    height,
    width: 86 + (seed % 15),
    look: LOOKS[(seed >>> 4) % LOOKS.length],
    shift: (seed >>> 8) % 100,
    lines: Math.max(1, Math.floor((height - 24) / LINE)),
    // Bigger books print bigger, within reason. Room for two lines once the book is thick enough to hold them.
    titleSize: Math.round(Math.min(32, Math.max(20, height * 0.3))),
    titleLines: height < 84 ? 1 : 2,
    thin: height < 92,
  }
}

// Which typeface prints a book's spine. The first of its genres, most popular first, that means something here.
const FACES: [RegExp, string][] = [
  [/horror|gothic|ghost|vampire/i, 'horror'],
  [/sci-?fi|science fiction|dystop|space|aliens|cyberpunk|litrpg/i, 'future'],
  [/fantasy|mytholog|fairy|magic|adventure/i, 'fantasy'],
  [/thriller|mystery|crime|detective|suspense|noir/i, 'crime'],
  [/^science$|histor|business|econom|biograph|memoir|psycholog|philosoph|politic|social|self-help|non-?fiction|essay/i, 'fact'],
  [/classic|litera|romance|poetry|drama|contemporary/i, 'novel'],
]

export function faceOf(subjects: string[]) {
  for (const subject of subjects) {
    const face = FACES.find(([pattern]) => pattern.test(subject))
    if (face) return face[1]
  }
  return 'plain'
}

/** A spine has no room for a subtitle. */
export const spineTitle = (title: string) => title.split(/:\s/)[0]
