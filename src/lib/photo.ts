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
