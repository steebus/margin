import { expect, test } from 'vitest'
import { nextCard, toastDue } from './drawer-rules'

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
