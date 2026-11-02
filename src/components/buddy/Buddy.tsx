import { Link, useParams } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { errorText } from '../../lib/books'
import { NotFoundBook } from '../book/BookPage'
import { Thumb } from '../thumb/Thumb'
import { Typewriter } from '../typewriter/Typewriter'

function Thread({ readId, title }: { readId: Id<'reads'>; title: string }) {
  const thread = useQuery(api.buddy.thread, { readId })
  const start = useMutation(api.buddy.start)
  const say = useMutation(api.buddy.say)
  const retry = useMutation(api.buddy.retry)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const turns = thread?.turns ?? []
  const writing = turns.some(t => t.state === 'writing')
  const failed = turns.at(-1)?.state === 'failed'
  const latest = turns.at(-1)?.text.length

  // Follow the reply as it's written.
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [turns.length, latest])

  if (thread === undefined) return <p role="status">Finding your conversation…</p>
  if (thread === null) return null
  if (!thread.ready) return <Typewriter text="Your buddy hasn't arrived yet. It needs an Anthropic key set in Convex, and then its questions about this book will be typed here." />

  const send = async () => {
    const words = text.trim()
    if (!words) return
    setError(null)
    setText('')
    try {
      await say({ readId, text: words })
    } catch (e) {
      setText(words)
      setError(errorText(e, "That didn't send. Your words are still here: check your connection and try again."))
    }
  }

  if (!turns.length) {
    return (
      <div className="stack">
        <p>Your buddy knows where you are in {title} and won't go past it. It has read your notes, and it will ask rather than tell.</p>
        <p className="where">The first time, it reads up on the book, which takes a minute or two and costs about 50 cents, once.</p>
        <div className="btn-row"><button type="button" className="btn btn-solid" onClick={() => void start({ readId })}>Start talking</button></div>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="thread" aria-live="polite">
        {turns.map(turn => (
          turn.role === 'reader'
            ? <p key={turn.id} className="hand turn-mine">{turn.text}</p>
            : (
              <div key={turn.id} className="turn-buddy">
                {turn.state === 'failed'
                  ? <p role="alert">{turn.text}</p>
                  : <p className="tw" data-writing={turn.state === 'writing' || undefined}>{turn.text || '…'}</p>}
              </div>
            )
        ))}
      </div>
      <div ref={end} />
      {failed
        ? <div className="btn-row"><button type="button" className="btn btn-solid" onClick={() => void retry({ readId })}>Try again</button></div>
        : (
          <form className="reply" onSubmit={e => { e.preventDefault(); void send() }}>
            <label className="sr-only" htmlFor="buddy-reply">Your answer</label>
            <input id="buddy-reply" value={text} placeholder="What you think" autoComplete="off" onChange={e => setText(e.target.value)} />
            <button type="submit" className="btn btn-solid" disabled={!text.trim() || writing}>Send</button>
          </form>
        )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export function Buddy() {
  const { bookSlug } = useParams({ from: '/books/$bookSlug/buddy' })
  const found = useQuery(api.library.bookBySlug, { slug: bookSlug })

  if (found === undefined) return <p role="status">Finding your book…</p>
  if (found === null) return <NotFoundBook />
  const { book } = found

  return (
    <div className="narrow stack">
      <header className="buddy-head">
        <Link to="/books/$bookSlug" params={{ bookSlug }} className="back" aria-label={`Back to ${book.title}`}>
          <ArrowLeft aria-hidden="true" strokeWidth={2.25} />
        </Link>
        <Thumb book={book} marks={false} />
        <div>
          <h1 className="buddy-title">{book.title}</h1>
          <p className="where">{book.author}</p>
        </div>
      </header>

      <hr className="rule" />

      <Thread readId={book.readId} title={book.title} />
    </div>
  )
}
