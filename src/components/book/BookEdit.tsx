import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import type { FunctionReturnType } from 'convex/server'
import { ArrowLeft, Undo2, X } from 'lucide-react'
import { useId, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { GENRES } from '../../../convex/lib/genres'
import { topicKey } from '../../../convex/lib/topics'
import { errorText } from '../../lib/books'
import { NotFoundBook } from './BookPage'
import { ReadDates } from './ReadDates'

type Found = NonNullable<FunctionReturnType<typeof api.library.bookBySlug>>

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** What Hardcover has, under a field the reader has changed, with a way back to it. */
function Was({ edited, original, onReset }: { edited: boolean; original: string; onReset: () => void }) {
  if (!edited) return null
  return (
    <p className="where edit-was">
      Hardcover has {original || 'nothing'}.{' '}
      <button type="button" className="text-link" onClick={onReset}><Undo2 aria-hidden="true" strokeWidth={2.25} />Use that</button>
    </p>
  )
}

function Form({ found }: { found: Found }) {
  const { book, original, edits } = found
  const navigate = useNavigate()
  const editBook = useMutation(api.library.editBook)
  const topics = useQuery(api.topics.forBook, { readId: book.readId })
  const names = useQuery(api.topics.tagNames)
  const listId = useId()
  const [title, setTitle] = useState(book.title)
  const [authors, setAuthors] = useState(book.authors.join('\n'))
  const [pages, setPages] = useState(book.pages ? String(book.pages) : '')
  const [year, setYear] = useState(book.published ? String(book.published) : '')
  const [genres, setGenres] = useState(book.genres)
  const [added, setAdded] = useState(edits?.topicsAdded ?? [])
  const [removed, setRemoved] = useState(edits?.topicsRemoved ?? [])
  const [words, setWords] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authorList = authors.split('\n').map(a => a.trim()).filter(Boolean)
  // The book's topics as they'll be once saved: the live ones, plus what's been added, less what's been taken off.
  const shown = [...(topics ?? []).map(t => t.name), ...added]
    .filter((name, i, all) => all.findIndex(n => topicKey(n) === topicKey(name)) === i)
    .filter(name => !removed.includes(topicKey(name)))
  const takeOff = (name: string) => {
    const key = topicKey(name)
    if (added.some(a => topicKey(a) === key)) setAdded(added.filter(a => topicKey(a) !== key))
    if (topics?.some(t => t.key === key)) setRemoved([...removed, key])
  }
  const putOn = () => {
    const name = words.trim()
    setWords('')
    if (!name) return
    const key = topicKey(name)
    if (removed.includes(key)) return setRemoved(removed.filter(r => r !== key))
    if (shown.some(s => topicKey(s) === key)) return
    // The spelling already in use wins, so "grief" joins "Grief".
    setAdded([...added, names?.find(n => topicKey(n.name) === key)?.name ?? name])
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await editBook({
        readId: book.readId,
        title,
        authors: authorList,
        pages: pages ? Number(pages) : undefined,
        year: year ? Number(year) : undefined,
        genres,
        topicsAdded: added,
        topicsRemoved: removed,
      })
      void navigate({ to: '/books/$bookSlug', params: { bookSlug: book.slug } })
    } catch (e) {
      setError(errorText(e, "That didn't save. Check your connection and try again."))
      setSaving(false)
    }
  }

  const asText = (n: number | null) => (n ? String(n) : '')
  return (
    <form className="stack edit-form" onSubmit={e => { e.preventDefault(); void save() }}>
      <div className="field">
        <label htmlFor="edit-title">Title</label>
        <input id="edit-title" value={title} onChange={e => setTitle(e.target.value)} required />
        <Was edited={title.trim() !== original.title} original={original.title} onReset={() => setTitle(original.title)} />
      </div>
      <div className="field">
        <label htmlFor="edit-authors">Authors, one to a line</label>
        <textarea id="edit-authors" rows={Math.max(2, authorList.length + 1)} value={authors} onChange={e => setAuthors(e.target.value)} required />
        <Was edited={!same(authorList, original.authors)} original={original.authors.join(', ')} onReset={() => setAuthors(original.authors.join('\n'))} />
      </div>
      <div className="edit-pair">
        <div className="field">
          <label htmlFor="edit-pages">Pages</label>
          <input id="edit-pages" type="number" inputMode="numeric" min={1} step={1} value={pages} onChange={e => setPages(e.target.value)} />
          <Was edited={(pages ? Number(pages) : null) !== original.pages} original={asText(original.pages)} onReset={() => setPages(asText(original.pages))} />
        </div>
        <div className="field">
          <label htmlFor="edit-year">Published</label>
          <input id="edit-year" type="number" inputMode="numeric" min={1} step={1} value={year} onChange={e => setYear(e.target.value)} />
          <Was edited={(year ? Number(year) : null) !== original.year} original={asText(original.year)} onReset={() => setYear(asText(original.year))} />
        </div>
      </div>

      <fieldset className="choices stack">
        <legend className="head">Genres</legend>
        <div className="genre-picks">
          {Object.keys(GENRES).map(g => (
            <button key={g} type="button" aria-pressed={genres.includes(g)} onClick={() => setGenres(genres.includes(g) ? genres.filter(x => x !== g) : [...genres, g])}>{g}</button>
          ))}
        </div>
        <Was edited={!same([...genres].sort(), [...original.genres].sort())} original={original.genres.join(', ')} onReset={() => setGenres(original.genres)} />
      </fieldset>

      <fieldset className="choices stack">
        <legend className="head">Topics</legend>
        {shown.length > 0 ? (
          <ul className="tags" aria-label="Topics">
            {shown.map(name => (
              <li key={name} className="tag tag-chip">
                {name}
                <button type="button" aria-label={`Take ${name} off this book`} onClick={() => takeOff(name)}><X aria-hidden="true" strokeWidth={2.5} /></button>
              </li>
            ))}
          </ul>
        ) : <p>No topics on this book.</p>}
        <div className="tag-add">
          <label htmlFor={`${listId}-input`} className="sr-only">Add a topic</label>
          <input
            id={`${listId}-input`}
            list={listId}
            value={words}
            placeholder="Add a topic"
            autoComplete="off"
            onChange={e => setWords(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); putOn() } }}
          />
          <datalist id={listId}>
            {names?.filter(n => !n.reserved && !shown.some(s => topicKey(s) === topicKey(n.name))).map(n => <option key={n.name} value={n.name} />)}
          </datalist>
          <button type="button" className="btn" disabled={!words.trim()} onClick={putOn}>Add</button>
        </div>
        {removed.length > 0 && (
          <p className="where">
            Taken off: {removed.join(', ')}.{' '}
            <button type="button" className="text-link" onClick={() => setRemoved([])}><Undo2 aria-hidden="true" strokeWidth={2.25} />Put them back</button>
          </p>
        )}
      </fieldset>

      <p className="where">These corrections are Margin's own. Hardcover keeps what it has, and its updates won't undo them.</p>
      <div className="btn-row">
        <button type="submit" className="btn btn-solid" disabled={saving}>{saving ? 'Saving…' : 'Save corrections'}</button>
        <Link to="/books/$bookSlug" params={{ bookSlug: book.slug }} className="btn">Cancel</Link>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

/** The reader's corrections to a book (Steve, 2026-11-06): details, genres, topics and read dates. */
export function BookEdit() {
  const { bookSlug } = useParams({ from: '/books/$bookSlug/edit' })
  const found = useQuery(api.library.bookBySlug, { slug: bookSlug })
  if (found === undefined) return <p role="status">Finding your book…</p>
  if (found === null) return <NotFoundBook />
  return (
    <div className="narrow stack">
      <Link to="/books/$bookSlug" params={{ bookSlug }} className="back"><ArrowLeft aria-hidden="true" strokeWidth={2.25} />{found.book.title}</Link>
      <h1 className="title-head">Correct the details</h1>
      <hr className="rule" />
      <Form key={found.book.readId} found={found} />
      <hr className="rule" />
      <ReadDates book={found.book} />
    </div>
  )
}
