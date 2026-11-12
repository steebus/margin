import { Link, useParams } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { errorText } from '../../lib/books'
import { faceOf, spineOf, spineTitle } from '../../lib/pile'
import { NotFoundBook } from './BookPage'
import { EntryText, entryLabel, type Entry } from './EntryList'

export const RATINGS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

/** The page for writing a review of a finished book, with the reader's notes and buddy talk beside it. */
export function FinishReview() {
  const { bookSlug } = useParams({ from: '/books/$bookSlug/review' })
  const found = useQuery(api.library.bookBySlug, { slug: bookSlug })
  if (found === undefined) return <p role="status">Finding the book…</p>
  if (found === null) return <NotFoundBook />
  const { book, entries } = found
  const back = <Link to="/books/$bookSlug" params={{ bookSlug }} className="back"><ArrowLeft aria-hidden="true" strokeWidth={2.25} />{book.title}</Link>
  if (book.status !== 'read') {
    return (
      <div className="narrow stack">
        {back}
        <h1 className="title-head">Not finished yet</h1>
      </div>
    )
  }
  const review = entries.find(e => e.kind === 'review')
  const notes = [...entries].reverse().filter(e => e.kind !== 'review')
  return (
    <div className="narrow stack">
      {back}
      <PileDrop book={book} />
      <h1 className="book-title">Your review</h1>
      <p>{book.title}, {book.author}</p>
      <ReviewForm key={book.readId} readId={book.readId} slug={bookSlug} rating={book.rating} text={review?.text ?? ''} />
      <Looking readId={book.readId} notes={notes} />
    </div>
  )
}

/** The finished book's own spine, as it will lie in the Pile, dropping onto the top of it. Decoration: the words repeat the page. */
function PileDrop({ book }: { book: { slug: string; title: string; author: string; pages: number | null; genres: string[] } }) {
  const spine = spineOf(book.slug, book.pages)
  return (
    <div className="pile-drop" aria-hidden="true">
      <div className="spine" data-look={spine.look} data-thin={spine.thin || undefined} style={{ height: spine.height, width: `${spine.width}%`, marginLeft: `${((100 - spine.width) * spine.shift) / 100}%` }}>
        <span className="spine-etch" />
        <span className="spine-label">
          <span className="spine-title" data-face={faceOf(book.genres)} style={{ WebkitLineClamp: spine.titleLines, '--title': `${spine.titleSize}px` } as React.CSSProperties}>{spineTitle(book.title)}</span>
          <span className="spine-author">{book.author}</span>
        </span>
      </div>
    </div>
  )
}

function ReviewForm({ readId, slug, rating, text }: { readId: Id<'reads'>; slug: string; rating: number | null; text: string }) {
  const saveReview = useMutation(api.library.saveReview)
  const [words, setWords] = useState(text)
  const [stars, setStars] = useState<number | null>(rating)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setState('saving')
    setError(null)
    try {
      await saveReview({ readId, text: words, rating: stars })
      setState('saved')
    } catch (e) {
      setError(errorText(e, "That didn't save. Your words are still here: check your connection and try again."))
      setState('idle')
    }
  }

  return (
    <form className="stack" onSubmit={e => { e.preventDefault(); void save() }}>
      <div className="field">
        <label htmlFor="review-rating">Rating</label>
        <select id="review-rating" value={stars ?? ''} onChange={e => { setStars(e.target.value ? Number(e.target.value) : null); setState('idle') }}>
          <option value="">Not rated</option>
          {[...RATINGS].reverse().map(r => <option key={r} value={r}>{r} {r === 1 ? 'star' : 'stars'}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="review-text">Review</label>
        <textarea id="review-text" className="hand" rows={10} value={words} onChange={e => { setWords(e.target.value); setState('idle') }} />
      </div>
      <div className="btn-row">
        <button type="submit" className="btn btn-solid" disabled={state === 'saving'}>{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save review'}</button>
        <Link to="/books/$bookSlug" params={{ bookSlug: slug }} className="btn">Done</Link>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

/** What the reader has written and said about the book, to hand while the review is written. */
function Looking({ readId, notes }: { readId: Id<'reads'>; notes: Entry[] }) {
  const thread = useQuery(api.buddy.thread, { readId })
  const turns = (thread?.turns ?? []).filter(t => t.state === 'done' && t.text)
  return (
    <>
      {notes.length > 0 && (
        <section className="stack" aria-labelledby="review-notes">
          <h2 id="review-notes" className="selected-title">Your notes</h2>
          <ul className="stack">
            {notes.map(e => (
              <li key={e.id}>
                <p className="where">{entryLabel(e) || (e.kind === 'excerpt' ? 'Excerpt' : 'Note')}</p>
                <EntryText entry={e} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {turns.length > 0 && (
        <section className="stack" aria-labelledby="review-buddy">
          <h2 id="review-buddy" className="selected-title">With the buddy</h2>
          <ul className="stack">
            {turns.map(t => (
              <li key={t.id}>
                <p className="where">{t.role === 'buddy' ? 'Buddy' : 'You'}</p>
                <p className={t.role === 'buddy' ? undefined : 'hand'}>{t.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
