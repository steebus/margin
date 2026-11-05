import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useBooks } from '../../lib/offline'
import { motion } from 'motion/react'
import type { Book } from '../../lib/books'
import { sendQuietly } from '../../lib/quiet'

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
  const [saved, setSaved] = useState<{ slug: string; message: string } | null>(null)

  const audio = chosen.format === 'audio'
  const words = text.trim()
  const number = place.trim() === '' ? undefined : Number(place)
  const current = KINDS.find(k => k.id === kind)!
  const withNote = kind === 'excerpt' && note.trim() !== ''

  const save = () => {
    const args = {
      readId: chosen.readId,
      kind,
      text: words,
      ...(withNote ? { note: note.trim() } : {}),
      ...(shared ? { origin: 'share' as const } : {}),
      ...(number === undefined ? {} : audio ? { percent: number } : { page: number }),
    }
    // Done the moment it's tapped (Steve, 2026-11-06). If the server refuses it, a toast brings the words back.
    // A popup closes once the words are safe (landed, or kept on the device after a while), never on a refusal.
    const sent = sendQuietly('addEntry', args, () => addEntry(args), { message: `That ${current.label.toLowerCase()} didn't save to ${chosen.title}.`, words: [words, withNote ? note.trim() : ''].filter(Boolean).join('\n\n') })
    if (popup) void Promise.race([sent, new Promise<boolean>(r => setTimeout(() => r(true), 8000))]).then(ok => { if (ok) setTimeout(() => window.close(), 1200) })
    setSaved({
      slug: chosen.slug,
      message: navigator.onLine ? `Saved to ${chosen.title}.` : `Kept on this device. It goes to ${chosen.title} when you're back online.`,
    })
    setText('')
    setNote('')
    setPlace('')
    navigator.vibrate?.(15)
  }

  return (
    <form className="stack" onSubmit={e => { e.preventDefault(); if (words) save() }}>
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

      <button type="submit" className="btn btn-solid" disabled={!words}>{`Save ${current.label.toLowerCase()}`}</button>

      {saved && (
        <p role="status" className="saved-line">
          <motion.span
            key={saved.message + saved.slug}
            className="stamp stamp-inline"
            initial={{ scale: 1.8, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: -4, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 800, damping: 26 }}
            aria-hidden="true"
          >Kept</motion.span>
          {saved.message} <Link to="/books/$bookSlug" params={{ bookSlug: saved.slug }}>See it in the margin</Link>
        </p>
      )}
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
          <div className="btn-row"><Link to="/settings" search={{ tab: 'integrations' }} className="btn btn-solid">Go to Settings</Link></div>
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
