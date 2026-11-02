import type { Book } from './books'
import { daysBetween } from './shelf'

export type Finish = { book: Book; at: number; days: number | null; year: number; month: number }
export type Row = { label: string; value: number; note?: string }

/** Every time a book was finished, so a re-read counts as reading it again. */
export const finishesOf = (books: Book[]): Finish[] => books.flatMap(book => book.readings.flatMap(r => {
  if (!r.finishedAt) return []
  const at = new Date(r.finishedAt)
  return [{ book, at: r.finishedAt, days: daysBetween(r.startedAt, r.finishedAt), year: at.getUTCFullYear(), month: at.getUTCMonth() }]
}))

const pagesOf = (finishes: Finish[]) => finishes.reduce((sum, f) => sum + (f.book.pages ?? 0), 0)
const plural = (n: number, word: string) => `${n.toLocaleString('en-GB')} ${word}${n === 1 ? '' : 's'}`

/** Every year from the first finish to the last, so a year with nothing read shows as the gap it was. */
export function byYear(finishes: Finish[], measure: 'books' | 'pages'): Row[] {
  if (!finishes.length) return []
  const years = finishes.map(f => f.year)
  const rows: Row[] = []
  for (let year = Math.min(...years); year <= Math.max(...years); year++) {
    const here = finishes.filter(f => f.year === year)
    rows.push({
      label: String(year),
      value: measure === 'books' ? here.length : pagesOf(here),
      note: `${plural(here.length, 'book')}, ${plural(pagesOf(here), 'page')}`,
    })
  }
  return rows
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const byMonth = (finishes: Finish[]): Row[] => MONTHS.map((label, month) => {
  const here = finishes.filter(f => f.month === month)
  return { label, value: here.length, note: `${plural(here.length, 'book')}, ${plural(pagesOf(here), 'page')}` }
})

/** Half-star ratings, top down, including the ones nothing landed on. */
export function byRating(books: Book[]): Row[] {
  const rows: Row[] = []
  for (let r = 5; r >= 0.5; r -= 0.5) rows.push({ label: String(r), value: books.filter(b => b.rating === r).length })
  return rows
}

const inBands = (values: number[], bands: [number, string][], last: string): Row[] => {
  const rows = [...bands.map(([, label]) => ({ label, value: 0 })), { label: last, value: 0 }]
  for (const value of values) {
    const index = bands.findIndex(([under]) => value < under)
    rows[index < 0 ? bands.length : index].value++
  }
  return rows
}

export const byDays = (finishes: Finish[]) => inBands(
  finishes.flatMap(f => (f.days === null ? [] : [f.days])),
  [[7, 'Under a week'], [14, '1 to 2 weeks'], [29, '2 to 4 weeks'], [91, '1 to 3 months']],
  'Over 3 months',
)

const DAY = 86_400_000

/** How long the TBR has been waiting. */
export const tbrAge = (books: Book[], now: number) => inBands(
  books.flatMap(b => (b.status === 'tbr' && b.addedAt ? [(now - b.addedAt) / DAY] : [])),
  [[30, 'Under a month'], [182, '1 to 6 months'], [365, '6 to 12 months'], [1095, '1 to 3 years']],
  'Over 3 years',
)

const counted = (labels: string[], top: number): Row[] => {
  const counts = new Map<string, number>()
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1)
  return [...counts].map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, top)
}

const FORMAT: Record<string, string> = { print: 'Print', ebook: 'Ebook', audio: 'Audiobook' }
export const byFormat = (finishes: Finish[]) => counted(finishes.map(f => FORMAT[f.book.format]), 3)
export const byGenre = (finishes: Finish[], top = 8) => counted(finishes.flatMap(f => f.book.subjects), top)
export const byAuthor = (finishes: Finish[], top = 8) => counted(finishes.map(f => f.book.author), top).filter(r => r.value > 1)

/** Whose recommendations land: anyone with two or more rated books, best first. */
export function bestSources(books: Book[]): Row[] {
  const groups = Map.groupBy(books.filter(b => b.recommendedBy && b.rating !== null), b => b.recommendedBy!)
  return [...groups]
    .filter(([, list]) => list.length > 1)
    .map(([label, list]) => ({
      label,
      value: Math.round((list.reduce((sum, b) => sum + b.rating!, 0) / list.length) * 10) / 10,
      note: plural(list.length, 'rated book'),
    }))
    .sort((a, b) => b.value - a.value)
}

export function headline(finishes: Finish[]) {
  const days = finishes.flatMap(f => (f.days === null ? [] : [f.days])).sort((a, b) => a - b)
  return {
    books: finishes.length,
    pages: pagesOf(finishes),
    // The middle, because one book left half-read for a year would drag an average out of shape.
    medianDays: days.length ? days[Math.floor(days.length / 2)] : null,
  }
}
