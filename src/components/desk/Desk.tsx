import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Camera, Check, Dices, MessageCircle, PenLine, Quote } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { toastDue } from '../../lib/drawer-rules'
import { Thumb } from '../thumb/Thumb'
import { Typewriter } from '../typewriter/Typewriter'

const TOAST_KEY = 'margin.drawerToastAt'

const read = (key: string) => {
  try { return localStorage.getItem(key) } catch { return null }
}
const write = (key: string, value: string) => {
  try { localStorage.setItem(key, value) } catch { /* private window: the toast just shows again */ }
}

function Masthead() {
  return (
    <header className="masthead">
      <h1>Margin</h1>
    </header>
  )
}

export function Desk() {
  const books = useQuery(api.library.myBooks)
  const entries = useQuery(api.library.recentEntries)
  const logProgress = useMutation(api.library.logProgress)
  const [index, setIndex] = useState(0)
  const [draft, setDraft] = useState<number | null>(null)
  const [logging, setLogging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [stamp, setStamp] = useState<number | null>(null)
  const [toast, setToast] = useState(false)

  const current = (books ?? []).filter(b => b.status === 'reading')
  const book = current[Math.min(index, Math.max(current.length - 1, 0))]
  const latest = entries?.[0]
  const percent = draft ?? book?.percent ?? 0

  // Only once there's something in the drawer to offer.
  useEffect(() => {
    if (!entries?.length || !toastDue(read(TOAST_KEY), Date.now())) return
    const timer = setTimeout(() => {
      setToast(true)
      write(TOAST_KEY, String(Date.now()))
    }, 1500)
    return () => clearTimeout(timer)
  }, [entries?.length])

  // The toast sits over the Desk, so it clears itself and never holds up the buddy's question.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(false), 9000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (stamp === null) return
    const timer = setTimeout(() => setStamp(null), 1600)
    return () => clearTimeout(timer)
  }, [stamp])

  const go = (i: number) => {
    setIndex(i)
    setLogging(false)
    setDraft(null)
    setStamp(null)
    setFailed(false)
  }

  if (books === undefined) return <div className="desk"><Masthead /><p role="status">Opening your desk…</p></div>

  if (books.length === 0) {
    return (
      <div className="desk">
        <Masthead />
        <div className="box stack">
          <p>Your shelves are empty. Bring your books in from Hardcover to start.</p>
          <div className="btn-row"><Link to="/settings" className="btn btn-solid">Go to Settings</Link></div>
        </div>
      </div>
    )
  }

  const save = async () => {
    if (!book) return
    setSaving(true)
    setFailed(false)
    try {
      await logProgress({ readId: book.readId, percent })
      setLogging(false)
      setDraft(null)
      setStamp(percent)
      navigator.vibrate?.(15)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="desk">
      <Masthead />

      {book ? (
        <section className="reading" aria-label="Books you're reading" style={{ gridTemplateColumns: `repeat(${Math.min(current.length, 2)}, minmax(0, 1fr))` }}>
          {current.map((c, i) => {
            const value = i === index && draft !== null ? draft : c.percent
            return (
              <button key={c.readId} type="button" className="reading-cell" aria-pressed={c.readId === book.readId} onClick={() => go(i)}>
                <span className="reading-title">{c.title}</span>
                <span className="reading-sub">{c.format === 'audio' ? 'Audiobook' : c.author}</span>
                <Thumb book={c} />
                <span className="pct">{value}%</span>
                <span className="bar" aria-hidden="true"><span style={{ transform: `scaleX(${value / 100})` }} /></span>
              </button>
            )
          })}
          <AnimatePresence>
            {stamp !== null && (
              <motion.span
                className="stamp"
                role="status"
                initial={{ scale: 1.9, rotate: -14, opacity: 0 }}
                animate={{ scale: 1, rotate: -5, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 800, damping: 26 }}
              >
                Logged {stamp}%
              </motion.span>
            )}
          </AnimatePresence>
        </section>
      ) : (
        <div className="box stack">
          <p>You're not reading anything right now. Pick something from your TBR.</p>
          <div className="btn-row"><Link to="/shelves" search={{ status: 'tbr' }} className="btn btn-solid">Open your TBR</Link></div>
        </div>
      )}

      <hr className="rule" />

      <section className="note" aria-labelledby="note-heading">
        <h2 id="note-heading" className="head">Latest note</h2>
        {latest ? (
          <div className="box">
            {latest.kind === 'excerpt' ? <p className="book-voice">{latest.text}</p> : <p className="hand">{latest.text}</p>}
            <p className="where">{latest.where}</p>
          </div>
        ) : (
          <Typewriter text="Nothing here yet. Your notes, and your buddy's questions, will land on this sheet." />
        )}
      </section>

      {book && (
        <>
          <div className="actions">
            <button type="button" className="action" aria-expanded={logging} onClick={() => setLogging(!logging)}>
              <Check aria-hidden="true" strokeWidth={2.25} />Log progress
            </button>
            <Link to="/capture" search={{ book: book.slug, kind: 'excerpt' }} className="action"><Quote aria-hidden="true" strokeWidth={2.25} />Add excerpt</Link>
            <Link to="/capture/camera" className="action"><Camera aria-hidden="true" strokeWidth={2.25} />Camera</Link>
            <Link to="/capture" search={{ book: book.slug, kind: 'note' }} className="action"><PenLine aria-hidden="true" strokeWidth={2.25} />Add note</Link>
            <Link to="/books/$bookSlug/buddy" params={{ bookSlug: book.slug }} className="action">
              <MessageCircle aria-hidden="true" strokeWidth={2.25} />Talk
            </Link>
          </div>

          {logging && (
            <form className="log box" onSubmit={e => { e.preventDefault(); void save() }}>
              <label htmlFor="progress">
                {book.title}: {percent}%
                {book.format !== 'audio' && book.pages ? `, page ${Math.round((percent / 100) * book.pages)}` : ''}
              </label>
              <input
                id="progress"
                type="range"
                min={0}
                max={100}
                value={percent}
                onChange={e => setDraft(Number(e.target.value))}
              />
              <button type="submit" className="btn btn-solid" disabled={saving}>{saving ? 'Saving…' : 'Save progress'}</button>
              {failed && <p role="alert">That didn't save. Check your connection and try again.</p>}
            </form>
          )}
        </>
      )}

      <Link to="/drawer" className="btn drawer-link"><Dices aria-hidden="true" strokeWidth={2.25} />Open the drawer</Link>

      <AnimatePresence>
        {toast && latest && (
          <motion.aside
            className="toast"
            role="status"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            <p className="toast-head">From the drawer</p>
            <p className="book-voice">{entries![Math.floor(Math.random() * entries!.length)].text}</p>
            <div className="btn-row">
              <Link to="/drawer" className="btn btn-solid">Open the drawer</Link>
              <button type="button" className="btn" onClick={() => setToast(false)}>Dismiss</button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}
