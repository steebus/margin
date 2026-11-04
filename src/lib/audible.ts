import { sameBook } from '../../convex/lib/match'

// Audible import (Steve, 2026-11-03). Audible has no API, so the library comes from audible-cli's export
// (`audible library export`), as TSV, CSV or JSON, uploaded by the reader. Parsed and compared here; nothing is
// written until the reader confirms. Pure, so it can be tested against an export.

export type AudibleBook = { asin: string; title: string; author: string; finished: boolean; percent: number; minutes: number | null }

/** A delimited file into rows of named fields. Quoted fields may hold the delimiter, quotes ("") and new lines. */
export function parseDelimited(text: string): Record<string, string>[] {
  const delimiter = text.split('\n', 1)[0].includes('\t') ? '\t' : ','
  const rows: string[][] = [[]]
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === delimiter) { rows.at(-1)!.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      rows.at(-1)!.push(field); field = ''; rows.push([])
    } else field += c
  }
  rows.at(-1)!.push(field)
  const [head, ...body] = rows.filter(r => r.some(f => f.trim()))
  if (!head) return []
  const names = head.map(h => h.trim().toLowerCase())
  return body.map(r => Object.fromEntries(names.map((n, i) => [n, (r[i] ?? '').trim()])))
}

const yes = (v: unknown) => v === true || /^(true|1|yes)$/i.test(String(v ?? ''))

/** audible-cli's export, in any of its formats, as books. Podcasts and anything without a title are left out. */
export function readAudible(text: string): AudibleBook[] {
  const trimmed = text.trim()
  let rows: Record<string, unknown>[]
  try {
    rows = trimmed.startsWith('[') ? JSON.parse(trimmed) : parseDelimited(trimmed)
  } catch {
    return []
  }
  return rows.flatMap(r => {
    const title = String(r.title ?? '').trim()
    if (!title || /podcast/i.test(String(r.content_type ?? ''))) return []
    const authors = Array.isArray(r.authors) ? r.authors.map(a => (typeof a === 'string' ? a : (a as { name?: string }).name ?? '')).join(', ') : String(r.authors ?? '')
    const percent = Math.max(0, Math.min(100, Math.round(Number(r.percent_complete) || 0)))
    const finished = yes(r.is_finished) || percent >= 100
    return [{
      asin: String(r.asin ?? ''),
      title,
      author: authors.split(',')[0]?.trim() ?? '',
      finished,
      percent: finished ? 100 : percent,
      minutes: Number(r.runtime_length_min) || null,
    }]
  })
}


type Shelved = { readId: string; title: string; author: string; status: string; percent: number }

export type AudiblePlan<B extends Shelved> = {
  finish: { book: B; audible: AudibleBook }[] // finished on Audible, not marked read here
  progress: { book: B; audible: AudibleBook }[] // further along on Audible
  addFinished: AudibleBook[]
  addReading: AudibleBook[]
  addUnstarted: AudibleBook[]
  same: number
}

/** What an Audible export would change. Only ever moves a book forward: nothing here is marked less read. */
export function planAudible<B extends Shelved>(audible: AudibleBook[], shelves: B[]): AudiblePlan<B> {
  const plan: AudiblePlan<B> = { finish: [], progress: [], addFinished: [], addReading: [], addUnstarted: [], same: 0 }
  for (const a of audible) {
    const book = shelves.find(b => sameBook(b, a))
    if (!book) {
      ;(a.finished ? plan.addFinished : a.percent > 0 ? plan.addReading : plan.addUnstarted).push(a)
    } else if (a.finished && book.status !== 'read') plan.finish.push({ book, audible: a })
    else if (!a.finished && book.status !== 'read' && a.percent > book.percent) plan.progress.push({ book, audible: a })
    else plan.same++
  }
  return plan
}
