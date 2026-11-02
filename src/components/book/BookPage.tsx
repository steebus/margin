import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ArrowLeft, MessageCircle, Plus } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { formatDate, type Status } from '../../lib/books'
import { Stars } from '../shelf/Shelves'
import { Thumb } from '../thumb/Thumb'

const STATUS: Record<Status, string> = { tbr: 'On your TBR', reading: 'Reading', paused: 'Paused', read: 'Read', dnf: 'Stopped' }

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
          <p className="where">{STATUS[book.status]}{book.format === 'audio' ? ', audiobook' : ''}</p>
          {showProgress && (
            <>
              <p className="pct pct-large">{book.percent}%</p>
              <span className="bar" aria-hidden="true"><span style={{ transform: `scaleX(${book.percent / 100})` }} /></span>
            </>
          )}
          {book.rating !== null && <Stars rating={book.rating} />}
        </div>
      </header>

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
                <span className="entry-position">{e.kind === 'summary' ? `Summary${e.position ? `, ${e.position}` : ''}` : e.position}</span>
                {e.kind === 'excerpt' ? <blockquote className="book-voice">{e.text}</blockquote> : <p className="hand">{e.text}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nothing in the margin yet. Add a line you underlined, or a thought about it.</p>
        )}
      </section>

      <div className="btn-row btn-row-fill">
        <Link to="/capture" className="btn"><Plus aria-hidden="true" strokeWidth={2.25} />Add entry</Link>
        <Link to="/books/$bookSlug/buddy" params={{ bookSlug: book.slug }} className="btn btn-solid">
          <MessageCircle aria-hidden="true" strokeWidth={2.25} />Talk about it
        </Link>
      </div>
    </div>
  )
}
