import { Link } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { sameBook } from '../../../convex/lib/match'
import { errorText } from '../../lib/books'

type Card = FunctionReturnType<typeof api.review.waiting>[number]
type Hit = FunctionReturnType<typeof api.books.search>[number]
type Status = 'read' | 'reading' | 'tbr'
const STATUSES: { id: Status; label: string }[] = [{ id: 'read', label: 'Read' }, { id: 'reading', label: 'Reading' }, { id: 'tbr', label: 'To read' }]
const SOURCE = { playbooks: 'Play Books' } as const

/** One waiting book: how far the reader got, which book it is on Hardcover, then add it or leave it out for good. */
function ReviewCard({ card, left }: { card: Card; left: number }) {
  const search = useAction(api.books.search)
  const addBooks = useMutation(api.books.addBooks)
  const placed = useMutation(api.review.placed)
  const leave = useMutation(api.review.leave)
  const [status, setStatus] = useState<Status | null>(card.status)
  const [words, setWords] = useState(card.isbn ?? `${card.title} ${card.author.split(',')[0]}`.trim())
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const look = async (q: string) => {
    setHits(null)
    setError(null)
    try {
      const found = (await search({ q })).slice(0, 5)
      setHits(found)
      const sure = found.find(h => !h.onShelves && sameBook({ title: h.book.title, author: h.book.authors[0] ?? '' }, card))
      setPicked(sure?.book.hardcoverId ?? null)
    } catch (e) {
      setHits([])
      setError(errorText(e, "Hardcover's search didn't answer. Try again."))
    }
  }
  useEffect(() => { void look(words) }, [card.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (work: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (e) {
      setError(errorText(e, "That didn't save. Check your connection and try again."))
      setBusy(false)
    }
  }
  const hit = hits?.find(h => h.book.hardcoverId === picked)
  // Merging into a book already on the shelves: addBooks hands back its read untouched, so no status is needed.
  const merge = !!hit?.onShelves
  const add = () => act(async () => {
    if (!hit || (!status && !merge)) return
    const [added] = await addBooks({ books: [hit.book], status: status ?? 'read', format: 'ebook', undated: status === 'read' })
    await placed({ id: card.id, readId: added.readId })
  })

  return (
    <article className="box stack" aria-label={card.title}>
      <p className="where">{left} waiting · from {SOURCE[card.source]}</p>
      <h2 className="book-title" data-size={card.title.length > 28 ? 'long' : 'mid'}>{card.title}</h2>
      {card.author && <p className="book-author">{card.author}</p>}
      <p>{card.notes ? `${card.notes} ${card.notes === 1 ? 'highlight or note comes' : 'highlights and notes come'} with it.` : 'No notes with it.'}</p>

      <div className="segments" role="group" aria-label="How far you got">
        {STATUSES.map(s => <button key={s.id} type="button" aria-pressed={status === s.id} onClick={() => setStatus(s.id)}>{s.label}</button>)}
      </div>

      <form className="stack" onSubmit={e => { e.preventDefault(); void look(words) }}>
        <div className="field">
          <label htmlFor="review-search">Which book on Hardcover</label>
          <input id="review-search" value={words} onChange={e => setWords(e.target.value)} />
        </div>
        <div className="btn-row"><button type="submit" className="btn">Search</button></div>
      </form>
      {hits === null ? <p role="status">Looking on Hardcover…</p> : hits.length === 0 ? <p>Nothing found. Try other words.</p> : (
        <fieldset className="stack">
          <legend className="where">Hardcover's matches</legend>
          {hits.map(h => (
            <label key={h.book.hardcoverId} className="check">
              <input type="radio" name="review-hit" checked={picked === h.book.hardcoverId} onChange={() => setPicked(h.book.hardcoverId)} />
              {h.book.title}, {h.book.authors.join(', ') || 'unknown author'}{h.book.year ? ` (${h.book.year})` : ''}{h.onShelves ? ', already on your shelves, merge into it' : ''}
            </label>
          ))}
        </fieldset>
      )}

      <div className="btn-row">
        <button type="button" className="btn btn-solid" disabled={busy || !hit || (!status && !merge)} onClick={() => void add()}>{merge ? (busy ? 'Merging…' : 'Merge') : busy ? 'Adding…' : 'Add'}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => void act(() => leave({ id: card.id }))}>Leave out</button>
      </div>
      {!status && hit && !merge && <p className="where">Choose how far you got to add it.</p>}
      {error && <p role="alert">{error}</p>}
    </article>
  )
}

/** Books an import couldn't place, waiting for the reader one at a time (SPEC 3.5, the review queue). */
export function Review() {
  const cards = useQuery(api.review.waiting)
  return (
    <div className="narrow stack">
      <h1 className="title-head">Review</h1>
      <hr className="rule" />
      {cards === undefined && <p role="status">Finding what's waiting…</p>}
      {cards?.length === 0 && (
        <div className="box stack">
          <p>Nothing waiting. Books an import can't place for sure wait here.</p>
          <div className="btn-row"><Link to="/settings" search={{ tab: 'integrations' }} className="btn">Go to Settings</Link></div>
        </div>
      )}
      {cards && cards.length > 0 && <ReviewCard key={cards[0].id} card={cards[0]} left={cards.length} />}
    </div>
  )
}
