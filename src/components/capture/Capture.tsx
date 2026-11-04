import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useBooks } from '../../lib/offline'
import { errorText, type Book } from '../../lib/books'
import { sendOrKeep } from '../../lib/outbox'

const KINDS = [
  { id: 'excerpt', label: 'Excerpt', prompt: 'The line, as the book has it' },
  { id: 'note', label: 'Note', prompt: 'What you thought' },
  { id: 'summary', label: 'Summary', prompt: 'What happened, in your words' },
] as const

const byTitle = (a: Book, b: Book) => a.title.localeCompare(b.title)

function Form({ books }: { books: Book[] }) {
  // Words shared in from another app arrive as text, and maybe a page (SPEC 3.4).
  const { book: slug, kind = 'excerpt', text: shared, page: sharedPage, popup } = useSearch({ from: '/capture/' })
  const navigate = useNavigate({ from: '/capture/' })
  const addEntry = useMutation(api.entries.addEntry)
  // Offline this stays undefined, and the first book being read stands in.
  const latest = useQuery(api.library.latestRead)
  const reading = books.filter(b => b.status === 'reading').sort(byTitle)
  const others = books.filter(b => b.status !== 'reading').sort(byTitle)
  const chosen = books.find(b => b.slug === slug) ?? books.find(b => b.readId === latest) ?? reading[0] ?? others[0]
  const [text, setText] = useState(shared ?? '')
  const [note, setNote] = useState('')
  const [place, setPlace] = useState(sharedPage ? String(sharedPage) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<{ slug: string; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const audio = chosen.format === 'audio'
  const words = text.trim()
  const number = place.trim() === '' ? undefined : Number(place)
  const current = KINDS.find(k => k.id === kind)!
  const withNote = kind === 'excerpt' && note.trim() !== ''

  useEffect(() => {
    if (!popup || !saved) return
    const timer = setTimeout(() => window.close(), 1800)
    return () => clearTimeout(timer)
  }, [popup, saved])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const args = {
        readId: chosen.readId,
        kind,
        text: words,
        ...(withNote ? { note: note.trim() } : {}),
        ...(shared ? { origin: 'share' as const } : {}),
        ...(number === undefined ? {} : audio ? { percent: number } : { page: number }),
      }
      const sent = await sendOrKeep('addEntry', args, () => addEntry(args))
      setSaved({
        slug: chosen.slug,
        message: sent.kept
          ? `Kept on this device. It goes to ${chosen.title} when you're back online.`
          : sent.result.duplicate ? `Already saved to ${chosen.title}.` : `Saved to ${chosen.title}.`,
      })
      setText('')
      setNote('')
      setPlace('')
      navigator.vibrate?.(15)
    } catch (e) {
      setError(errorText(e, "That didn't save. Your words are still here: check your connection and try again."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="stack" onSubmit={e => { e.preventDefault(); if (words) void save() }}>
      <div className="segments" role="group" aria-label="What is it?">
        {KINDS.map(k => (
          <button
            key={k.id}
            type="button"
            aria-pressed={kind === k.id}
            onClick={() => navigate({ search: prev => ({ ...prev, kind: k.id }), replace: true })}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="field">
        <label htmlFor="capture-book">Book</label>
        <select
          id="capture-book"
          value={chosen.slug}
          onChange={e => navigate({ search: prev => ({ ...prev, book: e.target.value }), replace: true })}
        >
          {reading.length > 0 && <optgroup label="Reading">{reading.map(b => <option key={b.slug} value={b.slug}>{b.title}</option>)}</optgroup>}
          <optgroup label="Everything else">{others.map(b => <option key={b.slug} value={b.slug}>{b.title}</option>)}</optgroup>
        </select>
      </div>

      <div className="field">
        <label htmlFor="capture-text">{current.label}</label>
        <textarea
          id="capture-text"
          className={kind === 'excerpt' ? 'book-voice' : 'hand'}
          rows={6}
          value={text}
          placeholder={current.prompt}
          onChange={e => { setText(e.target.value); setSaved(null) }}
        />
      </div>

      {kind === 'excerpt' && (
        <div className="field">
          <label htmlFor="capture-note">Your note, if you have one</label>
          <textarea id="capture-note" className="hand" rows={3} value={note} placeholder="What you thought" onChange={e => { setNote(e.target.value); setSaved(null) }} />
        </div>
      )}

      <div className="field field-short">
        <label htmlFor="capture-place">{audio ? 'Percent through' : 'Page'}</label>
        <input
          id="capture-place"
          type="number"
          inputMode="numeric"
          min={audio ? 0 : 1}
          max={audio ? 100 : undefined}
          step={1}
          value={place}
          onChange={e => setPlace(e.target.value)}
        />
      </div>

      <button type="submit" className="btn btn-solid" disabled={!words || saving}>{saving ? 'Saving…' : `Save ${current.label.toLowerCase()}`}</button>

      {saved && (
        <p role="status">
          {saved.message} <Link to="/books/$bookSlug" params={{ bookSlug: saved.slug }}>See it in the margin</Link>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

export function Capture() {
  const books = useBooks()
  return (
    <div className="narrow stack">
      <h1 className="title-head">Capture</h1>
      <hr className="rule" />
      {books === undefined && <p role="status">Opening your shelves…</p>}
      {books?.length === 0 && (
        <div className="box stack">
          <p>Add some books first, so there's somewhere to keep this.</p>
          <div className="btn-row"><Link to="/settings" className="btn btn-solid">Go to Settings</Link></div>
        </div>
      )}
      {books && books.length > 0 && (
        <>
          <Link to="/capture/add" className="btn"><Plus aria-hidden="true" strokeWidth={2.25} />Add a book</Link>
          <Form books={books} />
        </>
      )}
    </div>
  )
}
