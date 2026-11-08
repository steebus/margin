import { expect, test } from 'vitest'
import { withLogged } from './quiet'

const DAY = 86_400_000
const now = 20 * DAY
const since = now - 13 * DAY
const book = { readId: 'r1', percent: 40, startedAt: since - DAY, format: 'print', pages: 200, audioSeconds: null }
const quiet = { logs: [{ readId: 'r1', logs: [{ at: since - 2 * DAY, percent: 10 }] }], pages: 0, audioSeconds: 0, finished: 0 }

test('a log adds a step to the line and its pages to the total', () => {
  const next = withLogged(quiet, book, 40, since, now)
  expect(next.logs[0].logs.at(-1)).toEqual({ at: now, percent: 40 })
  expect(next.pages).toBe(60) // 30% of 200 pages
  expect(next.finished).toBe(0)
})

test('a book with no log yet gets its own line', () => {
  const next = withLogged({ ...quiet, logs: [] }, { ...book, startedAt: since + DAY }, 25, since, now)
  expect(next.logs).toEqual([{ readId: 'r1', logs: [{ at: now, percent: 25 }] }])
  expect(next.pages).toBe(50)
})

test('audio moves the listening, not the pages', () => {
  const audio = { ...book, format: 'audio', pages: null, audioSeconds: 36_000 }
  const next = withLogged(quiet, audio, 40, since, now)
  expect(next.pages).toBe(0)
  expect(next.audioSeconds).toBe(10_800)
})
