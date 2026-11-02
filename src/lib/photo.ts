/** The size to send a photo at: enough to read small print, a fraction of what a phone camera takes. */
export function fitWithin(width: number, height: number, longest = 1800) {
  const scale = Math.min(1, longest / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** A chosen photo as base64 JPEG, shrunk first. Respects the photo's rotation. */
export async function shrinkPhoto(file: File) {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1]
}

export type Read = { paragraphs: string[]; page: number | null; chapter: string | null }

const END_OF_PARAGRAPH = 0.72

/**
 * Plain recognised text, tidied into what the model would have said: the header or footer lifted out, words split
 * across lines rejoined, and a new paragraph wherever a line stops well short of the others.
 */
export function fromOcr(text: string): Read {
  const blocks = text.split(/\n\s*\n/).map(b => b.split('\n').map(l => l.trim()).filter(Boolean)).filter(b => b.length)
  let page: number | null = null
  let chapter: string | null = null

  const margin = (line: string) => {
    const number = line.match(/^(\d{1,4})$|^\d{1,4}\s+\S|\S\s+(\d{1,4})$/)
    const words = line.replace(/\d+/g, '').trim()
    const shouting = !!words && words === words.toUpperCase() && line.length < 60
    if (!number && !shouting) return false
    const found = line.match(/\b\d{1,4}\b/)?.[0]
    if (found && line.length < 60) page ??= Number(found)
    if (/chapter|part\b/i.test(words)) chapter = words
    return true
  }
  // Only the very top and bottom of a page can be its margin.
  if (blocks[0]?.length === 1 && blocks.length > 1 && margin(blocks[0][0])) blocks.shift()
  else if (blocks[0]?.[0] && blocks[0].length > 1 && margin(blocks[0][0]) && blocks[0][0].length < 60) blocks[0].shift()
  const last = blocks.at(-1)
  if (last?.length === 1 && blocks.length > 1 && last[0].length < 60 && margin(last[0])) blocks.pop()

  const paragraphs = blocks.flatMap(block => {
    const longest = Math.max(...block.map(l => l.length))
    const out: string[] = []
    let open = ''
    for (const line of block) {
      open = open.endsWith('-') ? open.slice(0, -1) + line : open ? `${open} ${line}` : line
      if (line.length < longest * END_OF_PARAGRAPH) {
        out.push(open)
        open = ''
      }
    }
    if (open) out.push(open)
    return out
  })
  return { paragraphs, page, chapter }
}

/** Marking a passage by tapping its first and last word. A third tap starts again; tapping a lone word clears it. */
export type Range = [number, number] | null
export function nextRange(range: Range, word: number): Range {
  if (!range) return [word, word]
  if (range[0] !== range[1]) return [word, word]
  if (range[0] === word) return null
  return [Math.min(range[0], word), Math.max(range[0], word)]
}

/** The words a paragraph holds, each carrying its place in the whole page. */
export function wordsOf(paragraphs: string[]) {
  let index = 0
  return paragraphs.map(p => p.split(/\s+/).filter(Boolean).map(text => ({ text, index: index++ })))
}

/** The marked words as text, keeping paragraph breaks. The whole page when nothing is marked. */
export function passage(paragraphs: string[], range: Range) {
  if (!range) return paragraphs.join('\n\n')
  return wordsOf(paragraphs)
    .map(words => words.filter(w => w.index >= range[0] && w.index <= range[1]).map(w => w.text).join(' '))
    .filter(Boolean)
    .join('\n\n')
}
