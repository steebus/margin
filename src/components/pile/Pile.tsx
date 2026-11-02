import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { formatDate } from '../../lib/books'
import { pileNote, pileOf, spineOf } from '../../lib/pile'

/** Every book read, lying flat in the order they were finished, with what you made of each down the side. */
export function Pile() {
  const books = useQuery(api.library.myBooks)
  const entries = useQuery(api.library.allEntries)

  const rows = pileOf(books ?? [])
  const bySlug = Map.groupBy(entries ?? [], e => e.slug)
  const pages = rows.reduce((sum, r) => sum + (r.book.pages ?? 0), 0)
  let lastYear: number | null = null

  return (
    <div className="stack pile-page">
      <header className="shelves-head">
        <h1 className="title-head">The pile</h1>
        {books && <p>{rows.length} {rows.length === 1 ? 'book' : 'books'}, {pages.toLocaleString('en-GB')} pages</p>}
      </header>

      {books === undefined && <p role="status">Stacking your books…</p>}
      {books && rows.length === 0 && <p>Nothing finished yet. Books land here as you finish them.</p>}

      <ol className="pile">
        {rows.map(({ key, book, finishedAt, days }) => {
          const spine = spineOf(book.slug, book.pages)
          const year = finishedAt === null ? null : new Date(finishedAt).getUTCFullYear()
          const newYear = year !== null && year !== lastYear
          if (newYear) lastYear = year
          const notes = bySlug.get(book.slug) ?? []
          const note = pileNote(notes)
          return (
            <li key={key} className="pile-row" style={{ minHeight: spine.height }}>
              <div className="pile-book">
                <Link
                  to="/books/$bookSlug"
                  params={{ bookSlug: book.slug }}
                  className="spine"
                  data-look={spine.look}
                  style={{ width: `${spine.width}%`, marginLeft: `${((100 - spine.width) * spine.shift) / 100}%` }}
                >
                  <span className="spine-title">{book.title}</span>
                  <span className="spine-author">{book.author}</span>
                </Link>
              </div>
              <div className="pile-side">
                {newYear && <p className="pile-year">{year}</p>}
                <p className="pile-date">
                  {finishedAt ? formatDate(finishedAt) : 'Date not recorded'}
                  {days !== null && `, ${days} ${days === 1 ? 'day' : 'days'}`}
                </p>
                {note && (
                  <Link to="/books/$bookSlug/entries" params={{ bookSlug: book.slug }} className="pile-note">
                    <span className={note.kind === 'excerpt' ? 'pile-text' : 'pile-text hand'}>{note.text}</span>
                    {notes.length > 1 && <span className="pile-more">All {notes.length} notes</span>}
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
