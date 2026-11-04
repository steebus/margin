// Kobo, read-only (docs/superpowers/specs/2026-11-04-kobo-pull-design.md). Kobo has no public API: the book list
// comes from a bookmarklet on My Books, and annotations from the endpoint Kobo's web reader uses. Pure, so tests can
// hold Kobo's shapes. These are guesses at an undocumented format, so anything unexpected throws rather than guesses.

/** What the bookmarklet sends for each book on My Books. */
export type KoboBook = { koboId: string | null; title: string; author: string; statusText: string }

export type KoboNote = { id: string; text: string; note: string; chapter?: string; percent?: number; at?: number }

/** "FINISHED", "33% READ" or "UNREAD", as My Books shows them. */
export function koboStatus(text: string): { status: 'read' | 'reading' | 'tbr'; percent: number } | null {
  const t = text.trim().toUpperCase()
  if (t === 'FINISHED') return { status: 'read', percent: 100 }
  if (t === 'UNREAD') return { status: 'tbr', percent: 0 }
  const m = /^(\d{1,3})% READ$/.exec(t)
  return m ? { status: 'reading', percent: Math.min(100, Number(m[1])) } : null
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** One page of `api/v3/content/{id}/annotations`. */
export function parseAnnotations(json: unknown): { notes: KoboNote[]; more: boolean } {
  const list = (json as { annotations?: unknown })?.annotations
  if (!Array.isArray(list)) throw new Error('kobo shape')
  const notes = list.map(a => {
    if (typeof a?.id !== 'string') throw new Error('kobo shape')
    const span = a.location?.span
    const at = Date.parse(str(a.clientLastModifiedUtc))
    const share = typeof span?.percentageOfBook === 'number' ? span.percentageOfBook : null
    return {
      id: a.id,
      text: str(a.highlightedText),
      note: str(a.noteText),
      ...(str(span?.chapterTitle) ? { chapter: str(span.chapterTitle) } : {}),
      ...(Number.isFinite(at) ? { at } : {}),
      ...(share !== null && share >= 0 && share <= 1 ? { percent: Math.round(share * 1000) / 10 } : {}),
    }
  }).filter(n => n.text || n.note)
  return { notes, more: !!(json as { nextPageOffsetToken?: unknown }).nextPageOffsetToken }
}
