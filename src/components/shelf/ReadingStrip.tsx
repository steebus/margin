import { Link } from '@tanstack/react-router'
import type { Book } from '../../lib/books'
import { flyCover } from '../../lib/coverFlight'
import { useBookHold } from '../book/BookActions'
import { Thumb } from '../thumb/Thumb'

export function Card({ book }: { book: Book }) {
  const hold = useBookHold(book)
  return (
    <Link to="/books/$bookSlug" params={{ bookSlug: book.slug }} className="strip-card" aria-label={`${book.title} by ${book.author}, ${book.percent}%`} {...hold} onClickCapture={e => { hold.onClickCapture(e); if (!e.defaultPrevented) flyCover(e.currentTarget) }}>
      <Thumb book={book} marks={false} />
      <span className="strip-foot" aria-hidden="true">
        <span className="strip-sub">{book.format === 'audio' ? 'Audiobook' : book.author}</span>
        <span className="pct">{book.percent}%</span>
        <span className="bar"><span style={{ transform: `scaleX(${book.percent / 100})` }} /></span>
      </span>
    </Link>
  )
}

/** The books you're reading, big enough to see their art. Tap to open one, hold for what you can do with it. */
export function ReadingStrip({ books, label = "Books you're reading" }: { books: Book[]; label?: string }) {
  return (
    <div className="strip-wrap">
      <ul className="strip" aria-label={label} data-count={Math.min(books.length, 3)}>
        {books.map(b => <li key={b.readId}><Card book={b} /></li>)}
      </ul>
      <p className="strip-hint">Hold a book for its actions</p>
    </div>
  )
}
