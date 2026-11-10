import { Link } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { errorText } from '../../lib/books'
import { landedSince } from '../../lib/newEntries'

export type Entry = { id: Id<'entries'>; kind: string; text: string; question: string | null; position: string; parentId?: Id<'entries'> | null }

const LABEL: Record<string, string> = { review: 'Your review', reflection: 'Reflection', summary: 'Summary' }

export const entryLabel = (e: Pick<Entry, 'kind' | 'position'>) =>
  [LABEL[e.kind], e.position].filter(Boolean).join(', ')

export function EntryText({ entry }: { entry: Pick<Entry, 'kind' | 'text' | 'question'> }) {
  return (
    <>
      {entry.question && <p className="entry-question">{entry.question}</p>}
      {entry.kind === 'excerpt' ? <blockquote className="book-voice">{entry.text}</blockquote> : <p className="hand">{entry.text}</p>}
    </>
  )
}

function Delete({ entry }: { entry: Entry }) {
  const removeEntry = useMutation(api.entries.removeEntry)
  return (
    <button
      type="button"
      className="entry-delete"
      aria-label={`Delete: ${entry.text.slice(0, 40)}`}
      onClick={() => { if (confirm('Delete this entry, here and on Hardcover? This cannot be undone.')) void removeEntry({ id: entry.id }) }}
    >
      <Trash2 aria-hidden="true" strokeWidth={2} />
    </button>
  )
}

/** Attaches a thought to the line it's about, which is how a marginal note sits beside its excerpt (SPEC 3.2). */
function AttachNote({ parent, readId }: { parent: Entry; readId: Id<'reads'> }) {
  const addEntry = useMutation(api.entries.addEntry)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return <button type="button" className="text-link entry-attach" onClick={() => setOpen(true)}><Plus aria-hidden="true" strokeWidth={2.25} />Add a note to this</button>
  }
  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await addEntry({ readId, kind: 'note', text, parentId: parent.id })
      setText('')
      setOpen(false)
    } catch (e) {
      setError(errorText(e, "That didn't save. Your words are still here: check your connection and try again."))
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className="entry-attach-form" onSubmit={e => { e.preventDefault(); if (text.trim()) void save() }}>
      <div className="field">
        <label htmlFor={`attach-${parent.id}`} className="sr-only">Your note</label>
        <textarea id={`attach-${parent.id}`} className="hand" rows={2} autoFocus value={text} placeholder="What you thought" onChange={e => setText(e.target.value)} />
      </div>
      <div className="btn-row">
        <button type="submit" className="btn btn-solid" disabled={!text.trim() || saving}>{saving ? 'Saving…' : 'Save note'}</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

/** A book's notes and thoughts, with notes under the excerpts they belong to. Reviews belong to Hardcover, so they can't be deleted here. */
export function EntryList({ entries, readId, limit }: { entries: Entry[]; readId: Id<'reads'>; limit?: number }) {
  const ids = new Set(entries.map(e => e.id))
  const top = entries.filter(e => !e.parentId || !ids.has(e.parentId))
  // Entries present when the list first showed are not "new"; ones that arrive later are written out as they land.
  const first = useRef<Set<string> | null>(null)
  if (first.current === null) first.current = new Set(entries.map(e => e.id))
  const landed = landedSince(first.current, entries.map(e => e.id))
  return (
    <ul className="entries">
      {top.slice(0, limit).map(e => (
        <li key={e.id} data-landed={landed.has(e.id) || undefined}>
          <span className="entry-position">{entryLabel(e)}</span>
          <div className="entry-body">
            <Link to="/e/$entryId" params={{ entryId: e.id }} className="note-link"><EntryText entry={e} /></Link>
            {entries.filter(c => c.parentId === e.id).reverse().map(c => (
              <div key={c.id} className="entry-child" data-landed={landed.has(c.id) || undefined}>
                <Link to="/e/$entryId" params={{ entryId: c.id }} className="note-link"><p className="hand">{c.text}</p></Link>
                <Delete entry={c} />
              </div>
            ))}
            {e.kind === 'excerpt' && <AttachNote parent={e} readId={readId} />}
          </div>
          {e.kind !== 'review' && <Delete entry={e} />}
        </li>
      ))}
    </ul>
  )
}
