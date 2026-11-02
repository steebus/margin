import { expect, test } from 'vitest'
import { fitWithin, nextRange, passage, wordsOf } from './photo'

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
