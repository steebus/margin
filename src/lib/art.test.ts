import { expect, test } from 'vitest'
import { artFor, coverPath } from './art'

test('a stored drawing is found by title and surname, and other books have none', () => {
  expect(artFor('The Left Hand of Darkness', 'Ursula K. Le Guin')?.small).toBe('/art-demo/the-left-hand-of-darkness-guin-256.webp')
  expect(artFor('The Works of Vermin', 'Hiron Ennes')).toBeNull()
})

test('Hardcover covers go through this site; anything else is left alone', () => {
  expect(coverPath('https://assets.hardcover.app/edition/1/a.jpg')).toBe('/hc-covers/edition/1/a.jpg')
  expect(coverPath('https://covers.openlibrary.org/b/id/1-L.jpg')).toBe('https://covers.openlibrary.org/b/id/1-L.jpg')
})
