// Real Hardcover replies, recorded by scripts/hardcover-record.mjs and scrubbed, run through Margin's mappers.
// If Hardcover changes a shape, re-recording makes these fail. If Margin changes a query, re-record.
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { JOURNAL_FIELDS, LIBRARY_QUERY, LISTS_QUERY, listSlug, mapJournal, mapSearch, mapUserBook, SEARCH_QUERY, type HardcoverJournal, type HardcoverUserBook } from './hardcover'

const lf = (text: string) => text.replace(/\r\n/g, '\n')
const recorded = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/hardcover/${name}.json`, import.meta.url), 'utf8'))

test('the recordings were made with the queries Margin sends today', () => {
  expect(lf(recorded('library').query)).toBe(lf(LIBRARY_QUERY))
  expect(lf(recorded('search').query)).toBe(lf(SEARCH_QUERY))
  expect(lf(recorded('lists').query)).toBe(lf(LISTS_QUERY))
  expect(lf(recorded('journals').query)).toContain(lf(JOURNAL_FIELDS))
})

test('every recorded library book maps to a work and a read', () => {
  const books: HardcoverUserBook[] = recorded('library').data.me[0].user_books
  expect(books.length).toBeGreaterThan(5)
  const statuses = new Set<string>()
  for (const ub of books) {
    const mapped = mapUserBook(ub)
    expect(mapped, `user_book ${ub.id}`).not.toBeNull()
    const { work, read } = mapped!
    expect(work.title).not.toBe('Untitled')
    expect(work.authors.length).toBeGreaterThan(0)
    expect(work.coverUrl).toMatch(/^https:/)
    expect(read.hardcoverUserBookId).toBe(ub.id)
    if (read.status === 'read') expect(read.finishedAt ?? read.readings.at(-1)?.finishedAt).toBeTypeOf('number')
    statuses.add(read.status)
  }
  expect([...statuses].sort()).toEqual(['dnf', 'paused', 'read', 'reading', 'tbr'])
  expect(books.some(ub => mapUserBook(ub)!.read.review)).toBe(true)
  expect(books.some(ub => mapUserBook(ub)!.read.format === 'audio')).toBe(true)
})

test('recorded notes and quotes map, with their page and tags', () => {
  const journals: HardcoverJournal[] = recorded('journals').data.reading_journals
  const mapped = journals.map(mapJournal)
  expect(mapped.every(Boolean)).toBe(true)
  expect(new Set(mapped.map(m => m!.kind))).toEqual(new Set(['excerpt', 'note']))
  expect(mapped.some(m => m!.page)).toBe(true)
  // Hardcover's tag shape as read back (H10 is the shape Margin writes).
  expect(mapped.flatMap(m => m!.tags).length).toBeGreaterThan(0)
  for (const m of mapped) expect(m!.at).toBeTypeOf('number')
})

test('journal events other than quotes and notes are not imported as entries', () => {
  const events: HardcoverJournal[] = recorded('journal-events').data.reading_journals
  for (const j of events) expect(mapJournal(j) === null).toBe(j.event !== 'quote' && j.event !== 'note')
})

test('the two-minute sync reply carries books and journal events in the library shape', () => {
  const { me, reading_journals } = recorded('sync').data
  for (const ub of me[0].user_books as HardcoverUserBook[]) expect(mapUserBook(ub)).not.toBeNull()
  for (const j of reading_journals as (HardcoverJournal & { book_id: number })[]) expect(j.book_id).toBeTypeOf('number')
})

test('recorded search results map, most read first', () => {
  const hits = recorded('search').data.search.results.hits.map((h: { document: object }) => h.document)
  const found = mapSearch(hits)
  expect(found.length).toBeGreaterThan(0)
  expect(found[0].title).toMatch(/piranesi/i)
  expect(found[0].authors).toContain('Susanna Clarke')
})

test('recorded lists give each a slug and their books', () => {
  for (const list of recorded('lists').data.me[0].lists) {
    expect(listSlug(list)).toBeTruthy()
    for (const entry of list.list_books) expect(entry.book_id).toBeTypeOf('number')
  }
})
