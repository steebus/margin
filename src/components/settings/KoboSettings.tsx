import { useAction, useMutation } from 'convex/react'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorText, formatDate } from '../../lib/books'
import { koboBookmarklet } from '../../lib/kobo'

/** Kobo: the session cookie the server pulls notes with, the pull itself, and the bookmarklet that sends the book list. */
export function KoboSettings() {
  const status = useQuery(api.kobo.status)
  const saveCookie = useMutation(api.kobo.saveCookie)
  const forget = useMutation(api.kobo.forget)
  const pull = useAction(api.kobo.pull)
  const [cookie, setCookie] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const link = useRef<HTMLAnchorElement>(null)
  // React refuses to render a javascript: address, rightly, so it's set once the link is on the page.
  useEffect(() => { link.current?.setAttribute('href', koboBookmarklet(window.location.origin)) }, [status === undefined])

  const run = async (label: string, work: () => Promise<string | null>) => {
    setBusy(label)
    setError(null)
    setSaid(null)
    try {
      setSaid(await work())
    } catch (e) {
      setError(errorText(e, "That didn't work. Check your connection and try again."))
    } finally {
      setBusy(null)
    }
  }

  if (status === undefined) return <p role="status">Checking Kobo…</p>
  return (
    <div className="stack">
      {status?.connected ? (
        <p>
          Connected. {status.linked} {status.linked === 1 ? 'book is' : 'books are'} linked to Kobo
          {status.lastPullAt ? `; last pulled ${formatDate(status.lastPullAt)}` : ''}
          {status.lastReport ? `, ${status.lastReport.highlights} new` : ''}. Notes are pulled every morning.
        </p>
      ) : (
        <p>Kobo has no way in for other apps, so Margin uses your Kobo sign-in. In Chrome, open a book on readnow.kobo.com, press F12, choose Network, reload, click the <code>annotations</code> request, and copy the <code>cookie</code> request header here.</p>
      )}
      {status?.lastError && <p role="alert">{status.lastError}</p>}

      <form className="stack" onSubmit={e => { e.preventDefault(); void run('Saving', async () => { await saveCookie({ cookie }); setCookie(''); return 'Saved. It stays on the server.' }) }}>
        <div className="field">
          <label htmlFor="kobo-cookie">{status?.connected ? 'A fresh Kobo cookie' : 'Kobo cookie'}</label>
          <input id="kobo-cookie" type="password" autoComplete="off" value={cookie} onChange={e => setCookie(e.target.value)} />
        </div>
        <div className="btn-row">
          <button type="submit" className="btn" disabled={!cookie.trim() || !!busy}>Save cookie</button>
          {status?.connected && (
            <button type="button" className="btn btn-solid" disabled={!!busy} onClick={() => void run('Pulling', async () => {
              const r = await pull({})
              return r.error ?? `${r.highlights} new highlights and notes from ${r.books} books.`
            })}>{busy === 'Pulling' ? 'Pulling…' : 'Pull from Kobo'}</button>
          )}
        </div>
      </form>

      <p>To link your Kobo books, or after buying new ones, drag this to your bookmarks bar on a computer and tap it on My Books (kobo.com, Library, Books):</p>
      <div className="btn-row">
        <a ref={link} className="btn" onClick={e => e.preventDefault()}>Send Kobo books to Margin</a>
        {status?.connected && <button type="button" className="btn" disabled={!!busy} onClick={() => void run('Forgetting', async () => { await forget({}); return 'Kobo forgotten.' })}>Forget Kobo</button>}
      </div>
      {busy && busy !== 'Pulling' && <p role="status">{busy}…</p>}
      {said && <p role="status">{said}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
