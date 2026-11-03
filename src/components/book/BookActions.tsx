import { Link, useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, X } from 'lucide-react'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Book } from '../../lib/books'
import { useLongPress } from '../../lib/longPress'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { api } from '../../../convex/_generated/api'
import { Thumb } from '../thumb/Thumb'
import { CoverControls } from './CoverControls'
import { GuideControls } from './GuideControls'
import { ProgressForm } from './ProgressForm'
import { QuickActions } from './QuickActions'

const OpenActions = createContext<(book: Book) => void>(() => {})

/** Hold a book anywhere to get what you do with it. */
export const useBookHold = (book: Book) => useLongPress(useContext(OpenActions).bind(null, book))
/** Opens the same sheet from a button, for the book page. */
export const useOpenBookActions = () => useContext(OpenActions)

function Sheet({ book, onClose, onLogged }: { book: Book; onClose: () => void; onLogged: (label: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [logging, setLogging] = useState(false)
  // The guide and the picture, which the shelf's list of books doesn't carry.
  const found = useQuery(api.library.bookBySlug, { slug: book.slug })
  const onPage = useRouterState({ select: st => st.location.pathname }) === `/books/${book.slug}`

  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="sheet-title"
      onCancel={e => { e.preventDefault(); onClose() }}
      // A tap on the dimmed page outside the sheet closes it.
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        className="sheet-body"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
      >
        <header className="sheet-head">
          <Thumb book={book} marks={false} />
          <div className="sheet-head-text">
            <h2 id="sheet-title" className="selected-title">{book.title}</h2>
            <p className="where">{book.author}</p>
            {(book.status === 'reading' || book.status === 'paused') && <p className="pct">{book.percent}%</p>}
          </div>
          <button type="button" className="theme-toggle" aria-label="Close" onClick={onClose}><X aria-hidden="true" strokeWidth={2.25} /></button>
        </header>
        <QuickActions book={book} logging={logging} onLog={() => setLogging(!logging)} />
        {logging && book.status !== 'read' && <ProgressForm book={book} onSaved={onLogged} />}
        {!onPage && <Link to="/books/$bookSlug" params={{ bookSlug: book.slug }} className="btn"><BookOpen aria-hidden="true" strokeWidth={2.25} />Open the book</Link>}
        {found && (
          <>
            <details className="sheet-more">
              <summary>Guide</summary>
              <GuideControls readId={book.readId} guide={found.guide} />
            </details>
            <details className="sheet-more">
              <summary>Picture</summary>
              <CoverControls readId={book.readId} book={book} cover={found.cover} />
            </details>
          </>
        )}
      </motion.div>
    </dialog>
  )
}

export function BookActionsProvider({ children }: { children: ReactNode }) {
  const [book, setBook] = useState<Book | null>(null)
  const [logged, setLogged] = useState<string | null>(null)
  const path = useRouterState({ select: s => s.location.href })

  // Any action that goes somewhere closes the sheet behind it.
  useEffect(() => setBook(null), [path])

  useEffect(() => {
    if (!logged) return
    const timer = setTimeout(() => setLogged(null), 1800)
    return () => clearTimeout(timer)
  }, [logged])

  return (
    <OpenActions.Provider value={setBook}>
      {children}
      {book && <Sheet key={book.readId} book={book} onClose={() => setBook(null)} onLogged={label => { setBook(null); setLogged(label) }} />}
      <AnimatePresence>
        {logged && (
          <motion.p
            className="stamp stamp-float"
            role="status"
            initial={{ scale: 1.9, rotate: -14, opacity: 0 }}
            animate={{ scale: 1, rotate: -5, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 800, damping: 26 }}
          >
            Logged: {logged}
          </motion.p>
        )}
      </AnimatePresence>
    </OpenActions.Provider>
  )
}
