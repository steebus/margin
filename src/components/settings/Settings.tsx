import { useAuthActions } from '@convex-dev/auth/react'
import { useAction, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorText } from '../../lib/books'

function Account() {
  const viewer = useQuery(api.users.viewer)
  const { signOut } = useAuthActions()
  return (
    <div className="box stack">
      <p>Signed in as <strong>{viewer?.name ?? viewer?.email ?? '…'}</strong></p>
      {viewer?.name && viewer.email && <p className="where">{viewer.email}</p>}
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => void signOut()}>Sign out</button>
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
    </div>
  )
}
