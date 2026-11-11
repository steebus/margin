import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { delayAfter, inkFor, wrapLines } from '../../lib/typing'
import { play, strikeFor } from '../../lib/typeSound'

// ponytail: one span per glyph, not the plan's one text node per line, because the
// brief wants per-glyph ink. Notes are short. Render lines to canvas if a throttled trace complains.
const Line = memo(function Line({ text, start, strike }: { text: string; start: number; strike: boolean }) {
  return (
    <div className="tw-line">
      {[...text].map((c, i) => {
        const ink = inkFor(start + i)
        return (
          <span
            key={i}
            className={strike && i === text.length - 1 ? 'tw-strike' : undefined}
            style={{ opacity: ink.opacity, top: `${ink.y}em` }}
          >
            {c}
          </span>
        )
      })}
    </div>
  )
})

export function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const windowRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(0)
  const [started, setStarted] = useState(false)
  const [typed, setTyped] = useState(() =>
    matchMedia('(prefers-reduced-motion: reduce)').matches ? Infinity : 0,
  )

  useLayoutEffect(() => {
    const measure = () => {
      const glyph = probeRef.current!.getBoundingClientRect().width / 10
      if (glyph) setCols(Math.max(8, Math.floor(windowRef.current!.clientWidth / glyph)))
    }
    measure()
    document.fonts.ready.then(measure)
    const observer = new ResizeObserver(measure)
    observer.observe(windowRef.current!)
    return () => observer.disconnect()
  }, [])

  const lines = useMemo(() => (cols ? wrapLines(text, cols) : []), [text, cols])
  const total = lines.reduce((sum, line) => sum + line.length, 0)
  const done = cols > 0 && typed >= total

  useEffect(() => {
    if (done) onDone?.()
  }, [done, onDone])

  // Which line the strike point is on, and how far along it.
  let current = 0
  let before = 0
  while (current < lines.length - 1 && typed >= before + lines[current].length) {
    before += lines[current].length
    current++
  }
  const column = Math.min(typed - before, lines[current]?.length ?? 0)

  // Typing waits until the first line would land clear of the fixed tab bar, so it's actually seen.
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -86px 0px' }, // the tab bar (59px) plus one line (27px)
    )
    observer.observe(windowRef.current!)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started || !cols || done) return
    const char = lines[current][column - 1] ?? ''
    const atLineEnd = column === lines[current].length
    const wait = delayAfter(char, typed) + (atLineEnd ? 260 : 0)
    if (char) play(strikeFor(char, typed, atLineEnd))
    const timer = setTimeout(() => setTyped((n) => n + 1), wait)
    return () => clearTimeout(timer)
  }, [started, typed, cols, done, lines, current, column])

  // Each new line kicks the sheet up from below. Height is reserved, so nothing around it shifts.
  useEffect(() => {
    if (current > 0 && !done) {
      sheetRef.current?.animate([{ translate: '0 0.6em' }, { translate: '0 0' }], {
        duration: 200,
        easing: 'cubic-bezier(0.34, 1.5, 0.64, 1)',
      })
    }
  }, [current, done])

  // The carriage creeps left as it types and snaps back on return. Capped by the sheet's padding.
  const carriage = done ? 0 : Math.max(column * -0.02, -0.7)

  let start = 0
  return (
    <div className="tw" onClick={() => setTyped(Infinity)}>
      <p className="sr-only">{text}</p>
      <span ref={probeRef} className="tw-probe" aria-hidden="true">0000000000</span>
      <div
        ref={windowRef}
        className="tw-window"
        aria-hidden="true"
        style={{ height: `${Math.max(lines.length, 1) * 1.5}em` }}
      >
        <div ref={sheetRef} className="tw-sheet" style={{ transform: `translate3d(${carriage}em, 0, 0)` }}>
          {lines.map((line, i) => {
            const lineStart = start
            start += line.length
            const shown = i < current || done ? line : i === current ? line.slice(0, column) : ''
            return <Line key={i} text={shown} start={lineStart} strike={!done && i === current} />
          })}
        </div>
      </div>
      {!done && (
        <button type="button" className="tw-skip" onClick={() => setTyped(Infinity)}>
          Finish typing
        </button>
      )}
    </div>
  )
}
