import { expect, test } from 'vitest'
import { dueNudge } from './nudge'

const DAY = 24 * 60 * 60_000
const now = Date.UTC(2026, 10, 3, 17)
const book = (title: string, daysAgo: number) => ({ title, slug: title.toLowerCase(), lastProgressAt: now - daysAgo * DAY })

test('a book quiet for seven days gets a nudge, and six days does not', () => {
  expect(dueNudge({ reading: [book('Six', 6)], waiting: [], lastPushAt: null, now })).toBeNull()
  expect(dueNudge({ reading: [book('Six', 6), book('Nine', 9), book('Seven', 7)], waiting: [], lastPushAt: null, now }))
    .toEqual({ title: 'Nine has been quiet', body: 'Nothing logged for 9 days. Still reading it?', url: '/books/nine' })
})

test('a note left three days comes first, and nothing goes out twice in a day', () => {
  const waiting = [{ title: 'Noted', slug: 'noted', createdAt: now - 3 * DAY }]
  expect(dueNudge({ reading: [book('Nine', 9)], waiting, lastPushAt: null, now })?.url).toBe('/books/noted')
  expect(dueNudge({ reading: [], waiting: [{ ...waiting[0], createdAt: now - 2 * DAY }], lastPushAt: null, now })).toBeNull()
  expect(dueNudge({ reading: [book('Nine', 9)], waiting, lastPushAt: now - 12 * 60 * 60_000, now })).toBeNull()
  expect(dueNudge({ reading: [book('Nine', 9)], waiting, lastPushAt: now - DAY + 30 * 60_000, now })).not.toBeNull()
})
