import { expect, test } from 'vitest'
import { parseNotesDoc, shelfStatus } from './playbooks'

const row = (inner: string, page: number) =>
  `<table><tr><td><img src="x.png"></td><td>${inner}</td><td><p><a href="https://www.google.com/url?q=https://play.google.com/books/reader?id%3DVOL123%26pg%3DGBS.PA${page}%26output%3Dreader&amp;sa=D">${page}</a></p></td></tr></table>`
const p = (cls: string, words: string) => `<p class="c0"><span class="${cls}">${words}</span></p>`

// Made up, in the shape of Drive's export of a "Notes from" doc.
const doc = `<html><head><title>Notes from "A Made-Up Book"</title><style>.c0{padding-top:0pt}.c13{background-color:#fde096;color:#000000}.c9{color:#424242;font-weight:400}.c15{color:#757575;font-size:11pt}</style></head>
<body><h1 class="c0"><span>A Made-Up Book</span></h1>
<table><tr><td><p>This document is overwritten when you make changes in Play Books.</p></td></tr></table>
${row(p('c13', 'It&#39;s a line from the book.') + p('c9', 'My thought on it.') + p('c15', 'March 26, 2026'), 15)}
${row(p('c13', 'Only the words.') + p('c15', 'March 27, 2026'), 16)}
${row(p('c15', 'Highlighted text cannot be displayed') + p('c9', 'A note on hidden words.') + p('c15', 'May 14, 2026'), 9)}
${row(p('c15', 'January 24, 2019'), 20)}
${row(p('c13', 'It&#39;s a line from the book.') + p('c9', 'My thought on it.') + p('c15', 'March 26, 2026'), 15)}
</body></html>`

test('a notes doc becomes its annotations, once each, with hidden words and bookmarks recognised', () => {
  const read = parseNotesDoc(doc)
  expect(read.title).toBe('A Made-Up Book')
  expect(read.volumeId).toBe('VOL123')
  expect(read.notes).toEqual([
    { page: 15, highlight: "It's a line from the book.", note: 'My thought on it.', at: Date.parse('March 26, 2026') },
    { page: 16, highlight: 'Only the words.', note: '', at: Date.parse('March 27, 2026') },
    { page: 9, highlight: '', note: 'A note on hidden words.', at: Date.parse('May 14, 2026') },
  ])
})

test('shelves that say how far the reader got', () => {
  expect([shelfStatus(4), shelfStatus(3), shelfStatus(2), shelfStatus(7)]).toEqual(['read', 'reading', 'tbr', null])
})
