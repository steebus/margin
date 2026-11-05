import { z } from 'zod'
import type { Book, Status } from './books'

const DAY = 86_400_000

export const SHELVES: { slug: string; status: Status; label: string }[] = [
  { slug: 'reading', status: 'reading', label: 'Reading' },
  { slug: 'paused', status: 'paused', label: 'Paused' },
  { slug: 'tbr', status: 'tbr', label: 'TBR' },
  { slug: 'read', status: 'read', label: 'Read' },
  { slug: 'stopped', status: 'dnf', label: 'Stopped' },
]

/** The date that matters for a book where it sits: when you finished it, or when it joined your TBR. */
export const dateOf = (b: Pick<Book, 'status' | 'finishedAt' | 'startedAt' | 'addedAt'>) =>
  b.status === 'read' ? b.finishedAt ?? b.startedAt ?? b.addedAt
    : b.status === 'tbr' ? b.addedAt
      : b.startedAt ?? b.addedAt

/** Days from start to finish, counting both ends. Null when the dates are missing or don't make sense. */
export function daysBetween(startedAt: number | null | undefined, finishedAt: number | null | undefined) {
  if (!startedAt || !finishedAt || finishedAt < startedAt) return null
  return Math.floor(finishedAt / DAY) - Math.floor(startedAt / DAY) + 1
}
export const daysToRead = (b: Pick<Book, 'startedAt' | 'finishedAt'>) => daysBetween(b.startedAt, b.finishedAt)

const surname = (name: string) => name.trim().split(/\s+/).at(-1) ?? name

type SortValue = number | string | null
export const SORTS = {
  recent: { label: 'Date finished or added', value: (b: Book): SortValue => dateOf(b), dir: 'desc' },
  title: { label: 'Title', value: (b: Book): SortValue => b.title, dir: 'asc' },
  author: { label: 'Author', value: (b: Book): SortValue => surname(b.author), dir: 'asc' },
  published: { label: 'Date published', value: (b: Book): SortValue => b.published, dir: 'desc' },
  finished: { label: 'Date finished', value: (b: Book): SortValue => b.finishedAt, dir: 'desc' },
  started: { label: 'Date started', value: (b: Book): SortValue => b.startedAt, dir: 'desc' },
  added: { label: 'Date added', value: (b: Book): SortValue => b.addedAt, dir: 'desc' },
  rating: { label: 'Rating', value: (b: Book): SortValue => b.rating, dir: 'desc' },
  pages: { label: 'Pages', value: (b: Book): SortValue => b.pages, dir: 'desc' },
  days: { label: 'Days to read', value: (b: Book): SortValue => daysToRead(b), dir: 'asc' },
} as const
export type SortId = keyof typeof SORTS
export type Dir = 'asc' | 'desc'

/** Sorted either way, with books missing that fact always last. */
export function sortBooks(books: Book[], sort: SortId = 'recent', dir?: Dir) {
  const { value, dir: natural } = SORTS[sort]
  const sign = (dir ?? natural) === 'asc' ? 1 : -1
  return [...books].sort((a, b) => {
    const x = value(a)
    const y = value(b)
    if (x === null || y === null) return x === y ? a.title.localeCompare(b.title) : x === null ? 1 : -1
    const order = typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)
    return order * sign || a.title.localeCompare(b.title)
  })
}

export type Filters = { q?: string; format?: string; rating?: string; genre?: string }

export function filterBooks(books: Book[], { q, format, rating, genre }: Filters) {
  const words = q?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? []
  return books.filter(b => {
    if (format && b.format !== format) return false
    if (genre && !b.genres.includes(genre)) return false
    if (rating === 'none' ? b.rating !== null : rating && (b.rating ?? 0) < Number(rating)) return false
    if (!words.length) return true
    const text = `${b.title} ${b.author} ${b.genres.join(' ')}`.toLowerCase()
    return words.every(w => text.includes(w))
  })
}

const bands = (value: number | null, steps: [number, string][], last: string) => {
  if (value === null) return null
  const index = steps.findIndex(([under]) => value < under)
  return index < 0 ? { label: last, order: steps.length } : { label: steps[index][1], order: index }
}
const FORMATS: Record<string, string> = { print: 'Print', ebook: 'Ebook', audio: 'Audiobook' }

