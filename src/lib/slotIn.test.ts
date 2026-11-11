import { describe, expect, it } from 'vitest'
import { arrivals } from './slotIn'

describe('arrivals', () => {
  it('names a book added to a shelf already showing', () => expect(arrivals(['a', 'b'], ['a', 'x', 'b'])).toEqual(['x']))
  it('ignores the first render', () => {
    expect(arrivals(null, ['a'])).toEqual([])
    expect(arrivals([], ['a'])).toEqual([])
  })
  it('ignores a reorder', () => expect(arrivals(['a', 'b'], ['b', 'a'])).toEqual([]))
  it('ignores a filter, which removes books', () => expect(arrivals(['a', 'b', 'c'], ['a', 'z'])).toEqual([]))
  it('ignores a big batch', () => expect(arrivals(['a'], ['a', '1', '2', '3', '4'])).toEqual([]))
})
