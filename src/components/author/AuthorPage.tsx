import { Link, useNavigate, useParams, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Fragment } from 'react'
import { authorOf, authorSlug } from '../../lib/authors'
import type { Book, Status } from '../../lib/books'
import { useBooks } from '../../lib/offline'
import { sortBooks } from '../../lib/shelf'
import { Catalog } from '../shelf/BookList'
import { useCatalogSize } from '../shelf/ShelfTools'
import { Opening } from '../opening/Opening'

// In the order a reader wants them: what's in hand, what's done, what's waiting.
const GROUPS: [string, Status[]][] = [['In hand', ['reading', 'paused']], ['Read', ['read']], ['To be read', ['tbr']], ['Put down', ['dnf']]]

/** An author: every book of theirs on the shelves, and how they've landed. */
export function AuthorPage() {
  const { authorSlug: slug } = useParams({ from: '/authors/$authorSlug' })
  const books = useBooks()
  const [size] = useCatalogSize()
  const router = useRouter()
  const navigate = useNavigate()

  if (books === undefined) return <Opening what="your shelves" />
  const author = authorOf(books, slug)
  const back = (
    <button type="button" className="back" onClick={() => router.history.canGoBack() ? router.history.back() : void navigate({ to: '/stats' })}>
      <ArrowLeft aria-hidden="true" strokeWidth={2.25} />Back
    </button>
  )
  if (!author) {
    return (
      <div className="narrow stack">
        {back}
        <h1 className="title-head">No such author</h1>
        <p>Nothing on your shelves is by anyone of that name.</p>
      </div>
    )
  }

  const n = author.books.length
  const facts = [
    `${n} ${n === 1 ? 'book' : 'books'} on your shelves`,
    author.read > 0 && `${author.read} read`,
    author.pages > 0 && `${author.pages.toLocaleString('en-GB')} pages`,
    author.rating !== null && `rated ${author.rating} on average`,
  ].filter(Boolean)
  const groups = GROUPS.map(([label, statuses]) => [label, sortBooks(author.books.filter(b => statuses.includes(b.status)))] as [string, Book[]])

  return (
    <div className="stack shelves author-page">
      {back}
      <p className="eyebrow">Author</p>
      <h1 className="book-title">{author.name}</h1>
      <p className="topic-meta">{facts.join(' · ')}</p>
      {(author.genres.length > 0 || author.with.length > 0) && (
        <p className="where">
          {author.genres.map((g, i) => <Fragment key={g}>{i > 0 && ', '}<Link to="/shelves" search={{ genre: g }}>{g}</Link></Fragment>)}
          {author.genres.length > 0 && author.with.length > 0 && ' · '}
          {author.with.length > 0 && <>With {author.with.map((a, i) => <Fragment key={a}>{i > 0 && ', '}<Link to="/authors/$authorSlug" params={{ authorSlug: authorSlug(a) }}>{a}</Link></Fragment>)}</>}
        </p>
      )}
      <hr className="rule" />
      {groups.filter(([, here]) => here.length > 0).map(([label, here]) => (
        <section key={label} className="stack" aria-label={label}>
          <h2 className="year"><span>{label} · {here.length}</span></h2>
          <Catalog books={here} size={size} />
        </section>
      ))}
    </div>
  )
}
