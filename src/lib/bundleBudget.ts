// The main chunk's size budget (improvement loop E4). Pure, so the rule is tested; scripts/bundle-budget.mjs
// reads dist/ and feeds it in.

export type Budget = { bytes: number; gzipBytes: number; allowedGrowth: number }
export type Measured = { bytes: number; gzipBytes: number }

export type BudgetResult = { ok: boolean; lines: string[] }

const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`

/** Fails when raw or gzip size is more than `allowedGrowth` (a fraction, 0.05 = 5%) over the recorded budget. */
export function checkBudget(budget: Budget, got: Measured): BudgetResult {
  const lines: string[] = []
  let ok = true
  for (const [label, limit, size] of [
    ['raw', budget.bytes, got.bytes],
    ['gzip', budget.gzipBytes, got.gzipBytes],
  ] as const) {
    const max = Math.floor(limit * (1 + budget.allowedGrowth))
    const over = size > max
    if (over) ok = false
    lines.push(`${over ? 'OVER' : 'ok  '} main chunk ${label}: ${kb(size)} (budget ${kb(limit)}, limit ${kb(max)})`)
  }
  if (!ok) lines.push('Raise the numbers in bundle-budget.json on purpose, in the same commit, if the growth is wanted.')
  return { ok, lines }
}
