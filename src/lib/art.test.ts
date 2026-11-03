import { expect, test } from 'vitest'
import { coverPath, coverTitleSize } from './art'

test('Hardcover covers go through this site; anything else is left alone', () => {
  expect(coverPath('https://assets.hardcover.app/edition/1/a.jpg')).toBe('/hc-covers/edition/1/a.jpg')
  expect(coverPath('https://covers.openlibrary.org/b/id/1-L.jpg')).toBe('https://covers.openlibrary.org/b/id/1-L.jpg')
})

test('a cover title is as big as it can be, shrinking so its longest word fits whole and it all fits in three lines', () => {
  expect(coverTitleSize('Red Rising')).toBe(15)
  const long = coverTitleSize("The Reverse Centaur's Guide to Life After AI")
  expect(long).toBeLessThan(15)
  expect(coverTitleSize('Supercalifragilisticexpialidocious')).toBeLessThan(long)
  // The longest word, at its size, fits the width.
  const word = 'Supercalifragilisticexpialidocious'
  expect(coverTitleSize(word) * (0.42 * word.length + 0.4)).toBeLessThanOrEqual(88.1)
})
