// Fixture mode (docs/IMPROVEMENT-LOOP.md E1): Margin on a made-up library, with no sign-in and no server, so a
// screen can be looked at by anyone, or anything, that can't be Steve. Only `npm run fixtures` loads this file; a
// production build never contains it (src/main.tsx).
//
// It stands in for the Convex client. Queries answer from fixtures/generate.test.ts's file, which Margin's real
// queries wrote. Writes are accepted and forgotten, except that a screen's own optimistic update stays on show.
// Actions that would reach Hardcover, Kobo or a model refuse, as they would with no connection to them.
//
// `?fixture=empty` shows a reader with no books, and `?fixture=slow` never answers, for the loading states. The
// choice lasts for the tab; `?fixture=library` goes back.
import { ConvexProviderWithAuth, type ConvexReactClient } from 'convex/react'
import { getFunctionName, type FunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import { useEffect, useState, type ReactNode } from 'react'

type Answer = { args: Record<string, unknown>; value: unknown }
type Answers = Record<string, Answer[]>
type Data = { generatedAt: number; library: Answers; empty: Answers; search: unknown[] }
type Variant = 'library' | 'empty' | 'slow'

const variant = (): Variant => {
  const asked = new URLSearchParams(location.search).get('fixture')
  if (asked === 'library' || asked === 'empty' || asked === 'slow') sessionStorage.setItem('margin.fixture', asked)
  const kept = sessionStorage.getItem('margin.fixture')
  return kept === 'empty' || kept === 'slow' ? kept : 'library'
}

const stable = (value: unknown): string => JSON.stringify(value, (_, x) =>
  x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x)
const keyOf = (name: string, args: unknown) => `${name}|${stable(args ?? {})}`

// What a write answers with, where a screen reads the answer.
const WRITES: Record<string, (args: Record<string, unknown>) => unknown> = {
  'library:logProgress': () => ({ finished: false }),
  'entries:addEntry': () => ({ id: 'fixture-entry', duplicate: false }),
  'books:addBooks': () => [],
  'books:saveView': () => 'five-star-audio',
}

function fakeClient(data: Data, which: Variant) {
  const answers = which === 'empty' ? data.empty : data.library
  const changed = new Map<string, unknown>()
  const listeners = new Set<() => void>()

  const lookup = (name: string, args: Record<string, unknown>): unknown => {
    if (which === 'slow') return undefined
    const key = keyOf(name, args)
    if (changed.has(key)) return changed.get(key)
    const asked = answers[name]
    const exact = asked?.find(a => keyOf(name, a.args) === key)
    if (exact) return exact.value
    // Asked once with no arguments or with a time (the Desk's window): the one answer serves.
    if (asked?.length === 1 && (name === 'library:activity' || !Object.keys(asked[0].args).length)) return asked[0].value
    return null
  }

  // The part of Convex's optimistic store the screens use (ProgressForm).
  const store = {
    getQuery: (query: FunctionReference<'query'>, args: Record<string, unknown> = {}) => lookup(getFunctionName(query), args),
    setQuery: (query: FunctionReference<'query'>, args: Record<string, unknown>, value: unknown) => { changed.set(keyOf(getFunctionName(query), args), value) },
    getAllQueries: (query: FunctionReference<'query'>) => {
      const name = getFunctionName(query)
      return (answers[name] ?? []).map(a => ({ args: a.args, value: lookup(name, a.args) }))
    },
  }

  const client = {
    watchQuery: (query: FunctionReference<'query'>, args: Record<string, unknown> = {}) => ({
      onUpdate: (callback: () => void) => {
        listeners.add(callback)
        return () => { listeners.delete(callback) }
      },
      localQueryResult: () => lookup(getFunctionName(query), args),
      journal: () => undefined,
    }),
    query: async (query: FunctionReference<'query'>, args: Record<string, unknown> = {}) => {
      // The export is the library itself.
      if (getFunctionName(query) === 'library:exportAll') return { exportedAt: data.generatedAt, books: lookup('library:myBooks', {}), lists: [], entries: [] }
      return lookup(getFunctionName(query), args)
    },
    mutation: async (mutation: FunctionReference<'mutation'>, args: Record<string, unknown> = {}, options?: { optimisticUpdate?: (s: typeof store, a: Record<string, unknown>) => void }) => {
      const name = getFunctionName(mutation)
      console.info('[fixture] write accepted and forgotten:', name, args)
      if (options?.optimisticUpdate) {
        options.optimisticUpdate(store, args)
        for (const listener of listeners) listener()
      }
      await new Promise(resolve => setTimeout(resolve, 150))
      return WRITES[name]?.(args) ?? null
    },
    action: async (action: FunctionReference<'action'>, args: Record<string, unknown> = {}) => {
      const name = getFunctionName(action)
      await new Promise(resolve => setTimeout(resolve, 400))
      if (name === 'books:search') return which === 'empty' || !String(args.q ?? '').trim() ? [] : data.search
      throw new ConvexError('Not in fixture mode: this would reach a real service.')
    },
    // Signed in, always.
    setAuth: (_fetchToken: unknown, onChange: (signedIn: boolean) => void) => onChange(true),
    clearAuth: () => {},
  }
  return client as unknown as ConvexReactClient
}

const signedIn = { isLoading: false, isAuthenticated: true, fetchAccessToken: async () => null }
const useSignedIn = () => signedIn

// Missing until `npm run fixtures` (or `npm test`) has written it, so it's looked for and never imported by name.
const files = import.meta.glob<{ default: Data }>('./data.json')

export default function FixtureBackend({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<ConvexReactClient | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    const load = files['./data.json']
    if (!load) return setMissing(true)
    void load().then(file => setClient(fakeClient(file.default, variant())))
  }, [])
  if (missing) return <p role="alert">No fixture data yet. Start with <code>npm run fixtures</code>, which writes it first.</p>
  if (!client) return null
  return (
    <ConvexProviderWithAuth client={client} useAuth={useSignedIn}>
      {/* Said on every screen, so a screenshot of made-up data is never taken for the real library. */}
      <p aria-hidden="true" style={{ position: 'fixed', top: 2, left: 6, zIndex: 9, margin: 0, font: '10px/1 monospace', opacity: 0.55, pointerEvents: 'none' }}>fixture data</p>
      {children}
    </ConvexProviderWithAuth>
  )
}
