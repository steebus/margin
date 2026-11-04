import { expect, test } from 'vitest'
import { planPlayBooks, playBooks } from './playbooks-plan'

const note = { page: 3, highlight: 'Words.', note: '', at: null }

test("a doc joins its book by volume id, or by title, or stands alone with no status", () => {
  const books = playBooks(
    [{ volumeId: 'V1', title: 'Read One', author: 'A Writer', shelves: [7, 4] }, { volumeId: 'V2', title: 'Owned Only', author: 'B', shelves: [7] }],
    [{ title: 'Read One', volumeId: 'V1', notes: [note] }, { title: 'Owned Only: A Subtitle', volumeId: null, notes: [note] }, { title: 'Nowhere', volumeId: 'V9', notes: [note] }],
  )
  expect(books.map(b => [b.sourceId, b.status, b.notes.length])).toEqual([['V1', 'read', 1], ['V2', null, 1], ['V9', null, 1]])
})

test('Play Books moves books forward only, adds what it knows, and leaves the rest for review', () => {
  const shelf = (title: string, status: string) => ({ readId: title, title, author: 'A Writer', status })
  const plan = planPlayBooks([
    { sourceId: '1', title: 'Finished There', author: 'A Writer', status: 'read', notes: [] },
    { sourceId: '2', title: 'Started There', author: 'A Writer', status: 'reading', notes: [] },
    { sourceId: '3', title: 'Read Here', author: 'A Writer', status: 'tbr', notes: [note] },
    { sourceId: '4', title: 'Same Here', author: 'A Writer', status: 'reading', notes: [] },
    { sourceId: '5', title: 'New, Known', author: 'C', status: 'read', notes: [] },
    { sourceId: '6', title: 'New, Unknown', author: 'D', status: null, notes: [note] },
  ], [shelf('Finished There', 'reading'), shelf('Started There', 'tbr'), shelf('Read Here', 'read'), shelf('Same Here', 'reading')])
  expect(plan.onShelves.map(o => [o.book.title, o.move])).toEqual([['Finished There', 'read'], ['Started There', 'reading'], ['Read Here', null]])
  expect(plan.toAdd.map(b => b.title)).toEqual(['New, Known'])
  expect(plan.toReview.map(b => b.title)).toEqual(['New, Unknown'])
})
