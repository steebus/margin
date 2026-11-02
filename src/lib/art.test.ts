import { expect, test } from 'vitest'
import { coverPath } from './art'

test('Hardcover covers go through this site; anything else is left alone', () => {
  expect(coverPath('https://assets.hardcover.app/edition/1/a.jpg')).toBe('/hc-covers/edition/1/a.jpg')
  expect(coverPath('https://covers.openlibrary.org/b/id/1-L.jpg')).toBe('https://covers.openlibrary.org/b/id/1-L.jpg')
})
