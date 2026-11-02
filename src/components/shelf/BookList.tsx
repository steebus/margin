import { Link } from '@tanstack/react-router'
import { formatDate, type Book } from '../../lib/books'
import { daysToRead, dateOf, SORTS, type Dir, type SortId } from '../../lib/shelf'
import { Tick } from '../thumb/Marks'
import { Thumb } from '../thumb/Thumb'

export const SIZES = [
  { id: 'small', label: 'Small', px: 68 },
  { id: 'medium', label: 'Medium', px: 88 },
  { id: 'large', label: 'Large', px: 116 },
] as const
export type Size = (typeof SIZES)[number]['id']

export function Catalog({ books, size }: { books: Book[]; size: Size }) {
  return (
    <div className="catalog" data-size={size} style={{ '--cell': `${SIZES.find(s => s.id === size)!.px}px` } as React.CSSProperties}>
      {books.map(b => (
        <Link key={b.slug} to="/books/$bookSlug" params={{ bookSlug: b.slug }} className="cell" aria-label={`${b.title} by ${b.author}`}>
          <Thumb book={b} />
          {b.status === 'read' && <span className="cell-tick"><Tick /></span>}
        </Link>
      ))}
    </div>
  )
}

const COLUMNS: { id: SortId; label: string; wide?: boolean; numeric?: boolean; show: (b: Book) => string | number | null }[] = [
  { id: 'title', label: 'Title', show: b => b.title },
  { id: 'author', label: 'Author', wide: true, show: b => b.author },
  { id: 'published', label: 'Published', wide: true, numeric: true, show: b => b.published },
  { id: 'pages', label: 'Pages', wide: true, numeric: true, show: b => b.pages },
  { id: 'rating', label: 'Rating', numeric: true, show: b => b.rating },
  { id: 'days', label: 'Days', wide: true, numeric: true, show: b => daysToRead(b) },
  { id: 'recent', label: 'Date', numeric: true, show: b => { const at = dateOf(b); return at && formatDate(at) } },
]

type TableProps = { books: Book[]; sort: SortId; dir?: Dir; onSort: (sort: SortId, dir: Dir) => void }

export function BookTable({ books, sort, dir, onSort }: TableProps) {
  const current = dir ?? SORTS[sort].dir
  return (
    <div className="table-wrap">
      <table className="book-table">
        <thead>
          <tr>
            {COLUMNS.map(c => (
              <th
                key={c.id}
                className={`${c.wide ? 'col-wide' : ''} ${c.numeric ? 'col-num' : ''}`}
                aria-sort={sort === c.id ? (current === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                <button type="button" onClick={() => onSort(c.id, sort === c.id ? (current === 'asc' ? 'desc' : 'asc') : SORTS[c.id].dir)}>
                  {c.label}{sort === c.id && <span aria-hidden="true"> {current === 'asc' ? '↑' : '↓'}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {books.map(b => (
            <tr key={b.slug}>
              {COLUMNS.map(c => (
                <td key={c.id} className={`${c.wide ? 'col-wide' : ''} ${c.numeric ? 'col-num' : ''}`}>
                  {c.id === 'title' ? <Link to="/books/$bookSlug" params={{ bookSlug: b.slug }}>{b.title}</Link> : c.show(b)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
