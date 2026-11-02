import type { Book } from './books'

export type Unit = 'page' | 'time' | 'percent'
type Lengths = Pick<Book, 'pages' | 'audioSeconds'>

/** The ways this book can be logged: only ones it has a length for. Percent always works. */
export const unitsFor = (b: Lengths): Unit[] => [
  ...(b.pages ? (['page'] as const) : []),
  ...(b.audioSeconds ? (['time'] as const) : []),
  'percent',
]

/** The reader's choice for this book if it still works, otherwise the natural one for its format. */
export function unitFor(b: Lengths & Pick<Book, 'format' | 'progressUnit'>): Unit {
  const units = unitsFor(b)
  if (b.progressUnit && units.includes(b.progressUnit)) return b.progressUnit
  if (b.format === 'audio') return b.audioSeconds ? 'time' : 'percent'
  return units[0]
}

export const toClock = (seconds: number) => ({ hours: Math.floor(seconds / 3600), minutes: Math.floor((seconds % 3600) / 60) })

/** "12h 30m", or "45m" under an hour. */
export function formatClock(seconds: number) {
  const { hours, minutes } = toClock(seconds)
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

/** Days and pace from a finished read, in words for the book page. Null when there's nothing to go on. */
export const pagesPerDay = (pages: number | null, days: number | null) =>
  pages && days ? Math.round(pages / days) : null

/** A date input's value, and back. Dates are whole UTC days, as Hardcover stores them. */
export const toDateInput = (time?: number | null) => (time ? new Date(time).toISOString().slice(0, 10) : '')
export const fromDateInput = (value: string) => (value ? Date.parse(value) : undefined)
