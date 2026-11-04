import { describe, expect, test } from 'vitest'
import { bookTags, buildTopics, isReserved, mentions, topicKey, topicTags, type EntryIn, type WorkIn } from './topics'

const work = (over: Partial<WorkIn> & Pick<WorkIn, 'readId'>): WorkIn =>
  ({ slug: over.readId, title: over.readId, authors: [], status: 'read', tags: [], ...over })
const entry = (over: Partial<EntryIn> & Pick<EntryIn, 'id' | 'readId'>): EntryIn =>
  ({ kind: 'note', text: '', tags: [], createdAt: 1, ...over })

describe('topicKey', () => {
  test('ignores case, spacing and punctuation', () => {
    expect(topicKey('Feminism.')).toBe(topicKey(' feminism'))
    expect(topicKey('Science  Fiction')).toBe('science fiction')
  })
})

test('reserved labels in any case', () => {
  expect(isReserved('theme')).toBe(true)
  expect(isReserved('Chapter Summary')).toBe(true)
  expect(isReserved('why choose')).toBe(true)
  expect(isReserved('Feminism')).toBe(false)
})

describe('bookTags and topicTags', () => {
  test('keeps genres, keeps tags used twice or already known, caps tags at 8, ignores moods', () => {
    const tag = (name: string, count: number) => ({ tag: name, count })
    const cached = {
      Genre: [tag('Fiction', 1), tag('Dystopian', 1)],
      Tag: [tag('Feminism', 3), tag('Plot driven', 1), tag('Grief', 1), ...Array.from({ length: 10 }, (_, i) => tag(`T${i}`, 5))],
      Mood: [tag('dark', 9)],
    }
    const got = topicTags(bookTags(cached), new Set([topicKey('grief')]))
    expect(got.filter(t => t.kind === 'genre').map(t => t.name)).toEqual(['Fiction', 'Dystopian'])
    const tags = got.filter(t => t.kind === 'tag').map(t => t.name)
    expect(tags).toContain('Feminism')
    expect(tags).toContain('Grief')
    expect(tags).not.toContain('Plot driven')
    expect(tags).toHaveLength(8)
    expect(got.map(t => t.name)).not.toContain('dark')
  })
  test('copes with nothing', () => {
    expect(bookTags(null)).toEqual([])
  })
})

describe('mentions', () => {
  test('whole words, any case, a plain plural', () => {
    expect(mentions('So much FEMINISM here', 'feminism')).toBe(true)
    expect(mentions('on feminisms, plural', 'Feminism')).toBe(true)
    expect(mentions('a feministic take', 'feminism')).toBe(false)
    expect(mentions('the science fiction of it', 'Science Fiction')).toBe(true)
  })
  test('names with regex characters match literally', () => {
    expect(mentions('I like C++ a lot', 'C++')).toBe(true)
    expect(mentions('I like C a lot', 'C++')).toBe(false)
    expect(mentions('Sci-Fi (Hard) again', 'Sci-Fi (Hard)')).toBe(true)
  })
})

describe('buildTopics', () => {
  test('merges spellings, adds note-tagged and mentioning books with reasons, skips reserved and hidden', () => {
    const topics = buildTopics({
      works: [
        work({ readId: 'b', tags: [{ name: 'feminism', kind: 'genre' }] }),
        work({ readId: 'a', tags: [{ name: 'Feminism', kind: 'tag', count: 3 }, { name: 'Fiction', kind: 'genre' }] }),
        work({ readId: 'c' }),
        work({ readId: 'd' }),
      ],
      entries: [
        entry({ id: 'n1', readId: 'c', tags: ['Feminism', 'Theme'], page: 212 }),
        entry({ id: 'n2', readId: 'd', text: 'Not much feminism in this one' }),
      ],
      hidden: new Set([topicKey('Fiction')]),
    })
    expect(topics.map(t => t.name)).toEqual(['Feminism'])
    const [f] = topics
    expect(f.slug).toBe('feminism')
    expect(f.books.map(b => b.readId).sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(f.books.find(b => b.readId === 'c')!.reasons).toEqual([{ kind: 'note', page: 212 }])
    expect(f.books.find(b => b.readId === 'd')!.reasons).toEqual([{ kind: 'mentions' }])
    expect(f.entries).toEqual([{ id: 'n1', how: 'tagged' }, { id: 'n2', how: 'mentions' }])
  })
  test('a hidden topic stays hidden even when a note is tagged with it', () => {
    const topics = buildTopics({
      works: [work({ readId: 'a' })],
      entries: [entry({ id: 'n1', readId: 'a', tags: ['Grief'] })],
      hidden: new Set([topicKey('grief')]),
    })
    expect(topics).toEqual([])
  })
})
