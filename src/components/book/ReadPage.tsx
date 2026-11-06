import { Link, useParams } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorText, formatDate } from '../../lib/books'
import { fromDateInput, pagesPerDay, toDateInput } from '../../lib/progress'
import { duringRead } from '../../lib/reads'
import { daysBetween } from '../../lib/shelf'
import { NotFoundBook } from './BookPage'
import { EntryList } from './EntryList'

/** One time through a book: when, how long, and what was written along the way. Its dates can be changed here. */
export function ReadPage() {
  const { bookSlug, n } = useParams({ from: '/books/$bookSlug/reads/$n' })
  const found = useQuery(api.library.bookBySlug, { slug: bookSlug })
  const saveReadings = useMutation(api.library.saveReadings)
  const [dates, setDates] = useState<{ started: string; finished: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (found === undefined) return <p role="status">Finding the read…</p>
  if (found === null) return <NotFoundBook />
  const { book, entries } = found
  const i = Number(n) - 1
  const read = book.readings[i]
  const up = <Link to="/books/$bookSlug" params={{ bookSlug }} className="back"><ArrowLeft aria-hidden="true" strokeWidth={2.25} />{book.title}</Link>
  if (!read) {
    return (
      <div className="narrow stack">
        {up}
        <h1 className="title-head">No such read</h1>
        <p>This book has {book.readings.length === 0 ? 'no reads recorded' : `${book.readings.length} ${book.readings.length === 1 ? 'read' : 'reads'}`}.</p>
      </div>
    )
  }

  const days = daysBetween(read.startedAt, read.finishedAt)
  const pace = pagesPerDay(book.pages, days)
  const notes = duringRead(entries, book.readings, i)
  const facts: [string, string | number | null | undefined][] = [
    ['Started', read.startedAt && formatDate(read.startedAt)],
    ['Finished', read.finishedAt ? formatDate(read.finishedAt) : 'Not yet'],
    ['Days', days],
    ['Pace', pace && `${pace} pages a day`],
    ['Notes', notes.length],
  ]

  const save = async () => {
    setError(null)
    try {
      const readings = book.readings.map((r, j) => (j === i ? { hardcoverId: r.hardcoverId, startedAt: fromDateInput(dates!.started), finishedAt: fromDateInput(dates!.finished) } : r))
      await saveReadings({ readId: book.readId, readings })
      setDates(null)
    } catch (e) {
      setError(errorText(e, "That didn't save. Check your connection and try again."))
    }
  }

  return (
    <div className="narrow stack">
      {up}
      <p className="eyebrow">{book.readings.length > 1 ? `Read ${n} of ${book.readings.length}` : 'The read'}</p>
      <h1 className="book-title">{book.title}</h1>
      <dl className="card-grid read-facts">
        {facts.filter(([, v]) => v).map(([label, value]) => <div key={label} className="card-cell"><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {dates ? (
        <form className="stack" onSubmit={e => { e.preventDefault(); void save() }}>
          <fieldset className="read-row">
            <legend className="sr-only">Dates of this read</legend>
            <div className="field"><label htmlFor="read-start">Started</label><input id="read-start" type="date" value={dates.started} onChange={e => setDates({ ...dates, started: e.target.value })} /></div>
            <div className="field"><label htmlFor="read-finish">Finished</label><input id="read-finish" type="date" value={dates.finished} onChange={e => setDates({ ...dates, finished: e.target.value })} /></div>
          </fieldset>
          <div className="btn-row">
            <button type="submit" className="btn btn-solid">Save dates</button>
            <button type="button" className="btn" onClick={() => setDates(null)}>Cancel</button>
          </div>
          {error && <p role="alert">{error}</p>}
        </form>
      ) : (
        <div className="btn-row"><button type="button" className="btn" onClick={() => setDates({ started: toDateInput(read.startedAt), finished: toDateInput(read.finishedAt) })}>Change the dates</button></div>
      )}
      <hr className="rule" />
      <h2 className="head">Written during this read</h2>
      {notes.length > 0 ? <EntryList entries={[...notes].reverse()} readId={book.readId} /> : <p>Nothing written while reading it this time.</p>}
    </div>
  )
}
