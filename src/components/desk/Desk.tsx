import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useBooks, useEntries } from '../../lib/offline'
import { toastDue } from '../../lib/drawer-rules'
import { Reflection } from '../book/Reflection'
import { ReadingStrip } from '../shelf/ReadingStrip'
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
  const [toast, setToast] = useState(false)
  const [pick] = useState(Math.random) // chosen once, so a data update doesn't swap the note while it shows

  const current = (books ?? []).filter(b => b.status === 'reading')
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

      {current.length > 0 ? <ReadingStrip books={current} /> : (
        <div className="box stack">
          <p>You're not reading anything right now. Pick something from your TBR.</p>
          <div className="btn-row"><Link to="/shelves/$shelfSlug" params={{ shelfSlug: 'tbr' }} className="btn btn-solid">Open your TBR</Link></div>
        </div>
      )}

      <hr className="rule" />

      <section className="note" aria-labelledby="note-heading">
        <h2 id="note-heading" className="head">{prompt ? 'A question' : 'Latest note'}</h2>
        {prompt ? <Reflection key={prompt.id} prompt={prompt} /> : latest ? (
          <Link to="/e/$entryId" params={{ entryId: latest.id }} className="box box-link">
            {latest.kind === 'excerpt' ? <p className="book-voice">{latest.text}</p> : <p className="hand">{latest.text}</p>}
            <p className="where">{latest.where}</p>
          </Link>
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
            <p className="book-voice">{entries![Math.floor(pick * entries!.length)].text}</p>
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
