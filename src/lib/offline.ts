import { useConvex, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { replay } from './outbox'

const KEYS = { books: 'margin.cache.books', entries: 'margin.cache.entries' }

const remember = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* full or private: it just won't be there offline */ }
}
const recall = <T>(key: string): T | undefined => {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) as T : undefined
  } catch {
    return undefined
  }
}

/** A query's answer, or the last one this device saw when there's no connection to ask. */
function useLastKnown<T>(live: T | undefined, key: string): T | undefined {
  useEffect(() => { if (live !== undefined) remember(key, live) }, [live, key])
  const [saved] = useState(() => (live === undefined ? recall<T>(key) : undefined))
  const online = useOnline()
  return live ?? (online ? undefined : saved)
}

export const useBooks = () => useLastKnown(useQuery(api.library.myBooks), KEYS.books)
export const useEntries = () => useLastKnown(useQuery(api.library.allEntries), KEYS.entries)

/** Nothing of the library stays on the device after signing out. */
export const forgetDevice = () => { for (const key of Object.values(KEYS)) localStorage.removeItem(key) }

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const change = () => setOnline(navigator.onLine)
    window.addEventListener('online', change)
    window.addEventListener('offline', change)
    return () => {
      window.removeEventListener('online', change)
      window.removeEventListener('offline', change)
    }
  }, [])
  return online
}

/** Sends what was written offline: when the app opens, and whenever the connection returns. */
export function useReplayOutbox(signedIn: boolean) {
  const convex = useConvex()
  const online = useOnline()
  useEffect(() => {
    if (!signedIn || !online) return
    replay(item => (item.name === 'addEntry'
      ? convex.mutation(api.entries.addEntry, item.args as never)
      : convex.mutation(api.library.logProgress, item.args as never)))
      .then(rejected => { if (rejected.length) console.error('Refused when replayed:', rejected) })
      .catch(e => console.error('Replay failed:', e))
  }, [signedIn, online, convex])
}
