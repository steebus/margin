import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useBooks } from '../../lib/offline'
import { bestSources, byAuthor, byDays, byFormat, byGenre, byMonth, byRating, byYear, finishesOf, headline, tbrAge, type Row } from '../../lib/stats'

/** Tapping or hovering a column says what it holds. One line under the chart, so it can't run off a phone's edge. */
function Columns({ title, rows, unit }: { title: string; rows: Row[]; unit: string }) {
  const [picked, setPicked] = useState<number | null>(null)
  const max = Math.max(1, ...rows.map(r => r.value))
  const last = rows.length - 1
  const shown = rows[picked ?? last]
  const step = rows.length > 16 ? 5 : rows.length > 8 ? 2 : 1
  return (
    <figure className="chart">
      <figcaption className="year"><span>{title}</span></figcaption>
      <div className="columns" onPointerLeave={() => setPicked(null)}>
        {rows.map((row, i) => (
          <button
            key={row.label}
            type="button"
            className="column"
            aria-label={`${row.label}: ${row.note ?? `${row.value} ${unit}`}`}
            aria-pressed={picked === i}
            onPointerEnter={() => setPicked(i)}
            onFocus={() => setPicked(i)}
            onClick={() => setPicked(i)}
          >
            <span className="column-track"><span className="column-bar" style={{ height: `${(row.value / max) * 100}%` }} /></span>
            <span className="column-label">{(i === last || (last - i) % step === 0) && (step === 1 ? row.label : row.label.slice(-2))}</span>
          </button>
        ))}
      </div>
      {shown && <p className="chart-readout" role="status"><strong>{shown.label}</strong> {shown.note ?? `${shown.value.toLocaleString('en-GB')} ${unit}`}</p>}
    </figure>
  )
}

/** Longer labels read best across, and every bar carries its own number. */
function Bars({ title, rows, note }: { title: string; rows: Row[]; note?: string }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  if (!rows.some(r => r.value > 0)) return null
  return (
    <figure className="chart">
      <figcaption className="year"><span>{title}</span></figcaption>
      {note && <p className="where">{note}</p>}
      <dl className="bars">
        {rows.map(row => (
          <div key={row.label} className="bar-row" title={row.note}>
            <dt>{row.label}</dt>
            <dd>
              <span className="bar-fill" style={{ width: `${(row.value / max) * 100}%` }} />
              <span className="bar-value">{row.value.toLocaleString('en-GB')}</span>
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  )
}

export function Stats() {
  const { range } = useSearch({ from: '/stats' })
  const navigate = useNavigate({ from: '/stats' })
  const books = useBooks()

  if (books === undefined) return <p role="status">Adding it all up…</p>

  const all = finishesOf(books)
  const years = [...new Set(all.map(f => f.year))].sort((a, b) => b - a)
  const year = range && years.includes(Number(range)) ? Number(range) : null
  const finishes = year ? all.filter(f => f.year === year) : all
  const finished = [...new Set(finishes.map(f => f.book))]
  const top = headline(finishes)

  return (
    <div className="stack narrow stats">
      <Link to="/shelves" className="back"><ArrowLeft aria-hidden="true" strokeWidth={2.25} />Shelves</Link>
      <h1 className="title-head">Stats</h1>

      <div className="field stats-range">
        <label htmlFor="stats-range">Which years</label>
        <select id="stats-range" value={year ?? ''} onChange={e => navigate({ search: { range: e.target.value || undefined }, replace: true })}>
          <option value="">All of them</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <dl className="tiles">
        <div><dt>Books finished</dt><dd>{top.books.toLocaleString('en-GB')}</dd></div>
        <div><dt>Pages</dt><dd>{top.pages.toLocaleString('en-GB')}</dd></div>
        <div><dt>Usual days to read</dt><dd>{top.medianDays ?? 'No dates'}</dd></div>
      </dl>

      {finishes.length === 0 && <p>Nothing finished yet. These fill up as you finish books.</p>}

      {year
        ? <Columns title={`Books by month, ${year}`} rows={byMonth(finishes)} unit="books" />
        : (
          <>
            <Columns title="Books by year" rows={byYear(all, 'books')} unit="books" />
            <Columns title="Pages by year" rows={byYear(all, 'pages')} unit="pages" />
          </>
        )}
      <Bars title="Ratings" rows={byRating(finished)} />
      <Bars title="Time to finish" rows={byDays(finishes)} note={`Of the ${finishes.filter(f => f.days !== null).length} with both dates.`} />
      <Bars title="Genres" rows={byGenre(finishes)} />
      <Bars title="Most-read authors" rows={byAuthor(finishes)} />
      <Bars title="Format" rows={byFormat(finishes)} />
      <Bars title="Whose recommendations land" rows={bestSources(books)} note="Average rating, for anyone with two or more rated books." />
      {!year && <Bars title="How long your TBR has waited" rows={tbrAge(books, Date.now())} />}
    </div>
  )
}
