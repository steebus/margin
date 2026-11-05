import { expect, test } from 'vitest'
import { layered, localGraph, parseFocus, parseShow, type Graph } from './graph'

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

test('show reads the kinds from the address, everything when none', () => {
  expect([...parseShow('genre,topic')].sort()).toEqual(['genre', 'topic'])
  expect(parseShow(undefined).size).toBe(3)
  expect(parseShow('nonsense').size).toBe(3)
  expect(parseFocus('genre:fantasy')).toBe('genre:fantasy')
})

test('with books hidden, what shares books is joined, as heavy as how many', () => {
  const g: Graph = {
    nodes: [...graph.nodes, { id: 'genre:x', kind: 'genre', label: 'X', slug: 'X', size: 2 }],
    links: [...graph.links, { source: 'genre:x', target: 'book:a' }, { source: 'genre:x', target: 'book:b' }],
  }
  expect(layered(g, parseShow('book,topic')).links).toHaveLength(4)
  const joined = layered(g, parseShow('genre,topic'))
  // F and X share A and B; G and X share only B, too few to draw, so G is left out.
  expect(ids(joined)).toEqual(['genre:x', 'topic:f'])
  expect(joined.links).toEqual([{ source: 'genre:x', target: 'topic:f', weight: 2 }])
})
