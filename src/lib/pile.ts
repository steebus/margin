import type { Book } from './books'
import { daysBetween } from './shelf'

type Note = { kind: string; text: string }

// What sums a book up best: what the reader concluded, then what they wrote along the way.
const ORDER = ['reflection', 'summary', 'review', 'note', 'excerpt']

/** The one line beside a book in the pile, from entries given newest first. */
export const pileNote = <T extends Note>(entries: T[]) =>
  ORDER.map(kind => entries.find(e => e.kind === kind)).find(e => !!e) ?? null

/** What unfurls beside a book when it reaches the middle of the screen: its best few entries, conclusions first. */
export const pileNotes = <T extends Note>(entries: T[], count = 3) =>
  ORDER.flatMap(kind => entries.filter(e => e.kind === kind)).slice(0, count)

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

/**
 * How a book lies in the pile. Thickness is its page count and nothing else: a 200-page book is about 35px, half what
 * it was (Steve, 2026-11-03). Its binding, width and offset come from its slug, so they never change between visits.
 */
export function spineOf(slug: string, pages: number | null) {
  const seed = seedOf(slug)
  const height = Math.round(22 + Math.min(pages ?? UNKNOWN_PAGES, 1200) / 16)
  return {
    height,
    width: 86 + (seed % 15),
    look: LOOKS[(seed >>> 4) % LOOKS.length],
    shift: (seed >>> 8) % 100,
    // Bigger books print bigger, within reason. Room for two lines once the book is thick enough to hold them.
    titleSize: Math.round(Math.min(28, Math.max(15, height * 0.42))),
    titleLines: height < 64 ? 1 : 2,
    thin: height < 56,
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

/**
 * How tall the finished books would stand, stacked, in words. A leaf is two pages at about 0.1mm, and each book
 * adds 4mm of boards. An estimate, so it says "about".
 */
export function stackHeight(pages: number, books: number) {
  const mm = (pages / 2) * 0.1 + books * 4
  if (mm < 1000) return `about ${Math.round(mm / 10)} cm tall`
  const metres = (mm / 1000).toFixed(1).replace(/\.0$/, '')
  return `about ${metres} ${metres === '1' ? 'metre' : 'metres'} tall`
}
