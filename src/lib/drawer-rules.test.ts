import { expect, test } from 'vitest'
import { nextCard, onThisDay, toastDue, yearsAgoToday } from './drawer-rules'

const DAY = 24 * 60 * 60 * 1000

test('the toast is due first time, after a week, and after bad data, but not within the week', () => {
  const now = 100 * DAY
  expect(toastDue(null, now)).toBe(true)
  expect(toastDue('rubbish', now)).toBe(true)
  expect(toastDue(String(now - 7 * DAY), now)).toBe(true)
  expect(toastDue(String(now - 6 * DAY), now)).toBe(false)
})

test('shuffle never lands on the same card and stays in range', () => {
  for (let current = 0; current < 5; current++) {
    for (const random of [0, 0.3, 0.6, 0.999]) {
      const next = nextCard(current, 5, random)
      expect(next).not.toBe(current)
      expect(next).toBeGreaterThanOrEqual(0)
      expect(next).toBeLessThan(5)
    }
  }
  expect(nextCard(0, 1)).toBe(0)
})

test('on this day finds a note from an earlier year, not from today or another date', () => {
  const now = new Date(2026, 10, 10, 15).getTime()
  const at = (y: number, m: number, d: number) => ({ id: `${y}-${m}-${d}`, createdAt: new Date(y, m, d, 8).getTime() })
  const entries = [at(2026, 10, 10), at(2025, 10, 9), at(2023, 10, 10), at(2024, 4, 10)]
  expect(onThisDay(entries, now)?.entry.id).toBe('2023-10-10')
  expect(onThisDay(entries, now)?.years).toBe(3)
  expect(onThisDay([at(2026, 10, 10)], now)).toBeUndefined()
  expect(onThisDay([], now)).toBeUndefined()
})

test('on this day lets the pick choose among several and never runs off the end', () => {
  const now = new Date(2026, 10, 10).getTime()
  const entries = [2024, 2023, 2022].map(y => ({ id: String(y), createdAt: new Date(y, 10, 10, 9).getTime() }))
  expect(onThisDay(entries, now, 0)?.entry.id).toBe('2024')
  expect(onThisDay(entries, now, 0.5)?.entry.id).toBe('2023')
  expect(onThisDay(entries, now, 0.999)?.entry.id).toBe('2022')
  expect(onThisDay(entries, now, 1)?.entry.id).toBe('2022')
})

test('the years-ago heading reads as words for small numbers', () => {
  expect(yearsAgoToday(1)).toBe('A year ago today')
  expect(yearsAgoToday(3)).toBe('Three years ago today')
  expect(yearsAgoToday(12)).toBe('12 years ago today')
})
