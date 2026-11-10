const WEEK = 7 * 24 * 60 * 60 * 1000

/** The drawer's toast shows about once a week. A missing or unreadable date counts as due. */
export function toastDue(lastShown: string | null, now: number): boolean {
  const last = Number(lastShown)
  return !lastShown || !Number.isFinite(last) || now - last >= WEEK
}

/** A random index other than the current one, so Shuffle always changes the card. */
export function nextCard(current: number, count: number, random = Math.random()): number {
  if (count < 2) return 0
  return (current + 1 + Math.floor(random * (count - 1))) % count
}

const NUMBER_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']

/**
 * A note written on today's date in an earlier year, if there is one. `pick` (0 to 1) chooses among several, so the
 * choice can be made once and held. Dates are the reader's own calendar days.
 */
export function onThisDay<E extends { createdAt: number }>(entries: E[], now: number, pick = 0): { entry: E; years: number } | undefined {
  const today = new Date(now)
  const matches = entries.flatMap(entry => {
    const written = new Date(entry.createdAt)
    const years = today.getFullYear() - written.getFullYear()
    return years > 0 && written.getMonth() === today.getMonth() && written.getDate() === today.getDate() ? [{ entry, years }] : []
  })
  return matches.length ? matches[Math.min(matches.length - 1, Math.floor(pick * matches.length))] : undefined
}

/** "Three years ago today", the toast's heading when its note was written on this date. */
export function yearsAgoToday(years: number): string {
  if (years === 1) return 'A year ago today'
  return `${NUMBER_WORDS[years] || years} years ago today`
}
