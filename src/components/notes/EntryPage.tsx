import { Link, useNavigate, useParams, useRouter } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import { errorText, formatDate } from '../../lib/books'
import { EntryText } from '../book/EntryList'
import { Thumb } from '../thumb/Thumb'

type Found = NonNullable<FunctionReturnType<typeof api.entries.entry>>

const KIND: Record<string, string> = { excerpt: 'Excerpt', note: 'Note', summary: 'Summary', reflection: 'Reflection', review: 'Your review' }
const EDITABLE_KINDS = ['excerpt', 'note', 'summary'] as const
type EditableKind = (typeof EDITABLE_KINDS)[number]

function Editor({ entry, onDone }: { entry: Found; onDone: () => void }) {
  const updateEntry = useMutation(api.entries.updateEntry)
  const audio = entry.book.format === 'audio'
  const [text, setText] = useState(entry.text)
  const [kind, setKind] = useState(entry.kind)
  const [place, setPlace] = useState(String((audio ? entry.percent : entry.page) ?? ''))
  const [chapter, setChapter] = useState(entry.chapter ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const number = place.trim() === '' ? undefined : Number(place)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await updateEntry({
        id: entry.id,
        text,
        kind: EDITABLE_KINDS.includes(kind as EditableKind) ? kind as EditableKind : undefined,
        // The other kind of place is kept as it was.
        page: audio ? entry.page ?? undefined : number,
        percent: audio ? number : entry.percent ?? undefined,
        chapter,
      })
      onDone()
    } catch (e) {
      setError(errorText(e, "That didn't save. Your words are still here: check your connection and try again."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="stack" onSubmit={e => { e.preventDefault(); if (text.trim()) void save() }}>
      {entry.kind !== 'reflection' && (
        <div className="segments" role="group" aria-label="Kind">
          {EDITABLE_KINDS.map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND[k]}</button>)}
        </div>
      )}
      <div className="field">
        <label htmlFor="entry-text">{kind === 'excerpt' ? 'The line' : 'Your words'}</label>
        <textarea id="entry-text" className={kind === 'excerpt' ? 'book-voice' : 'hand'} rows={6} value={text} onChange={e => setText(e.target.value)} />
      </div>
      <div className="entry-place">
        <div className="field field-short">
          <label htmlFor="entry-place">{audio ? 'Percent through' : 'Page'}</label>
          <input id="entry-place" type="number" inputMode="numeric" min={audio ? 0 : 1} max={audio ? 100 : undefined} step={1} value={place} onChange={e => setPlace(e.target.value)} />
        </div>
        <div className="field field-short">
          <label htmlFor="entry-chapter">Chapter</label>
          <input id="entry-chapter" value={chapter} onChange={e => setChapter(e.target.value)} />
        </div>
      </div>
      <div className="btn-row">
        <button type="submit" className="btn btn-solid" disabled={!text.trim() || saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" className="btn" onClick={onDone}>Cancel</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

/** One note, excerpt or thought, to read again, change or throw away. */
export function EntryPage() {
  const { entryId } = useParams({ strict: false }) as { entryId: string }
  const found = useQuery(api.entries.entry, { id: entryId })
  const removeEntry = useMutation(api.entries.removeEntry)
  const navigate = useNavigate()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (found === undefined) return <p role="status">Finding that note…</p>
  if (found === null) {
    return (
      <div className="narrow stack">
        <h1 className="title-head">Note not found</h1>
        <p>This link doesn't match anything you've kept. It may have been deleted.</p>
        <div className="btn-row"><Link to="/notes" className="btn btn-solid">Go to Notes</Link></div>
      </div>
    )
  }

  const { book } = found
  const remove = async () => {
    if (!confirm('Delete this, here and on Hardcover? This cannot be undone.')) return
    try {
      await removeEntry({ id: found.id })
      void navigate({ to: '/books/$bookSlug/entries', params: { bookSlug: book.slug } })
    } catch (e) {
      setError(errorText(e, "That didn't delete. Check your connection and try again."))
    }
  }

  return (
    <div className="narrow stack">
      <button type="button" className="back" onClick={() => router.history.canGoBack() ? router.history.back() : void navigate({ to: '/notes' })}>
        <ArrowLeft aria-hidden="true" strokeWidth={2.25} />Back
      </button>

      <Link to="/books/$bookSlug" params={{ bookSlug: book.slug }} className="notes-head">
        <Thumb book={book} marks={false} />
        <span className="notes-head-text">
          <span className="selected-title">{book.title}</span>
          <span className="where">{book.author}</span>
        </span>
      </Link>

      <p className="entry-meta">
        {[KIND[found.kind] ?? found.kind, found.position, `written ${formatDate(found.createdAt)}`].filter(Boolean).join(' · ')}
      </p>

      {found.parent && (
        <Link to="/e/$entryId" params={{ entryId: found.parent.id }} className="entry-parent">
          <span className="where">On the line</span>
          <span className="book-voice">{found.parent.text}</span>
        </Link>
      )}

      {editing ? <Editor entry={found} onDone={() => setEditing(false)} /> : (
        <>
          <div className="entry-full"><EntryText entry={found} /></div>
          {found.kind === 'review'
            ? <p className="where">Your review lives on Hardcover. Change it there.</p>
            : (
              <div className="btn-row">
                <button type="button" className="btn btn-solid" onClick={() => setEditing(true)}><Pencil aria-hidden="true" strokeWidth={2.25} />Edit</button>
                <button type="button" className="btn" onClick={() => void remove()}><Trash2 aria-hidden="true" strokeWidth={2.25} />Delete</button>
              </div>
            )}
          {error && <p role="alert">{error}</p>}
        </>
      )}

      {found.children.length > 0 && (
        <section className="stack" aria-labelledby="children-heading">
          <h2 id="children-heading" className="head">Your notes on this</h2>
          <ul className="notes-list">
            {found.children.map(c => (
              <li key={c.id}><Link to="/e/$entryId" params={{ entryId: c.id }} className="note-link"><p className="hand">{c.text}</p></Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
