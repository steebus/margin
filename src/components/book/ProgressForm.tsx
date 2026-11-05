import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Book } from '../../lib/books'
import { movedTo, sendQuietly } from '../../lib/quiet'
import { formatClock, toClock, unitFor, unitsFor, type Unit } from '../../lib/progress'

const LABEL: Record<Unit, string> = { page: 'Page', time: 'Time', percent: '%' }

/** Logs a place in the book, by page, time or percent. The choice is remembered per book. */
export function ProgressForm({ book, onSaved }: { book: Book; onSaved?: (label: string) => void }) {
  // The Desk and the book page show the new place at once; the server's answer replaces it.
  const logProgress = useMutation(api.library.logProgress).withOptimisticUpdate((store, args) => {
    const books = store.getQuery(api.library.myBooks, {})
    if (books) store.setQuery(api.library.myBooks, {}, books.map(b => (b.readId === args.readId ? movedTo(b, args) : b)))
    const found = store.getQuery(api.library.bookBySlug, { slug: book.slug })
    if (found) store.setQuery(api.library.bookBySlug, { slug: book.slug }, { ...found, book: movedTo(found.book, args) })
  })
  const setProgressUnit = useMutation(api.library.setProgressUnit)
  const units = unitsFor(book)
  const [unit, setUnit] = useState(unitFor(book))
  const clock = toClock(book.seconds ?? 0)
  // Empty, with where the reader was as the placeholder: they type the new place without clearing the old one.
  const [page, setPage] = useState('')
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [percent, setPercent] = useState('')

  // Typing only minutes keeps the hour the reader was in; typing only hours means on the hour.
  const seconds = Number(hours || clock.hours) * 3600 + Number(minutes || 0) * 60
  const at = unit === 'page' ? { page: Number(page) } : unit === 'time' ? { seconds } : { percent: Number(percent) }
  const portion = unit === 'page' ? Number(page) / book.pages! : unit === 'time' ? seconds / book.audioSeconds! : Number(percent) / 100
  const typed = unit === 'page' ? page !== '' : unit === 'time' ? hours !== '' || minutes !== '' : percent !== ''
  const valid = typed && Number.isFinite(portion) && portion >= 0
  const atEnd = valid && portion >= 1

  const choose = (next: Unit) => {
    setUnit(next)
    void setProgressUnit({ readId: book.readId, unit: next })
  }

  // Done the moment it's tapped (Steve, 2026-11-06). The write goes quietly; only a refusal speaks up.
  const save = () => {
    const args = { readId: book.readId, ...at }
    const where = unit === 'page' ? `page ${page}` : unit === 'time' ? formatClock(seconds) : `${percent}%`
    sendQuietly('logProgress', args, () => logProgress(args), { message: `${book.title} wasn't moved to ${where}.` })
    navigator.vibrate?.(15)
    onSaved?.(!navigator.onLine ? 'Kept for when you\'re online' : atEnd ? 'Finished' : unit === 'page' ? `Page ${page}` : where)
  }

  return (
    <form className="log box" onSubmit={e => { e.preventDefault(); if (valid) save() }}>
      <p className="log-title">{book.title}</p>

      {units.length > 1 && (
        <div className="segments" role="group" aria-label="Log by">
          {units.map(u => <button key={u} type="button" aria-pressed={unit === u} onClick={() => choose(u)}>{LABEL[u]}</button>)}
        </div>
      )}

      <div className="log-fields">
        {unit === 'page' && (
          <label className="log-field">
            <span>Page</span>
            <input type="number" inputMode="numeric" min={0} max={book.pages!} step={1} value={page} placeholder={book.page !== null ? String(book.page) : undefined} autoFocus onChange={e => setPage(e.target.value)} />
            <span className="log-of">of {book.pages}</span>
          </label>
        )}
        {unit === 'time' && (
          <>
            <label className="log-field">
              <span>Hours</span>
              <input type="number" inputMode="numeric" min={0} step={1} value={hours} placeholder={String(clock.hours)} autoFocus onChange={e => setHours(e.target.value)} />
            </label>
            <label className="log-field">
              <span>Minutes</span>
              <input type="number" inputMode="numeric" min={0} max={59} step={1} value={minutes} placeholder={String(clock.minutes)} onChange={e => setMinutes(e.target.value)} />
            </label>
            <span className="log-of">of {formatClock(book.audioSeconds!)}</span>
          </>
        )}
        {unit === 'percent' && (
          <label className="log-field">
            <span>Percent</span>
            <input type="number" inputMode="numeric" min={0} max={100} step={1} value={percent} placeholder={String(book.percent)} autoFocus onChange={e => setPercent(e.target.value)} />
          </label>
        )}
      </div>

      {units.length === 1 && <p className="where">Hardcover has no length for this book, so it's logged by percent.</p>}

      <button type="submit" className="btn btn-solid" disabled={!valid}>{atEnd ? 'Save and mark finished' : 'Save progress'}</button>
    </form>
  )
}
