import { useEffect, useRef, useState } from 'react'
import type { Logged } from '../../lib/activity'

const fmt = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** The width the chart actually has, so its words stay their real size however wide the column is. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * Where a book got to across the window: one ink, a stepped line (a place holds until the next log), a mark at each
 * log with its date and place on hover, and the start and end labelled (dataviz: one series, so no legend).
 */
export function ProgressChart({ points, since, now, title }: { points: Logged[]; since: number; now: number; title: string }) {
  const [ref, width] = useWidth()
  const H = 132, pl = 4, pr = 44, pt = 16, pb = 24
  const W = Math.max(width, 160)
  const values = points.map(p => p.percent)
  const min = Math.min(...values), max = Math.max(...values)
  const pad = Math.max(3, (max - min) * 0.2)
  const lo = Math.max(0, min - pad), hi = Math.min(100, max + pad)
  const x = (t: number) => pl + ((t - since) / (now - since)) * (W - pl - pr)
  const y = (v: number) => pt + (1 - (v - lo) / (hi - lo || 1)) * (H - pt - pb)
  const end = points.at(-1)!
  const d = points.map((p, i) => (i === 0 ? `M${x(p.at)},${y(p.percent)}` : `H${x(p.at)}V${y(p.percent)}`)).join('') + `H${x(now)}`
  const summary = `${title}: ${points[0].percent}% on ${fmt(points[0].at)}, ${end.percent}% now`

  return (
    <div ref={ref} className="act-chart">
      {width > 0 && (
        <svg width={W} height={H} role="img" aria-label={summary}>
          <line className="act-base" x1={pl} x2={W - pr} y1={H - pb} y2={H - pb} />
          <path className="act-line" d={d} />
          {points.slice(1).map(p => (
            <circle key={p.at} className="act-mark" cx={x(p.at)} cy={y(p.percent)} r={4}>
              <title>{`${fmt(p.at)}: ${p.percent}%`}</title>
            </circle>
          ))}
          <text className="act-label act-quiet" x={x(points[0].at)} y={y(points[0].percent) - 6}>{points[0].percent}%</text>
          <text className="act-label" x={W - pr + 6} y={y(end.percent) + 5}>{end.percent}%</text>
          <text className="act-axis" x={pl} y={H - 6}>{fmt(since)}</text>
          <text className="act-axis" x={W - pr} y={H - 6} textAnchor="end">Today</text>
        </svg>
      )}
    </div>
  )
}
