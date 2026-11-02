import { expect, test } from 'vitest'
import type { Book } from './books'
import { pileNote, pileOf, spineOf } from './pile'

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

test('a spine is stable, and longer books are thicker', () => {
  expect(spineOf('dune', 500)).toEqual(spineOf('dune', 500))
  expect(spineOf('dune', 900).height).toBeGreaterThan(spineOf('dune', 200).height)
})
