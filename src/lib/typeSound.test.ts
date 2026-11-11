import { describe, expect, it } from 'vitest'
import { strikeFor } from './typeSound'

describe('strikeFor', () => {
  it('rings the bell at the end of a line, whatever the letter', () => {
    expect(strikeFor('a', 4, true).kind).toBe('bell')
    expect(strikeFor(' ', 4, true).kind).toBe('bell')
  })
  it('thuds on a space, lower than any key', () => {
    const space = strikeFor(' ', 1, false)
    expect(space.kind).toBe('space')
    for (let i = 0; i < 50; i++) expect(strikeFor('e', i, false).pitch).toBeGreaterThan(space.pitch)
  })
  it('clicks on letters, a little different each time but the same for the same place', () => {
    const pitches = new Set(Array.from({ length: 20 }, (_, i) => strikeFor('e', i, false).pitch))
    expect(pitches.size).toBeGreaterThan(10)
    expect(strikeFor('e', 7, false)).toEqual(strikeFor('e', 7, false))
  })
  it('is quiet enough not to startle', () => {
    for (let i = 0; i < 50; i++) expect(strikeFor('t', i, false).gain).toBeLessThan(0.2)
  })
})
