// The explore graph's shape, and the local view around one dot (Obsidian's local graph). Pure, so it's tested.

export type GraphNode = { id: string; kind: 'topic' | 'book'; label: string; slug: string; size: number; status?: string }
export type GraphLink = { source: string; target: string }
export type Graph = { nodes: GraphNode[]; links: GraphLink[] }

/** The dots within `depth` steps of `focus`, and the lines between them. Empty when `focus` isn't in the graph. */
export function localGraph(graph: Graph, focus: string, depth: number): Graph {
  if (!graph.nodes.some(n => n.id === focus)) return { nodes: [], links: [] }
  const next = new Map<string, string[]>()
  for (const { source, target } of graph.links) {
    next.set(source, [...(next.get(source) ?? []), target])
    next.set(target, [...(next.get(target) ?? []), source])
  }
  const kept = new Set([focus])
  let ring = [focus]
  for (let step = 0; step < depth; step++) {
    ring = ring.flatMap(id => next.get(id) ?? []).filter(id => !kept.has(id))
    ring.forEach(id => kept.add(id))
  }
  return {
    nodes: graph.nodes.filter(n => kept.has(n.id)),
    links: graph.links.filter(l => kept.has(l.source) && kept.has(l.target)),
  }
}

/** `topic:feminism` or `book:dune-herbert-1a`, as Explore's address carries it. */
export const parseFocus = (focus?: string) => (focus && /^(topic|book):./.test(focus) ? focus : undefined)
