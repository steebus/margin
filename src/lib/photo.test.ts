import { expect, test } from 'vitest'
import { fitWithin, fromOcr, nextRange, passage, wordsOf } from './photo'

test('a big photo shrinks to fit, and a small one is left alone', () => {
  expect(fitWithin(4000, 3000)).toEqual({ width: 1800, height: 1350 })
  expect(fitWithin(3000, 4000)).toEqual({ width: 1350, height: 1800 })
  expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
})

test('two taps mark a passage either way round, and the next tap starts again', () => {
  expect(nextRange(null, 5)).toEqual([5, 5])
  expect(nextRange([5, 5], 9)).toEqual([5, 9])
  expect(nextRange([5, 5], 2)).toEqual([2, 5])
  expect(nextRange([2, 5], 7)).toEqual([7, 7])
  expect(nextRange([7, 7], 7)).toBeNull()
})

const page = ['One two three.', 'Four five.']

test('words number straight through the paragraphs', () => {
  expect(wordsOf(page).flat().map(w => w.index)).toEqual([0, 1, 2, 3, 4])
})

test('a passage keeps its paragraph break, and no mark means the whole page', () => {
  expect(passage(page, [1, 3])).toBe('two three.\n\nFour')
  expect(passage(page, [3, 4])).toBe('Four five.')
  expect(passage(page, null)).toBe('One two three.\n\nFour five.')
})

const scanned = `CHAPTER SEVEN 212

The ferry left Oban an hour late, and by the time
Marguerite had found a seat out of the wind the
harbour had shrunk. She read the part about the keep-
er's daughter for the ninth time that morning, again.
It was over.
Nobody on the island would admit to having written
it. That, she thought, was probably the whole point.

`

test('recognised text comes back as paragraphs, with its header lifted out and split words rejoined', () => {
  const read = fromOcr(scanned)
  expect(read.page).toBe(212)
  expect(read.chapter).toBe('CHAPTER SEVEN')
  expect(read.paragraphs).toHaveLength(2)
  expect(read.paragraphs[0]).toContain("the keeper's daughter")
  expect(read.paragraphs[0].endsWith('It was over.')).toBe(true)
  expect(read.paragraphs[1].startsWith('Nobody')).toBe(true)
})

test('a lone page number at the foot is taken, and plain words are never mistaken for a margin', () => {
  expect(fromOcr('A whole line of words that goes on.\nAnother line of words, about as long.\n\n88')).toMatchObject({ page: 88, chapter: null })
  expect(fromOcr('She left at dawn and did not look back.\nHe watched her go from the window.')).toMatchObject({ page: null, paragraphs: ['She left at dawn and did not look back. He watched her go from the window.'] })
  expect(fromOcr('   ').paragraphs).toEqual([])
})
