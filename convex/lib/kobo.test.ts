import { expect, test } from 'vitest'
import { koboStatus, parseAnnotations } from './kobo'
import { sameBook } from './match'

test('Kobo statuses', () => {
  expect(koboStatus('33% READ')).toEqual({ status: 'reading', percent: 33 })
  expect(koboStatus('FINISHED')).toEqual({ status: 'read', percent: 100 })
  expect(koboStatus('UNREAD')).toEqual({ status: 'tbr', percent: 0 })
  expect(koboStatus('Move to Archive')).toBeNull()
})

test('annotations keep their words, note, chapter and place, and a note on its own', () => {
  const { notes, more } = parseAnnotations({
    annotations: [
      { id: 'a', type: 'note', highlightedText: ' A line. ', noteText: 'Mine', location: { span: { chapterTitle: 'Introduction', percentageOfBook: 0.0964912 } } },
      { id: 'b', type: 'note', highlightedText: '', noteText: 'Only a thought', location: {} },
      { id: 'c', type: 'highlight', highlightedText: '', noteText: '' },
    ],
    nextPageOffsetToken: null,
  })
  expect(notes).toEqual([
    { id: 'a', text: 'A line.', note: 'Mine', chapter: 'Introduction', percent: 9.6 },
    { id: 'b', text: '', note: 'Only a thought' },
  ])
  expect(more).toBe(false)
  expect(() => parseAnnotations({})).toThrow('kobo shape')
  expect(() => parseAnnotations({ annotations: [{ highlightedText: 'x' }] })).toThrow('kobo shape')
})

test('the same book across stores', () => {
  expect(sameBook({ title: "The Reason I Jump: one boy's voice from the silence of autism", author: 'Naoki Higashida, David Mitchell +1' }, { title: 'The Reason I Jump', author: 'Naoki Higashida' })).toBe(true)
  expect(sameBook({ title: 'Station Eleven', author: 'Emily St. John Mandel' }, { title: 'Station Eleven', author: '' })).toBe(true)
  expect(sameBook({ title: 'Recursion', author: 'Blake Crouch' }, { title: 'Recursion', author: 'Someone Else' })).toBe(false)
})
