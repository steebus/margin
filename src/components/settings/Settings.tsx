import { useAuthActions } from '@convex-dev/auth/react'
import { useAction, useConvex, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorText } from '../../lib/books'
import { download, toMarkdown } from '../../lib/export'
import { forgetDevice } from '../../lib/offline'

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

export function Settings() {
  return (
    <div className="narrow stack">
      <h1 className="title-head">Settings</h1>
      <hr className="rule" />
      <section className="stack" aria-labelledby="account-heading">
        <h2 id="account-heading" className="head">Account</h2>
        <Account />
      </section>
      <section className="stack" aria-labelledby="hardcover-heading">
        <h2 id="hardcover-heading" className="head">Hardcover</h2>
        <HardcoverImport />
      </section>
      <section className="stack" aria-labelledby="buddy-heading">
        <h2 id="buddy-heading" className="head">Buddy</h2>
        <BuddySpend />
      </section>
      <section className="stack" aria-labelledby="export-heading">
        <h2 id="export-heading" className="head">Export</h2>
        <Export />
      </section>
    </div>
  )
}
