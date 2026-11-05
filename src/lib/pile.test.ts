import { expect, test } from 'vitest'
import type { Book } from './books'
import { faceOf, LOOKS, pileNote, pileNotes, pileOf, spineOf, spineTitle, stackHeight } from './pile'

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
  const notes = [{ kind: 'excerpt', text: 'a' }, { kind: 'note', text: 'b' }, { kind: 'reflection', text: 'c' }, { kind: 'note', text: 'd' }]
  expect(pileNotes(notes).map(n => n.text)).toEqual(['c', 'b', 'd'])
})

test('a spine is stable, thickness comes from the page count, and a short book is slim', () => {
  expect(spineOf('dune', 500)).toEqual(spineOf('dune', 500))
  expect(spineOf('dune', 800).height - spineOf('dune', 400).height).toBe(25)
  expect(spineOf('strange-houses', 200).height).toBe(35)
  expect(spineOf('thin', 10).thin).toBe(true)
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

test('every book gets a real binding and a position within its column, whatever its name hashes to', () => {
  for (let i = 0; i < 500; i++) {
    const { look, shift, width } = spineOf(`book-${i}-${'x'.repeat(i % 40)}`, 300)
    expect(LOOKS).toContain(look)
    expect(shift).toBeGreaterThanOrEqual(0)
    expect(width).toBeLessThanOrEqual(100)
  }
})

test('all fifteen bindings turn up, and bigger books print bigger', () => {
  expect(LOOKS).toHaveLength(15)
  const seen = new Set(Array.from({ length: 800 }, (_, i) => spineOf(`a-book-${i}`, 300).look))
  expect(seen.size).toBe(15)
  expect(spineOf('a', 1000).titleSize).toBeGreaterThan(spineOf('a', 100).titleSize)
})

test('a stack says centimetres under a metre, metres above', () => {
  expect(stackHeight(600, 2)).toBe('about 4 cm tall')
  expect(stackHeight(100_000, 300)).toBe('about 6.2 metres tall')
  expect(stackHeight(19_200, 20)).toBe('about 1 metre tall')
})
