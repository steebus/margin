/** Hardcover's image server refuses canvas access, so its covers are served through this site (see vercel.json). */
export function coverPath(url: string) {
  return url.replace('https://assets.hardcover.app/', '/hc-covers/')
}

// A cover title's size, from its words alone, so hundreds of covers need no measuring. League Gothic capitals measure
// about 0.34em a character on average and 0.52em at the widest (M, W). The longest word must fit the width whole,
// never hyphenated or broken, so it's sized for wide letters. Then the words are wrapped as the browser would, a
// little pessimistically, and the size steps down until they take three lines. Checked against all 647 titles in
// Steve's library. Sizes are in cqi: hundredths of the cover's width.
const CHAR_WORD = 0.42
const CHAR_WRAP = 0.37
const SPACE = 0.22
const WIDTH = 88 // the title box: 6% inset either side
const PAPER = 0.4 // the strip of paper behind each line's ends, in em
const LINES = 3
const MAX = 15

/** How many lines the words take at a size, wrapped greedily the way a browser does. */
function linesAt(words: string[], size: number) {
  const room = WIDTH / size - PAPER
  let lines = 1
  let used = 0
  for (const word of words) {
    const w = word.length * CHAR_WRAP
    if (used > 0 && used + SPACE + w > room) { lines++; used = w } else used += (used > 0 ? SPACE : 0) + w
  }
  return lines
}

export function coverTitleSize(title: string) {
  const words = title.trim().toUpperCase().split(/\s+/).filter(Boolean)
  const longest = Math.max(1, ...words.map(w => w.length))
  let size = Math.min(MAX, WIDTH / (CHAR_WORD * longest + PAPER))
  while (size > 3 && linesAt(words, size) > LINES) size *= 0.95
  return Math.round(size * 10) / 10
}
