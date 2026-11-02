import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { NotFoundBook } from '../book/BookPage'
import { Thumb } from '../thumb/Thumb'
import { Typewriter } from '../typewriter/Typewriter'

export function Buddy() {
  const { bookSlug } = useParams({ from: '/books/$bookSlug/buddy' })
  const found = useQuery(api.library.bookBySlug, { slug: bookSlug })

  if (found === undefined) return <p role="status">Finding your book…</p>
  if (found === null) return <NotFoundBook />
  const { book } = found

  return (
    <div className="narrow stack">
      <header className="buddy-head">
        <Link to="/books/$bookSlug" params={{ bookSlug }} className="back" aria-label={`Back to ${book.title}`}>
          <ArrowLeft aria-hidden="true" strokeWidth={2.25} />
        </Link>
        <Thumb book={book} />
        <div>
          <h1 className="buddy-title">{book.title}</h1>
          <p className="where">{book.author}</p>
        </div>
      </header>

      <hr className="rule" />

      <Typewriter text="Your buddy hasn't arrived yet. When it does, its questions about this book will be typed here." />
    </div>
  )
}
