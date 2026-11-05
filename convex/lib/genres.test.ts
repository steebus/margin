import { describe, expect, it } from 'vitest'
import { genresOf, isGenreName } from './genres'
import { buildTopics } from './topics'

describe('genres', () => {
  it('maps Hardcover spellings onto our list, most used first, at most three', () => {
    expect(genresOf([
      { name: 'Sci-Fi', kind: 'genre' }, { name: 'Space Opera', kind: 'genre' }, { name: 'Adventure', kind: 'genre' },
      { name: 'War', kind: 'genre' }, { name: 'Thriller', kind: 'genre' }, { name: 'Horror', kind: 'genre' },
    ])).toEqual(['Science fiction', 'Adventure', 'Thriller'])
  })
  it('counts a reader tag only once two readers used it', () => {
    expect(genresOf([{ name: 'Fantasy', kind: 'tag', count: 1 }, { name: 'Horror', kind: 'tag', count: 2 }])).toEqual(['Horror'])
  })
  it('uses a joined shelf only when nothing names a genre alone', () => {
    expect(genresOf([{ name: 'Science Fiction & Fantasy', kind: 'genre' }, { name: 'Fantasy', kind: 'genre' }])).toEqual(['Fantasy'])
    expect(genresOf([{ name: 'Science Fiction & Fantasy', kind: 'genre' }])).toEqual(['Science fiction', 'Fantasy'])
  })
  it('falls back to stored genre names', () => {
    expect(genresOf(undefined, ['Memoir'])).toEqual(['Biography & memoir'])
  })
  it('reads bookshop paths by their most specific genre, and never makes them topics', () => {
    expect(genresOf([{ name: 'Fiction / Fantasy / Epic', kind: 'genre' }])).toEqual(['Fantasy'])
    expect(genresOf([{ name: 'Crime / Thriller', kind: 'genre' }])).toEqual(['Thriller'])
    expect(isGenreName('Fiction / General')).toBe(true)
    expect(isGenreName('Literature & Fiction')).toBe(true)
    expect(genresOf([{ name: 'Literature & Fiction', kind: 'genre' }])).toEqual([])
  })
  it('keeps genres out of topics', () => {
    expect(isGenreName('science-fiction')).toBe(true)
    const topics = buildTopics({
      works: [{ readId: 'r', slug: 's', title: 't', authors: [], status: 'read', tags: [{ name: 'Fantasy', kind: 'genre' }, { name: 'Grief', kind: 'genre' }] }],
      entries: [],
      hidden: new Set(),
    })
    expect(topics.map(t => t.name)).toEqual(['Grief'])
  })
})
