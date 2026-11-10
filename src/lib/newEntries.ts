/** Ids in `now` that weren't in `seen`: the entries that have landed since the list was first shown. */
export function landedSince<T extends string>(seen: ReadonlySet<T>, now: readonly T[]): Set<T> {
  return new Set(now.filter(id => !seen.has(id)))
}
