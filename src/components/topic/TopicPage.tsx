import { Link, useParams } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { EyeOff, Waypoints } from 'lucide-react'
import { Fragment, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorText, formatDate } from '../../lib/books'
import { Thumb } from '../thumb/Thumb'

type Page = NonNullable<FunctionReturnType<typeof api.topics.page>>
type Item = Page['items'][number]
type Card = Page['books'][number]

const DID: Record<string, string> = { read: 'Finished', reading: 'Reading', paused: 'Paused', dnf: 'Put down' }
const yearOf = (at: number | null) => (at ? new Date(at).getFullYear() : null)

function BookItem({ book }: { book: Card }) {
  return (
    <Link to="/books/$bookSlug" params={{ bookSlug: book.slug }} className="tl-book">
      <Thumb book={book} />
      <span className="tl-book-text">
        <span className="tl-did">{DID[book.status] ?? 'Read'}{book.at ? ` · ${formatDate(book.at)}` : ''}</span>
        <span className="selected-title">{book.title}</span>
        <span className="where">{book.author}</span>
        <span className="tl-why">{book.why}</span>
      </span>
    </Link>
  )
}

function EntryItem({ item }: { item: Extract<Item, { kind: 'entry' }> }) {
  const { entry } = item
  return (
    <Link to="/e/$entryId" params={{ entryId: entry.id }} className="tl-entry note-link">
      <span className="tl-did">{entry.how === 'tagged' ? 'Tagged' : 'Mentioned'} · {formatDate(item.at)}</span>
      {entry.kind === 'excerpt'
        ? <span className="book-voice tl-quote"><span>{entry.text}</span></span>
        : <span className="hand">{entry.text}</span>}
      <span className="where">{entry.where}</span>
    </Link>
  )
}

/** One topic as a timeline: what Steve read on it and what he wrote about it, newest first (design doc, Steve's B). */
export function TopicPage() {
  const { topicSlug } = useParams({ from: '/topics/$topicSlug' })
  const page = useQuery(api.topics.page, { slug: topicSlug })
  const hide = useMutation(api.topics.hide)
  const unhide = useMutation(api.topics.unhide)
  const [all, setAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (page === undefined) return <p role="status">Gathering the topic…</p>
  if (page === null) {
    return (
      <div className="narrow stack">
        <h1 className="title-head">No such topic</h1>
        <p>Nothing on your shelves is filed under this. The tag may have changed.</p>
        <div className="btn-row"><Link to="/topics" className="btn btn-solid">All topics</Link></div>
      </div>
    )
  }

  const act = async (work: () => Promise<unknown>) => {
    setError(null)
    try { await work() } catch (e) { setError(errorText(e, "That didn't save. Check your connection and try again.")) }
  }
  const books = page.books.length
  const span = page.years && (page.years[0] === page.years[1] ? `${page.years[0]}` : `${page.years[0]}–${page.years[1]}`)

  return (
    <div className="narrow stack topic-page">
      <Link to="/topics" className="where topic-up">Topics</Link>
      <h1 className="title-head" data-size={page.name.length > 16 ? 'long' : undefined}>{page.name}</h1>
      <p className="topic-meta">
        {[`${books} ${books === 1 ? 'book' : 'books'}`, page.notes && `${page.notes} ${page.notes === 1 ? 'note' : 'notes'}`, span].filter(Boolean).join(' · ')}
      </p>
      <div className="btn-row">
        <Link to="/explore" search={{ focus: `topic:${page.slug}` }} className="btn"><Waypoints aria-hidden="true" strokeWidth={2.25} />Explore</Link>
        <button type="button" className="btn" aria-pressed={all} onClick={() => setAll(!all)}>{all ? 'Timeline' : 'All books'}</button>
        {page.hidden
          ? <button type="button" className="btn" onClick={() => void act(() => unhide({ key: page.key }))}>Show again</button>
          : <button type="button" className="btn" onClick={() => void act(() => hide({ slug: page.slug }))}><EyeOff aria-hidden="true" strokeWidth={2.25} />Hide</button>}
      </div>
      {page.hidden && <p className="where">Hidden: it's out of Explore, the topics list and the buddy's view.</p>}
      {error && <p role="alert">{error}</p>}
      <hr className="rule" />

      {all ? (
        <ul className="tl-list">
          {page.books.map(b => <li key={b.readId}><BookItem book={b} /></li>)}
        </ul>
      ) : (
        <>
          {page.items.length === 0 && <p>Nothing read or written on this yet. The books below are waiting.</p>}
          <ol className="timeline">
            {page.items.map((item, i) => {
              const year = yearOf(item.at)
              const prev = i > 0 ? yearOf(page.items[i - 1].at) : undefined
              return (
                <Fragment key={item.key}>
                  {year !== prev && <li className="year tl-year" aria-hidden="true">{year ?? 'Undated'}</li>}
                  <li className="tl-item" data-kind={item.kind}>
                    {item.kind === 'book' ? <BookItem book={item.book} /> : <EntryItem item={item} />}
                  </li>
                </Fragment>
              )
            })}
          </ol>
          {page.tbr.length > 0 && (
            <section className="stack" aria-labelledby="tbr-head">
              <h2 id="tbr-head" className="head">On your TBR</h2>
              <ul className="tl-list">{page.tbr.map(b => <li key={b.readId}><BookItem book={b} /></li>)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
