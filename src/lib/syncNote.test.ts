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

test('the Desk is quiet when all is sent, or the wait is ordinary', async () => {
  const { deskSyncMark } = await import('./syncNote')
  expect(deskSyncMark(null, now)).toBeNull()
  expect(deskSyncMark({ lastError: null, pending: 0, oldestAt: null }, now)).toBeNull()
  expect(deskSyncMark({ lastError: null, pending: 2, oldestAt: now - 20 * 60_000 }, now)).toBeNull()
})

test('the Desk says so when a sync failed or something has waited an hour', async () => {
  const { deskSyncMark, DESK_SYNC_QUIET_MS } = await import('./syncNote')
  expect(deskSyncMark({ lastError: 'Hardcover answered 502.', pending: 0, oldestAt: null }, now)).toBe("Hardcover isn't answering. Margin will keep trying.")
  expect(deskSyncMark({ lastError: null, pending: 1, oldestAt: now - DESK_SYNC_QUIET_MS }, now)).toBe('1 change still waiting for Hardcover.')
  expect(deskSyncMark({ lastError: null, pending: 3, oldestAt: now - DESK_SYNC_QUIET_MS }, now)).toBe('3 changes still waiting for Hardcover.')
})
