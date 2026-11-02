const hash = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** Word-wrap for a monospace face. Words longer than a line are hard-broken. */
export function wrapLines(text: string, cols: number): string[] {
  const lines: string[] = []
  let line = ''
  for (let word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > cols) {
      lines.push(line)
      line = ''
    }
    while (word.length > cols) {
      lines.push(word.slice(0, cols))
      word = word.slice(cols)
    }
    line = line ? `${line} ${word}` : word
  }
  if (line) lines.push(line)
  return lines
}

/** Milliseconds to wait after striking this character. */
export function delayAfter(char: string, i: number): number {
  const beat = 26 + hash(i) * 26
  return /[.?!]/.test(char) ? beat + 240 : /[,;:]/.test(char) ? beat + 110 : beat
}

/** Uneven ribbon: a stable opacity and baseline offset for each glyph. */
export function inkFor(i: number): { opacity: number; y: number } {
  return { opacity: 0.74 + hash(i + 1) * 0.26, y: (hash(i + 2) - 0.5) * 0.05 }
}
