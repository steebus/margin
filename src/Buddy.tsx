import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { NotFoundBook } from './BookPage'
import { Arrow } from './Marks'
import { books, current, threads, type Turn } from './sample'
import { Thumb } from './Thumb'
import { Typewriter } from './Typewriter'

export function Buddy() {
  const { bookSlug } = useParams({ from: '/books/$bookSlug/buddy' })
  const book = books.find(b => b.slug === bookSlug)
  const reading = current.find(c => c.book.slug === bookSlug)
  const [turns, setTurns] = useState<Turn[]>(
    () => threads[bookSlug] ?? (reading ? [{ who: 'buddy', text: reading.prompt }] : []),
  )
  const [reply, setReply] = useState('')

  if (!book) return <NotFoundBook />

  const lastBuddy = turns.findLastIndex(t => t.who === 'buddy')

  const send = (e: FormEvent) => {
    e.preventDefault()
    const text = reply.trim()
    if (!text) return
    setTurns([...turns, { who: 'reader', text }])
    setReply('')
  }

  return (
    <div className="narrow stack">
      <header className="buddy-head">
        <Link to="/books/$bookSlug" params={{ bookSlug }} className="back" aria-label={`Back to ${book.title}`}>
          <ArrowLeft aria-hidden="true" strokeWidth={2.25} />
        </Link>
        <Thumb book={book} />
        <div>
          <h1 className="buddy-title">{book.title}</h1>
          {reading && <p className="where">Talking up to {reading.percent}%</p>}
        </div>
      </header>

      <hr className="rule" />

      <ol className="thread">
        {turns.length === 0 && <li>Nothing to talk about yet. Start the book and your buddy will ask when you reach a milestone.</li>}
        {turns.map((turn, i) =>
          turn.who === 'buddy' ? (
            <li key={i} className="turn-buddy">
              {i === lastBuddy
                ? <Typewriter text={turn.text} />
                : <div className="tw"><p className="tw-static">{turn.text}</p></div>}
              {turn.cites && (
                <aside className="citation">
                  <p className="hand">{turn.cites.note}</p>
                  <p className="where">{turn.cites.where}</p>
                </aside>
              )}
            </li>
          ) : (
            <li key={i} className="turn-reader">
              <Arrow />
              <p className="hand">{turn.text}</p>
            </li>
          ),
        )}
      </ol>

      <form className="reply" onSubmit={send}>
        <label htmlFor="reply" className="sr-only">Write your reply</label>
        <input id="reply" value={reply} onChange={e => setReply(e.target.value)} placeholder="Write your reply" autoComplete="off" />
        <button type="submit" className="btn btn-solid" disabled={!reply.trim()}>Send</button>
      </form>
      <button
        type="button"
        className="text-link"
        onClick={() => setTurns([...turns, { who: 'reader', text: "That hasn't happened yet." }])}
      >
        That hasn't happened yet
      </button>
    </div>
  )
}
