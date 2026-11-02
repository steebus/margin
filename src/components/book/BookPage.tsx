import { Link, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { slugify } from '../../../convex/lib/hardcover'
import { api } from '../../../convex/_generated/api'
import { formatDate, type Book, type Status } from '../../lib/books'
import { formatClock, pagesPerDay } from '../../lib/progress'
import { daysToRead } from '../../lib/shelf'
import { CoverControls } from './CoverControls'
import { EntryList } from './EntryList'
import { ProgressForm } from './ProgressForm'
import { QuickActions } from './QuickActions'
import { ReadDates } from './ReadDates'
import { Reflection } from './Reflection'
import { Thumb } from '../thumb/Thumb'

const STATUS: Record<Status, string> = { tbr: 'TBR', reading: 'Reading', paused: 'Paused', read: 'Read', dnf: 'Stopped' }
const FORMAT: Record<Book['format'], string> = { print: 'Print', ebook: 'Ebook', audio: 'Audiobook' }
const RATINGS = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5]
const PREVIEW = 3

export function NotFoundBook() {
  return (
    <div className="narrow stack">
      <h1 className="title-head">Book not found</h1>
      <p>This link doesn't match a book on your shelves.</p>
      <div className="btn-row"><Link to="/shelves" className="btn btn-solid">Go to Shelves</Link></div>
    </div>
  )
}

/** Everything known about the book, leaving out what isn't. */
function bookFacts(book: Book, notes: number) {
  const days = daysToRead(book)
  const pace = pagesPerDay(book.pages, days)
  const rows: [string, ReactNode][] = [
    ['Pages', book.pages],
    ['Length', book.audioSeconds && formatClock(book.audioSeconds)],
    ['Published', book.published],
    ['Format', FORMAT[book.format]],
    ['Added', book.addedAt && formatDate(book.addedAt)],
    ['Started', book.startedAt && formatDate(book.startedAt)],
    ['Finished', book.finishedAt && formatDate(book.finishedAt)],
    ['Days to read', days],
    ['Pace', pace && `${pace} pages a day`],
    ['Times read', book.readings.length > 1 && book.readings.length],
    ['Notes and thoughts', notes],
    ['Genres', book.subjects.join(', ')],
    ['ISBN', book.isbn],
    ['Recommended by', book.recommendedBy && <Link to="/people/$personSlug" params={{ personSlug: slugify(book.recommendedBy) }}>{book.recommendedBy}</Link>],
  ]
  return rows.filter(row => !!row[1])
}

/** The Hardcover lists a book is on, changed with a tick. */
function Lists({ book }: { book: Book }) {
  const lists = useQuery(api.books.myLists)
  const setOnList = useMutation(api.books.setOnList)
  if (!lists?.length) return null
  return (
    <details className="tools-filters">
      <summary>Lists{book.shelfIds.length ? ` (${book.shelfIds.length})` : ''}</summary>
      <fieldset className="choices">
        <legend className="sr-only">Lists this book is on</legend>
        {lists.map(l => (
          <label key={l.id} className="choice">
            <input type="checkbox" checked={book.shelfIds.includes(l.id)} onChange={e => void setOnList({ readId: book.readId, listId: l.id, on: e.target.checked })} />
            {l.name}
          </label>
        ))}
      </fieldset>
    </details>
  )
}

export function BookPage() {
  const { bookSlug } = useParams({ from: '/books/$bookSlug/' })
  const found = useQuery(api.library.bookBySlug, { slug: bookSlug })
  const setStatus = useMutation(api.library.setStatus)
  const setRating = useMutation(api.library.setRating)
  const [logging, setLogging] = useState(false)
  const [logged, setLogged] = useState<string | null>(null)

  useEffect(() => {
    if (!logged) return
    const timer = setTimeout(() => setLogged(null), 2500)
    return () => clearTimeout(timer)
  }, [logged])

  if (found === undefined) return <p role="status">Finding your book…</p>
  if (found === null) return <NotFoundBook />

  const { book, entries, cover, prompt } = found
  const showProgress = book.status === 'reading' || book.status === 'paused'

  return (
    <div className="narrow stack">
      <Link to="/shelves" className="back"><ArrowLeft aria-hidden="true" strokeWidth={2.25} />Shelves</Link>

      <header className="book-head">
        <Thumb book={book} />
        <div className="book-head-text">
          <h1 className="book-title">{book.title}</h1>
          <p>{book.author}</p>
          {showProgress && (
            <>
              <p className="pct pct-large">{book.percent}%</p>
              <span className="bar" aria-hidden="true"><span style={{ transform: `scaleX(${book.percent / 100})` }} /></span>
              {book.format === 'audio' && book.seconds !== null && book.audioSeconds
                ? <p className="where">{formatClock(book.seconds)} of {formatClock(book.audioSeconds)}</p>
                : book.page !== null && book.pages && <p className="where">Page {book.page} of {book.pages}</p>}
            </>
          )}
        </div>
      </header>

      <QuickActions book={book} logging={logging} onLog={() => setLogging(!logging)} />

      {logging && book.status !== 'read' && <ProgressForm book={book} onSaved={label => { setLogging(false); setLogged(label) }} />}
      {logged && <p role="status">Logged: {logged}</p>}

      {prompt && <Reflection key={prompt.id} prompt={prompt} />}

      <div className="book-controls">
        <div className="field">
          <label htmlFor="book-status">Status</label>
          <select id="book-status" value={book.status} onChange={e => void setStatus({ readId: book.readId, status: e.target.value as Status })}>
            {(Object.keys(STATUS) as Status[]).map(s => <option key={s} value={s}>{STATUS[s]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="book-rating">Rating</label>
          <select id="book-rating" value={book.rating ?? ''} onChange={e => void setRating({ readId: book.readId, rating: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Not rated</option>
            {RATINGS.map(r => <option key={r} value={r}>{r} {r === 1 ? 'star' : 'stars'}</option>)}
          </select>
        </div>
      </div>

      <Lists book={book} />

      <table className="card-table">
        <caption>Library card</caption>
        <tbody>
          {bookFacts(book, entries.length).map(([label, value]) => (
            <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>
          ))}
        </tbody>
      </table>

      <ReadDates book={book} />

      <hr className="rule" />

      <section className="stack" aria-labelledby="margin-heading">
        <h2 id="margin-heading" className="head">In the margin</h2>
        {entries.length > 0 ? <EntryList entries={[...entries].reverse()} readId={book.readId} limit={PREVIEW} /> : <p>Nothing in the margin yet. Add a line you underlined, or a thought about it.</p>}
        {entries.length > 0 && (
          <div className="btn-row">
            <Link to="/books/$bookSlug/entries" params={{ bookSlug: book.slug }} className="btn">{entries.length === 1 ? 'Open in notes and thoughts' : `All ${entries.length} notes and thoughts`}</Link>
          </div>
        )}
      </section>

      <hr className="rule" />
      <CoverControls readId={book.readId} cover={cover} />
    </div>
  )
}
