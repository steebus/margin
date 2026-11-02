import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { NotFoundBook } from './BookPage'
import { EntryList } from './EntryList'
import { Reflection } from './Reflection'

export const NOTE_KINDS = [
  { id: undefined, label: 'All' },
  { id: 'reflection', label: 'Reflections' },
  { id: 'note', label: 'Notes' },
  { id: 'excerpt', label: 'Excerpts' },
  { id: 'summary', label: 'Summaries' },
  { id: 'review', label: 'Reviews' },
] as const

/** All of one book's notes and thoughts, in one place. */
export function BookNotes() {
  const { bookSlug } = useParams({ from: '/books/$bookSlug/entries/' })
  const { kind } = useSearch({ from: '/books/$bookSlug/entries/' })
  const navigate = useNavigate({ from: '/books/$bookSlug/entries/' })
  const found = useQuery(api.library.bookBySlug, { slug: bookSlug })

  if (found === undefined) return <p role="status">Finding your notes…</p>
  if (found === null) return <NotFoundBook />

  const { book, entries, prompt } = found
  const newest = [...entries].reverse()
  const shown = newest.filter(e => !kind || e.kind === kind)
  const present = NOTE_KINDS.filter(k => !k.id || entries.some(e => e.kind === k.id))

  return (
    <div className="narrow stack">
      <Link to="/books/$bookSlug" params={{ bookSlug }} className="back"><ArrowLeft aria-hidden="true" strokeWidth={2.25} />{book.title}</Link>
      <h1 className="book-title">Notes and thoughts</h1>
      <p>{book.title}, {book.author}</p>

      {prompt && <Reflection key={prompt.id} prompt={prompt} />}

      {present.length > 2 && (
        <div className="segments scroll-x" role="group" aria-label="Show">
          {present.map(k => (
            <button key={k.label} type="button" aria-pressed={kind === k.id} onClick={() => navigate({ search: prev => ({ ...prev, kind: k.id }), replace: true })}>{k.label}</button>
          ))}
        </div>
      )}

      {shown.length > 0 ? <EntryList entries={shown} /> : <p>Nothing here yet.</p>}

      <div className="btn-row">
        <Link to="/capture" search={{ book: bookSlug, kind: 'note' }} className="btn btn-solid">Add a note</Link>
      </div>
    </div>
  )
}
