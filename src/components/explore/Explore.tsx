import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import { List, Minus, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGraph } from '../../lib/offline'
import { KINDS, layered, localGraph, parseFocus, parseShow, type Graph, type GraphNode, type Kind } from '../../lib/graph'

type Dot = GraphNode & SimulationNodeDatum & { r: number }
type Line = SimulationLinkDatum<Dot> & { weight: number }
type View = { x: number; y: number; k: number }

/** Topics and genres grow with how many books sit under them; a genre's stamp runs a little bigger than a topic. */
const radius = (n: GraphNode, biggest: Record<Kind, number>) =>
  n.kind === 'topic' ? 7 + 17 * Math.sqrt(n.size / biggest.topic)
  : n.kind === 'genre' ? 10 + 20 * Math.sqrt(n.size / biggest.genre)
  : 4
const KIND_LABEL: Record<Kind, string> = { book: 'Books', genre: 'Genres', topic: 'Topics' }
// Names print in this order, and the first to claim a spot keeps it: genres, then topics, then books.
const RANK: Record<Kind, number> = { genre: 0, topic: 1, book: 2 }
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/**
 * The library as marks: genres as double-ruled paper stamps, topics in solid ink, books in the engraver's grey (open
 * when still to read, ringed in biro while being read, as on the shelves). Any mix of the three can be shown
 * (Steve, 2026-11-06); with books hidden, genres and topics are joined by the books they share. Focused, it's the
 * local view.
 */
