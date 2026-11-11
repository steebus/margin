import { useLayoutEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { formatDate, type Book } from '../../lib/books'
import { daysToRead, dateOf, SORTS, type Dir, type SortId } from '../../lib/shelf'
import { arrivals } from '../../lib/slotIn'
import { flyCover } from '../../lib/coverFlight'
import { useBookHold } from '../book/BookActions'
import { Tick } from '../thumb/Marks'
import { Thumb } from '../thumb/Thumb'

export const SIZES = [
  { id: 'small', label: 'Small', px: 68 },
  { id: 'medium', label: 'Medium', px: 88 },
  { id: 'large', label: 'Large', px: 116 },
] as const
export type Size = (typeof SIZES)[number]['id']

/** A book added while the shelf is open slides into its slot, and the cells it displaces glide to their new places
 *  (a FLIP with the Web Animations API). Anything else that changes the list stays as it was. */
function useSlotIn(books: Book[], size: Size) {
  const ref = useRef<HTMLDivElement>(null)
  const seen = useRef<{ slugs: string[]; size: Size; rects: Map<string, DOMRect>; scroll: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const slugs = books.map(b => b.slug)
    const before = seen.current
    const cells = [...el.querySelectorAll<HTMLElement>('.cell[data-slug]')]
    if (before && before.size === size && typeof el.animate === 'function') {
      const fresh = new Set(arrivals(before.slugs, slugs))
      if (fresh.size > 0) {
        for (const cell of cells) {
          const slug = cell.dataset.slug!
          if (fresh.has(slug)) {
            cell.animate([{ opacity: 0, transform: 'translateY(-14px) scale(0.92)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)' })
            continue
          }
          const was = before.rects.get(slug)
          if (!was) continue
          const now = cell.getBoundingClientRect()
          const dx = was.left - now.left
          const dy = was.top - now.top + before.scroll - window.scrollY
          if (dx || dy) cell.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(0.3, 0.9, 0.3, 1)' })
        }
      }
    }
    seen.current = { slugs, size, rects: new Map(cells.map(c => [c.dataset.slug!, c.getBoundingClientRect()])), scroll: window.scrollY }
  }, [books, size])
  return ref
}

export function Catalog({ books, size }: { books: Book[]; size: Size }) {
  const ref = useSlotIn(books, size)
  return (
    <div ref={ref} className="catalog" data-size={size} style={{ '--cell': `${SIZES.find(s => s.id === size)!.px}px` } as React.CSSProperties}>
      {books.map(b => <Cell key={b.slug} book={b} />)}
    </div>
  )
}

function Cell({ book }: { book: Book }) {
  const hold = useBookHold(book)
  return (
    <Link to="/books/$bookSlug" params={{ bookSlug: book.slug }} className="cell" data-slug={book.slug} aria-label={`${book.title} by ${book.author}`} {...hold} onClickCapture={e => { hold.onClickCapture(e); if (!e.defaultPrevented) flyCover(e.currentTarget) }}>
      <Thumb book={book} />
      {book.status === 'read' && <span className="cell-tick"><Tick /></span>}
    </Link>
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
