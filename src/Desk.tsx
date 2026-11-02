import { Link } from '@tanstack/react-router'
import { Camera, Check, Dices, MessageCircle, PenLine, Quote } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { toastDue } from './drawer-rules'
import { current, drawer, latestEntry } from './sample'
import { Thumb } from './Thumb'
import { Typewriter } from './Typewriter'

const TOAST_KEY = 'margin.drawerToastAt'

const read = (key: string) => {
  try { return localStorage.getItem(key) } catch { return null }
}
const write = (key: string, value: string) => {
  try { localStorage.setItem(key, value) } catch { /* private window: the toast just shows again */ }
}

export function Desk() {
  const [index, setIndex] = useState(0)
  const [percents, setPercents] = useState(() => current.map(c => c.percent))
  const [logging, setLogging] = useState(false)
  const [stamp, setStamp] = useState<number | null>(null)
  const [passed, setPassed] = useState<string[]>([])
  const [toast, setToast] = useState(false)

  const { book, format, prompt } = current[index]
  const percent = percents[index]
  const pending = !passed.includes(book.slug)

  useEffect(() => {
    if (!toastDue(read(TOAST_KEY), Date.now())) return
    const timer = setTimeout(() => {
      setToast(true)
      write(TOAST_KEY, String(Date.now()))
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  // The toast sits over the lower Desk, so it clears itself and never holds up the buddy's question.
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
    setStamp(null)
  }

  return (
    <div className="desk">
      <header className="masthead">
        <h1>Margin</h1>
      </header>

      <section className="reading" aria-label="Books you're reading">
        {current.map((c, i) => {
          const value = percents[i]
          return (
            <button key={c.book.slug} type="button" className="reading-cell" aria-pressed={i === index} onClick={() => go(i)}>
              <span className="reading-title">{c.book.title}</span>
              <span className="reading-sub">{c.format === 'audiobook' ? 'Audiobook' : c.book.author}</span>
              <Thumb book={c.book} />
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

      <hr className="rule" />

      <section className="note" aria-labelledby="note-heading">
        <h2 id="note-heading" className="head">{pending ? "Buddy's latest question" : 'Latest note'}</h2>
        {pending ? (
          <>
            <Typewriter key={book.slug} text={prompt} />
            <div className="btn-row">
              <Link to="/books/$bookSlug/buddy" params={{ bookSlug: book.slug }} className="btn btn-solid">Answer</Link>
              <button type="button" className="btn" onClick={() => setPassed([...passed, book.slug])}>Pass</button>
            </div>
          </>
        ) : (
          <div className="box">
            <p className="hand">{latestEntry.text}</p>
            <p className="where">{latestEntry.where}</p>
          </div>
        )}
      </section>

      <div className="actions">
        <button type="button" className="action" aria-expanded={logging} onClick={() => setLogging(!logging)}>
          <Check aria-hidden="true" strokeWidth={2.25} />Log progress
        </button>
        <Link to="/capture" className="action"><Quote aria-hidden="true" strokeWidth={2.25} />Add excerpt</Link>
        <Link to="/capture/camera" className="action"><Camera aria-hidden="true" strokeWidth={2.25} />Camera</Link>
        <Link to="/capture" className="action"><PenLine aria-hidden="true" strokeWidth={2.25} />Add note</Link>
        <Link to="/books/$bookSlug/buddy" params={{ bookSlug: book.slug }} className="action">
          <MessageCircle aria-hidden="true" strokeWidth={2.25} />Talk
        </Link>
      </div>

      {logging && (
        <form
          className="log box"
          onSubmit={e => {
            e.preventDefault()
            setLogging(false)
            setStamp(percent)
            navigator.vibrate?.(15)
          }}
        >
          <label htmlFor="progress">
            {book.title}: {percent}%{format === 'print' && `, page ${Math.round((percent / 100) * (book.pages ?? 0))}`}
          </label>
          <input
            id="progress"
            type="range"
            min={0}
            max={100}
            value={percent}
            onChange={e => setPercents(percents.map((p, i) => (i === index ? Number(e.target.value) : p)))}
          />
          <button type="submit" className="btn btn-solid">Save progress</button>
        </form>
      )}

      <Link to="/drawer" className="btn drawer-link"><Dices aria-hidden="true" strokeWidth={2.25} />Open the drawer</Link>

      <AnimatePresence>
        {toast && (
          <motion.aside
            className="toast"
            role="status"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            <p className="toast-head">From the drawer</p>
            <p className="book-voice">{drawer[0].text}</p>
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
