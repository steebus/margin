// Turns Hardcover's records into Margin's. Pure, so it can be tested and run against real data without saving anything.
export const LIBRARY_QUERY = `query Library($limit: Int!, $offset: Int!) {
  me { user_books(limit: $limit, offset: $offset, order_by: {id: asc}) {
    id status_id rating first_started_reading_date last_read_date date_added recommended_by owned review_raw reviewed_at
    edition { isbn_13 isbn_10 pages audio_seconds reading_format_id }
    book { id title pages audio_seconds release_year cached_contributors cached_image cached_tags }
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
  edition?: { isbn_13?: string | null; isbn_10?: string | null; pages?: number | null; audio_seconds?: number | null; reading_format_id?: number | null } | null
  book?: {
    id: number
    title?: string | null
    pages?: number | null
    audio_seconds?: number | null
    release_year?: number | null
    cached_contributors?: { author?: { name?: string | null } | null; contribution?: string | null }[] | null
    cached_image?: { url?: string | null } | null
    cached_tags?: { Genre?: { tag?: string | null }[] | null } | null
  } | null
  user_book_reads?: { id?: number | null; progress?: number | null; progress_pages?: number | null; progress_seconds?: number | null; started_at?: string | null; finished_at?: string | null }[] | null
}

const STATUS = { 1: 'tbr', 2: 'reading', 3: 'read', 4: 'paused', 5: 'dnf' } as const
const FORMAT = { 2: 'audio', 4: 'ebook' } as const

export function slugify(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const day = (value?: string | null) => {
  const time = value ? Date.parse(value) : NaN
  return Number.isFinite(time) ? time : undefined
}

/** One Margin work and read, or null for records Margin doesn't keep: "Ignored" books, or ones with no book attached. */
export function mapUserBook(ub: HardcoverUserBook) {
  const status = STATUS[ub.status_id as keyof typeof STATUS]
  const book = ub.book
  if (!status || !book) return null

  const contributors = book.cached_contributors ?? []
  const writers = contributors.filter(c => !c.contribution || c.contribution === 'Author')
  const authors = (writers.length ? writers : contributors).map(c => c.author?.name?.trim()).filter((n): n is string => !!n)
  const title = book.title?.trim() || 'Untitled'
  const lastName = authors[0]?.split(/\s+/).at(-1) ?? ''
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
      slug: `${slugify(`${title} ${lastName}`) || 'book'}-${book.id.toString(36)}`,
      title,
      authors,
      year: book.release_year ?? undefined,
      isbns: [ub.edition?.isbn_13, ub.edition?.isbn_10].filter((i): i is string => !!i),
      coverUrl: book.cached_image?.url ?? undefined,
      pages,
      audioSeconds: ub.edition?.audio_seconds || book.audio_seconds || undefined,
      subjects: (book.cached_tags?.Genre ?? []).map(g => g.tag).filter((t): t is string => !!t).slice(0, 5),
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
      format: FORMAT[ub.edition?.reading_format_id as keyof typeof FORMAT] ?? ('print' as const),
      owned: ub.owned ?? false,
      rating: ub.rating ?? undefined,
      recommendedBy: ub.recommended_by?.trim() || undefined,
      review: ub.review_raw?.trim() ? { text: ub.review_raw.trim(), at: day(ub.reviewed_at) } : undefined,
    },
  }
}

export const JOURNAL_FIELDS = 'id event entry metadata book_id action_at'

export type HardcoverJournal = {
  id: number
  event?: string | null
  entry?: string | null
  book_id?: number | null
  action_at?: string | null
  metadata?: { position?: { type?: string | null; value?: number | null; percent?: number | null } | null } | null
}

/** A quote or note from the reading journal, or null for anything else in there, such as "rated". */
export function mapJournal(j: HardcoverJournal) {
  const kind = j.event === 'quote' ? ('excerpt' as const) : j.event === 'note' ? ('note' as const) : null
  const text = j.entry?.trim()
  if (!kind || !text || !j.book_id) return null
  const position = j.metadata?.position
  const page = position?.type === 'pages' && position.value ? Math.round(position.value) : undefined
  const percent = position?.percent != null ? Math.min(100, Math.max(0, Math.round(position.percent))) : undefined
  return { journalId: j.id, hardcoverBookId: j.book_id, kind, text, page, percent: page ? undefined : percent, at: Date.parse(j.action_at ?? '') || undefined }
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
export function journalObject(entry: { kind: string; text: string; page?: number; percent?: number; createdAt: number }, hardcoverBookId: number) {
  const position = entry.page ? { type: 'pages', value: entry.page } : entry.percent != null ? { type: 'percent', value: entry.percent, percent: entry.percent } : undefined
  return {
    book_id: hardcoverBookId,
    event: entry.kind === 'excerpt' ? 'quote' : 'note',
    entry: entry.text,
    privacy_setting_id: 3,
    tags: [],
    action_at: isoDay(entry.createdAt),
    metadata: position ? { position } : {},
  }
}

/** Ignores rounding differences between pages and percent, so a sync never nudges progress back and forth. */
export const progressChanged = (mine: number, theirs: number) => Math.abs(mine - theirs) > 1
