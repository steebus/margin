import { describe, expect, it } from 'vitest'
import { checkBudget } from './bundleBudget'

const budget = { bytes: 1000, gzipBytes: 400, allowedGrowth: 0.05 }

describe('checkBudget', () => {
  it('passes at the budget and up to 5% over', () => {
    expect(checkBudget(budget, { bytes: 1000, gzipBytes: 400 }).ok).toBe(true)
    expect(checkBudget(budget, { bytes: 1050, gzipBytes: 420 }).ok).toBe(true)
  })
  it('fails when raw size grows past the limit', () => {
    const r = checkBudget(budget, { bytes: 1051, gzipBytes: 400 })
    expect(r.ok).toBe(false)
    expect(r.lines.join('\n')).toMatch(/OVER main chunk raw/)
    expect(r.lines.join('\n')).toMatch(/bundle-budget\.json/)
  })
  it('fails when only gzip size grows past the limit', () => {
    expect(checkBudget(budget, { bytes: 900, gzipBytes: 421 }).ok).toBe(false)
  })
  it('passes when the bundle shrinks', () => {
    expect(checkBudget(budget, { bytes: 500, gzipBytes: 100 }).ok).toBe(true)
  })
})
