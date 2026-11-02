import { Link, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowLeft, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { formatDate, type Status } from '../../lib/books'
import { Thumb } from '../thumb/Thumb'

const STATUS: Record<Status, string> = { tbr: 'TBR', reading: 'Reading', paused: 'Paused', read: 'Read', dnf: 'Stopped' }
const RATINGS = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5]

export function NotFoundBook() {
  return (
    <div className="narrow stack">
      <h1 className="title-head">Book not found</h1>
      <p>This link doesn't match a book on your shelves.</p>
      <div className="btn-row"><Link to="/shelves" className="btn btn-solid">Go to Shelves</Link></div>
    </div>
  )
}

export function BookPage() {
  const { bookSlug } = useParams({ from: '/books/$bookSlug/' })
  const found = useQuery(api.library.bookBySlug, { slug: bookSlug })
  const removeEntry = useMutation(api.entries.removeEntry)
  const setStatus = useMutation(api.library.setStatus)
  const setRating = useMutation(api.library.setRating)

  if (found === undefined) return <p role="status">Finding your book…</p>
  if (found === null) return <NotFoundBook />

  const { book, entries } = found
  const showProgress = book.status === 'reading' || book.status === 'paused'
  const card = [
    book.addedAt && { date: book.addedAt, event: 'Added' },
    book.startedAt && { date: book.startedAt, event: 'Started' },
    book.finishedAt && { date: book.finishedAt, event: 'Finished' },
  ].filter(row => !!row)

  return (
    <div className="narrow stack">
      <Link to="/shelves" className="back"><ArrowLeft aria-hidden="true" strokeWidth={2.25} />Shelves</Link>

      <header className="book-head">
        <Thumb book={book} />
        <div className="book-head-text">
          <h1 className="book-title">{book.title}</h1>
          <p>{book.author}</p>
          {book.format === 'audio' && <p className="where">Audiobook</p>}
          {showProgress && (
            <>
              <p className="pct pct-large">{book.percent}%</p>
              <span className="bar" aria-hidden="true"><span style={{ transform: `scaleX(${book.percent / 100})` }} /></span>
            </>
          )}
        </div>
      </header>

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

      {(card.length > 0 || book.recommendedBy) && (
        <table className="card-table">
          <caption>Library card</caption>
          <tbody>
            {card.map(row => (
              <tr key={row.event}>
                <td><span className="date-stamp">{formatDate(row.date)}</span></td>
                <td>{row.event}</td>
              </tr>
            ))}
            {book.recommendedBy && <tr><td colSpan={2}>Recommended by {book.recommendedBy}</td></tr>}
          </tbody>
        </table>
      )}

      <hr className="rule" />

      <section className="stack" aria-labelledby="margin-heading">
        <h2 id="margin-heading" className="head">In the margin</h2>
        {entries.length > 0 ? (
          <ul className="entries">
            {entries.map(e => (
              <li key={e.id}>
                <span className="entry-position">{e.kind === 'review' ? 'Your review' : e.kind === 'summary' ? `Summary${e.position ? `, ${e.position}` : ''}` : e.position}</span>
                {e.kind === 'excerpt' ? <blockquote className="book-voice">{e.text}</blockquote> : <p className="hand">{e.text}</p>}
                {e.kind !== 'review' && (
                  <button
                    type="button"
                    className="entry-delete"
                    aria-label={`Delete: ${e.text.slice(0, 40)}`}
                    onClick={() => { if (confirm('Delete this entry, here and on Hardcover? This cannot be undone.')) void removeEntry({ id: e.id }) }}
                  >
                    <Trash2 aria-hidden="true" strokeWidth={2} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nothing in the margin yet. Add a line you underlined, or a thought about it.</p>
        )}
      </section>

      <div className="btn-row btn-row-fill">
        <Link to="/capture" search={{ book: book.slug }} className="btn"><Plus aria-hidden="true" strokeWidth={2.25} />Add entry</Link>
        <Link to="/books/$bookSlug/buddy" params={{ bookSlug: book.slug }} className="btn btn-solid">
          <MessageCircle aria-hidden="true" strokeWidth={2.25} />Talk about it
        </Link>
      </div>
    </div>
  )
}
