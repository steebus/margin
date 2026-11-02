import '@fontsource/cinzel/latin-600.css'
import '@fontsource/oxanium/latin-500.css'
import '@fontsource/pirata-one/latin-400.css'
import '@fontsource/playfair-display/latin-700.css'
import '@fontsource/special-elite/latin-400.css'

import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { formatDate } from '../../lib/books'
import { faceOf, pileNote, pileOf, spineOf, spineTitle } from '../../lib/pile'

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
          const note = pileNote(bySlug.get(book.slug) ?? [])
          return (
            <li key={key} className="pile-row" style={{ height: spine.height }}>
              <div className="pile-book">
                <Link
                  to="/books/$bookSlug"
                  params={{ bookSlug: book.slug }}
                  className="spine"
                  data-look={spine.look}
                  style={{ width: `${spine.width}%`, marginLeft: `${((100 - spine.width) * spine.shift) / 100}%` }}
                >
                  <span className="spine-label">
                    <span className="spine-title" data-face={faceOf(book.subjects)}>{spineTitle(book.title)}</span>
                    <span className="spine-author">{book.author}</span>
                  </span>
                </Link>
              </div>
              <div className="pile-side" data-year={newYear || undefined}>
                <p className="pile-date">
                  <span>{finishedAt ? formatDate(finishedAt) : 'Date not recorded'}{days !== null && `, ${days} ${days === 1 ? 'day' : 'days'}`}</span>
                  {newYear && <span className="pile-year">{year}</span>}
                </p>
                {note && (
                  <Link to="/books/$bookSlug/entries" params={{ bookSlug: book.slug }} className="pile-note">
                    <span className={note.kind === 'excerpt' ? 'pile-text' : 'pile-text hand'} style={{ WebkitLineClamp: spine.lines }}>{note.text}</span>
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
