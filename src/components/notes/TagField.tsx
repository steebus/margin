import { Link } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { isReserved, topicKey } from '../../../convex/lib/topics'
import { slugify } from '../../../convex/lib/hardcover'
import { errorText } from '../../lib/books'
import { landedSince } from '../../lib/newEntries'

/**
 * A note's tags. Topics link to their page; reserved labels (Theme, Chapter summary…) only sort notes. Typing suggests
 * tags already used, with the browser's own list. Each change saves straight away, and goes to Hardcover.
 */
export function TagField({ entryId, tags }: { entryId: Id<'entries'>; tags: string[] }) {
  const names = useQuery(api.topics.tagNames)
  const setTags = useMutation(api.entries.setTags)
  const [words, setWords] = useState('')
  const [error, setError] = useState<string | null>(null)
  const listId = useId()
  // A tag that arrives while the note is open swings in on its string; the ones already there don't move.
  const first = useRef<Set<string> | null>(null)
  if (first.current === null) first.current = new Set(tags)
  const landed = landedSince(first.current, tags)

  const save = async (next: string[]) => {
    setError(null)
    try {
      await setTags({ id: entryId, tags: next })
    } catch (e) {
      setError(errorText(e, "That tag didn't save. Check your connection and try again."))
    }
  }
  const add = () => {
    // A suggestion picked from the list carries its " (hidden)" note; the tag is the name.
    const tag = words.replace(/ \(hidden\)$/, '').trim()
    setWords('')
    if (!tag || tags.some(t => topicKey(t) === topicKey(tag))) return
    // The spelling already in use wins, so "feminism" joins "Feminism".
    const known = names?.find(n => topicKey(n.name) === topicKey(tag))
    void save([...tags, known?.name ?? tag])
  }

  return (
    <div className="tag-field">
      {tags.length > 0 && (
        <ul className="tags" aria-label="Tags">
          {tags.map(tag => (
            <li key={tag} className="tag tag-chip" data-reserved={isReserved(tag) ? '' : undefined} data-landed={landed.has(tag) || undefined}>
              {isReserved(tag) ? tag : <Link to="/topics/$topicSlug" params={{ topicSlug: slugify(topicKey(tag)) }}>{tag}</Link>}
              <button type="button" aria-label={`Remove the tag ${tag}`} onClick={() => void save(tags.filter(t => t !== tag))}>
                <X aria-hidden="true" strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="tag-add" onSubmit={e => { e.preventDefault(); add() }}>
        <label htmlFor={`${listId}-input`} className="sr-only">Add a tag</label>
        <input
          id={`${listId}-input`}
          list={listId}
          value={words}
          placeholder="Add a tag"
          autoComplete="off"
          enterKeyHint="done"
          onChange={e => setWords(e.target.value)}
          // A comma ends a tag, as Enter does.
          onKeyDown={e => { if (e.key === ',') { e.preventDefault(); add() } }}
        />
        <datalist id={listId}>
          {names?.filter(n => !tags.some(t => topicKey(t) === topicKey(n.name))).map(n => (
            <option key={n.name} value={n.hidden ? `${n.name} (hidden)` : n.name} />
          ))}
        </datalist>
        <button type="submit" className="btn" disabled={!words.trim()}>Add</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
