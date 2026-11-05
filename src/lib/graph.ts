// The explore graph's shape, and the local view around one dot (Obsidian's local graph). Pure, so it's tested.

export type Kind = 'book' | 'genre' | 'topic'
export type GraphNode = { id: string; kind: Kind; label: string; slug: string; size: number; status?: string }
export type GraphLink = { source: string; target: string; weight?: number }
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

/** `topic:feminism`, `genre:fantasy` or `book:dune-herbert-1a`, as Explore's address carries it. */
export const parseFocus = (focus?: string) => (focus && /^(topic|genre|book):./.test(focus) ? focus : undefined)

export const KINDS: Kind[] = ['book', 'genre', 'topic']

/** Which kinds Explore draws, from the address's `show` ("genre,topic"). Everything when it's missing or empty. */
export const parseShow = (show?: string): Set<Kind> => {
  const kinds = (show ?? '').split(',').filter((k): k is Kind => (KINDS as string[]).includes(k))
  return new Set(kinds.length ? kinds : KINDS)
}

const MOST_LINKS = 6

/**
 * The graph with only some kinds drawn (Steve, 2026-11-06). With books shown, every line runs through a book. With
 * them hidden, a genre and a topic (or two topics) are joined by the books they share, the line as heavy as how
 * many, and only each dot's six strongest, so the picture stays readable. Dots joined to nothing are left out.
 */
export function layered(graph: Graph, show: Set<Kind>): Graph {
  const nodes = graph.nodes.filter(n => show.has(n.kind))
  const kept = new Set(nodes.map(n => n.id))
  if (show.has('book')) return { nodes, links: graph.links.filter(l => kept.has(l.source) && kept.has(l.target)) }
  const byBook = new Map<string, string[]>()
  for (const { source, target } of graph.links) {
    const [book, other] = source.startsWith('book:') ? [source, target] : [target, source]
    if (kept.has(other)) byBook.set(book, [...(byBook.get(book) ?? []), other])
  }
  const shared = new Map<string, number>()
  for (const around of byBook.values()) {
    for (let i = 0; i < around.length; i++) for (let j = i + 1; j < around.length; j++) {
      const key = [around[i], around[j]].sort().join('|')
      shared.set(key, (shared.get(key) ?? 0) + 1)
    }
  }
  const strongest = [...shared].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])
  const count = new Map<string, number>()
  const links: GraphLink[] = []
  for (const [key, weight] of strongest) {
    const [source, target] = key.split('|')
    if ((count.get(source) ?? 0) >= MOST_LINKS && (count.get(target) ?? 0) >= MOST_LINKS) continue
    count.set(source, (count.get(source) ?? 0) + 1)
    count.set(target, (count.get(target) ?? 0) + 1)
    links.push({ source, target, weight })
  }
  // Without books, a dot joined to nothing would only float off the edge of the picture.
  const joined = new Set(links.flatMap(l => [l.source, l.target]))
  return { nodes: nodes.filter(n => joined.has(n.id)), links }
}
