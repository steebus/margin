import { useEffect, useState } from 'react'
import { useOnline } from '../../lib/offline'
import { offlineLine } from '../../lib/offlineLine'
import { deviceStore } from '../../lib/outbox'

/** How many writes wait on this device. Looked at when the connection changes and every few seconds. */
function useWaitingCount(online: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let live = true
    const look = () => { deviceStore.all().then(items => { if (live) setCount(items.length) }, () => {}) }
    look()
    const timer = setInterval(look, 4000)
    return () => { live = false; clearInterval(timer) }
  }, [online])
  return count
}

/** A small line at the top of the page when offline or when writes are waiting. Nothing otherwise. */
export function OfflineLine() {
  const online = useOnline()
  const line = offlineLine(online, useWaitingCount(online))
  return line ? <p className="offline-line" role="status">{line}</p> : null
}
