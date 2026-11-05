import { Link, useNavigate, useParams, useRouter } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { ArrowLeft, Waypoints } from 'lucide-react'
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { slugify } from '../../../convex/lib/hardcover'
import { api } from '../../../convex/_generated/api'
import { formatDate, type Book, type Status } from '../../lib/books'
import { formatClock, pagesPerDay } from '../../lib/progress'
import { daysToRead } from '../../lib/shelf'
import { DeleteBook } from './BookActions'
import { CoverControls } from './CoverControls'
import { GuideControls } from './GuideControls'
import { EntryList } from './EntryList'
import { ProgressForm } from './ProgressForm'
import { QuickActions } from './QuickActions'
import { ReadDates } from './ReadDates'
import { BuddyNote } from './BuddyNote'
import { Reflection } from './Reflection'
import { Thumb } from '../thumb/Thumb'

const STATUS: Record<Status, string> = { tbr: 'TBR', reading: 'Reading', paused: 'Paused', read: 'Read', dnf: 'Stopped' }
const FORMAT: Record<Book['format'], string> = { print: 'Print', ebook: 'Ebook', audio: 'Audiobook' }
const RATINGS = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5]
const PREVIEW = 6

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
// How each status is stamped on the cover, as a library stamps a card.
const STAMP: Record<Status, string> = { reading: 'Reading', paused: 'Paused', read: 'Read', tbr: 'To be read', dnf: 'Abandoned' }
// Facts too long for a cell take the card's full width; dates print a little off true, as stamped dates do.
const WIDE = new Set(['Genres', 'Recommended by', 'ISBN'])
const DATES = new Set(['Added', 'Started', 'Finished'])

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
    ['Genres', book.genres.length > 0 && book.genres.map((g, i) => <Fragment key={g}>{i > 0 && ', '}<Link to="/shelves" search={{ genre: g }}>{g}</Link></Fragment>)],
    ['ISBN', book.isbn],
    ['Recommended by', book.recommendedBy && <Link to="/people/$personSlug" params={{ personSlug: slugify(book.recommendedBy) }}>{book.recommendedBy}</Link>],
  ]
  return rows.filter(row => !!row[1])
}

/** The Hardcover lists a book is on, changed with a tick. */
/** The book's topics, each leading to its timeline, and the book in Explore. */
function BookTopics({ readId, slug }: { readId: Book['readId']; slug: string }) {
  const topics = useQuery(api.topics.forBook, { readId })
  if (!topics?.length) return null
  return (
    <section className="stack" aria-labelledby="topics-heading">
      <h2 id="topics-heading" className="head">Topics</h2>
      <ul className="book-topics">
        {topics.map(t => <li key={t.slug}><Link to="/topics/$topicSlug" params={{ topicSlug: t.slug }}>{t.name}</Link></li>)}
      </ul>
      <div className="btn-row"><Link to="/explore" search={{ focus: `book:${slug}` }} className="btn"><Waypoints aria-hidden="true" strokeWidth={2.25} />See it in Explore</Link></div>
    </section>
  )
}

