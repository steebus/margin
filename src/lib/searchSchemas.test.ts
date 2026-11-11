import { describe, expect, it } from 'vitest'
import { captureSearch, exploreSearch, notesSearch, shareSearch } from './searchSchemas'
import { shelfSearch } from './shelf'

// Search params come from bookmarks and share sheets, so every one must survive nonsense. These pin the behaviour
// the schemas had under full zod, so changing the library can't change what an old link opens.
const parse = (schema: { parse(v: unknown): unknown }, v: unknown) => JSON.parse(JSON.stringify(schema.parse(v)))

describe('search schemas', () => {
  it('keeps good values and drops absent ones', () => {
    expect(parse(notesSearch, { q: 'fox', sort: 'title', dir: 'desc', from: 2020 })).toEqual({ q: 'fox', sort: 'title', dir: 'desc', from: 2020 })
    expect(parse(notesSearch, {})).toEqual({})
  })
  it('turns wrong values into nothing instead of throwing', () => {
    expect(parse(notesSearch, { sort: 'sideways', dir: 3, q: { a: 1 }, from: 'abc', to: 1.5 })).toEqual({})
    expect(parse(captureSearch, { kind: 'poem', page: -4, popup: 'x' })).toEqual({})
    expect(parse(exploreSearch, { depth: 3 })).toEqual({})
    expect(parse(exploreSearch, { depth: 0 })).toEqual({})
  })
  it('reads numbers from text, as the address bar gives them', () => {
    expect(parse(captureSearch, { page: '12', popup: '1' })).toEqual({ page: 12, popup: 1 })
    expect(parse(exploreSearch, { depth: '2' })).toEqual({ depth: 2 })
    expect(parse(shareSearch, { url: 'https://x.test', popup: 1 })).toEqual({ url: 'https://x.test', popup: 1 })
  })
  it('coerces a flag the way JavaScript does', () => {
    expect(parse(notesSearch, { drawer: true })).toEqual({ drawer: true })
    expect(parse(notesSearch, { drawer: 'false' })).toEqual({ drawer: true })
    expect(parse(notesSearch, { drawer: '' })).toEqual({ drawer: false })
  })
  it('keeps the shelf view, sort and group only when they exist', () => {
    expect(parse(shelfSearch, { view: 'table', sort: 'title', group: 'none', dir: 'asc' })).toEqual({ view: 'table', sort: 'title', group: 'none', dir: 'asc' })
    expect(parse(shelfSearch, { view: 'wall', sort: 'nope', group: 'x' })).toEqual({})
  })
})
