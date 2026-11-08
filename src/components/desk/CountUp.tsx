import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

/** A number that counts to its new value instead of jumping, and just shows it for anyone who asked for less motion. */
export function CountUp({ value, format = (n: number) => n.toLocaleString('en-GB') }: { value: number; format?: (n: number) => string }) {
  const calm = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (calm || from.current === value) { from.current = value; setShown(value); return }
    const run = animate(from.current, value, { duration: 0.7, ease: 'easeOut', onUpdate: n => { from.current = n; setShown(Math.round(n)) } })
    return () => run.stop()
  }, [value, calm])
  return <>{format(shown)}</>
}
