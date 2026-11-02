import type { Doc } from '../_generated/dataModel'

export type Reading = NonNullable<Doc<'reads'>['readings']>[number]

/** Each time through the book, oldest first. Reads from before this was tracked have just their top-level dates. */
export function readingsOf(read: Pick<Doc<'reads'>, 'readings' | 'startedAt' | 'finishedAt'>): Reading[] {
  if (read.readings) return read.readings
  return read.startedAt || read.finishedAt ? [{ startedAt: read.startedAt, finishedAt: read.finishedAt }] : []
}

/** The reads after a change of status: starting after a finish is a re-read, and finishing closes the open one. */
export function readingsAfter(readings: Reading[], status: Doc<'reads'>['status'], now: number): Reading[] {
  const latest = readings.at(-1)
  const open = latest && !latest.finishedAt
  if (status === 'reading') return open ? (latest.startedAt ? readings : [...readings.slice(0, -1), { ...latest, startedAt: now }]) : [...readings, { startedAt: now }]
  if (status === 'read') return open ? [...readings.slice(0, -1), { ...latest, startedAt: latest.startedAt ?? now, finishedAt: now }] : latest ? readings : [{ startedAt: now, finishedAt: now }]
  return readings
}

/** The top-level dates, always the latest read's. */
export function datesFrom(readings: Reading[], status: Doc<'reads'>['status']) {
  const latest = readings.at(-1)
  return { startedAt: latest?.startedAt, finishedAt: status === 'read' ? latest?.finishedAt : undefined }
}

/** A book as the app shows it: one person's read of a work, flattened. */
export function toBook(read: Doc<'reads'>, work: Doc<'works'>) {
  const { percent } = read.progress
  return {
    readId: read._id,
    slug: work.slug,
    title: work.title,
    author: work.authors[0] ?? 'Unknown author',
    status: read.status,
    format: read.format,
    percent,
    pages: work.pages ?? null,
    audioSeconds: work.audioSeconds ?? null,
    seconds: read.progress.seconds ?? (work.audioSeconds ? Math.round((percent / 100) * work.audioSeconds) : null),
    progressUnit: read.progressUnit ?? null,
    published: work.year ?? null,
    subjects: work.subjects,
    isbn: work.isbns[0] ?? null,
    readings: readingsOf(read),
    page: read.progress.page ?? (work.pages ? Math.round((percent / 100) * work.pages) : null),
    rating: read.rating ?? null,
    coverUrl: work.coverUrl ?? null,
    art: read.artChoice !== 'cover' && work.artSmallUrl && work.artLargeUrl ? { small: work.artSmallUrl, large: work.artLargeUrl } : null,
    addedAt: read.addedAt ?? null,
    startedAt: read.startedAt ?? null,
    finishedAt: read.finishedAt ?? null,
    recommendedBy: read.source?.who ?? null,
  }
}

/**
 * Where a logged place puts the reader. Percent is only for showing, so the exact page or second is kept: at 1,000
 * pages a rounded percent would be ten pages out. Only the very end counts as 100, because that finishes the book.
 * Null when it asks for a length this book doesn't have.
 */
export function progressAt(at: { percent?: number; page?: number; seconds?: number }, pages?: number, audioSeconds?: number) {
  const value = at.page ?? at.seconds ?? at.percent
  if (value === undefined || !Number.isFinite(value) || value < 0) return null
  const length = at.page !== undefined ? pages : at.seconds !== undefined ? audioSeconds : 100
  if (!length) return null
  const portion = Math.min(1, value / length)
  return {
    percent: portion === 1 ? 100 : Math.min(99, Math.round(portion * 100)),
    page: pages ? (at.page !== undefined ? Math.min(Math.round(at.page), pages) : Math.round(portion * pages)) : undefined,
    seconds: audioSeconds ? (at.seconds !== undefined ? Math.min(Math.round(at.seconds), audioSeconds) : Math.round(portion * audioSeconds)) : undefined,
  }
}

/** Where in the book an entry sits, in words. */
export function positionOf(pos: Doc<'entries'>['pos']): string {
  if (pos.page != null) return `Page ${pos.page}`
  if (pos.chapter) return `Chapter ${pos.chapter}`
  if (pos.percent != null) return `${pos.percent}%`
  return ''
}
