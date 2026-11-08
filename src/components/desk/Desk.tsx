import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useActivity, useBooks, useEntries, useWaiting } from '../../lib/offline'
import { toastDue } from '../../lib/drawer-rules'
import { Reflection } from '../book/Reflection'
import { Card } from '../shelf/ReadingStrip'
import { CountUp } from './CountUp'
import { ProgressChart } from './ProgressChart'
import { RecentPile } from './RecentPile'
import { progressSteps, windowStart } from '../../../convex/lib/activity'
import { formatClock } from '../../lib/progress'
import { Typewriter } from '../typewriter/Typewriter'

const TOAST_KEY = 'margin.drawerToastAt'

const read = (key: string) => {
  try { return localStorage.getItem(key) } catch { return null }
}
const write = (key: string, value: string) => {
  try { localStorage.setItem(key, value) } catch { /* private window: the toast just shows again */ }
}

// The catalog's dateline: today, and what's in hand. Printed, not announced.
function Masthead({ reading }: { reading?: number }) {
  const [today] = useState(() => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))
  return (
    <header className="masthead-block">
      <div className="masthead"><h1>Margin</h1></div>
      <p className="dateline">{today}{reading ? ` · ${reading} in hand` : ''}</p>
    </header>
  )
}

export function Desk() {
  const books = useBooks()
  const entries = useEntries()
  const waiting = useWaiting()
  const [toast, setToast] = useState(false)
  const [pick] = useState(Math.random) // chosen once, so a data update doesn't swap the note while it shows

  const current = (books ?? []).filter(b => b.status === 'reading')
  const latest = entries?.[0]
  const prompt = waiting?.[0]
  // The window is fixed when the Desk opens, so the query isn't asked afresh every render.
  const [now] = useState(Date.now)
  const since = windowStart(now)
  const activity = useActivity(since)
  const shown = entries?.length ? entries[Math.floor(pick * entries.length)] : undefined

  // Only once there's something in the drawer to offer.
  useEffect(() => {
    if (!entries?.length || !toastDue(read(TOAST_KEY), Date.now())) return
    const timer = setTimeout(() => {
      setToast(true)
      write(TOAST_KEY, String(Date.now()))
    }, 1500)
    return () => clearTimeout(timer)
  }, [entries?.length])

  // The toast stays until it's dismissed or opened (Steve, 2026-11-06).
  if (books === undefined) return <div className="desk"><Masthead /><p role="status">Opening your desk…</p></div>

  if (books.length === 0) {
    return (
      <div className="desk">
        <Masthead />
        <div className="box stack">
          <p>Your shelves are empty. Bring your books in from Hardcover to start.</p>
          <div className="btn-row"><Link to="/settings" search={{ tab: 'integrations' }} className="btn btn-solid">Go to Settings</Link></div>
        </div>
      </div>
    )
  }

  return (
    <div className="desk">
      <Masthead reading={current.length} />

      <section className="desk-reading stack" aria-labelledby="reading-heading">
        <h2 id="reading-heading" className="head">Reading</h2>
        {current.length > 0 ? current.map(book => {
          const logs = activity?.logs.find(l => l.readId === book.readId)?.logs ?? []
          const steps = progressSteps(logs, since, now, book.startedAt) ?? { points: [{ at: since, percent: book.percent }], opened: true, gained: 0 }
          const logged = steps.points.length - (steps.opened ? 1 : 0)
          return (
            <article key={book.readId} className="desk-book">
              <Card book={book} />
              <div className="desk-book-chart">
                <p className="desk-book-head">
                  <span className="selected-title">{book.title}</span>
                  <span className="where">{steps.gained > 0 ? <>+<CountUp value={steps.gained} format={n => String(n)} />% in two weeks</> : logged ? `Logged at ${book.percent}%, no further in two weeks` : 'No progress logged in two weeks'}</span>
                </p>
                {activity !== undefined && <ProgressChart points={steps.points} opened={steps.opened} since={since} now={now} title={book.title} />}
              </div>
            </article>
          )
        }) : (
          <div className="box stack">
            <p>You're not reading anything right now. Pick something from your TBR.</p>
            <div className="btn-row"><Link to="/shelves/$shelfSlug" params={{ shelfSlug: 'tbr' }} className="btn btn-solid">Open your TBR</Link></div>
          </div>
        )}
      </section>

      <aside className="desk-side stack" aria-labelledby="window-heading">
        {prompt && <Reflection key={prompt.id} prompt={prompt} />}
        <h2 id="window-heading" className="head">The last two weeks</h2>
        <dl className="tiles desk-tiles">
          <div><dt>Pages read</dt><dd>{activity ? <CountUp value={activity.pages} /> : '…'}</dd></div>
          <div><dt>Listened</dt><dd>{activity ? <CountUp value={activity.audioSeconds} format={formatClock} /> : '…'}</dd></div>
          <div><dt>Books finished</dt><dd>{activity?.finished ?? '…'}</dd></div>
          <div><dt>Notes written</dt><dd>{activity?.notes ?? '…'}</dd></div>
        </dl>
        <section className="stack" aria-labelledby="tbr-heading">
          <h2 id="tbr-heading" className="head">Newly on the TBR</h2>
          {activity && activity.added.length > 0 && <RecentPile books={activity.added} />}
          <div className="btn-row"><Link to="/capture/add" className="btn"><Plus aria-hidden="true" strokeWidth={2.25} />Add a book</Link></div>
        </section>
        {activity && !activity.notes && !activity.added.length && !latest && (
          <Typewriter text="Nothing here yet. Your notes, and your buddy's questions, will land on this sheet." />
        )}
      </aside>

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
            <p className="book-voice">{shown!.text}</p>
            <div className="btn-row">
              {/* The note itself, in its book: the drawer only chose it. */}
              {shown!.slug
                ? <Link to="/books/$bookSlug/entries/$entryId" params={{ bookSlug: shown!.slug, entryId: shown!.id }} className="btn btn-solid">Open the note</Link>
                : <Link to="/e/$entryId" params={{ entryId: shown!.id }} className="btn btn-solid">Open the note</Link>}
              <button type="button" className="btn" onClick={() => setToast(false)}>Dismiss</button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}
