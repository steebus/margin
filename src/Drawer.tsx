import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { nextCard } from './drawer-rules'
import { drawer, slugFor } from './sample'

const kinds = [
  { id: undefined, label: 'All' },
  { id: 'excerpt', label: 'Excerpts' },
  { id: 'note', label: 'Notes' },
] as const

export function Drawer() {
  const { kind } = useSearch({ from: '/drawer' })
  const navigate = useNavigate({ from: '/drawer' })
  const [card, setCard] = useState(0)
  const [hidden, setHidden] = useState<string[]>([])

  const entries = drawer.filter(e => (!kind || e.kind === kind) && !hidden.includes(e.text))
  const entry = entries[card % Math.max(entries.length, 1)]

  return (
    <div className="narrow stack">
      <h1 className="title-head">The drawer</h1>

      <div className="segments" role="group" aria-label="Show">
        {kinds.map(k => (
          <button
            key={k.label}
            type="button"
            aria-pressed={kind === k.id}
            onClick={() => {
              setCard(0)
              navigate({ search: prev => ({ ...prev, kind: k.id }) })
            }}
          >
            {k.label}
          </button>
        ))}
      </div>

      <hr className="rule" />

      {entry ? (
        <>
          <div className="drawer-slot">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.article
                key={entry.text}
                className="box drawer-card"
                initial={{ y: 48, opacity: 0, rotate: 1.5 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                exit={{ x: 320, rotate: 10, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              >
                {entry.kind === 'excerpt'
                  ? <blockquote className="book-voice">{entry.text}</blockquote>
                  : <p className="hand">{entry.text}</p>}
                {entry.note && <p className="hand">{entry.note}</p>}
                <p className="where">{entry.where}</p>
              </motion.article>
            </AnimatePresence>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-solid"
              disabled={entries.length < 2}
              onClick={() => setCard(c => nextCard(c % entries.length, entries.length))}
            >
              Shuffle
            </button>
            <Link to="/books/$bookSlug/buddy" params={{ bookSlug: slugFor(entry.book) }} className="btn">Talk about this</Link>
            <button type="button" className="btn" onClick={() => setHidden([...hidden, entry.text])}>Not this one again</button>
          </div>
        </>
      ) : (
        <div className="box stack">
          <p>Nothing left in this drawer. Show everything again, or capture a new line.</p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-solid"
              onClick={() => {
                setHidden([])
                navigate({ search: prev => ({ ...prev, kind: undefined }) })
              }}
            >
              Show everything
            </button>
            <Link to="/capture" className="btn">Capture</Link>
          </div>
        </div>
      )}
    </div>
  )
}
