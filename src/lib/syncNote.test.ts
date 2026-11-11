import { expect, test } from 'vitest'
import { SYNC_QUIET_MS, syncNote } from './syncNote'

const now = 1_000_000_000

test('nothing waiting says nothing', () => {
  expect(syncNote(null, now)).toBeNull()
  expect(syncNote(undefined, now)).toBeNull()
})

test('a fresh change is left alone', () => {
  expect(syncNote({ since: now - 60_000, lastError: null }, now)).toBeNull()
})

test('a change that has waited a while says so', () => {
  expect(syncNote({ since: now - SYNC_QUIET_MS, lastError: null }, now)).toEqual({ text: 'Not on Hardcover yet. Margin is still sending it.', failed: false })
})

test('a failed try gives the reason at once', () => {
  expect(syncNote({ since: now - 1000, lastError: 'Hardcover answered 502.' }, now)).toEqual({
    text: "Couldn't send to Hardcover: Hardcover answered 502. Margin will try again.",
    failed: true,
  })
})
