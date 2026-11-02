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
