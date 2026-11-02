import type { Doc } from '../_generated/dataModel'

/** A book as the app shows it: one person's read of a work, flattened. */
export function toBook(read: Doc<'reads'>, work: Doc<'works'>) {
  const activity = read.finishedAt ?? read.startedAt ?? read.addedAt ?? read._creationTime
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
    page: read.progress.page ?? (work.pages ? Math.round((percent / 100) * work.pages) : null),
    rating: read.rating ?? null,
    coverUrl: work.coverUrl ?? null,
    art: read.artChoice !== 'cover' && work.artSmallUrl && work.artLargeUrl ? { small: work.artSmallUrl, large: work.artLargeUrl } : null,
    year: new Date(activity).getUTCFullYear(),
    addedAt: read.addedAt ?? null,
    startedAt: read.startedAt ?? null,
    finishedAt: read.finishedAt ?? null,
    recommendedBy: read.source?.who ?? null,
  }
}

/** Where in the book an entry sits, in words. */
export function positionOf(pos: Doc<'entries'>['pos']): string {
  if (pos.page != null) return `Page ${pos.page}`
  if (pos.chapter) return `Chapter ${pos.chapter}`
  if (pos.percent != null) return `${pos.percent}%`
  return ''
}
