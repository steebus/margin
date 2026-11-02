import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Star, StarHalf } from 'lucide-react'
import { useState } from 'react'
import { Tick } from './Marks'
import { books, type Book, type Status } from './sample'
import { Thumb } from './Thumb'

const statuses: { id: Status | undefined; label: string }[] = [
  { id: undefined, label: 'All' },
  { id: 'reading', label: 'Reading' },
  { id: 'tbr', label: 'TBR' },
  { id: 'read', label: 'Read' },
  { id: 'paused', label: 'Paused' },
  { id: 'dnf', label: 'Stopped' },
]

const sizes = [
  { id: 'small', label: 'Small', px: 68 },
  { id: 'medium', label: 'Medium', px: 88 },
  { id: 'large', label: 'Large', px: 116 },
] as const
type Size = (typeof sizes)[number]['id']

const SIZE_KEY = 'margin.catalogSize'

const savedSize = (): Size => {
  try {
    const value = localStorage.getItem(SIZE_KEY)
    return sizes.some(s => s.id === value) ? (value as Size) : 'medium'
  } catch {
    return 'medium'
  }
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" role="img" aria-label={`${rating} stars`}>
      {Array.from({ length: Math.floor(rating) }, (_, i) => <Star key={i} aria-hidden="true" fill="currentColor" />)}
      {rating % 1 > 0 && <StarHalf aria-hidden="true" fill="currentColor" />}
    </span>
  )
}

function Selected({ book }: { book: Book }) {
  return (
    <aside className="selected" aria-label={`Selected: ${book.title}`}>
      <Thumb book={book} marks={false} />
      <div className="selected-text">
        <p className="selected-title">{book.title}</p>
        <p className="where">{book.author}</p>
        {book.rating !== null && <Stars rating={book.rating} />}
        {book.tags.length > 0 && <p className="tags">{book.tags.map(t => <span key={t} className="tag">{t}</span>)}</p>}
      </div>
      <Link to="/books/$bookSlug" params={{ bookSlug: book.slug }} className="btn btn-solid">Open</Link>
    </aside>
  )
}

export function Shelves() {
  const { status, view = 'catalog' } = useSearch({ from: '/shelves/' })
  const navigate = useNavigate({ from: '/shelves/' })
  const [size, setSize] = useState(savedSize)
  const [selected, setSelected] = useState<string | null>(null)

  const shown = books.filter(b => !status || b.status === status)
  const years = [...new Set(shown.map(b => b.year))].sort((a, b) => b - a)
  const picked = books.find(b => b.slug === selected)

  const chooseSize = (next: Size) => {
    setSize(next)
    try { localStorage.setItem(SIZE_KEY, next) } catch { /* private window: it just won't persist */ }
  }

  return (
    <div className="stack shelves">
      <header className="shelves-head">
        <h1 className="title-head">Shelves</h1>
        <p>{shown.length} {shown.length === 1 ? 'book' : 'books'}</p>
      </header>

      <div className="segments scroll-x" role="group" aria-label="Filter by status">
        {statuses.map(s => (
          <button
            key={s.label}
            type="button"
            aria-pressed={status === s.id}
            onClick={() => navigate({ search: prev => ({ ...prev, status: s.id }) })}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="shelves-tools">
        <div className="segments" role="group" aria-label="View">
          {(['catalog', 'table'] as const).map(v => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => navigate({ search: prev => ({ ...prev, view: v }) })}
            >
              {v === 'catalog' ? 'Catalog' : 'Table'}
            </button>
          ))}
        </div>
        {view === 'catalog' && (
          <div className="segments" role="group" aria-label="Cell size">
            {sizes.map(s => (
              <button key={s.id} type="button" aria-pressed={size === s.id} onClick={() => chooseSize(s.id)}>{s.label}</button>
            ))}
          </div>
        )}
      </div>

      {shown.length === 0 && (
        <div className="box stack">
          <p>No books with this status yet.</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => navigate({ search: prev => ({ ...prev, status: undefined }) })}>Show all books</button>
          </div>
        </div>
      )}

      {view === 'table' && shown.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Title</th><th>Author</th><th>Year</th><th>Rating</th></tr></thead>
            <tbody>
              {shown.map(b => (
                <tr key={b.slug}>
                  <td>{b.code}</td>
                  <td><Link to="/books/$bookSlug" params={{ bookSlug: b.slug }}>{b.title}</Link></td>
                  <td>{b.author}</td>
                  <td>{b.year}</td>
                  <td>{b.rating ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'catalog' && years.map(year => (
        <section key={year} aria-labelledby={`year-${year}`}>
          <h2 id={`year-${year}`} className="year"><span>{year}</span></h2>
          <div key={size} className="catalog" data-size={size} style={{ '--cell': `${sizes.find(s => s.id === size)!.px}px` } as React.CSSProperties}>
            {shown.filter(b => b.year === year).map(b => (
              <button
                key={b.slug}
                type="button"
                className="cell"
                aria-pressed={selected === b.slug}
                aria-label={`${b.title} by ${b.author}, code ${b.code}`}
                onClick={() => setSelected(selected === b.slug ? null : b.slug)}
              >
                <span className="cell-head">
                  <span className="cell-title">{b.title}</span>
                  <span className="cell-code">{b.code}</span>
                  {b.status === 'read' && <Tick />}
                </span>
                <Thumb book={b} />
              </button>
            ))}
          </div>
        </section>
      ))}

      <p className="where">Covers from <a href="https://openlibrary.org">Open Library</a></p>

      {picked && <Selected book={picked} />}
    </div>
  )
}
