import { expect, test } from 'vitest'
import { toMarkdown, type Everything } from './export'

const book = (over: Partial<Everything['books'][number]>) => ({
  readId: 'r1', title: 'Dune', author: 'Frank Herbert', status: 'read', published: 1965, pages: 412, rating: 4.5, recommendedBy: null,
  readings: [{ startedAt: Date.UTC(2024, 0, 1), finishedAt: Date.UTC(2024, 0, 9) }], ...over,
}) as Everything['books'][number]
const entry = (over: Partial<Everything['entries'][number]>) => ({
  id: 'e1', readId: 'r1', kind: 'excerpt', text: 'Fear is the mind-killer.', question: null, parentId: null, position: 'Page 8', createdAt: 1, ...over,
}) as Everything['entries'][number]

test('a book reads as its facts, then what was written, with notes under their excerpts', () => {
  const md = toMarkdown({
    books: [book({})],
    entries: [
      entry({}),
      entry({ id: 'e2' as never, kind: 'note', text: 'Learnt this by heart.', parentId: 'e1' as never, position: '', createdAt: 2 }),
      entry({ id: 'e3' as never, kind: 'reflection', text: 'Power corrupts.', question: 'What was it about?', position: '', createdAt: 3 }),
    ],
  })
  expect(md).toContain('# Dune\n\n- Author: Frank Herbert')
  expect(md).toContain('- Read: 1 Jan 2024 to 9 Jan 2024')
  expect(md).toContain('**Excerpt, Page 8**\n\n> Fear is the mind-killer.\n\nNote: Learnt this by heart.')
  expect(md).toContain('**Reflection**\n\n*What was it about?*\n\nPower corrupts.')
  expect(md.match(/Learnt this by heart/g)).toHaveLength(1)
})

test('books come alphabetically, each its own section, and one with no notes is still there', () => {
  const md = toMarkdown({ books: [book({ title: 'Zed', readId: 'r2' as never, readings: [] }), book({})], entries: [] })
  expect(md.indexOf('# Dune')).toBeLessThan(md.indexOf('# Zed'))
  expect(md).toContain('\n\n---\n\n')
})
