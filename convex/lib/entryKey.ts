type Pos = { page?: number; chapter?: string; percent?: number }

/** The same words spelled the same way, whatever the spacing or capitals. */
export function normaliseText(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
}

const hash = (text: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** Short, stable stand-in for some words, for keys. */
export const wordsKey = (text: string) => {
  const normal = normaliseText(text)
  return `${normal.length}.${hash(normal)}`
}

/** Identifies an entry by book, words and place, so saving or importing it twice only keeps one. */
export function entryKey(workId: string, kind: string, text: string, pos: Pos): string {
  const normal = normaliseText(text)
  const place = pos.page ?? pos.chapter ?? pos.percent ?? ''
  return `${workId}:${kind}:${normal.length}.${hash(normal)}:${place}`
}
