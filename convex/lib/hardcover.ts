// Turns Hardcover's records into Margin's. Pure, so it can be tested and run against real data without saving anything.
import { bookTags, type CachedTags } from './topics'
export const LIBRARY_QUERY = `query Library($limit: Int!, $offset: Int!) {
  me { user_books(limit: $limit, offset: $offset, order_by: {id: asc}) {
    id status_id rating first_started_reading_date last_read_date date_added recommended_by owned review_raw reviewed_at
    edition { id isbn_13 isbn_10 pages audio_seconds reading_format_id }
    book { id title pages audio_seconds release_year cached_contributors cached_image cached_tags contributions(limit: 1) { author { gender_id location is_bipoc is_lgbtq } } }
    user_book_reads(order_by: {id: desc}) { id progress progress_pages progress_seconds started_at finished_at }
  } }
}`

export type HardcoverUserBook = {
  id: number
  status_id: number
  rating?: number | null
  first_started_reading_date?: string | null
  last_read_date?: string | null
  date_added?: string | null
  recommended_by?: string | null
  owned?: boolean | null
  review_raw?: string | null
  reviewed_at?: string | null
  edition?: { id?: number | null; isbn_13?: string | null; isbn_10?: string | null; pages?: number | null; audio_seconds?: number | null; reading_format_id?: number | null } | null
  book?: {
    id: number
    title?: string | null
    pages?: number | null
    audio_seconds?: number | null
    release_year?: number | null
    cached_contributors?: { author?: { name?: string | null } | null; contribution?: string | null }[] | null
    cached_image?: { url?: string | null } | null
    cached_tags?: CachedTags | null
    contributions?: { author?: { gender_id?: number | null; location?: string | null; is_bipoc?: boolean | null; is_lgbtq?: boolean | null } | null }[] | null
  } | null
  user_book_reads?: { id?: number | null; progress?: number | null; progress_pages?: number | null; progress_seconds?: number | null; started_at?: string | null; finished_at?: string | null }[] | null
}

const STATUS = { 1: 'tbr', 2: 'reading', 3: 'read', 4: 'paused', 5: 'dnf' } as const
// Hardcover's reading formats: 1 physical, 2 audio, 3 both, 4 ebook.
const FORMAT = { 1: 'print', 2: 'audio', 3: 'print', 4: 'ebook' } as const

/** A work's address: readable, and unique because of Hardcover's id. It never changes once minted. */
export const slugFor = (title: string, authors: string[], id: number) =>
  `${slugify(`${title} ${authors[0]?.split(/\s+/).at(-1) ?? ''}`) || 'book'}-${id.toString(36)}`

