import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useBooks, useEntries } from '../../lib/offline'
import { toastDue } from '../../lib/drawer-rules'
import { ProgressForm } from '../book/ProgressForm'
import { QuickActions } from '../book/QuickActions'
import { Reflection } from '../book/Reflection'
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
  const books = useBooks()
  const entries = useEntries()
  const waiting = useQuery(api.reflect.waiting)
  const [chosen, setChosen] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)
  const [stamp, setStamp] = useState<string | null>(null)
  const [toast, setToast] = useState(false)

  const current = (books ?? []).filter(b => b.status === 'reading')
  const book = current.find(b => b.readId === chosen) ?? current[0]
  const latest = entries?.[0]
  const prompt = waiting?.[0]

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

  return (
    <div className="desk">
      <Masthead />

      {current.length > 0 ? (
        <section className="reading" aria-label="Books you're reading">
          {current.map(c => (
            <div key={c.readId} className="reading-cell">
              <Thumb book={c} marks={false} />
              <div className="reading-text">
                {c.readId === book.readId
                  ? <p className="reading-label">Current book</p>
                  : <button type="button" className="reading-label reading-switch" onClick={() => { setChosen(c.readId); setLogging(false) }}>Switch to</button>}
                {/* Stretched over the whole cell, so tapping anywhere but "Switch to" opens the book. */}
                <Link to="/books/$bookSlug" params={{ bookSlug: c.slug }} className="reading-title">{c.title}</Link>
                <p className="reading-sub">{c.format === 'audio' ? 'audiobook' : `by ${c.author}`}</p>
                <p className="pct">{c.percent}%</p>
                <span className="bar" aria-hidden="true"><span style={{ transform: `scaleX(${c.percent / 100})` }} /></span>
              </div>
            </div>
          ))}
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
                {stamp}
              </motion.span>
            )}
          </AnimatePresence>
        </section>
      ) : (
        <div className="box stack">
          <p>You're not reading anything right now. Pick something from your TBR.</p>
          <div className="btn-row"><Link to="/shelves/$shelfSlug" params={{ shelfSlug: 'tbr' }} className="btn btn-solid">Open your TBR</Link></div>
        </div>
      )}

      {book && <QuickActions book={book} logging={logging} onLog={() => setLogging(!logging)} />}

      {book && logging && <ProgressForm key={book.readId} book={book} onSaved={label => { setLogging(false); setStamp(label) }} />}

      <hr className="rule" />

      <section className="note" aria-labelledby="note-heading">
        <h2 id="note-heading" className="head">{prompt ? 'A question' : 'Latest note'}</h2>
        {prompt ? <Reflection key={prompt.id} prompt={prompt} /> : latest ? (
          <div className="box">
            {latest.kind === 'excerpt' ? <p className="book-voice">{latest.text}</p> : <p className="hand">{latest.text}</p>}
            <p className="where">{latest.where}</p>
          </div>
        ) : (
          <Typewriter text="Nothing here yet. Your notes, and your buddy's questions, will land on this sheet." />
        )}
      </section>

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