type Bucket = { label: string; order: number | string } | null
const GROUPS = {
  month: {
    label: 'Month',
    newest: true,
    of: (b: Book): Bucket => {
      const at = dateOf(b)
      return at === null ? null : { label: new Date(at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }), order: new Date(at).toISOString().slice(0, 7) }
    },
  },
  year: {
    label: 'Year',
    newest: true,
    of: (b: Book): Bucket => {
      const at = dateOf(b)
      return at === null ? null : { label: String(new Date(at).getUTCFullYear()), order: new Date(at).getUTCFullYear() }
    },
  },
  published: {
    label: 'Date published',
    newest: true,
    of: (b: Book): Bucket => (b.published === null ? null : { label: `${Math.floor(b.published / 10) * 10}s`, order: Math.floor(b.published / 10) * 10 }),
  },
  days: {
    label: 'Days to read',
    newest: false,
    of: (b: Book): Bucket => bands(daysToRead(b), [[7, 'Under a week'], [14, 'One to two weeks'], [29, 'Two to four weeks'], [91, 'One to three months']], 'Longer than three months'),
  },
  rating: {
    label: 'Rating',
    newest: true,
    of: (b: Book): Bucket => (b.rating === null ? null : { label: `${Math.floor(b.rating)} ${Math.floor(b.rating) === 1 ? 'star' : 'stars'}`, order: Math.floor(b.rating) }),
  },
  length: {
    label: 'Length',
    newest: false,
    of: (b: Book): Bucket => bands(b.pages, [[200, 'Under 200 pages'], [350, '200 to 350 pages'], [500, '350 to 500 pages'], [800, '500 to 800 pages']], 'Over 800 pages'),
  },
  author: { label: 'Author', newest: false, of: (b: Book): Bucket => ({ label: b.author, order: surname(b.author) }) },
  genre: { label: 'Genre', newest: false, of: (b: Book): Bucket => (b.genres[0] ? { label: b.genres[0], order: b.genres[0] } : null) },
  format: { label: 'Format', newest: false, of: (b: Book): Bucket => ({ label: FORMATS[b.format], order: FORMATS[b.format] }) },
} as const
export type GroupId = keyof typeof GROUPS
export const GROUP_OPTIONS = (Object.keys(GROUPS) as GroupId[]).map(id => ({ id, label: GROUPS[id].label }))

/** Books under headings, keeping the order they came in. Books missing that fact go last, under "Not known". */
export function groupBooks(books: Book[], group: GroupId) {
  const { of, newest } = GROUPS[group]
  const found = new Map<string, { label: string; order: number | string; books: Book[] }>()
  const unknown: Book[] = []
  for (const book of books) {
    const bucket = of(book)
    if (!bucket) { unknown.push(book); continue }
    const row = found.get(bucket.label)
    if (row) row.books.push(book)
    else found.set(bucket.label, { ...bucket, books: [book] })
  }
  const sign = newest ? -1 : 1
  const rows = [...found.values()].sort((a, b) => sign * (typeof a.order === 'string' ? a.order.localeCompare(b.order as string) : a.order - (b.order as number)))
  return unknown.length ? [...rows, { label: 'Not known', order: '', books: unknown }] : rows
}

export const genresIn = (books: Book[]) => [...new Set(books.flatMap(b => b.genres))].sort((a, b) => a.localeCompare(b))

const sortIds = Object.keys(SORTS) as [SortId, ...SortId[]]
const groupIds = Object.keys(GROUPS) as [GroupId, ...GroupId[]]
const catching = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined)

/** Search, sort and filter live in the URL, so any view can be bookmarked and reached with Back (SPEC 4). */
export const shelfSearch = z.object({
  q: catching(z.string()),
  sort: catching(z.enum(sortIds)),
  dir: catching(z.enum(['asc', 'desc'])),
  format: catching(z.string()),
  rating: catching(z.string()),
  genre: catching(z.string()),
  view: catching(z.enum(['catalog', 'table'])),
  group: catching(z.enum([...groupIds, 'none'])),
})
export type ShelfSearch = z.infer<typeof shelfSearch>

type Saved = ShelfSearch & { status?: Status }

/** What a smart shelf keeps: the filter, in the same words as the URL, and the status shelf it came from. */
export const savedFilter = (search: ShelfSearch, status?: Status) => JSON.stringify({ ...search, status })

/** A smart shelf's filter. One that can't be read shows everything, which is plainly wrong, rather than crashing. */
export function parseSaved(filter: string): Saved {
  try {
    const raw = JSON.parse(filter) as Saved
    return { ...shelfSearch.parse(raw), status: SHELVES.find(s => s.status === raw.status)?.status }
  } catch {
    return {}
  }
}

/** What's in the URL overrides what was saved, so a smart shelf can still be re-sorted or searched. */
export const mergeSearch = (saved: ShelfSearch, search: ShelfSearch): ShelfSearch =>
  ({ ...saved, ...Object.fromEntries(Object.entries(search).filter(([, v]) => v !== undefined)) })
