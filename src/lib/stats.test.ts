import { expect, test } from 'vitest'
import type { Book } from './books'
import { bestSources, byDays, byMonth, byRating, byYear, finishesOf, gaps, headline, tbrAge } from './stats'

const day = (text: string) => Date.parse(text)
const book = (over: Partial<Book>) => ({ title: 'A', author: 'Ann', status: 'read', format: 'print', pages: 100, rating: null, subjects: [], genres: [], readings: [], addedAt: null, recommendedBy: null, ...over }) as Book

const twice = book({ pages: 300, readings: [{ startedAt: day('2020-01-01'), finishedAt: day('2020-01-05') }, { finishedAt: day('2023-03-01') }] })
const open = book({ status: 'reading', readings: [{ startedAt: day('2024-01-01') }] })

test('each finish counts, so a re-read is read twice, and an open read is not finished', () => {
  const finishes = finishesOf([twice, open])
  expect(finishes.map(f => f.year)).toEqual([2020, 2023])
  expect(finishes[0].days).toBe(5)
  expect(finishes[1].days).toBeNull()
})

test('years with nothing read still show, as the gaps they were', () => {
  const rows = byYear(finishesOf([twice]), 'pages')
  expect(rows.map(r => [r.label, r.value])).toEqual([['2020', 300], ['2021', 0], ['2022', 0], ['2023', 300]])
  expect(rows[0].note).toBe('1 book, 300 pages')
  expect(byYear([], 'books')).toEqual([])
})

test('months always run January to December', () => {
  const rows = byMonth(finishesOf([twice]))
  expect(rows).toHaveLength(12)
  expect(rows[0]).toMatchObject({ label: 'Jan', value: 1 })
  expect(rows[2]).toMatchObject({ label: 'Mar', value: 1 })
})

test('every half star gets a row, top down', () => {
  const rows = byRating([book({ rating: 4.5 }), book({ rating: 4.5 }), book({})])
  expect(rows).toHaveLength(10)
  expect(rows[0].label).toBe('5')
  expect(rows[1]).toMatchObject({ label: '4.5', value: 2 })
  expect(rows[1].books).toHaveLength(2)
})

test('days and TBR age land in the right bands', () => {
  expect(byDays(finishesOf([twice]))[0]).toMatchObject({ label: 'Under a week', value: 1, books: [twice] })
  const rows = tbrAge([book({ status: 'tbr', addedAt: day('2024-01-01') }), book({ status: 'tbr', addedAt: day('2020-01-01') })], day('2024-01-10'))
  expect(rows[0].value).toBe(1)
  expect(rows.at(-1)).toMatchObject({ label: 'Over 3 years', value: 1 })
})

test('a source needs two rated books, and the best come first', () => {
  const rows = bestSources([
    book({ recommendedBy: 'Sam', rating: 5 }), book({ recommendedBy: 'Sam', rating: 4 }),
    book({ recommendedBy: 'Jo', rating: 2 }), book({ recommendedBy: 'Jo', rating: 3 }),
    book({ recommendedBy: 'One', rating: 5 }), book({ recommendedBy: 'Sam' }),
  ])
  expect(rows.map(r => [r.label, r.value])).toEqual([['Sam', 4.5], ['Jo', 2.5]])
})

test('the headline uses the middle, so one long read does not skew it', () => {
  const quick = (n: number) => book({ readings: [{ startedAt: day('2024-01-01'), finishedAt: day('2024-01-01') + (n - 1) * 86_400_000 }] })
  const h = headline(finishesOf([quick(5), quick(7), quick(400)]))
  expect(h).toEqual({ books: 3, pages: 300, medianDays: 7 })
  expect(headline([]).medianDays).toBeNull()
})

test('a re-read counts twice in the numbers, but is one book in the list behind them', () => {
  const [row] = byYear(finishesOf([book({ readings: [{ finishedAt: day('2020-01-01') }, { finishedAt: day('2020-06-01') }] })]), 'books')
  expect(row.value).toBe(2)
  expect(row.books).toHaveLength(1)
})

test('gaps finds finished books missing dates or a rating, and books in hand with no start', () => {
  const b = (slug: string, status: string, readings: Book['readings'], rating: number | null = 4) => ({ slug, status, readings, rating }) as Book
  const found = gaps([
    b('complete', 'read', [{ startedAt: 1, finishedAt: 2 }]),
    b('undated', 'read', [], null),
    b('no-start', 'read', [{ finishedAt: 2 }]),
    b('in-hand', 'reading', []),
    b('waiting', 'tbr', []),
  ])
  expect(found.map(g => [g.key, g.books.map(x => x.slug)])).toEqual([
    ['finished', ['undated']],
    ['started', ['undated', 'no-start', 'in-hand']],
    ['rating', ['undated']],
  ])
  expect(gaps([b('complete', 'read', [{ startedAt: 1, finishedAt: 2 }])])).toEqual([])
})
