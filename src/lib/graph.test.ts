import { expect, test } from 'vitest'
import { localGraph, parseFocus, type Graph } from './graph'

const graph: Graph = {
  nodes: [
    { id: 'topic:f', kind: 'topic', label: 'F', slug: 'f', size: 2 },
    { id: 'topic:g', kind: 'topic', label: 'G', slug: 'g', size: 2 },
    { id: 'book:a', kind: 'book', label: 'A', slug: 'a', size: 1 },
    { id: 'book:b', kind: 'book', label: 'B', slug: 'b', size: 1 },
    { id: 'book:c', kind: 'book', label: 'C', slug: 'c', size: 1 },
  ],
  links: [
    { source: 'topic:f', target: 'book:a' },
    { source: 'topic:f', target: 'book:b' },
    { source: 'topic:g', target: 'book:b' },
    { source: 'topic:g', target: 'book:c' },
  ],
}
const ids = (g: Graph) => g.nodes.map(n => n.id).sort()

test('a step out from a topic is its books; two steps adds their other topics', () => {
  expect(ids(localGraph(graph, 'topic:f', 1))).toEqual(['book:a', 'book:b', 'topic:f'])
  expect(ids(localGraph(graph, 'topic:f', 2))).toEqual(['book:a', 'book:b', 'topic:f', 'topic:g'])
  expect(localGraph(graph, 'topic:f', 2).links).toHaveLength(3)
})

test('an unknown focus is an empty graph, and only well-formed addresses count', () => {
  expect(localGraph(graph, 'topic:zzz', 1)).toEqual({ nodes: [], links: [] })
  expect(parseFocus('topic:feminism')).toBe('topic:feminism')
  expect(parseFocus('feminism')).toBeUndefined()
  expect(parseFocus('topic:')).toBeUndefined()
})