export function slugify(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const day = (value?: string | null) => {
  const time = value ? Date.parse(value) : NaN
  return Number.isFinite(time) ? time : undefined
}

/** One Margin work and read, or null for records Margin doesn't keep: "Ignored" books, or ones with no book attached. */
// Hardcover's gender ids, as its author pages show them.
const GENDER = { 1: 'man', 2: 'woman', 3: 'non-binary' } as const
const US_STATES = new Set(['alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'washington state', 'west virginia', 'wisconsin', 'wyoming'])
const COUNTRY: Record<string, string> = {
  usa: 'United States', us: 'United States', 'u.s.': 'United States', 'u.s.a.': 'United States', america: 'United States',
  'united states of america': 'United States', 'united states': 'United States',
  uk: 'United Kingdom', 'u.k.': 'United Kingdom', england: 'United Kingdom', scotland: 'United Kingdom', wales: 'United Kingdom',
  'northern ireland': 'United Kingdom', 'great britain': 'United Kingdom', britain: 'United Kingdom', 'united kingdom': 'United Kingdom',
}

/** The country in an author's free-text location: its last part, with the usual ways of naming the US and UK made one. */
export function countryOf(location: string | null | undefined): string | undefined {
  const last = location?.split(',').map(p => p.trim()).filter(Boolean).at(-1)
  if (!last) return undefined
  const key = last.toLowerCase().replace(/\s+/g, ' ')
  return COUNTRY[key] ?? (US_STATES.has(key) ? 'United States' : last)
}

/**
 * What Hardcover knows about the first author, for the stats: gender, country, and whether they're BIPOC or LGBTQ.
 * Only what Hardcover has: an unknown is left out, never guessed and never counted as a no.
 */
export function authorFacts(author: { gender_id?: number | null; location?: string | null; is_bipoc?: boolean | null; is_lgbtq?: boolean | null } | null | undefined) {
  const gender = GENDER[author?.gender_id as keyof typeof GENDER]
  const country = countryOf(author?.location)
  return {
    ...(gender ? { authorGender: gender } : {}),
    ...(country ? { authorCountry: country } : {}),
    ...(typeof author?.is_bipoc === 'boolean' ? { authorBipoc: author.is_bipoc } : {}),
    ...(typeof author?.is_lgbtq === 'boolean' ? { authorLgbtq: author.is_lgbtq } : {}),
  }
}

export function mapUserBook(ub: HardcoverUserBook) {
  const status = STATUS[ub.status_id as keyof typeof STATUS]
  const book = ub.book
  if (!status || !book) return null

  const contributors = book.cached_contributors ?? []
  const writers = contributors.filter(c => !c.contribution || c.contribution === 'Author')
  const authors = (writers.length ? writers : contributors).map(c => c.author?.name?.trim()).filter((n): n is string => !!n)
  const title = book.title?.trim() || 'Untitled'
  const pages = ub.edition?.pages || book.pages || undefined
  const latest = ub.user_book_reads?.[0]
  const logged = Math.min(100, Math.max(0, Math.round(latest?.progress ?? 0)))
  const percent = status === 'read' ? 100 : status === 'tbr' ? 0 : logged
  const startedAt = day(latest?.started_at) ?? day(ub.first_started_reading_date)
  const finishedAt = status === 'read' ? day(latest?.finished_at) ?? day(ub.last_read_date) : undefined
  const rows = ub.user_book_reads ?? []

  return {
    work: {
      hardcoverId: book.id,
      slug: slugFor(title, authors, book.id),
      title,
      authors,
      year: book.release_year ?? undefined,
      isbns: [ub.edition?.isbn_13, ub.edition?.isbn_10].filter((i): i is string => !!i),
      coverUrl: book.cached_image?.url ?? undefined,
      pages,
      audioSeconds: ub.edition?.audio_seconds || book.audio_seconds || undefined,
      subjects: (book.cached_tags?.Genre ?? []).map(g => g.tag).filter((t): t is string => !!t).slice(0, 5),
      tags: bookTags(book.cached_tags),
      ...authorFacts(book.contributions?.[0]?.author),
    },
    read: {
      hardcoverUserBookId: ub.id,
      status,
      addedAt: day(ub.date_added),
      startedAt,
      finishedAt,
      // Oldest first. A book can have dates and no read records, and then those dates are its one read.
      readings: rows.length
        ? rows.map(r => ({ hardcoverId: r.id ?? undefined, startedAt: day(r.started_at), finishedAt: day(r.finished_at) })).reverse()
        : startedAt || finishedAt ? [{ startedAt, finishedAt }] : [],
      percent,
      // Whether Hardcover actually said, so a read with no progress record never wipes what Margin knows.
      progressKnown: status === 'read' || status === 'tbr' || latest?.progress != null,
      page: latest?.progress_pages ?? undefined,
      seconds: latest?.progress_seconds ?? undefined,
      // Only when the edition says, so a book with no edition never loses the format Margin was told.
      format: FORMAT[ub.edition?.reading_format_id as keyof typeof FORMAT] as (typeof FORMAT)[keyof typeof FORMAT] | undefined,
      editionId: ub.edition?.id ?? undefined,
      owned: ub.owned ?? false,
      rating: ub.rating ?? undefined,
      recommendedBy: ub.recommended_by?.trim() || undefined,
      review: ub.review_raw?.trim() ? { text: ub.review_raw.trim(), at: day(ub.reviewed_at) } : undefined,
    },
  }
}

export const SEARCH_QUERY = 'query($q: String!) { search(query: $q, query_type: "Book", per_page: 10, page: 1) { results } }'

export type SearchDocument = {
  id?: string | number | null
  title?: string | null
  author_names?: string[] | null
  release_year?: number | null
  pages?: number | null
  isbns?: string[] | null
  genres?: string[] | null
  image?: { url?: string | null } | null
  users_count?: number | null
}

/** Search results, most read first: search alone puts study guides and summaries above the book itself. */
export function mapSearch(documents: SearchDocument[]) {
  return [...documents]
    .sort((a, b) => (b.users_count ?? 0) - (a.users_count ?? 0))
    .flatMap(d => {
      const hardcoverId = Number(d.id)
      const title = d.title?.trim()
      if (!Number.isInteger(hardcoverId) || !title) return []
      const authors = (d.author_names ?? []).filter(Boolean)
      return [{
        hardcoverId,
        slug: slugFor(title, authors, hardcoverId),
        title,
        authors,
        year: d.release_year ?? undefined,
        isbns: (d.isbns ?? []).slice(0, 4),
        coverUrl: d.image?.url ?? undefined,
        pages: d.pages || undefined,
        subjects: (d.genres ?? []).slice(0, 5),
      }]
    })
}

/** A book added in Margin, as Hardcover wants it. */
export function newUserBook(book: { hardcoverBookId: number; status: keyof typeof STATUS_ID; who?: string; addedAt?: number; rating?: number }) {
  return {
    book_id: book.hardcoverBookId,
    status_id: STATUS_ID[book.status],
    recommended_by: book.who,
    date_added: isoDay(book.addedAt),
    rating: book.rating,
  }
}

export const LISTS_QUERY = '{ me { lists(limit: 100) { id name slug list_books(limit: 2000) { book_id } } } }'
export type HardcoverList = { id: number; name?: string | null; slug?: string | null; list_books?: { book_id?: number | null }[] | null }

/** A list's address on Margin. Status shelves keep theirs. */
export const listSlug = (list: { name?: string | null; slug?: string | null; id: number }) => {
  const slug = list.slug || slugify(list.name ?? '') || String(list.id)
  return ['reading', 'paused', 'tbr', 'read', 'stopped'].includes(slug) ? `list-${slug}` : slug
}

export const JOURNAL_FIELDS = 'id event entry metadata book_id action_at taggings { tag { tag } }'

export type HardcoverJournal = {
  id: number
  event?: string | null
  entry?: string | null
  book_id?: number | null
  action_at?: string | null
  metadata?: { position?: { type?: string | null; value?: number | null; percent?: number | null } | null } | null
  taggings?: { tag?: { tag?: string | null } | null }[] | null
}

/** A quote or note from the reading journal, or null for anything else in there, such as "rated". */
export function mapJournal(j: HardcoverJournal) {
  const kind = j.event === 'quote' ? ('excerpt' as const) : j.event === 'note' ? ('note' as const) : null
  const text = j.entry?.trim()
  if (!kind || !text || !j.book_id) return null
  const position = j.metadata?.position
  const page = position?.type === 'pages' && position.value ? Math.round(position.value) : undefined
  const percent = position?.percent != null ? Math.min(100, Math.max(0, Math.round(position.percent))) : undefined
  const tags = (j.taggings ?? []).map(t => t.tag?.tag?.trim()).filter((t): t is string => !!t)
  return { journalId: j.id, hardcoverBookId: j.book_id, kind, text, page, percent: page ? undefined : percent, at: Date.parse(j.action_at ?? '') || undefined, tags }
}

const STATUS_ID = { tbr: 1, reading: 2, read: 3, paused: 4, dnf: 5 } as const
export const statusId = (status: keyof typeof STATUS_ID) => STATUS_ID[status]

type Length = { pages?: number | null; audio_seconds?: number | null }

/** Hardcover records progress as pages or seconds, not percent. Null when it has no length for this book. */
export function progressFields(percent: number, edition?: Length | null, book?: Length | null, exact: { page?: number; seconds?: number } = {}) {
  const portion = percent / 100
  // The exact place the reader logged, unless they've finished: a stale place must not undo that.
  const at = percent < 100 ? exact : {}
  if (edition?.audio_seconds) return { progress_seconds: at.seconds ?? Math.round(portion * edition.audio_seconds) }
  if (edition?.pages) return { progress_pages: at.page ?? Math.round(portion * edition.pages) }
  if (book?.pages) return { progress_pages: at.page ?? Math.round(portion * book.pages) }
  if (book?.audio_seconds) return { progress_seconds: at.seconds ?? Math.round(portion * book.audio_seconds) }
  return null
}

const isoDay = (time?: number) => (time ? new Date(time).toISOString().slice(0, 10) : undefined)

/** What goes in a read record: only ever fields Margin knows. */
export function readFields(read: { status: string; percent: number; page?: number; seconds?: number; startedAt?: number; finishedAt?: number }, edition?: Length | null, book?: Length | null) {
  return {
    ...progressFields(read.percent, edition, book, { page: read.page, seconds: read.seconds }),
    started_at: isoDay(read.startedAt),
    finished_at: read.status === 'read' ? isoDay(read.finishedAt) : undefined,
  }
}

/** One read's dates, exactly as Margin has them: a date cleared here is cleared there. */
export const readingDates = (reading: { startedAt?: number; finishedAt?: number }) => ({
  started_at: isoDay(reading.startedAt) ?? null,
  finished_at: isoDay(reading.finishedAt) ?? null,
})

/** A Margin entry as a journal record. Private on Hardcover, as Steve's existing ones are. */
export function journalObject(entry: { kind: string; text: string; page?: number; percent?: number; createdAt: number; tags?: string[] }, hardcoverBookId: number) {
  const position = entry.page ? { type: 'pages', value: entry.page } : entry.percent != null ? { type: 'percent', value: entry.percent, percent: entry.percent } : undefined
  return {
    book_id: hardcoverBookId,
    event: entry.kind === 'excerpt' ? 'quote' : 'note',
    entry: entry.text,
    privacy_setting_id: 3,
    // ponytail: the shape Hardcover's journal tags take, unverified until Steve tags a real note (design doc).
    tags: (entry.tags ?? []).map(tag => ({ category: 'general', spoiler: false, tag })),
    action_at: isoDay(entry.createdAt),
    metadata: position ? { position } : {},
  }
}

/** Ignores rounding differences between pages and percent, so a sync never nudges progress back and forth. */
export const progressChanged = (mine: number, theirs: number) => Math.abs(mine - theirs) > 1

// Hardcover's `timestamp` columns come without a zone, and are UTC.
const instant = (time: string | null | undefined) => time ? Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(time) ? time : `${time}Z`) : NaN

/**
 * Where the two-minute sync starts next time. With nothing cut off, from `fresh` (just before this run began). When a
 * page came back full, from just before the last thing on it, so its stragglers come again (saving is idempotent) and
 * the next run carries on from there. A page all stamped the same instant can't be split by time, so it's stepped
 * past, rather than fetched again forever; the daily reconcile still brings any book it skipped.
 */
export function nextCursor(previous: string, fresh: string, pages: { full: boolean; times: (string | null | undefined)[] }[]) {
  const cut = pages.filter(p => p.full)
  if (!cut.length) return fresh
  const since = instant(previous)
  let next = Infinity
  for (const { times } of cut) {
    const first = instant(times[0])
    const last = instant(times[times.length - 1])
    if (Number.isNaN(last)) return previous
    const before = last - 1
    next = Math.min(next, first === last || before <= since ? last : before)
  }
  return new Date(next).toISOString()
}

/** Hardcover's lists in a few characters, the same whatever order they came in. */
export function listsFingerprint(lists: { hardcoverListId: number; name: string; slug: string; bookIds: number[] }[]) {
  const text = JSON.stringify([...lists].sort((a, b) => a.hardcoverListId - b.hardcoverListId)
    .map(l => [l.hardcoverListId, l.name, l.slug, [...l.bookIds].sort((a, b) => a - b)]))
  // FNV-1a, twice with different seeds: nothing hangs on it but skipping work, so it needn't be cryptographic.
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193)
    b = Math.imul(b ^ c, 0x811c9dc5)
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}:${text.length}`
}
