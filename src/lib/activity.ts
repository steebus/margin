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
  const from = startedAt && startedAt > since ? Math.min(startedAt, now) : since
  const opening = before?.percent ?? (startedAt && startedAt > since ? 0 : inside.length ? 0 : null)
  if (opening === null && !inside.length) return null
  const points = [{ at: from, percent: opening ?? inside[0].percent }, ...inside]
  return { points, last: { at: now, percent: points.at(-1)!.percent }, gained: Math.max(0, points.at(-1)!.percent - points[0].percent) }
}

export const windowStart = (now: number) => {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime() - (WINDOW_DAYS - 1) * DAY
}
