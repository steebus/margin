import { expect, test } from 'vitest'
import { authorFacts, countryOf, mapUserBook, slugify, type HardcoverUserBook } from './hardcover'

const base: HardcoverUserBook = {
  id: 7,
  status_id: 1,
  date_added: '2018-04-23',
  edition: { isbn_13: '9780441478125', pages: 304, reading_format_id: 1 },
  book: {
    id: 588605,
    title: ' The Left Hand of Darkness ',
    pages: 300,
    release_year: 1969,
    cached_contributors: [
      { author: { name: 'Ursula K. Le Guin' }, contribution: 'Author' },
      { author: { name: 'A Translator' }, contribution: 'Translator' },
    ],
    cached_image: { url: 'https://assets.hardcover.app/a.jpg' },
    cached_tags: { Genre: [{ tag: 'Science Fiction' }] },
  },
}

test('maps a TBR book, keeping only real authors', () => {
  const mapped = mapUserBook(base)!
  expect(mapped.work).toMatchObject({
    hardcoverId: 588605, title: 'The Left Hand of Darkness', authors: ['Ursula K. Le Guin'], pages: 304,
    isbns: ['9780441478125'], coverUrl: 'https://assets.hardcover.app/a.jpg', subjects: ['Science Fiction'],
  })
  expect(mapped.read).toMatchObject({ hardcoverUserBookId: 7, status: 'tbr', percent: 0, format: 'print' })
  expect(mapped.read.addedAt).toBe(Date.parse('2018-04-23'))
})

test('every Hardcover status maps, and Ignored or bookless records are dropped', () => {
  const statuses = [[1, 'tbr'], [2, 'reading'], [3, 'read'], [4, 'paused'], [5, 'dnf']] as const
  for (const [id, status] of statuses) expect(mapUserBook({ ...base, status_id: id })!.read.status).toBe(status)
  expect(mapUserBook({ ...base, status_id: 6 })).toBeNull()
  expect(mapUserBook({ ...base, status_id: 99 })).toBeNull()
  expect(mapUserBook({ ...base, book: null })).toBeNull()
})

test('progress: finished is 100, a TBR is 0, and logged progress is rounded and kept in range', () => {
  const reads = (progress: number) => [{ progress }]
  expect(mapUserBook({ ...base, status_id: 3 })!.read.percent).toBe(100)
  expect(mapUserBook({ ...base, status_id: 1, user_book_reads: reads(40) })!.read.percent).toBe(0)
  expect(mapUserBook({ ...base, status_id: 2, user_book_reads: reads(33.6) })!.read.percent).toBe(34)
  expect(mapUserBook({ ...base, status_id: 2, user_book_reads: reads(140) })!.read.percent).toBe(100)
  expect(mapUserBook({ ...base, status_id: 2 })!.read.percent).toBe(0)
})

test('only finished books get a finish date, and it falls back to the read record', () => {
  const finished = { user_book_reads: [{ finished_at: '2024-01-02', started_at: '2023-12-01' }] }
  expect(mapUserBook({ ...base, status_id: 3, ...finished })!.read.finishedAt).toBe(Date.parse('2024-01-02'))
  expect(mapUserBook({ ...base, status_id: 3, ...finished })!.read.startedAt).toBe(Date.parse('2023-12-01'))
  expect(mapUserBook({ ...base, status_id: 2, ...finished })!.read.finishedAt).toBeUndefined()
})

test('audio, ebook and physical formats are recognised, and an edition with none says nothing', () => {
  const format = (id: number | null) => mapUserBook({ ...base, edition: { reading_format_id: id } })!.read.format
  expect(format(2)).toBe('audio')
  expect(format(4)).toBe('ebook')
  expect(format(1)).toBe('print')
  expect(format(3)).toBe('print')
  // No format leaves Margin's alone; a new book is saved as print (hardcoverSync.test.ts).
  expect(format(null)).toBeUndefined()
})

test('thin records still produce something usable', () => {
  const thin = mapUserBook({ id: 1, status_id: 1, book: { id: 35 } })!
  expect(thin.work).toMatchObject({ title: 'Untitled', authors: [], isbns: [], subjects: [] })
  expect(thin.work.slug).toBe('untitled-z')
  expect(thin.read.addedAt).toBeUndefined()
})

test('a bad date is ignored rather than stored', () => {
  expect(mapUserBook({ ...base, date_added: 'not a date' })!.read.addedAt).toBeUndefined()
})

test('slugs are stable, plain and unique per book', () => {
  expect(slugify('Pédro Páramo: A Novel!')).toBe('pedro-paramo-a-novel')
  expect(mapUserBook(base)!.work.slug).toBe(`the-left-hand-of-darkness-guin-${(588605).toString(36)}`)
})

test("an author's location becomes a country, with the US and UK named one way", () => {
  expect(countryOf('Portland, Oregon, USA')).toBe('United States')
  expect(countryOf('Washington State, United States of America')).toBe('United States')
  expect(countryOf('Gig Harbor, Washington')).toBe('United States')
  expect(countryOf('Stony Stratford, Buckinghamshire, England, United Kingdom')).toBe('United Kingdom')
  expect(countryOf('Glasgow, Scotland')).toBe('United Kingdom')
  expect(countryOf('Lagos, Nigeria')).toBe('Nigeria')
  expect(countryOf('')).toBeUndefined()
  expect(authorFacts({ gender_id: 2, location: 'America' })).toEqual({ authorGender: 'woman', authorCountry: 'United States' })
  expect(authorFacts({ gender_id: 9, location: null })).toEqual({})
  expect(authorFacts({ is_bipoc: true, is_lgbtq: false })).toEqual({ authorBipoc: true, authorLgbtq: false })
  expect(authorFacts({ is_bipoc: null })).toEqual({})
})
