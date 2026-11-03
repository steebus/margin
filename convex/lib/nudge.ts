// Push only for absence or delay (SPEC 3.3): a book gone quiet, or a buddy note left waiting. One a day at most.
// Pure, so the rule can be tested with a simulated gap.

const DAY = 24 * 60 * 60_000
export const QUIET_DAYS = 7
export const UNANSWERED_DAYS = 3

export type Nudge = { title: string; body: string; url: string }
type Reading = { title: string; slug: string; lastProgressAt: number }
type Waiting = { title: string; slug: string; createdAt: number }

export function dueNudge({ reading, waiting, lastPushAt, now }: { reading: Reading[]; waiting: Waiting[]; lastPushAt: number | null; now: number }): Nudge | null {
  if (lastPushAt !== null && now - lastPushAt < DAY - 60 * 60_000) return null // an hour's grace, so a daily cron isn't skipped by drift
  const note = waiting.filter(w => now - w.createdAt >= UNANSWERED_DAYS * DAY).sort((a, b) => a.createdAt - b.createdAt)[0]
  if (note) return { title: 'Your buddy left you a note', body: `It's waiting in ${note.title}.`, url: `/books/${note.slug}` }
  const quiet = reading.filter(r => now - r.lastProgressAt >= QUIET_DAYS * DAY).sort((a, b) => a.lastProgressAt - b.lastProgressAt)[0]
  if (quiet) {
    const days = Math.floor((now - quiet.lastProgressAt) / DAY)
    return { title: `${quiet.title} has been quiet`, body: `Nothing logged for ${days} days. Still reading it?`, url: `/books/${quiet.slug}` }
  }
  return null
}
