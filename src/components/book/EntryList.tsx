import { useMutation } from 'convex/react'
import { Trash2 } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export type Entry = { id: Id<'entries'>; kind: string; text: string; question: string | null; position: string }

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

/** A book's notes and thoughts. Reviews belong to Hardcover, so they can't be deleted here. */
export function EntryList({ entries }: { entries: Entry[] }) {
  const removeEntry = useMutation(api.entries.removeEntry)
  return (
    <ul className="entries">
      {entries.map(e => (
        <li key={e.id}>
          <span className="entry-position">{entryLabel(e)}</span>
          <div className="entry-body"><EntryText entry={e} /></div>
          {e.kind !== 'review' && (
            <button
              type="button"
              className="entry-delete"
              aria-label={`Delete: ${e.text.slice(0, 40)}`}
              onClick={() => { if (confirm('Delete this entry, here and on Hardcover? This cannot be undone.')) void removeEntry({ id: e.id }) }}
            >
              <Trash2 aria-hidden="true" strokeWidth={2} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
