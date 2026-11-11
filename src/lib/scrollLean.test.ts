import { describe, expect, it } from 'vitest'
import { LEAN_FROM, LEAN_FULL, leanFor } from './scrollLean'

describe('leanFor', () => {
  it('is still at a reading pace', () => {
    expect(leanFor(0)).toBe(0)
    expect(leanFor(LEAN_FROM)).toBe(0)
    expect(leanFor(-300)).toBe(0)
  })
  it('grows with speed and keeps the direction', () => {
    const slow = leanFor(1500)
    expect(slow).toBeGreaterThan(0)
    expect(leanFor(2500)).toBeGreaterThan(slow)
    expect(leanFor(-2500)).toBe(-leanFor(2500))
  })
  it('stops at full', () => {
    expect(leanFor(LEAN_FULL)).toBe(1)
    expect(leanFor(50000)).toBe(1)
    expect(leanFor(-50000)).toBe(-1)
  })
  it('ignores nonsense', () => {
    expect(leanFor(Number.NaN)).toBe(0)
    expect(leanFor(Infinity)).toBe(0)
  })
})
