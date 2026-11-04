// Play Books (docs/superpowers/specs/2026-11-04-play-books-design.md). Its notes are Google Docs in Drive, one per book,
// read here as Drive's HTML export: each annotation a table row of swatch, words, page. The colours that tell the
// highlight from the note from the date are in the doc's own <style>, under class names that change per doc. Pure.

export type PlayNote = { page: number | null; highlight: string; note: string; at: number | null }

const HIDDEN = /^highlighted text cannot be displayed/i
const DATE = /^[A-Z][a-z]+ \d{1,2}, \d{4}$/

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' }
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m)
const text = (html: string) => decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()

/** Google's library shelves by id: To read, Reading now, Have read. Any other doesn't say how far the reader got. */
export const shelfStatus = (shelfId: number): 'read' | 'reading' | 'tbr' | null =>
  shelfId === 4 ? 'read' : shelfId === 3 ? 'reading' : shelfId === 2 ? 'tbr' : null

export const STATUS_RANK = { tbr: 0, reading: 1, read: 2 } as const

/** A notes doc: the book's title, its Google volume id, and its annotations, each once. */
export function parseNotesDoc(html: string): { title: string; volumeId: string | null; notes: PlayNote[] } {
  const style = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html)?.[1] ?? ''
  const rule = new Map<string, string>()
  for (const m of style.matchAll(/\.([\w-]+)\{([^}]*)\}/g)) rule.set(m[1], (rule.get(m[1]) ?? '') + m[2].toLowerCase())
  const kindOf = (classes: string): 'highlight' | 'note' | 'date' | null => {
    const css = classes.split(/\s+/).map(c => rule.get(c) ?? '').join(';')
    if (/background-color:\s*#(?!fff(?:fff)?\b)[0-9a-f]{3,6}/.test(css)) return 'highlight'
    if (/(^|;)color:\s*#424242/.test(css)) return 'note'
    if (/(^|;)color:\s*#757575/.test(css)) return 'date'
    return null
  }

  const body = html.slice(Math.max(0, html.search(/<body/i)))
  const title = text(/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(body)?.[1] ?? '') ||
    decode(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').replace(/^Notes from\s*"?|"$/g, '').trim()
  let volumeId: string | null = null
  const seen = new Set<string>()
  const notes: PlayNote[] = []

  for (const table of body.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const cells = [...table[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1])
    if (cells.length !== 3) continue
    const link = decode(/href="([^"]*)"/i.exec(cells[2])?.[1] ?? '')
    const inner = (() => { try { const u = new URL(link); return new URL(u.searchParams.get('q') ?? link) } catch { return null } })()
    if (!inner || !/play\.google\.com$/.test(inner.hostname)) continue
    volumeId ??= inner.searchParams.get('id')
    const pageText = /GBS\.PA(\d+)/.exec(inner.searchParams.get('pg') ?? '')?.[1] ?? text(cells[2])
    const page = /^\d+$/.test(pageText) ? Number(pageText) : null

    let highlight = '', note = '', at: number | null = null
    for (const p of cells[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
      const words = text(p[1])
      if (!words) continue
      const kind = kindOf([...p[1].matchAll(/<span[^>]*class="([^"]*)"/gi)].map(m => m[1]).join(' '))
      if (HIDDEN.test(words)) continue
      if (kind === 'date' || (!kind && DATE.test(words))) { const t = Date.parse(words); at = Number.isNaN(t) ? null : t }
      else if (kind === 'highlight') highlight = highlight ? `${highlight}\n${words}` : words
      else note = note ? `${note}\n${words}` : words
    }
    if (!highlight && !note) continue // a bookmark
    const key = `${page}|${highlight}|${note}`
    if (seen.has(key)) continue // the doc lists each one by colour and again in full
    seen.add(key)
    notes.push({ page, highlight, note, at })
  }
  return { title, volumeId, notes }
}
