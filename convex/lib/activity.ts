// The Desk's last two weeks (Steve, 2026-11-04): where each book in hand got to, day by day. Pure.

export const WINDOW_DAYS = 14
const DAY = 86_400_000

export type Logged = { at: number; percent: number }

/**
 * A book's place across the window, as steps: where it stood when the window opened (or when it was started, if later),
 * then each log, carried on to now. Null when there's nothing to draw.
 */
export function progressSteps(logs: Logged[], since: number, now: number, startedAt: number | null) {
  const sorted = [...logs].sort((a, b) => a.at - b.at)
  const before = sorted.filter(l => l.at < since).at(-1)
  const inside = sorted.filter(l => l.at >= since && l.at <= now)
  const startedInside = !!startedAt && startedAt > since
  // Where the book stood as the window opened: the last log before it, or nothing if it was picked up inside it.
  // Otherwise it isn't known, and the line starts at the first log rather than inventing a starting place.
  const opening = before ? { at: since, percent: before.percent } : startedInside ? { at: Math.min(startedAt!, now), percent: 0 } : null
  const points = opening ? [opening, ...inside] : inside
  if (!points.length) return null
  // `opened`: the first point is where the window opened, not a log of its own.
  return { points, opened: !!opening, last: { at: now, percent: points.at(-1)!.percent }, gained: Math.max(0, points.at(-1)!.percent - points[0].percent) }
}

export const windowStart = (now: number) => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime() - (WINDOW_DAYS - 1) * DAY
}

/** How far a read moved in the window, as a share of the book (0 to 1), by the same rules as its line. */
export function movedIn(logs: Logged[], since: number, now: number, startedAt: number | null) {
  const steps = progressSteps(logs, since, now, startedAt)
  return steps ? steps.gained / 100 : 0
}
