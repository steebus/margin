import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Search } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { NOTE_KINDS } from '../book/BookNotes'
import { entryLabel, EntryText } from '../book/EntryList'
import { Reflection } from '../book/Reflection'
import { Thumb } from '../thumb/Thumb'

const LATEST = 2

/** All your notes and reflections, book by book, with the book you last wrote about first. */
export function Notes() {
  const { q, kind } = useSearch({ from: '/notes' })
  const navigate = useNavigate({ from: '/notes' })
  const entries = useQuery(api.library.allEntries)
  const books = useQuery(api.library.myBooks)
  const waiting = useQuery(api.reflect.waiting)

  const words = q?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? []
  const shown = (entries ?? []).filter(e => {
    if (kind && e.kind !== kind) return false
    const text = `${e.text} ${e.question ?? ''} ${e.where}`.toLowerCase()
    return words.every(w => text.includes(w))
  })
  const groups = [...Map.groupBy(shown, e => e.slug)].flatMap(([slug, list]) => {
    const book = books?.find(b => b.slug === slug)
    return book ? [{ book, list }] : []
  })

  return (
    <div className="narrow stack">
      <h1 className="title-head">Notes</h1>

      {waiting?.map(p => <Reflection key={p.id} prompt={p} />)}

      <label className="tools-search">
        <Search aria-hidden="true" strokeWidth={2.25} />
        <span className="sr-only">Search your notes</span>
        <input type="search" value={q ?? ''} placeholder="Search your notes" onChange={e => navigate({ search: prev => ({ ...prev, q: e.target.value || undefined }), replace: true })} />
      </label>

      <div className="segments scroll-x" role="group" aria-label="Show">
        {NOTE_KINDS.map(k => (
          <button key={k.label} type="button" aria-pressed={kind === k.id} onClick={() => navigate({ search: prev => ({ ...prev, kind: k.id }), replace: true })}>{k.label}</button>
        ))}
      </div>

      {entries === undefined && <p role="status">Opening your notes…</p>}
      {entries?.length === 0 && <p>Nothing here yet. Your notes, excerpts and reflections will collect here.</p>}
      {entries && entries.length > 0 && groups.length === 0 && <p>Nothing matches that.</p>}

      {groups.map(({ book, list }) => {
        const narrowed = words.length > 0
        const visible = narrowed ? list : list.slice(0, LATEST)
        return (
          <article key={book.slug} className="notes-book">
            <Link to="/books/$bookSlug/entries" params={{ bookSlug: book.slug }} className="notes-head">
              <Thumb book={book} marks={false} />
              <span className="notes-head-text">
                <span className="selected-title">{book.title}</span>
                <span className="where">{book.author}</span>
                <span className="where">{list.length} {list.length === 1 ? 'entry' : 'entries'}</span>
              </span>
            </Link>
            <ul className="notes-list">
              {visible.map(e => (
                <li key={e.id}>
                  {entryLabel(e) && <span className="entry-position">{entryLabel(e)}</span>}
                  <div className="notes-clamp"><EntryText entry={e} /></div>
                </li>
              ))}
            </ul>
            {visible.length < list.length && (
              <Link to="/books/$bookSlug/entries" params={{ bookSlug: book.slug }} className="notes-more">All {list.length} notes and thoughts</Link>
            )}
          </article>
        )
      })}
    </div>
  )
}