export function Explore() {
  const { focus: rawFocus, depth = 1, show: rawShow } = useSearch({ from: '/explore' })
  const focus = parseFocus(rawFocus)
  const show = useMemo(() => parseShow(rawShow), [rawShow])
  const navigate = useNavigate({ from: '/explore' })
  const whole = useGraph()
  const graph: Graph | undefined = useMemo(() => {
    if (!whole) return undefined
    const drawn = layered(whole, show)
    return focus ? localGraph(drawn, focus, depth) : drawn
  }, [whole, show, focus, depth])
  const [picked, setPicked] = useState<GraphNode | null>(null)
  const openRef = useRef<(n: GraphNode) => void>(() => {})
  openRef.current = n => void navigate(
    n.kind === 'topic' ? { to: '/topics/$topicSlug', params: { topicSlug: n.slug } }
    : n.kind === 'genre' ? { to: '/shelves', search: { genre: n.slug } }
    : { to: '/books/$bookSlug', params: { bookSlug: n.slug } },
  )
  const canvas = useRef<HTMLCanvasElement>(null)
  const zoomBy = useRef<(factor: number) => void>(() => {})

  useEffect(() => { setPicked(null) }, [focus, depth])

  useEffect(() => {
    const el = canvas.current
    if (!el || !graph?.nodes.length) return
    const ctx = el.getContext('2d')!
    const most = (kind: Kind) => Math.max(1, ...graph.nodes.filter(n => n.kind === kind).map(n => n.size))
    const biggest = { book: 1, genre: most('genre'), topic: most('topic') }
    const dots: Dot[] = graph.nodes.map(n => ({ ...n, r: radius(n, biggest) }))
    const byId = new Map(dots.map(d => [d.id, d]))
    const lines: Line[] = graph.links.map(l => ({ source: byId.get(l.source)!, target: byId.get(l.target)!, weight: l.weight ?? 1 }))
    const heaviest = Math.max(1, ...lines.map(l => l.weight))
    // Names are offered genres first, then the biggest topics, then books: the order they appear in as you zoom.
    const labelOrder = [...dots].sort((a, b) => (a.kind === b.kind ? b.size - a.size : RANK[a.kind] - RANK[b.kind]))
    const center = focus ? byId.get(focus) : undefined
    if (center) { center.fx = 0; center.fy = 0 }
    const local = !!focus
    const view: View = { x: 0, y: 0, k: local ? 1.4 : 0.6 }
    let selected: Dot | null = null
    let frame = 0

    const size = () => {
      const { width, height } = el.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      el.width = Math.round(width * dpr)
      el.height = Math.round(height * dpr)
      return { width, height, dpr }
    }
    let box = size()

    const draw = () => {
      frame = 0
      const ink = token('--ink')
      const paper = token('--paper')
      const biro = token('--biro')
      const grey = token('--grey')
      const head = token('--head')
      const { width, height, dpr } = box
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.translate(width / 2 + view.x, height / 2 + view.y)
      ctx.scale(view.k, view.k)

      // Through books, each line is one book; between genres and topics, a line is as heavy as the books they share.
      ctx.strokeStyle = ink
      for (const l of lines) {
        const s = l.source as Dot
        const t = l.target as Dot
        const share = l.weight / heaviest
        ctx.globalAlpha = local ? 0.5 : l.weight > 1 ? 0.15 + 0.45 * share : 0.18
        ctx.lineWidth = (l.weight > 1 ? 1 + 4 * share : 1) / view.k
        ctx.beginPath()
        ctx.moveTo(s.x!, s.y!)
        ctx.lineTo(t.x!, t.y!)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // Books, then topics, then genres on top, so the bigger marks are never buried.
      for (const kind of ['book', 'topic', 'genre'] as const) for (const d of dots) {
        if (d.kind !== kind) continue
        ctx.beginPath()
        if (kind === 'genre') {
          // A genre is a catalog stamp: a paper square in a double rule, set a little off true.
          ctx.save()
          ctx.translate(d.x!, d.y!)
          ctx.rotate(-0.06)
          ctx.fillStyle = paper
          ctx.fillRect(-d.r, -d.r, d.r * 2, d.r * 2)
          ctx.strokeStyle = ink
          ctx.lineWidth = 2.5 / view.k
          ctx.strokeRect(-d.r, -d.r, d.r * 2, d.r * 2)
          const inset = Math.min(4, d.r / 3)
          ctx.lineWidth = 1.25 / view.k
          ctx.strokeRect(-d.r + inset, -d.r + inset, (d.r - inset) * 2, (d.r - inset) * 2)
          ctx.restore()
        } else {
          ctx.arc(d.x!, d.y!, d.r, 0, Math.PI * 2)
          ctx.fillStyle = kind === 'topic' ? ink : d.status === 'tbr' ? paper : grey
          ctx.fill()
          ctx.lineWidth = 1.5 / view.k
          ctx.strokeStyle = ink
          ctx.stroke()
        }
        // The shelves' biro circle: being read.
        if (d.status === 'reading') {
          ctx.beginPath()
          ctx.ellipse(d.x!, d.y!, d.r + 4, d.r + 3, -0.3, 0.2, Math.PI * 2.05)
          ctx.lineWidth = 2.25 / view.k
          ctx.strokeStyle = biro
          ctx.stroke()
        }
        // Picked or centred: a paper gap, then a heavier ink ring, as a pressed cell is ringed.
        if (d === selected || d === center) {
          ctx.beginPath()
          ctx.arc(d.x!, d.y!, d.r + 5 / view.k, 0, Math.PI * 2)
          ctx.lineWidth = 3 / view.k
          ctx.strokeStyle = ink
          ctx.stroke()
        }
      }

      // The biggest topics' names first, more as you zoom in; book titles once there's room to read them.
      // Names print at one size on the screen, whatever the zoom: the picked dot, then the biggest topics, then books
      // once zoomed in. A name that would land on one already printed is left off, so zooming in reveals more.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.lineJoin = 'round'
      const book = token('--book')
      const taken: [number, number, number, number][] = []
      const candidates = labelOrder.filter(d => d.kind !== 'book' || local || view.k > 1.6 || d === selected)
      for (const d of [...(selected ? [selected] : []), ...candidates]) {
        const text = d.kind === 'book' ? (d.label.length > 30 ? `${d.label.slice(0, 29)}…` : d.label) : d.label.toUpperCase()
        ctx.font = d.kind === 'genre' ? `19px ${head}` : d.kind === 'topic' ? `17px ${head}` : `13px ${book}`
        const w = ctx.measureText(text).width
        const x = width / 2 + view.x + d.x! * view.k
        const y = height / 2 + view.y + (d.y! + d.r) * view.k + (d.kind === 'genre' ? 7 : 3)
        const h = d.kind === 'genre' ? 19 : d.kind === 'topic' ? 17 : 14
        const pad = d.kind === 'genre' ? 6 : 3
        const rect: [number, number, number, number] = [x - w / 2 - pad, y - 3, x + w / 2 + pad, y + h + 1]
        if (x + w / 2 < 0 || x - w / 2 > width || y > height || y + h < 0) continue
        if (taken.some(r => rect[0] < r[2] && rect[2] > r[0] && rect[1] < r[3] && rect[3] > r[1])) continue
        taken.push(rect)
        if (d.kind === 'genre') {
          // A genre's name prints reversed out of a solid ink band, as the library card's does.
          ctx.fillStyle = ink
          ctx.fillRect(rect[0], rect[1], rect[2] - rect[0], rect[3] - rect[1])
          ctx.fillStyle = paper
          ctx.fillText(text, x, y)
          continue
        }
        ctx.lineWidth = 4
        ctx.strokeStyle = paper
        ctx.strokeText(text, x, y)
        ctx.fillStyle = ink
        ctx.fillText(text, x, y)
      }
    }
    const redraw = () => { if (!frame) frame = requestAnimationFrame(draw) }

    const sim = forceSimulation(dots)
      .force('link', forceLink(lines).distance(local ? 80 : 46).strength(0.4))
      .force('charge', forceManyBody<Dot>().strength(d => (d.kind === 'genre' ? -700 : d.kind === 'topic' ? -320 : -40)).theta(0.9).distanceMax(900))
      .force('collide', forceCollide<Dot>(d => d.r + 3))
      .force('center', forceCenter(0, 0).strength(0.04))
      .on('tick', redraw)
    // Opens framed on the library's mass: the middle 96% of dots fill the stage, so a stray few far out don't
    // shrink it to a speck. The strays stay a drag away.
    const fit = () => {
      const within = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b)
        const cut = local ? 0 : Math.floor(sorted.length * 0.02)
        return [sorted[cut], sorted[sorted.length - 1 - cut]]
      }
      const [x0, x1] = within(dots.map(d => d.x!))
      const [y0, y1] = within(dots.map(d => d.y!))
      view.k = Math.min(local ? 2 : 1.2, Math.max(0.15, Math.min(box.width / (x1 - x0 + 80), box.height / (y1 - y0 + 80))))
      view.x = -((x0 + x1) / 2) * view.k
      view.y = -((y0 + y1) / 2) * view.k
    }
    // A big library settles a little before it's shown, so the first frame isn't a burst of dots from one point.
    // With reduced motion it settles completely first, and is drawn once, still.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { sim.stop(); sim.tick(300) }
    else sim.tick(local ? 80 : 160).alpha(0.25)
    fit()
    redraw()

    const toWorld = (cx: number, cy: number) => {
      const rect = el.getBoundingClientRect()
      return { x: (cx - rect.left - rect.width / 2 - view.x) / view.k, y: (cy - rect.top - rect.height / 2 - view.y) / view.k }
    }
    const hit = (cx: number, cy: number) => {
      const p = toWorld(cx, cy)
      let best: Dot | null = null
      let bestDist = Infinity
      for (const d of dots) {
        const dist = Math.hypot(d.x! - p.x, d.y! - p.y)
        // A finger is wider than a book's dot.
        if (dist < Math.max(d.r, 18 / view.k) && dist < bestDist) { best = d; bestDist = dist }
      }
      return best
    }
    const zoomAt = (factor: number, cx: number, cy: number) => {
      const rect = el.getBoundingClientRect()
      const k = Math.min(6, Math.max(0.15, view.k * factor))
      const ox = cx - rect.left - rect.width / 2
      const oy = cy - rect.top - rect.height / 2
      view.x = ox - ((ox - view.x) * k) / view.k
      view.y = oy - ((oy - view.y) * k) / view.k
      view.k = k
      redraw()
    }
    zoomBy.current = factor => {
      const rect = el.getBoundingClientRect()
      zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2)
    }

    const pointers = new Map<number, { x: number; y: number }>()
    let moved = 0
    let lastTap: { id: string; at: number } | null = null
    let pinch = 0
    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      moved = 0
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const move = (e: PointerEvent) => {
      const last = pointers.get(e.pointerId)
      if (!last) return
      const now = { x: e.clientX, y: e.clientY }
      pointers.set(e.pointerId, now)
      if (pointers.size === 1) {
        view.x += now.x - last.x
        view.y += now.y - last.y
        moved += Math.abs(now.x - last.x) + Math.abs(now.y - last.y)
        redraw()
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const gap = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch) zoomAt(gap / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2)
        pinch = gap
        moved = Infinity
      }
    }
    const up = (e: PointerEvent) => {
      if (pointers.size === 1 && moved < 8) {
        selected = hit(e.clientX, e.clientY)
        // Twice in quick succession on the same dot opens it.
        const now = performance.now()
        if (selected && lastTap?.id === selected.id && now - lastTap.at < 450) {
          openRef.current(selected)
          lastTap = null
        } else lastTap = selected ? { id: selected.id, at: now } : null
        setPicked(selected ? { id: selected.id, kind: selected.kind, label: selected.label, slug: selected.slug, size: selected.size } : null)
        redraw()
      }
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = 0
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY)
    }
    const resize = new ResizeObserver(() => { box = size(); redraw() })
    // Theme changes (system or chosen) repaint in the new ink.
    const theme = new MutationObserver(redraw)
    const scheme = matchMedia('(prefers-color-scheme: dark)')

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    resize.observe(el)
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    scheme.addEventListener('change', redraw)
    return () => {
      sim.stop()
      cancelAnimationFrame(frame)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      resize.disconnect()
      theme.disconnect()
      scheme.removeEventListener('change', redraw)
    }
  }, [graph, focus])

  const focused = focus && whole?.nodes.find(n => n.id === focus)
  const go = (next: { focus?: string; depth?: number }) => navigate({ search: prev => ({ show: prev.show, ...next }) })
  // Any mix of the three; the last one on stays on, so there's always something to draw.
  const toggle = (kind: Kind) => {
    const next = new Set(show)
    if (next.has(kind)) { if (next.size > 1) next.delete(kind) } else next.add(kind)
    void navigate({ search: prev => ({ ...prev, show: next.size === KINDS.length ? undefined : KINDS.filter(k => next.has(k)).join(',') }), replace: true })
  }

  return (
    <div className="explore stack">
      <div className="explore-head">
        <h1 className="title-head">{focused ? focused.label : 'Explore'}</h1>
        <p className="where">
          {focused
            ? <Link to="/explore" search={{ show: rawShow }}>Whole library</Link>
            : 'Genres, topics and the books under them.'}
        </p>
      </div>
      {focused && (
        <div className="segments explore-depth" role="group" aria-label="How far out">
          {[1, 2].map(d => <button key={d} type="button" aria-pressed={depth === d} onClick={() => go({ focus, depth: d })}>{d === 1 ? 'One step' : 'Two steps'}</button>)}
        </div>
      )}

      <div className="explore-tools">
        <div className="segments explore-show" role="group" aria-label="Show">
          {KINDS.map(k => <button key={k} type="button" aria-pressed={show.has(k)} onClick={() => toggle(k)}>{KIND_LABEL[k]}</button>)}
        </div>
        <Link to="/topics" className="btn"><List aria-hidden="true" strokeWidth={2.25} />All topics</Link>
      </div>

      <div className="explore-body">
      <div className="explore-stage">
        {whole === undefined && <p role="status" className="explore-note">Laying out the library…</p>}
        {whole && !graph?.nodes.length && (
          <p className="explore-note">{focus ? "That isn't in the picture. It may be hidden, or have only one book." : 'Nothing to draw yet. Topics appear once two books share one.'}</p>
        )}
        <canvas ref={canvas} className="explore-canvas" role="img" aria-label={focused ? `${focused.label} and what's around it` : 'Your library as a graph of genres, topics and books'} />
        <div className="explore-zoom">
          <button type="button" className="theme-toggle" aria-label="Zoom in" onClick={() => zoomBy.current(1.4)}><Plus aria-hidden="true" strokeWidth={2.25} /></button>
          <button type="button" className="theme-toggle" aria-label="Zoom out" onClick={() => zoomBy.current(1 / 1.4)}><Minus aria-hidden="true" strokeWidth={2.25} /></button>
        </div>
      </div>

      {picked && (
        <div className="box explore-picked" role="status">
          <button type="button" className="explore-close" aria-label="Close" onClick={() => setPicked(null)}><X aria-hidden="true" strokeWidth={2.25} /></button>
          <p className="tl-did">{picked.kind === 'book' ? 'Book' : `${picked.kind === 'topic' ? 'Topic' : 'Genre'} · ${picked.size} ${picked.size === 1 ? 'book' : 'books'}`}</p>
          <p className="selected-title">{picked.label}</p>
          <div className="btn-row">
            {picked.kind === 'topic'
              ? <Link to="/topics/$topicSlug" params={{ topicSlug: picked.slug }} className="btn btn-solid">Open the timeline</Link>
              : picked.kind === 'genre'
                ? <Link to="/shelves" search={{ genre: picked.slug }} className="btn btn-solid">Open the shelf</Link>
                : <Link to="/books/$bookSlug" params={{ bookSlug: picked.slug }} className="btn btn-solid">Open the book</Link>}
            {picked.id !== focus && <button type="button" className="btn" onClick={() => go({ focus: picked.id, depth })}>Centre on it</button>}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
