import { expect, test } from 'vitest'
import { bookmarklet, cleanUrl, readShare } from './share-read'

const GR = 'https://www.goodreads.com/book/show/40180098-the-overstory'

test('a Goodreads page title gives the title and author', () => {
  expect(readShare({ url: GR, title: 'The Overstory by Richard Powers | Goodreads' })).toEqual({
    kind: 'goodreads', url: GR, title: 'The Overstory', author: 'Richard Powers',
  })
})

test('Goodreads through the Android share sheet, where the link sits inside the words', () => {
  const read = readShare({ text: `Check out The Overstory by Richard Powers on Goodreads: ${GR}?ref=nav&from_search=true` })
  expect(read).toEqual({ kind: 'goodreads', url: GR, title: 'The Overstory', author: 'Richard Powers' })
})

test('Goodreads with no usable words falls back to the address', () => {
  expect(readShare({ url: GR })).toMatchObject({ title: 'The Overstory', author: null })
  expect(readShare({ url: 'https://goodreads.com/book/show/2.The_Left_Hand' })).toMatchObject({ kind: 'goodreads', title: 'The Left Hand' })
})

test('a Goodreads page that is not a book is not treated as one', () => {
  expect(readShare({ url: 'https://www.goodreads.com/user/show/1-steve' }).kind).toBe('other')
})

test('Instagram posts and reels, in every shape, become one address', () => {
  for (const url of [
    'https://www.instagram.com/p/ABC_123/?igsh=xyz',
    'https://www.instagram.com/reel/ABC_123/',
    'https://instagram.com/reels/ABC_123',
    'https://www.instagram.com/tv/ABC_123/',
  ]) {
    expect(readShare({ url })).toEqual({ kind: 'instagram', url: 'https://www.instagram.com/p/ABC_123/', code: 'ABC_123', handle: null })
  }
})

test('the source account comes from the address or from the words around it', () => {
  expect(readShare({ url: 'https://www.instagram.com/some.reader/reel/ABC/' })).toMatchObject({ handle: 'some.reader' })
  expect(readShare({ title: 'Some Reader (@some.reader) on Instagram', url: 'https://www.instagram.com/p/ABC/' })).toMatchObject({ handle: 'some.reader' })
})

test('an Instagram profile, an unknown site and nothing at all are all "other"', () => {
  expect(readShare({ url: 'https://www.instagram.com/some.reader/' }).kind).toBe('other')
  expect(readShare({ url: 'https://example.com/a' })).toEqual({ kind: 'other', url: 'https://example.com/a' })
  expect(readShare({})).toEqual({ kind: 'other', url: null })
  expect(readShare({ url: 'javascript:alert(1)' })).toEqual({ kind: 'other', url: null })
})

test('cleanUrl removes tracking and refuses anything that is not a web address', () => {
  expect(cleanUrl('https://a.com/x?utm_source=s&keep=1')).toBe('https://a.com/x?keep=1')
  expect(cleanUrl('not a url')).toBeNull()
})

test('the bookmarklet points at the share screen and escapes what it sends', () => {
  const code = bookmarklet('https://margin.app')
  expect(code).toMatch(/^javascript:/)
  expect(code).toContain("'https://margin.app/capture/share?popup=1&url='+encodeURIComponent(location.href)")
})
