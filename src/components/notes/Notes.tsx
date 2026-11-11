import { RESERVED } from '../../../convex/lib/topics'
import { DrawerSheet } from '../drawer/Drawer'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { Archive, ArrowDown, ArrowUp, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { formatDate } from '../../lib/books'
import { filterNotes, groupNotes, NOTE_SORTS, noteYears, sortByWritten, type NoteSort } from '../../lib/notes'
import { useBooks, useEntries } from '../../lib/offline'
import { NOTE_KINDS } from '../book/BookNotes'
import { entryLabel, EntryText } from '../book/EntryList'
import { Reflection } from '../book/Reflection'
import { Thumb } from '../thumb/Thumb'
import { Opening } from '../opening/Opening'

const LATEST = 2
const STATUSES = [['reading', 'Reading'], ['paused', 'Paused'], ['read', 'Read'], ['tbr', 'TBR'], ['dnf', 'Stopped']] as const

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
  const { q, kind, status, label, from, to, sort = 'book', dir, drawer } = useSearch({ from: '/notes' })
  const navigate = useNavigate({ from: '/notes' })
  const entries = useEntries()
  const books = useBooks()
  const waiting = useQuery(api.reflect.waiting)
  const order = dir ?? NOTE_SORTS[sort].dir
  const Arrow = order === 'asc' ? ArrowUp : ArrowDown

  // The box keeps its own words and tells the address a moment after typing stops, so filtering hundreds of notes
  // never holds up a keystroke.
  const [typed, setTyped] = useState(q ?? '')
  useEffect(() => {
    if (typed === (q ?? '')) return
    const timer = setTimeout(() => navigate({ search: prev => ({ ...prev, q: typed || undefined }), replace: true }), 200)
    return () => clearTimeout(timer)
  }, [typed]) // eslint-disable-line react-hooks/exhaustive-deps

  const words = q?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? []
  const statusBySlug = new Map((books ?? []).map(b => [b.slug, b.status]))
  const shown = filterNotes(entries ?? [], slug => (slug ? statusBySlug.get(slug) : undefined), { kind, status, label, from, to, words })
  const years = noteYears(entries ?? [])
  const active = [kind, status, label, from, to].filter(v => v !== undefined).length
  const [open, setOpen] = useState(active > 0)
  const set = (change: Partial<{ kind: string; status: string; label: string; from: number; to: number; sort: NoteSort; dir: 'asc' | 'desc' }>) =>
    navigate({ search: prev => ({ ...prev, ...change }), replace: true })
  const flat = sort === 'written'
  const groups = flat ? [] : groupNotes(shown, books ?? [], sort, dir)
  const nothing = flat ? shown.length === 0 : groups.length === 0

  return (
    <div className="wide stack">
      <h1 className="title-head">Notes</h1>
      {drawer && <DrawerSheet onClose={() => void navigate({ search: prev => ({ ...prev, drawer: undefined }), replace: true })} />}

      {waiting?.map(p => <Reflection key={p.id} prompt={p} />)}

      <div className="tools">
        <div className="tools-top">
          <label className="tools-search">
            <Search aria-hidden="true" strokeWidth={2.25} />
            <span className="sr-only">Search your notes</span>
            <input type="search" value={typed} placeholder="Search your notes" onChange={e => setTyped(e.target.value)} />
          </label>
          <button type="button" className="btn tools-view" aria-expanded={open} aria-controls="notes-filter" onClick={() => setOpen(!open)}>
            <SlidersHorizontal aria-hidden="true" strokeWidth={2.25} />Filter{active > 0 && <span className="tools-badge">{active}</span>}
          </button>
          <button type="button" className="btn tools-view" onClick={() => void navigate({ search: prev => ({ ...prev, drawer: true }) })}><Archive aria-hidden="true" strokeWidth={2.25} />Drawer</button>
          <Link to="/capture" search={{ kind: 'note' }} className="btn tools-view"><Plus aria-hidden="true" strokeWidth={2.25} />New</Link>
        </div>

        {open && (
          <div id="notes-filter" className="tools-panel">
            <div className="tools-row">
              <div className="field tools-sort">
                <label htmlFor="notes-sort">Sort</label>
                <div className="tools-sort-row">
                  <select id="notes-sort" value={sort} onChange={e => set({ sort: e.target.value as NoteSort, dir: undefined })}>
                    {(Object.keys(NOTE_SORTS) as NoteSort[]).map(id => <option key={id} value={id}>{NOTE_SORTS[id].label}</option>)}
                  </select>
                  <button type="button" className="theme-toggle" aria-label={order === 'asc' ? 'Order: oldest or A first' : 'Order: newest or Z first'} onClick={() => set({ dir: order === 'asc' ? 'desc' : 'asc' })}>
                    <Arrow aria-hidden="true" strokeWidth={2.25} />
                  </button>
                </div>
              </div>
              <div className="field">
                <label htmlFor="notes-kind">Kind</label>
                <select id="notes-kind" value={kind ?? ''} onChange={e => set({ kind: e.target.value || undefined })}>
                  {NOTE_KINDS.map(k => <option key={k.label} value={k.id ?? ''}>{k.id ? k.label : 'Any'}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="notes-status">Book</label>
                <select id="notes-status" value={status ?? ''} onChange={e => set({ status: e.target.value || undefined })}>
                  <option value="">Any</option>
                  {STATUSES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
            </div>
            <div className="tools-row">
              <div className="field">
                <label htmlFor="notes-from">Written from</label>
                <select id="notes-from" value={from ?? ''} onChange={e => set({ from: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">The start</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="notes-to">Until</label>
                <select id="notes-to" value={to ?? ''} onChange={e => set({ to: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">Now</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="tools-row">
              <div className="field">
                <label htmlFor="notes-label">Label</label>
                <select id="notes-label" value={label ?? ''} onChange={e => set({ label: e.target.value || undefined })}>
                  <option value="">Any</option>
                  {RESERVED.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            {active > 0 && <div className="btn-row"><button type="button" className="btn" onClick={() => set({ kind: undefined, status: undefined, label: undefined, from: undefined, to: undefined })}>Clear filters</button></div>}
          </div>
        )}
      </div>

      {entries === undefined && <Opening what="your notes" />}
      {entries?.length === 0 && <p>Nothing here yet. Your notes, excerpts and reflections will collect here.</p>}
      {entries && entries.length > 0 && nothing && (
        <div className="box stack">
          <p>Nothing matches that.</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => { setTyped(''); set({ kind: undefined, status: undefined, label: undefined, from: undefined, to: undefined }) }}>Clear the search and filters</button>
          </div>
        </div>
      )}

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
