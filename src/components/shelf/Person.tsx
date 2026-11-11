import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { slugify } from '../../../convex/lib/hardcover'
import { useBooks } from '../../lib/offline'
import { sortBooks } from '../../lib/shelf'
import { Catalog } from './BookList'
import { useCatalogSize } from './ShelfTools'
import { Opening } from '../opening/Opening'

/** A recommender, or an account: what came from them, and how it landed (SPEC 3.1). */
export function Person() {
  const { personSlug } = useParams({ from: '/people/$personSlug' })
  const books = useBooks()
  const [size] = useCatalogSize()

  if (books === undefined) return <Opening what="your shelves" />
  const theirs = sortBooks(books.filter(b => b.recommendedBy && slugify(b.recommendedBy) === personSlug))
  const name = theirs[0]?.recommendedBy
  const rated = theirs.flatMap(b => (b.rating === null ? [] : [b.rating]))
  const read = theirs.filter(b => b.status === 'read').length

  return (
    <div className="stack shelves">
      <Link to="/shelves" className="back"><ArrowLeft aria-hidden="true" strokeWidth={2.25} />Shelves</Link>
      <h1 className="book-title">{name ?? 'Nobody by that name'}</h1>
      {name ? (
        <>
          <p>
            {theirs.length} {theirs.length === 1 ? 'book' : 'books'} from them, {read} read
            {rated.length > 0 && `, rated ${(rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(1)} on average`}.
          </p>
          <Catalog books={theirs} size={size} />
        </>
      ) : <p>No book on your shelves came from them.</p>}
    </div>
  )
}
