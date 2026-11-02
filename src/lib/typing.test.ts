import { expect, test } from 'vitest'
import { delayAfter, inkFor, wrapLines } from './typing'

test('wraps on words and never exceeds the column count', () => {
  expect(wrapLines('what is that pronoun doing', 10)).toEqual(['what is', 'that', 'pronoun', 'doing'])
})

test('hard-breaks a word wider than the column', () => {
  expect(wrapLines('a Gethenians', 4)).toEqual(['a', 'Geth', 'enia', 'ns'])
})

test('collapses whitespace and handles empty text', () => {
  expect(wrapLines('  a \n b  ', 10)).toEqual(['a b'])
  expect(wrapLines('', 10)).toEqual([])
})

test('sentence ends pause longer than clause breaks, which pause longer than letters', () => {
  expect(delayAfter('.', 3)).toBeGreaterThan(delayAfter(',', 3))
  expect(delayAfter(',', 3)).toBeGreaterThan(delayAfter('a', 3))
})

test('ink is stable per glyph and stays legible', () => {
  expect(inkFor(7)).toEqual(inkFor(7))
  for (let i = 0; i < 500; i++) expect(inkFor(i).opacity).toBeGreaterThanOrEqual(0.74)
})
