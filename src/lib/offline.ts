import { useConvex } from 'convex/react'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { replay } from './outbox'

// Versioned: an answer saved by an older build can lack fields this one reads, so a new shape gets a new key.
const KEYS = {
  books: 'margin.cache.books.3',
  entries: 'margin.cache.entries.2',
  activity: 'margin.cache.activity.2',
  waiting: 'margin.cache.waiting.2',
  graph: 'margin.cache.graph.2',
}
try { for (const old of ['margin.cache.books', 'margin.cache.entries', 'margin.cache.books.2']) localStorage.removeItem(old) } catch { /* nothing to clear */ }

// Parsed once per load: a 600-book library is worth not re-reading on every screen.
const memory = new Map<string, unknown>()

const remember = (key: string, value: unknown) => {
  memory.set(key, value)
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* full or private: it just won't be there next time */ }
}
const recall = <T>(key: string): T | undefined => {
  if (memory.has(key)) return memory.get(key) as T
  try {
    const saved = localStorage.getItem(key)
    const value = saved ? JSON.parse(saved) as T : undefined
    memory.set(key, value)
    return value
  } catch {
    return undefined
  }
}

/**
 * A query's answer, or until it arrives, the last one this device saw (Steve, 2026-11-06: show the last visit at
 * once and let the live answer replace it). `fresh` waits for the live answer, for screens that write from it.
 */
export function useLastKnown<T>(live: T | undefined, key: string, fresh = false): T | undefined {
  useEffect(() => { if (live !== undefined) remember(key, live) }, [live, key])
  const online = useOnline()
  if (live !== undefined) return live
  return fresh && online ? undefined : recall<T>(key)
}

export const useBooks = (fresh = false) => useLastKnown(useQuery(api.library.myBooks), KEYS.books, fresh)
export const useEntries = () => useLastKnown(useQuery(api.library.allEntries), KEYS.entries)
export const useActivity = (since: number) => useLastKnown(useQuery(api.library.activity, { since }), KEYS.activity)
export const useWaiting = () => useLastKnown(useQuery(api.reflect.waiting), KEYS.waiting)
export const useGraph = () => useLastKnown(useQuery(api.topics.graph), KEYS.graph)

/** Whether this device holds a sign-in, so the shell can open on the cache while Convex confirms it. */
export const hasSavedSignIn = () => {
  try { return Object.keys(localStorage).some(k => k.startsWith('__convexAuthJWT')) } catch { return false }
}

/** Nothing of the library stays on the device after signing out. */
export const forgetDevice = () => {
  memory.clear()
  for (const key of Object.values(KEYS)) localStorage.removeItem(key)
}

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
