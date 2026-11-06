type Reading = { startedAt?: number; finishedAt?: number }

/**
 * The notes written during one time through the book: from its start (or the end of the read before) to its finish
 * (or the start of the next). A note from between two reads belongs to the earlier one, which it was written after.
 */
export function duringRead<T extends { createdAt: number }>(entries: T[], readings: Reading[], i: number): T[] {
  const from = readings[i]?.startedAt ?? readings[i - 1]?.finishedAt ?? -Infinity
  const to = readings[i + 1]?.startedAt ?? Infinity
  return entries.filter(e => e.createdAt >= from && e.createdAt < to)
}
