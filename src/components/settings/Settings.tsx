import { useAction, useConvex, useMutation } from 'convex/react'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { useState, type ReactNode } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { AudibleImport } from './AudibleImport'
import { KoboSettings } from './KoboSettings'
import { PlayBooksImport } from './PlayBooksImport'
import { Nudges } from './Nudges'
import { api } from '../../../convex/_generated/api'
import { errorText } from '../../lib/books'
import { download, toMarkdown } from '../../lib/export'
import { forgetDevice } from '../../lib/offline'
import { setTypeSound, useTypeSound } from '../../lib/typeSound'
import { setTheme, useThemeChoice, type ThemeChoice } from '../../lib/theme'
import { useAuthActions } from '../../lib/auth'

function Account() {
  const viewer = useQuery(api.users.viewer)
  const { signOut } = useAuthActions()
  return (
    <div className="box stack">
      <p>Signed in as <strong>{viewer?.name ?? viewer?.email ?? '…'}</strong></p>
      {viewer?.name && viewer.email && <p className="where">{viewer.email}</p>}
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => { forgetDevice(); void signOut() }}>Sign out</button>
      </div>
    </div>
  )
}

function HardcoverImport() {
  const importLibrary = useAction(api.hardcover.importLibrary)
  const books = useQuery(api.library.myBooks)
  const sync = useQuery(api.hardcover.syncStatus)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const { added, existing, notes } = await importLibrary({})
      setResult(`Added ${added} ${added === 1 ? 'book' : 'books'}, and ${notes} new notes, quotes and reviews. ${existing} books were already here.`)
    } catch (e) {
      setError(errorText(e, "The import didn't finish. Nothing is lost: run it again to pick up the rest."))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="box stack">
      <p>
        {books === undefined ? 'Counting your books…' : `${books.length} ${books.length === 1 ? 'book' : 'books'} on your shelves.`}
      </p>
      {sync?.lastSyncAt ? (
        <p className="where">
          Syncing both ways, last checked {new Date(sync.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
          {sync.pending > 0 && ` ${sync.pending} waiting to send.`}
        </p>
      ) : (
        <p className="where">Run this once to bring in your books, notes and reviews and to start syncing both ways.</p>
      )}
      {sync?.lastError && <p role="alert">Hardcover sync problem: {sync.lastError} It will keep retrying.</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-solid" disabled={running} onClick={() => void run()}>
          {running ? 'Importing, a minute or two…' : 'Import from Hardcover'}
        </button>
      </div>
      {result && <p role="status">{result}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

function BuddySpend() {
  const spend = useQuery(api.buddy.monthSpend)
  if (!spend) return null
  return (
    <div className="box">
      <p>Your buddy has cost about ${spend.dollars.toFixed(2)} this month.</p>
      {spend.over && <p role="alert">That's past the ${spend.alert} you agreed to be told about.</p>}
    </div>
  )
}

function Export() {
  const convex = useConvex()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = () => new Date().toISOString().slice(0, 10)

  const run = async (save: (all: Awaited<ReturnType<typeof fetchAll>>) => void) => {
    setBusy(true)
    setError(null)
    try {
      save(await fetchAll())
    } catch (e) {
      setError(errorText(e, "The export didn't work. Check your connection and try again."))
    } finally {
      setBusy(false)
    }
  }
  const fetchAll = () => convex.query(api.library.exportAll, {})

  return (
    <div className="box stack">
      <p>Everything you've kept here is yours to take away: your books, dates, ratings, notes and reflections.</p>
      <div className="btn-row">
        <button type="button" className="btn" disabled={busy} onClick={() => void run(all => download(`margin-${today()}.md`, toMarkdown(all), 'text/markdown'))}>Markdown</button>
        <button type="button" className="btn" disabled={busy} onClick={() => void run(all => download(`margin-${today()}.json`, JSON.stringify(all, null, 2), 'application/json'))}>JSON</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Daylight' },
  { id: 'dark', label: 'Night' },
]

function Appearance() {
  const choice = useThemeChoice()
  const sound = useTypeSound()
  return (
    <div className="box stack">
      <div className="segments" role="group" aria-label="Theme">
        {THEMES.map(t => <button key={t.id} type="button" aria-pressed={choice === t.id} onClick={() => setTheme(t.id)}>{t.label}</button>)}
      </div>
      <p className="where">System follows your phone or computer's light and dark setting.</p>
      <label className="check">
        <input type="checkbox" checked={sound} onChange={e => setTypeSound(e.target.checked)} />
        <span>Typewriter sound: a click for each key and a bell at the end of a line. Off unless you turn it on.</span>
      </label>
    </div>
  )
}

/** Topics Steve hid, to bring back. Hidden ones stay out of Explore, the topics list and the buddy's view. */
function HiddenTopics() {
  const hidden = useQuery(api.topics.hidden)
  const unhide = useMutation(api.topics.unhide)
  if (hidden === undefined) return null
  if (!hidden.length) return <p>None. Hide a topic from its page if you don't want it in Explore.</p>
  return (
    <ul className="book-topics">
      {hidden.map(t => (
        <li key={t.key}><button type="button" className="btn" onClick={() => void unhide({ key: t.key })}>Show {t.name}</button></li>
      ))}
    </ul>
  )
}

export const TABS = ['account', 'reading', 'integrations', 'data'] as const
type Tab = (typeof TABS)[number]
const LABELS: Record<Tab, string> = { account: 'Account', reading: 'Reading', integrations: 'Integrations', data: 'Data' }

const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section className="stack" aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`} className="head">{title}</h2>
    {children}
  </section>
)

/** Settings in four places, each its own address (?tab=), so a link can land on the right one. */
export function Settings() {
  const { tab = 'account' } = useSearch({ from: '/settings/' })
  const waiting = useQuery(api.review.waiting)
  return (
    <div className="narrow stack">
      <h1 className="title-head">Settings</h1>
      <nav className="segments" aria-label="Settings">
        {TABS.map(t => (
          <Link key={t} to="/settings" search={{ tab: t }} replace activeOptions={{ includeSearch: true, exact: true }} aria-current={tab === t ? 'page' : undefined}>{LABELS[t]}</Link>
        ))}
      </nav>
      <hr className="rule" />
      {tab === 'account' && (
        <>
          <Section id="account" title="Account"><Account /></Section>
          <Section id="appearance" title="Appearance"><Appearance /></Section>
        </>
      )}
      {tab === 'reading' && (
        <>
          <Section id="buddy" title="Buddy"><BuddySpend /></Section>
          <Section id="nudges" title="Nudges"><Nudges /></Section>
          <Section id="hidden-topics" title="Hidden topics"><HiddenTopics /></Section>
        </>
      )}
      {tab === 'integrations' && (
        <>
          <Section id="review" title="Review">
            <p>{waiting?.length ? `${waiting.length} ${waiting.length === 1 ? 'book waits' : 'books wait'} for you to place.` : "Nothing waiting. Books an import can't place for sure wait here."}</p>
            <div className="btn-row"><Link to="/review" className="btn">Open review</Link></div>
          </Section>
          <Section id="hardcover" title="Hardcover"><HardcoverImport /></Section>
          <Section id="kobo" title="Kobo"><KoboSettings /></Section>
          <Section id="playbooks" title="Play Books"><PlayBooksImport /></Section>
          <Section id="audible" title="Audible"><AudibleImport /></Section>
        </>
      )}
      {tab === 'data' && <Section id="export" title="Export"><Export /></Section>}
    </div>
  )
}
