/** Which slugs just arrived on a shelf. Only a small addition to a shelf that was already showing counts: the first
 *  render, a sort, a filter or a big sync batch is not "a book was added", and nothing should shuffle then. */
export const MOST_ARRIVALS = 3

export function arrivals(before: readonly string[] | null, after: readonly string[]): string[] {
  if (!before || before.length === 0) return []
  const had = new Set(before)
  const now = new Set(after)
  if (before.some(s => !now.has(s))) return []
  const added = after.filter(s => !had.has(s))
  return added.length > 0 && added.length <= MOST_ARRIVALS ? added : []
}
