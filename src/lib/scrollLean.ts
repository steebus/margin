/** How far a spine leans, from -1 to 1, for a scroll speed in pixels per second. Slow scrolling is still; a flick is full. */
export const LEAN_FROM = 600
export const LEAN_FULL = 3500

export function leanFor(speed: number): number {
  const s = Math.abs(speed)
  if (!Number.isFinite(s) || s <= LEAN_FROM) return 0
  const amount = Math.min(1, (s - LEAN_FROM) / (LEAN_FULL - LEAN_FROM))
  return Math.sign(speed) * amount
}
