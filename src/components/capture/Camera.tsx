import { Link, useSearch } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import { Camera as CameraIcon, ImageUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useBooks } from '../../lib/offline'
import { errorText, type Book } from '../../lib/books'
import { readPage } from '../../lib/ocr'
import { nextRange, passage, wordsOf, type Range, type Read } from '../../lib/photo'
import { Typewriter } from '../typewriter/Typewriter'

// Long enough to see it arrive, short enough that a full page doesn't hold anyone up.
const TYPE_FOR_MS = 5000

function Mark({ read, book, books, onBook, onAgain }: { read: Read; book: Book; books: Book[]; onBook: (slug: string) => void; onAgain: () => void }) {
  const addEntry = useMutation(api.entries.addEntry)
  const [range, setRange] = useState<Range>(null)
  const [text, setText] = useState(() => passage(read.paragraphs, null))
  const [note, setNote] = useState('')
  const [page, setPage] = useState(read.page ? String(read.page) : '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const words = useMemo(() => wordsOf(read.paragraphs), [read])
  const inRange = (i: number) => range !== null && i >= range[0] && i <= range[1]

  const tap = (i: number) => {
    const next = nextRange(range, i)
    setRange(next)
    setText(passage(read.paragraphs, next))
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const place = { ...(page ? { page: Number(page) } : {}), ...(read.chapter ? { chapter: read.chapter } : {}) }
      const { id } = await addEntry({ readId: book.readId, kind: 'excerpt', text, origin: 'camera', ...place })
      if (note.trim()) await addEntry({ readId: book.readId, kind: 'note', text: note, origin: 'camera', parentId: id, ...place })
      navigator.vibrate?.(15)
      setSaved(true)
    } catch (e) {
      setError(errorText(e, "That didn't save. Your words are still here: check your connection and try again."))
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="box stack" role="status">
        <p className="book-voice">Saved to {book.title}.</p>
        <div className="btn-row">
          <button type="button" className="btn btn-solid" onClick={onAgain}>Another page</button>
          <Link to="/books/$bookSlug/entries" params={{ bookSlug: book.slug }} className="btn">See it in your notes</Link>
        </div>
      </div>
    )
  }

  return (
    <form className="stack" onSubmit={e => { e.preventDefault(); if (text.trim()) void save() }}>
      <p className="where">Tap the first word of the line you want, then the last. Or keep the whole page.</p>
      {/* Tapping words is a shortcut: the box below holds the same text, and works from the keyboard. */}
      <div className="page-text" aria-hidden="true" onClick={e => { const i = (e.target as HTMLElement).dataset.i; if (i) tap(Number(i)) }}>
        {words.map((paragraph, p) => (
          <p key={p}>
            {paragraph.map(w => <span key={w.index} data-i={w.index} data-on={inRange(w.index) || undefined}>{w.text} </span>)}
          </p>
        ))}
      </div>

      <div className="field">
        <label htmlFor="camera-text">Excerpt</label>
        <textarea id="camera-text" className="book-voice" rows={5} value={text} onChange={e => setText(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="camera-note">Your note, if you have one</label>
        <textarea id="camera-note" className="hand" rows={2} value={note} placeholder="What you thought" onChange={e => setNote(e.target.value)} />
      </div>
      <div className="book-controls">
        <div className="field">
          <label htmlFor="camera-book">Book</label>
          <select id="camera-book" value={book.slug} onChange={e => onBook(e.target.value)}>
            {books.map(b => <option key={b.slug} value={b.slug}>{b.title}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="camera-page">Page</label>
          <input id="camera-page" type="number" inputMode="numeric" min={1} step={1} value={page} onChange={e => setPage(e.target.value)} />
        </div>
      </div>
      {read.chapter && <p className="where">{read.chapter}</p>}
      <div className="btn-row btn-row-fill">
        <button type="submit" className="btn btn-solid" disabled={!text.trim() || saving}>{saving ? 'Saving…' : 'Save excerpt'}</button>
        <button type="button" className="btn" onClick={onAgain}>Start again</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

export function Camera() {
  const { book: slug } = useSearch({ from: '/capture/camera' })
  const all = useBooks()
  const transcribe = useAction(api.capture.transcribe)
  const [reading, setReading] = useState(false)
  const [read, setRead] = useState<Read | null>(null)
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chosen, setChosen] = useState(slug)

  useEffect(() => {
    if (!typing) return
    const timer = setTimeout(() => setTyping(false), TYPE_FOR_MS)
    return () => clearTimeout(timer)
  }, [typing])

  const books = useMemo(() => [...(all ?? [])].sort((a, b) => Number(b.status === 'reading') - Number(a.status === 'reading') || a.title.localeCompare(b.title)), [all])
  const book = books.find(b => b.slug === chosen) ?? books[0]

  const choose = async (file?: File) => {
    if (!file) return
    setError(null)
    setRead(null)
    setReading(true)
    try {
      const result = await readPage(file, transcribe)
      if (result.paragraphs.length) {
        setRead(result)
        setTyping(true)
      } else {
        setError("There's no text to read in that photo. Try again with the whole page in frame.")
      }
    } catch (e) {
      setError(errorText(e, "That page couldn't be read. Check your connection and try again."))
    } finally {
      setReading(false)
    }
  }

  return (
    <div className="narrow stack">
      <h1 className="title-head">Camera</h1>
      <hr className="rule" />

      {reading && <p role="status" className="book-voice">Reading the page…</p>}

      {!read && !reading && (
        <>
          <p>Photograph a page and Margin reads it for you. The photo isn't kept.</p>
          <div className="btn-row btn-row-fill">
            <label className="btn btn-solid">
              <CameraIcon aria-hidden="true" strokeWidth={2.25} />Photograph a page
              <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={e => void choose(e.target.files?.[0])} />
            </label>
            <label className="btn">
              <ImageUp aria-hidden="true" strokeWidth={2.25} />Choose a photo
              <input className="sr-only" type="file" accept="image/*" onChange={e => void choose(e.target.files?.[0])} />
            </label>
          </div>
          {error && <p role="alert">{error}</p>}
          <p className="where"><Link to="/capture" search={{ book: chosen, kind: 'excerpt' }}>Type it instead</Link></p>
        </>
      )}

      {read && typing && (
        <div className="stack" onClick={() => setTyping(false)}>
          <Typewriter text={read.paragraphs.join(' ')} onDone={() => setTyping(false)} />
        </div>
      )}

      {read && !typing && book && (
        <Mark key={read.paragraphs[0]} read={read} book={book} books={books} onBook={setChosen} onAgain={() => setRead(null)} />
      )}
    </div>
  )
}
