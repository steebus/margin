import { describe, expect, it } from 'vitest'
import { landedSince } from './newEntries'

describe('landedSince', () => {
  it('is empty when nothing is new', () => {
    expect(landedSince(new Set(['a', 'b']), ['a', 'b']).size).toBe(0)
  })
  it('finds only the ids that were not there at first', () => {
    expect([...landedSince(new Set(['a']), ['c', 'a', 'd'])]).toEqual(['c', 'd'])
  })
  it('ignores ids that went away', () => {
    expect(landedSince(new Set(['a', 'b']), ['b']).size).toBe(0)
  })
})
