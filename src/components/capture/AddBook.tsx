import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { errorText, type Status } from '../../lib/books'
import type { FunctionReturnType } from 'convex/server'

export type Result = FunctionReturnType<typeof api.books.search>[number]

const STATUS: { id: Status; label: string }[] = [
  { id: 'tbr', label: 'TBR' },
  { id: 'reading', label: 'Reading' },
  { id: 'read', label: 'Read' },
]

export const bookLine = (book: Result['book']) =>
  [book.authors[0], book.year, book.pages && `${book.pages} pages`].filter(Boolean).join(', ')

/** Which list a book goes on, beyond its status. Nothing chosen means just the status shelf. */
export function ListChoice({ value, onChange }: { value: Id<'shelves'> | ''; onChange: (id: Id<'shelves'> | '') => void }) {
  const lists = useQuery(api.books.myLists)
  if (!lists?.length) return null
  return (
    <div className="field">
      <label htmlFor="add-list">Also on a list</label>
      <select id="add-list" value={value} onChange={e => onChange(e.target.value as Id<'shelves'> | '')}>
        <option value="">No list</option>
        {lists.filter(l => !l.filter).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </div>
  )
}

/** Finds a book on Hardcover and puts it on your shelves, and on Hardcover. */
export function AddBook() {
  const { q } = useSearch({ from: '/capture/add' })
  const navigate = useNavigate({ from: '/capture/add' })
  const search = useAction(api.books.search)
  const addBooks = useMutation(api.books.addBooks)
  const [words, setWords] = useState(q ?? '')
  const [results, setResults] = useState<Result[] | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [status, setStatus] = useState<Status>('tbr')
  const [list, setList] = useState<Id<'shelves'> | ''>('')
  const [who, setWho] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (text: string) => {
    setBusy(true)
    setError(null)
    setPicked(null)
    try {
      const found = await search({ q: text })
      setResults(found)
      setPicked(found.find(f => !f.onShelves)?.book.hardcoverId ?? null)
    } catch (e) {
      setError(errorText(e, "The search didn't work. Check your connection and try again."))
    } finally {
      setBusy(false)
    }
  }

  // A link that already says what to look for.
  useEffect(() => { if (q) void run(q) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = results?.find(r => r.book.hardcoverId === picked)?.book

  const add = async () => {
    if (!chosen) return
    setBusy(true)
    setError(null)
    try {
      const [{ slug }] = await addBooks({
        books: [chosen],
        status,
        ...(list ? { listId: list } : {}),
        ...(who.trim() ? { source: { kind: 'person' as const, who: who.trim() } } : {}),
      })
      navigator.vibrate?.(15)
      void navigate({ to: '/books/$bookSlug', params: { bookSlug: slug } })
    } catch (e) {
      setError(errorText(e, "That didn't save. Check your connection and try again."))
      setBusy(false)
    }
  }

  return (
    <div className="narrow stack">
      <h1 className="title-head">Add a book</h1>
      <hr className="rule" />

      <form className="reply" onSubmit={e => { e.preventDefault(); if (words.trim()) void run(words.trim()) }}>
        <label className="tools-search">
          <Search aria-hidden="true" strokeWidth={2.25} />
          <span className="sr-only">Title, author or ISBN</span>
          <input type="search" autoFocus value={words} placeholder="Title, author or ISBN" onChange={e => setWords(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-solid" disabled={busy || !words.trim()}>Search</button>
      </form>

      {busy && !results && <p role="status">Searching…</p>}
      {error && <p role="alert">{error}</p>}
      {results?.length === 0 && <p>Nothing found on Hardcover for that. Try fewer words, or the ISBN.</p>}

      {!!results?.length && (
        <form className="stack" onSubmit={e => { e.preventDefault(); void add() }}>
          <fieldset className="choices">
            <legend className="head">Which one?</legend>
            {results.map(({ book, onShelves }) => (
              <label key={book.hardcoverId} className="choice" data-off={onShelves || undefined}>
                <input type="radio" name="book" disabled={onShelves} checked={picked === book.hardcoverId} onChange={() => setPicked(book.hardcoverId)} />
                <span>
                  <span className="choice-title">{book.title}</span>
                  <span className="where"> {bookLine(book)}</span>
                  {onShelves && <span className="where">, already on your shelves. <Link to="/books/$bookSlug" params={{ bookSlug: book.slug }}>Open it</Link></span>}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="segments" role="group" aria-label="Status">
            {STATUS.map(s => <button key={s.id} type="button" aria-pressed={status === s.id} onClick={() => setStatus(s.id)}>{s.label}</button>)}
          </div>
          <ListChoice value={list} onChange={setList} />
          <div className="field">
            <label htmlFor="add-who">Who recommended it, if anyone</label>
            <input id="add-who" value={who} autoComplete="off" onChange={e => setWho(e.target.value)} />
          </div>
          <p className="where">Also adds it to Hardcover. It's drawn when you ask on its page; until then it shows a cross-hatch of its cover.</p>
          <button type="submit" className="btn btn-solid" disabled={busy || !chosen}>{busy ? 'Adding…' : chosen ? `Add ${chosen.title}` : 'Choose a book'}</button>
        </form>
      )}
    </div>
  )
}
