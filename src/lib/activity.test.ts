import { expect, test } from 'vitest'
import { progressSteps } from './activity'

const DAY = 86_400_000
const now = 100 * DAY
const since = now - 14 * DAY

test('a book read across the window starts where it stood, steps at each log, and carries on to now', () => {
  const steps = progressSteps([{ at: since - DAY, percent: 10 }, { at: since + 3 * DAY, percent: 20 }, { at: since + 9 * DAY, percent: 33 }], since, now, since - 30 * DAY)
  expect(steps?.points).toEqual([{ at: since, percent: 10 }, { at: since + 3 * DAY, percent: 20 }, { at: since + 9 * DAY, percent: 33 }])
  expect(steps?.last).toEqual({ at: now, percent: 33 })
  expect(steps?.gained).toBe(23)
})

test('a book started inside the window starts at nothing on the day it was picked up', () => {
  const steps = progressSteps([{ at: since + 6 * DAY, percent: 5 }], since, now, since + 5 * DAY)
  expect(steps?.points[0]).toEqual({ at: since + 5 * DAY, percent: 0 })
  expect(steps?.gained).toBe(5)
})

test('a quiet book is a flat line at its place; a book with no history at all draws nothing', () => {
  expect(progressSteps([{ at: since - 3 * DAY, percent: 40 }], since, now, null)).toMatchObject({ gained: 0, last: { percent: 40 } })
  expect(progressSteps([], since, now, null)).toBeNull()
})

test("with no log before the window, the line starts at the first log, not at a made-up nothing", () => {
  const steps = progressSteps([{ at: since + 2 * DAY, percent: 70 }, { at: since + 8 * DAY, percent: 80 }], since, now, since - 60 * DAY)
  expect(steps?.points[0]).toEqual({ at: since + 2 * DAY, percent: 70 })
  expect(steps?.gained).toBe(10)
})
