// What a book's page says about changes that haven't reached Hardcover (SPEC §3.4.1). Quiet when the wait is the
// ordinary few minutes of the outbox; it speaks once a try has failed or the change has waited a while.

export const SYNC_QUIET_MS = 10 * 60_000

export type BookSync = { since: number; lastError: string | null }

export function syncNote(sync: BookSync | null | undefined, now: number): { text: string; failed: boolean } | null {
  if (!sync) return null
  if (sync.lastError) return { text: `Couldn't send to Hardcover: ${sync.lastError.replace(/\.$/, '')}. Margin will try again.`, failed: true }
  if (now - sync.since < SYNC_QUIET_MS) return null
  return { text: 'Not on Hardcover yet. Margin is still sending it.', failed: false }
}

export const DESK_SYNC_QUIET_MS = 60 * 60_000

export type SyncStatus = { lastError: string | null; pending: number; oldestAt: number | null }

/** The Desk's quiet mark (SPEC §3.4.1): only when the last sync failed or something has waited over an hour. */
export function deskSyncMark(status: SyncStatus | null | undefined, now: number): string | null {
  if (!status) return null
  if (status.lastError) return "Hardcover isn't answering. Margin will keep trying."
  if (status.pending > 0 && status.oldestAt !== null && now - status.oldestAt >= DESK_SYNC_QUIET_MS) {
    return `${status.pending} ${status.pending === 1 ? 'change' : 'changes'} still waiting for Hardcover.`
  }
  return null
}
