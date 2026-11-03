import { useMutation } from 'convex/react'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorText } from '../../lib/books'

const toKey = (base64: string) => {
  const raw = atob((base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

const registration = () => navigator.serviceWorker?.ready ?? Promise.reject(new Error('no service worker'))

/** Push nudges (SPEC 3.3): only for a book gone quiet or a note left waiting, one a day at most. */
export function Nudges() {
  const key = useQuery(api.push.publicKey)
  const subscribe = useMutation(api.push.subscribe)
  const unsubscribe = useMutation(api.push.unsubscribe)
  const [endpoint, setEndpoint] = useState<string | null | undefined>(undefined)
  const subscribed = useQuery(api.push.isSubscribed, endpoint ? { endpoint } : 'skip')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supported = typeof window !== 'undefined' && 'PushManager' in window && 'serviceWorker' in navigator

  useEffect(() => {
    if (!supported) return
    void registration().then(r => r.pushManager.getSubscription()).then(s => setEndpoint(s?.endpoint ?? null), () => setEndpoint(null))
  }, [supported])

  if (!supported) return <p>This browser can't take nudges. Install Margin on your phone from Chrome to get them.</p>
  if (key === null) return <p>Nudges aren't set up on the server yet.</p>
  const on = !!endpoint && subscribed === true

  const toggle = async () => {
    setBusy(true)
    setError(null)
    try {
      const reg = await registration()
      if (on) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) { await unsubscribe({ endpoint: sub.endpoint }); await sub.unsubscribe() }
        setEndpoint(null)
      } else {
        if (await Notification.requestPermission() !== 'granted') {
          setError("Notifications are blocked for Margin. Allow them in the browser's site settings, then try again.")
          return
        }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key!) })
        const { endpoint, keys } = sub.toJSON()
        await subscribe({ endpoint: endpoint!, p256dh: keys!.p256dh, auth: keys!.auth })
        setEndpoint(endpoint!)
      }
    } catch (e) {
      setError(errorText(e, "That didn't work. Check your connection and try again."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <p>A nudge when a book you're reading has gone quiet for a week, or your buddy's note has waited three days. One a day at most, in the early evening.</p>
      <div className="btn-row">
        <button type="button" className="btn" aria-pressed={on} disabled={busy || key === undefined || endpoint === undefined} onClick={() => void toggle()}>
          {on ? 'Stop nudges on this device' : 'Nudge me on this device'}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
