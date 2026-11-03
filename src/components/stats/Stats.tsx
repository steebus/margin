import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { sortBooks } from '../../lib/shelf'
import { Catalog } from '../shelf/BookList'
import { useBooks } from '../../lib/offline'
import { bestSources, byAuthor, byAuthorCountry, byAuthorGender, byDays, byFormat, byGenre, byMonth, byRating, byYear, finishesOf, gaps, headline, tbrAge, type Row } from '../../lib/stats'
import type { Book } from '../../lib/books'

/** The books behind a mark. */
function Behind({ row, onClose }: { row: Row; onClose: () => void }) {
  return (
    <div className="chart-books">
      <p><strong>{row.label}:</strong> {row.books.length} {row.books.length === 1 ? 'book' : 'books'} <button type="button" className="text-link" onClick={onClose}>Close</button></p>
      <Catalog books={sortBooks(row.books)} size="small" />
    </div>
  )
}

/** Tapping or hovering a column says what it holds. One line under the chart, so it can't run off a phone's edge. */
function Columns({ title, rows, unit }: { title: string; rows: Row[]; unit: string }) {
  const [picked, setPicked] = useState<number | null>(null)
  const [open, setOpen] = useState<number | null>(null)
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
            aria-pressed={open === i}
            onPointerEnter={() => setPicked(i)}
            onFocus={() => setPicked(i)}
            onClick={() => { setPicked(i); setOpen(open === i ? null : i) }}
          >
            <span className="column-track"><span className="column-bar" style={{ height: `${(row.value / max) * 100}%` }} /></span>
            <span className="column-label">{(i === last || (last - i) % step === 0) && (step === 1 ? row.label : row.label.slice(-2))}</span>
          </button>
        ))}
      </div>
      {shown && <p className="chart-readout" role="status"><strong>{shown.label}</strong> {shown.note ?? `${shown.value.toLocaleString('en-GB')} ${unit}`}</p>}
      {open !== null && rows[open].books.length > 0 && <Behind row={rows[open]} onClose={() => setOpen(null)} />}
    </figure>
  )
}

/** Longer labels read best across, and every bar carries its own number. */
function Bars({ title, rows, note }: { title: string; rows: Row[]; note?: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const max = Math.max(1, ...rows.map(r => r.value))
  const opened = rows.find(r => r.label === open)
  if (!rows.some(r => r.value > 0)) return null
  return (
    <figure className="chart">
      <figcaption className="year"><span>{title}</span></figcaption>
      {note && <p className="where">{note}</p>}
      <div className="bars">
        {rows.map(row => (
          <button
            key={row.label}
            type="button"
            className="bar-row"
            title={row.note}
            disabled={!row.books.length}
            aria-pressed={open === row.label}
            onClick={() => setOpen(open === row.label ? null : row.label)}
          >
            <span className="bar-label">{row.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(row.value / max) * 100}%` }} />
              <span className="bar-value">{row.value.toLocaleString('en-GB')}</span>
            </span>
          </button>
        ))}
      </div>
      {opened && <Behind row={opened} onClose={() => setOpen(null)} />}
    </figure>
  )
}

/** Books with gaps worth filling, each a tap away from where it's edited. What's filled in there goes to Hardcover. */
function MissingDetails({ books }: { books: Book[] }) {
  const found = gaps(books)
  return (
    <section className="stack" aria-labelledby="gaps-heading">
      <h2 id="gaps-heading" className="head">Missing details</h2>
      {found.length === 0
        ? <p>Every finished book has its dates and a rating.</p>
        : found.map(g => (
          <details key={g.key} className="gaps">
            <summary>{g.label} <span className="where">{g.books.length.toLocaleString('en-GB')}</span></summary>
            <ul className="gaps-list">
              {g.books.map(b => (
                <li key={b.readId}>
                  <Link to="/books/$bookSlug" params={{ bookSlug: b.slug }} hash={g.key === 'rating' ? 'book-rating' : 'reads-heading'}>{b.title}</Link>
                  <span className="where"> {b.author}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
    </section>
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
      <Bars title="Authors' gender" rows={byAuthorGender(finishes)} note="The first author of each book, as Hardcover records them." />
      <Bars title="Where authors are from" rows={byAuthorCountry(finishes)} note="From each author's location on Hardcover." />
      <Bars title="Format" rows={byFormat(finishes)} />
      <Bars title="Whose recommendations land" rows={bestSources(books)} note="Average rating, for anyone with two or more rated books." />
      {!year && <Bars title="How long your TBR has waited" rows={tbrAge(books, Date.now())} />}
      {!year && <MissingDetails books={books} />}
    </div>
  )
}
