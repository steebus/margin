import { Link } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { sameBook } from '../../../convex/lib/match'
import { parseNotesDoc } from '../../../convex/lib/playbooks'
import { errorText, type Book } from '../../lib/books'
import { exportDoc, GAPI, googleToken, GSI, loadScript, pickNotesDocs, playLibrary, PLAY_BOOKS_SCOPES } from '../../lib/google'
import { useBooks } from '../../lib/offline'
import { planPlayBooks, playBooks, type PlayBook, type PlayDoc, type PlayPlan } from '../../lib/playbooks-plan'

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
type Ready = { plan: PlayPlan<Book>; adds: { play: PlayBook; hit: Hit }[]; review: PlayBook[]; skipped: string[] }
type Hit = FunctionReturnType<typeof api.books.search>[number]

/**
 * Play Books, read in the browser when the reader presses the button (docs/superpowers/specs/2026-11-04-play-books-design.md).
 * Nothing is written until they say so; books it can't place wait in /review.
 */
export function PlayBooksImport() {
  const config = useQuery(api.google.clientConfig)
  const books = useBooks()
  const waiting = useQuery(api.review.waiting)
  const search = useAction(api.books.search)
  const addBooks = useMutation(api.books.addBooks)
  const setStatus = useMutation(api.library.setStatus)
  const saveNotes = useMutation(api.playbooks.saveNotes)
  const queue = useMutation(api.playbooks.queue)
  const [ready, setReady] = useState<Ready | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [report, setReport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Loaded ahead, so Google's popup opens straight from the tap.
  useEffect(() => { void loadScript(GSI).catch(() => {}); void loadScript(GAPI).catch(() => {}) }, [])

  const read = async () => {
    if (!config?.clientId || !config.apiKey || !books) return
    setError(null)
    setReport(null)
    try {
      const token = await googleToken(config.clientId, PLAY_BOOKS_SCOPES)
      setRunning('Reading your Play Books shelves')
      const volumes = await playLibrary(token)
      setRunning(null)
      const ids = await pickNotesDocs(token, config.apiKey, config.clientId)
      const docs: PlayDoc[] = []
      const skipped: string[] = []
      for (const [i, id] of ids.entries()) {
        setRunning(`Reading notes, ${i + 1} of ${ids.length}`)
        const doc = parseNotesDoc(await exportDoc(id, token))
        if (doc.notes.length || doc.volumeId) docs.push(doc)
        else skipped.push(doc.title || 'a doc')
      }
      const plan = planPlayBooks(playBooks(volumes, docs), books)
      const adds: Ready['adds'] = []
      const review = [...plan.toReview]
      for (const [i, play] of plan.toAdd.entries()) {
        setRunning(`Looking on Hardcover, ${i + 1} of ${plan.toAdd.length}: ${play.title}`)
        const hit = (await search({ q: play.isbn ?? `${play.title} ${play.author.split(',')[0]}` }))[0]
        if (hit && !hit.onShelves && sameBook({ title: hit.book.title, author: hit.book.authors[0] ?? '' }, play)) adds.push({ play, hit })
        else if (!hit?.onShelves) review.push(play)
        await pause(300)
      }
      setReady({ plan, adds, review, skipped })
    } catch (e) {
      setError(e instanceof Error && /closed|refused|popup/i.test(e.message)
        ? 'Google sign-in was closed, so nothing was read.'
        : errorText(e, "Play Books couldn't be read just now. Check your connection and try again."))
    } finally {
      setRunning(null)
    }
  }

  const apply = async () => {
    if (!ready) return
    setError(null)
    let notes = 0, moved = 0
    try {
      for (const { book, play, move } of ready.plan.onShelves) {
        setRunning(`Updating ${book.title}`)
        if (move) { await setStatus({ readId: book.readId, status: move, undated: move === 'read' }); moved++ }
        if (play.notes.length) notes += await saveNotes({ readId: book.readId, volumeId: play.sourceId, notes: play.notes })
      }
      for (const { play, hit } of ready.adds) {
        setRunning(`Adding ${play.title}`)
        const [added] = await addBooks({ books: [hit.book], status: play.status!, format: 'ebook', undated: play.status === 'read' })
        if (play.notes.length) notes += await saveNotes({ readId: added.readId, volumeId: play.sourceId, notes: play.notes })
        await pause(300)
      }
      setRunning('Putting the rest in review')
      const queued = await queue({ items: ready.review.map(({ sourceId, title, author, isbn, status, notes }) => ({ sourceId, title, author, isbn, status: status ?? undefined, notes })) })
      setReport(`${moved} moved on, ${ready.adds.length} added, ${notes} new highlights and notes. ${queued} ${queued === 1 ? 'book waits' : 'books wait'} in review.`)
      setReady(null)
    } catch (e) {
      setError(errorText(e, 'It stopped partway. Running it again carries on: nothing is added twice.'))
    } finally {
      setRunning(null)
    }
  }

  const count = waiting?.length ?? 0
  return (
    <div className="stack">
      <p>Reads your Play Books shelves, and the "Notes from" docs Play Books keeps in Drive (turn on "Save notes, highlights and bookmarks in Google Drive" in Play Books' settings). Google asks first; nothing about Google is kept.</p>
      {count > 0 && <p><Link to="/review">{count} {count === 1 ? 'book waits' : 'books wait'} in review</Link></p>}
      {!ready && (
        <div className="btn-row">
          <button type="button" className="btn btn-solid" disabled={!config?.clientId || !config.apiKey || !books || !!running} onClick={() => void read()}>Read Play Books</button>
        </div>
      )}
      {config && (!config.clientId || !config.apiKey) && <p role="alert">Play Books isn't set up: AUTH_GOOGLE_ID or GOOGLE_API_KEY is missing.</p>}

      {ready && (
        <div className="stack">
          <ul className="gaps-list">
            {ready.plan.onShelves.filter(o => o.move === 'read').length > 0 && <li>Finished, to mark read: {ready.plan.onShelves.filter(o => o.move === 'read').map(o => o.book.title).join('; ')}</li>}
            {ready.plan.onShelves.filter(o => o.move === 'reading').length > 0 && <li>Started, to mark reading: {ready.plan.onShelves.filter(o => o.move === 'reading').map(o => o.book.title).join('; ')}</li>}
            <li>Notes for {ready.plan.onShelves.filter(o => o.play.notes.length).length + ready.adds.filter(a => a.play.notes.length).length} books ({[...ready.plan.onShelves.map(o => o.play), ...ready.adds.map(a => a.play)].reduce((n, b) => n + b.notes.length, 0)} highlights and notes)</li>
            {ready.adds.length > 0 && <li>Not on your shelves, to add: {ready.adds.map(a => a.play.title).join('; ')}</li>}
            {ready.review.length > 0 && <li>To wait in review: {ready.review.length} {ready.review.length === 1 ? 'book' : 'books'} Margin can't place for sure</li>}
            {ready.skipped.length > 0 && <li>Docs with nothing Margin could read: {ready.skipped.join('; ')}</li>}
          </ul>
          <p className="where">Everything goes to Hardcover too.</p>
          <div className="btn-row">
            <button type="button" className="btn btn-solid" disabled={!!running} onClick={() => void apply()}>Make these changes</button>
            <button type="button" className="btn" disabled={!!running} onClick={() => setReady(null)}>Cancel</button>
          </div>
        </div>
      )}
      {running && <p role="status">{running}…</p>}
      {report && <p role="status">{report} {count > 0 && <Link to="/review">Go to review</Link>}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
