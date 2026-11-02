import { expect, test } from 'vitest'
import type { Book } from './books'
import { faceOf, pileNote, pileOf, spineOf, spineTitle } from './pile'

const book = (slug: string, readings: Book['readings'], status = 'read') => ({ slug, title: slug, status, readings }) as Book

test('the newest finish is on top, a re-read lies in the pile twice, and undated books go to the bottom', () => {
  const rows = pileOf([
    book('old', [{ finishedAt: 100 }]),
    book('twice', [{ startedAt: 86_400_000, finishedAt: 86_400_000 * 3 }, { finishedAt: 50 }]),
    book('undated', []),
    book('unread', [], 'tbr'),
  ])
  expect(rows.map(r => r.book.slug)).toEqual(['twice', 'old', 'twice', 'undated'])
  expect(rows[0].days).toBe(3)
})

test('a re-read in progress still shows its earlier finish', () => {
  expect(pileOf([book('again', [{ finishedAt: 100 }, { startedAt: 200 }], 'reading')]).map(r => r.finishedAt)).toEqual([100])
})

test('the note beside a book prefers what sums it up', () => {
  expect(pileNote([{ kind: 'excerpt', text: 'a' }, { kind: 'note', text: 'b' }, { kind: 'reflection', text: 'c' }])?.text).toBe('c')
  expect(pileNote([{ kind: 'excerpt', text: 'a' }, { kind: 'note', text: 'b' }])?.text).toBe('b')
  expect(pileNote([])).toBeNull()
})

test('a spine is stable, thickness comes from the page count, and thicker ones fit more note', () => {
  expect(spineOf('dune', 500)).toEqual(spineOf('dune', 500))
  expect(spineOf('dune', 800).height - spineOf('dune', 400).height).toBe(50)
  expect(spineOf('dune', 800).lines).toBeGreaterThan(spineOf('dune', 100).lines)
  expect(spineOf('thin', 10).lines).toBe(1)
  expect(new Set(['a', 'bb', 'ccc', 'dddd', 'eeeee', 'ffffff', 'ggggggg', 'hhhhhhhh', 'iiiiiiiii', 'jjjjjjjjjj', 'kkkkkkkkkkk', 'llllllllllll'].map(s => spineOf(s, 1).look)).size).toBeGreaterThan(2)
})

test('the typeface follows the first genre that means something', () => {
  expect(faceOf(['Horror', 'Fantasy'])).toBe('horror')
  expect(faceOf(['LGBTQ', 'Science Fiction'])).toBe('future')
  expect(faceOf(['General', 'History'])).toBe('fact')
  expect(faceOf(['Thriller'])).toBe('crime')
  expect(faceOf(['Science'])).toBe('fact')
  expect(faceOf([])).toBe('plain')
})

test('a spine drops the subtitle but keeps a colon that belongs to the title', () => {
  expect(spineTitle('Homo Deus: A Brief History of Tomorrow')).toBe('Homo Deus')
  expect(spineTitle('11/22/63')).toBe('11/22/63')
})
