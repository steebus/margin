import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { ArrowDown, ArrowUp, Plus, Search } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { formatDate } from '../../lib/books'
import { groupNotes, NOTE_SORTS, sortByWritten, type NoteSort } from '../../lib/notes'
import { useBooks, useEntries } from '../../lib/offline'
import { NOTE_KINDS } from '../book/BookNotes'
import { entryLabel, EntryText } from '../book/EntryList'
import { Reflection } from '../book/Reflection'
import { Thumb } from '../thumb/Thumb'

const LATEST = 2

type Note = NonNullable<ReturnType<typeof useEntries>>[number]

function NoteItem({ entry, where }: { entry: Note; where?: boolean }) {
  const label = where ? entry.where : entryLabel(entry)
  return (
    <li>
      <Link to="/e/$entryId" params={{ entryId: entry.id }} className="note-link">
        <span className="entry-position">{[label, formatDate(entry.createdAt)].filter(Boolean).join(' · ')}</span>
        <div className="notes-clamp"><EntryText entry={entry} /></div>
      </Link>
    </li>
  )
}

/** All your notes and reflections: book by book, or one by one by when you wrote them. Tap one to read, change or delete it. */
export function Notes() {
  const { q, kind, sort = 'book', dir } = useSearch({ from: '/notes' })
  const navigate = useNavigate({ from: '/notes' })
  const entries = useEntries()
  const books = useBooks()
  const waiting = useQuery(api.reflect.waiting)
  const order = dir ?? NOTE_SORTS[sort].dir
  const Arrow = order === 'asc' ? ArrowUp : ArrowDown

  const words = q?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? []
  const shown = (entries ?? []).filter(e => {
    if (kind && e.kind !== kind) return false
    const text = `${e.text} ${e.question ?? ''} ${e.where}`.toLowerCase()
    return words.every(w => text.includes(w))
  })
  const flat = sort === 'written'
  const groups = flat ? [] : groupNotes(shown, books ?? [], sort, dir)
  const nothing = flat ? shown.length === 0 : groups.length === 0

  return (
    <div className="wide stack">
      <h1 className="title-head">Notes</h1>

      {waiting?.map(p => <Reflection key={p.id} prompt={p} />)}

      <div className="notes-tools">
      <div className="tools-top">
        <label className="tools-search">
          <Search aria-hidden="true" strokeWidth={2.25} />
          <span className="sr-only">Search your notes</span>
          <input type="search" value={q ?? ''} placeholder="Search your notes" onChange={e => navigate({ search: prev => ({ ...prev, q: e.target.value || undefined }), replace: true })} />
        </label>
        <Link to="/capture" search={{ kind: 'note' }} className="btn tools-view"><Plus aria-hidden="true" strokeWidth={2.25} />New</Link>
      </div>

      <div className="field">
        <label htmlFor="notes-sort">Sort</label>
        <div className="tools-sort-row">
          <select id="notes-sort" value={sort} onChange={e => navigate({ search: prev => ({ ...prev, sort: e.target.value as NoteSort, dir: undefined }), replace: true })}>
            {(Object.keys(NOTE_SORTS) as NoteSort[]).map(id => <option key={id} value={id}>{NOTE_SORTS[id].label}</option>)}
          </select>
          <button
            type="button"
            className="theme-toggle"
            aria-label={order === 'asc' ? 'Order: oldest or A first' : 'Order: newest or Z first'}
            onClick={() => navigate({ search: prev => ({ ...prev, dir: order === 'asc' ? 'desc' : 'asc' }), replace: true })}
          >
            <Arrow aria-hidden="true" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <div className="segments scroll-x" role="group" aria-label="Show">
        {NOTE_KINDS.map(k => (
          <button key={k.label} type="button" aria-pressed={kind === k.id} onClick={() => navigate({ search: prev => ({ ...prev, kind: k.id }), replace: true })}>{k.label}</button>
        ))}
      </div>
      </div>

      {entries === undefined && <p role="status">Opening your notes…</p>}
      {entries?.length === 0 && <p>Nothing here yet. Your notes, excerpts and reflections will collect here.</p>}
      {entries && entries.length > 0 && nothing && <p>Nothing matches that.</p>}

      {flat && shown.length > 0 && (
        <ul className="notes-wall notes-cards">
          {sortByWritten(shown, order).map(e => <NoteItem key={e.id} entry={e} where />)}
        </ul>
      )}

      {groups.length > 0 && <div className="notes-wall">{groups.map(({ book, list }) => {
        const visible = words.length > 0 ? list : list.slice(0, LATEST)
        return (
          <article key={book.slug} className="notes-book">
            <Link to="/books/$bookSlug/entries" params={{ bookSlug: book.slug }} className="notes-head">
              <Thumb book={book} marks={false} />
              <span className="notes-head-text">
                <span className="selected-title">{book.title}</span>
                <span className="where">{book.author}</span>
                <span className="where">{list.length} {list.length === 1 ? 'entry' : 'entries'}{sort === 'read' && book.finishedAt ? ` · read ${formatDate(book.finishedAt)}` : ''}</span>
              </span>
            </Link>
            <ul className="notes-list">
              {visible.map(e => <NoteItem key={e.id} entry={e} />)}
            </ul>
            {visible.length < list.length && (
              <Link to="/books/$bookSlug/entries" params={{ bookSlug: book.slug }} className="notes-more">All {list.length} notes and thoughts</Link>
            )}
          </article>
        )
      })}</div>}
    </div>
  )
}
