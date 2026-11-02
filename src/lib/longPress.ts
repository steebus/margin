import { useEffect, useRef } from 'react'

export const HOLD_MS = 480
const SLOP = 10

/** A finger that drifts further than this is scrolling, not holding. */
export const movedTooFar = (from: { x: number; y: number }, to: { x: number; y: number }, slop = SLOP) =>
  Math.hypot(to.x - from.x, to.y - from.y) > slop

/**
 * Press and hold on an element, or right-click it, to run `onHold`. A tap still does whatever the element does,
 * and the click that ends a hold is swallowed so a held link doesn't also open.
 */
export function useLongPress(onHold: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const held = useRef(false)
  const hold = useRef(onHold)
  hold.current = onHold

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    start.current = null
  }
  useEffect(() => cancel, [])

  const fire = () => {
    cancel()
    held.current = true
    navigator.vibrate?.(12)
    hold.current()
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      held.current = false
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = setTimeout(fire, HOLD_MS)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && movedTooFar(start.current, { x: e.clientX, y: e.clientY })) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    // Android raises this on a long press, and a mouse on a right-click.
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      if (!held.current) fire()
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!held.current) return
      e.preventDefault()
      e.stopPropagation()
      held.current = false
    },
  }
}
