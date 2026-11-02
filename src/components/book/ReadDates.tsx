import { useMutation } from 'convex/react'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorText, formatDate, type Book } from '../../lib/books'
import { fromDateInput, toDateInput } from '../../lib/progress'
import { daysBetween } from '../../lib/shelf'

type Row = { key: number; hardcoverId?: number; started: string; finished: string }

const span = (r: Book['readings'][number]) => {
  const days = daysBetween(r.startedAt, r.finishedAt)
  if (!r.finishedAt) return r.startedAt ? `Started ${formatDate(r.startedAt)}, not finished` : 'No dates recorded'
  return (r.startedAt ? `${formatDate(r.startedAt)} to ` : 'Finished ') + formatDate(r.finishedAt) + (days ? `, ${days} ${days === 1 ? 'day' : 'days'}` : '')
}

/** Each time through the book, with dates that can be changed here and go to Hardcover. */
export function ReadDates({ book }: { book: Book }) {
  const saveReadings = useMutation(api.library.saveReadings)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = () => {
    setError(null)
    setRows(book.readings.map((r, key) => ({ key, hardcoverId: r.hardcoverId, started: toDateInput(r.startedAt), finished: toDateInput(r.finishedAt) })))
  }
  const edit = (key: number, change: Partial<Row>) => setRows(rows!.map(r => (r.key === key ? { ...r, ...change } : r)))

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveReadings({
        readId: book.readId,
        readings: rows!.map(r => ({ hardcoverId: r.hardcoverId, startedAt: fromDateInput(r.started), finishedAt: fromDateInput(r.finished) })),
      })
      setRows(null)
    } catch (e) {
      setError(errorText(e, "That didn't save. Check your connection and try again."))
    } finally {
      setSaving(false)
    }
  }

  if (!rows) {
    return (
      <section className="stack" aria-labelledby="reads-heading">
        <h2 id="reads-heading" className="head">Reads</h2>
        {book.readings.length > 0 ? (
          <ol className="reads">{book.readings.map((r, i) => <li key={r.hardcoverId ?? i}>{span(r)}</li>)}</ol>
        ) : <p>No reads recorded yet.</p>}
        <div className="btn-row"><button type="button" className="btn" onClick={start}>Edit dates</button></div>
      </section>
    )
  }

  return (
    <form className="stack" aria-labelledby="reads-heading" onSubmit={e => { e.preventDefault(); void save() }}>
      <h2 id="reads-heading" className="head">Reads</h2>
      {rows.map((r, i) => (
        <fieldset key={r.key} className="read-row">
          <legend className="sr-only">Read {i + 1}</legend>
          <div className="field">
            <label htmlFor={`start-${r.key}`}>Started</label>
            <input id={`start-${r.key}`} type="date" value={r.started} onChange={e => edit(r.key, { started: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`finish-${r.key}`}>Finished</label>
            <input id={`finish-${r.key}`} type="date" value={r.finished} onChange={e => edit(r.key, { finished: e.target.value })} />
          </div>
          <button type="button" className="entry-delete" aria-label={`Remove read ${i + 1}`} onClick={() => setRows(rows.filter(x => x.key !== r.key))}>
            <Trash2 aria-hidden="true" strokeWidth={2} />
          </button>
        </fieldset>
      ))}
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => setRows([...rows, { key: Math.max(-1, ...rows.map(r => r.key)) + 1, started: '', finished: '' }])}>
          <Plus aria-hidden="true" strokeWidth={2.25} />Add a read
        </button>
        <button type="submit" className="btn btn-solid" disabled={saving}>{saving ? 'Saving…' : 'Save dates'}</button>
        <button type="button" className="btn" onClick={() => setRows(null)}>Cancel</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