function Lists({ book }: { book: Book }) {
  const lists = useQuery(api.books.myLists)?.filter(l => !l.filter)
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

/**
 * The title at display size, stepping down as it grows so a long one doesn't run the page down. A subtitle after a
 * colon sits under it, smaller.
 */
function BookTitle({ title }: { title: string }) {
  const cut = title.search(/:\s/)
  const main = cut > 0 ? title.slice(0, cut) : title
  const sub = cut > 0 ? title.slice(cut + 1).trim() : ''
  const size = main.length > 60 ? 'long' : main.length > 28 ? 'mid' : undefined
  return (
    <h1 className="book-title" data-size={size}>
      {main}
      {sub && <span className="book-subtitle">{sub}</span>}
    </h1>
  )
}

export function BookPage() {
  const { bookSlug } = useParams({ from: '/books/$bookSlug/' })
  const found = useQuery(api.library.bookBySlug, { slug: bookSlug })
  const router = useRouter()
  const navigate = useNavigate()
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

  const { book, entries, prompt, note, guide, cover } = found
  const showProgress = book.status === 'reading' || book.status === 'paused'

  return (
    <div className="book-page">
      {/* A book is reached from the Desk, the shelves, a note or a link, so Back goes where the reader came from. */}
      <button type="button" className="back" onClick={() => router.history.canGoBack() ? router.history.back() : void navigate({ to: '/' })}>
        <ArrowLeft aria-hidden="true" strokeWidth={2.25} />Back
      </button>

      {/* The book's catalog entry: the cover, its status stamped across the corner, and the title at full size. */}
      <header className="book-head">
        <div className="book-cover"><Thumb book={book} /></div>
        <div className="book-state">
          <p className="stamp stamp-status" data-status={book.status}>{STAMP[book.status]}</p>
          {showProgress && (
            <>
              <p className="pct pct-large">{book.percent}%</p>
              <span className="bar" aria-hidden="true"><span style={{ transform: `scaleX(${book.percent / 100})` }} /></span>
              {book.format === 'audio' && book.seconds !== null && book.audioSeconds
                ? <p className="where">{formatClock(book.seconds)} of {formatClock(book.audioSeconds)}</p>
                : book.page !== null && book.pages && <p className="where">Page {book.page} of {book.pages}</p>}
            </>
          )}
          {book.status === 'read' && book.rating !== null && (
            <p className="book-rating"><span className="pct pct-large">{book.rating}</span> <span className="where">of 5</span></p>
          )}
          {book.status === 'read' && book.finishedAt && <p className="where">Finished {formatDate(book.finishedAt)}</p>}
        </div>
        <div className="book-name">
          <BookTitle title={book.title} />
          <p className="book-author">{book.author}</p>
        </div>
      </header>
      <hr className="rule" />

      {/* The margin is the page's hero; what the book is, and what can be done to it, sit beside it. */}
      <section className="book-margin stack" aria-labelledby="margin-heading">
        <h2 id="margin-heading" className="head">In the margin</h2>
        {entries.length > 0 ? <EntryList entries={[...entries].reverse()} readId={book.readId} limit={PREVIEW} /> : <p>Nothing in the margin yet. Add a line you underlined, or a thought about it.</p>}
        {entries.length > 0 && (
          <div className="btn-row">
            <Link to="/books/$bookSlug/entries" params={{ bookSlug: book.slug }} className="btn">{entries.length === 1 ? 'Open in notes and thoughts' : `All ${entries.length} notes and thoughts`}</Link>
          </div>
        )}
      </section>

      <div className="book-side stack">
        <div className="book-now stack">
          <QuickActions book={book} logging={logging} onLog={() => setLogging(!logging)} />
          {logging && book.status !== 'read' && <ProgressForm book={book} onSaved={label => { setLogging(false); setLogged(label) }} />}
          {logged && <p role="status">Logged: {logged}</p>}
          {prompt && <Reflection key={prompt.id} prompt={prompt} />}
          {!prompt && note && <BuddyNote key={note.id} note={note} slug={book.slug} />}
        </div>

        <section className="card" aria-labelledby="card-heading">
          <h2 id="card-heading" className="card-band">Library card</h2>
          <div className="book-controls card-controls">
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
          <dl className="card-grid">
            {bookFacts(book, entries.length).map(([label, value]) => (
              <div key={label} className="card-cell" data-wide={WIDE.has(label) || undefined} data-date={DATES.has(label) || undefined}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <ReadDates book={book} />

        <BookTopics readId={book.readId} slug={book.slug} />

        {/* The rarer things folded away: lists, the guide, the picture, and deleting the book. */}
        <div className="book-more">
          <Lists book={book} />
          <details className="tools-filters">
            <summary>Guide</summary>
            <GuideControls readId={book.readId} guide={guide} />
          </details>
          <details className="tools-filters">
            <summary>Picture</summary>
            <CoverControls readId={book.readId} book={book} cover={cover} />
          </details>
          <details className="tools-filters">
            <summary>Delete</summary>
            <DeleteBook book={book} notes={entries.length} onPage onDone={() => {}} />
          </details>
        </div>
      </div>
    </div>
  )
}
