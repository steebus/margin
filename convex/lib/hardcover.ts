// Turns Hardcover's records into Margin's. Pure, so it can be tested and run against real data without saving anything.
export const LIBRARY_QUERY = `query Library($limit: Int!, $offset: Int!) {
  me { user_books(limit: $limit, offset: $offset, order_by: {id: asc}) {
    id status_id rating first_started_reading_date last_read_date date_added recommended_by owned
    edition { isbn_13 isbn_10 pages reading_format_id }
    book { id title pages release_year cached_contributors cached_image cached_tags }
    user_book_reads(order_by: {id: desc}, limit: 1) { progress progress_pages started_at finished_at }
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
  edition?: { isbn_13?: string | null; isbn_10?: string | null; pages?: number | null; reading_format_id?: number | null } | null
  book?: {
    id: number
    title?: string | null
    pages?: number | null
    release_year?: number | null
    cached_contributors?: { author?: { name?: string | null } | null; contribution?: string | null }[] | null
    cached_image?: { url?: string | null } | null
    cached_tags?: { Genre?: { tag?: string | null }[] | null } | null
  } | null
  user_book_reads?: { progress?: number | null; progress_pages?: number | null; started_at?: string | null; finished_at?: string | null }[] | null
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
      subjects: (book.cached_tags?.Genre ?? []).map(g => g.tag).filter((t): t is string => !!t).slice(0, 5),
    },
    read: {
      hardcoverUserBookId: ub.id,
      status,
      addedAt: day(ub.date_added),
      startedAt: day(ub.first_started_reading_date) ?? day(latest?.started_at),
      finishedAt: status === 'read' ? day(ub.last_read_date) ?? day(latest?.finished_at) : undefined,
      percent,
      page: latest?.progress_pages ?? undefined,
      format: FORMAT[ub.edition?.reading_format_id as keyof typeof FORMAT] ?? ('print' as const),
      owned: ub.owned ?? false,
      rating: ub.rating ?? undefined,
      recommendedBy: ub.recommended_by?.trim() || undefined,
    },
  }
}
