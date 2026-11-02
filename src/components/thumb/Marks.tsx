import { useLayoutEffect, useRef } from 'react'

// The reader's biro. A circle means reading, a tick means finished, a strike means abandoned.

/** Marks stretch to fit their cell, so the stroke is set from the rendered size to stay one pen width. */
function Pen({ d, className = 'mark' }: { d: string; className?: string }) {
  const ref = useRef<SVGPathElement>(null)
  useLayoutEffect(() => {
    const path = ref.current!
    const width = path.ownerSVGElement!.getBoundingClientRect().width
    if (width) path.style.strokeWidth = `${(2.25 * 100) / width}`
  }, [])
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path ref={ref} pathLength={1} d={d} />
    </svg>
  )
}

export function Circle() {
  return <Pen d="M54 5C80 2 98 24 97 52c-1 28-25 46-51 44C20 94 3 73 4 47 5 22 28 3 60 8" />
}

export function Tick() {
  return <Pen className="mark-tick" d="M8 58l26 34L92 8" />
}

export function Strike() {
  return <Pen d="M10 12C35 38 62 66 92 90M90 10C62 36 36 62 8 92" />
}

export function Arrow() {
  return (
    <svg className="biro-arrow" viewBox="0 0 40 60" aria-hidden="true">
      <path d="M34 54C16 50 8 32 12 6M4 14l8-9 9 8" />
    </svg>
  )
}
