import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorText, type Book } from '../../lib/books'
import { formatClock, toClock, unitFor, unitsFor, type Unit } from '../../lib/progress'

const LABEL: Record<Unit, string> = { page: 'Page', time: 'Time', percent: '%' }

/** Logs a place in the book, by page, time or percent. The choice is remembered per book. */
export function ProgressForm({ book, onSaved }: { book: Book; onSaved?: (label: string) => void }) {
  const logProgress = useMutation(api.library.logProgress)
  const setProgressUnit = useMutation(api.library.setProgressUnit)
  const units = unitsFor(book)
  const [unit, setUnit] = useState(unitFor(book))
  const clock = toClock(book.seconds ?? 0)
  const [page, setPage] = useState(String(book.page ?? ''))
  const [hours, setHours] = useState(String(clock.hours))
  const [minutes, setMinutes] = useState(String(clock.minutes))
  const [percent, setPercent] = useState(String(book.percent))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const seconds = Number(hours || 0) * 3600 + Number(minutes || 0) * 60
  const at = unit === 'page' ? { page: Number(page) } : unit === 'time' ? { seconds } : { percent: Number(percent) }
  const portion = unit === 'page' ? Number(page) / book.pages! : unit === 'time' ? seconds / book.audioSeconds! : Number(percent) / 100
  const valid = Number.isFinite(portion) && portion >= 0 && (unit !== 'page' || page !== '') && (unit !== 'percent' || percent !== '')
  const atEnd = valid && portion >= 1

  const choose = (next: Unit) => {
    setUnit(next)
    void setProgressUnit({ readId: book.readId, unit: next })
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await logProgress({ readId: book.readId, ...at })
      navigator.vibrate?.(15)
      onSaved?.(atEnd ? 'Finished' : unit === 'page' ? `Page ${page}` : unit === 'time' ? formatClock(seconds) : `${percent}%`)
    } catch (e) {
      setError(errorText(e, "That didn't save. Check your connection and try again."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="log box" onSubmit={e => { e.preventDefault(); if (valid) void save() }}>
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
            <input type="number" inputMode="numeric" min={0} max={book.pages!} step={1} value={page} onChange={e => setPage(e.target.value)} />
            <span className="log-of">of {book.pages}</span>
          </label>
        )}
        {unit === 'time' && (
          <>
            <label className="log-field">
              <span>Hours</span>
              <input type="number" inputMode="numeric" min={0} step={1} value={hours} onChange={e => setHours(e.target.value)} />
            </label>
            <label className="log-field">
              <span>Minutes</span>
              <input type="number" inputMode="numeric" min={0} max={59} step={1} value={minutes} onChange={e => setMinutes(e.target.value)} />
            </label>
            <span className="log-of">of {formatClock(book.audioSeconds!)}</span>
          </>
        )}
        {unit === 'percent' && (
          <label className="log-field">
            <span>Percent</span>
            <input type="number" inputMode="numeric" min={0} max={100} step={1} value={percent} onChange={e => setPercent(e.target.value)} />
          </label>
        )}
      </div>

      {units.length === 1 && <p className="where">Hardcover has no length for this book, so it's logged by percent.</p>}

      <button type="submit" className="btn btn-solid" disabled={saving || !valid}>{saving ? 'Saving…' : atEnd ? 'Save and mark finished' : 'Save progress'}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
