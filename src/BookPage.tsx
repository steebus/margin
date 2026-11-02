import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, MessageCircle, Plus } from 'lucide-react'
import { books, cards, current, margins, threads } from './sample'
import { Stars } from './Shelves'
import { Thumb } from './Thumb'

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
  const book = books.find(b => b.slug === bookSlug)
  if (!book) return <NotFoundBook />

  const reading = current.find(c => c.book.slug === book.slug)
  const entries = margins[book.slug] ?? []
  const library = book.slug === current[0].book.slug ? cards : []

  return (
    <div className="narrow stack">
      <Link to="/shelves" className="back"><ArrowLeft aria-hidden="true" strokeWidth={2.25} />Shelves</Link>

      <header className="book-head">
        <Thumb book={book} />
        <div className="book-head-text">
          <h1 className="book-title">{book.title}</h1>
          <p>{book.author}</p>
          {reading && (
            <>
              <p className="pct pct-large">{reading.percent}%</p>
              <span className="bar" aria-hidden="true"><span style={{ transform: `scaleX(${reading.percent / 100})` }} /></span>
              {reading.format === 'audiobook' && <p className="where">Audiobook</p>}
            </>
          )}
          {book.rating !== null && <Stars rating={book.rating} />}
          {book.tags.length > 0 && <p className="tags">{book.tags.map(t => <span key={t} className="tag">{t}</span>)}</p>}
        </div>
      </header>

      {library.length > 0 && (
        <table className="card-table">
          <caption>Library card</caption>
          <tbody>
            {library.map(row => (
              <tr key={row.event}>
                <td><span className="date-stamp">{row.added}</span></td>
                <td>{row.event}</td>
              </tr>
            ))}
            <tr><td colSpan={2}>Recommended by Sam: read it for the winter</td></tr>
          </tbody>
        </table>
      )}

      <hr className="rule" />

      <section className="stack" aria-labelledby="margin-heading">
        <h2 id="margin-heading" className="head">In the margin</h2>
        {entries.length > 0 ? (
          <ul className="entries">
            {entries.map(e => (
              <li key={e.note} data-summary={e.summary || undefined}>
                <span className="entry-position">{e.summary ? `Summary, ${e.position.toLowerCase()}` : e.position}</span>
                {e.quote && <blockquote className="book-voice">{e.quote}</blockquote>}
                <p className="hand">{e.note}</p>
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
          <MessageCircle aria-hidden="true" strokeWidth={2.25} />
          Talk{threads[book.slug] ? '' : ' about it'}
        </Link>
      </div>
    </div>
  )
}
