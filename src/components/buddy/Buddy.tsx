import { Link, useParams } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { errorText } from '../../lib/books'
import { NotFoundBook } from '../book/BookPage'
import { Thumb } from '../thumb/Thumb'
import { Typewriter } from '../typewriter/Typewriter'

// Rough, from real runs: deep was $1.48 on Red Rising before it was trimmed.
const GUIDE_LABEL = { light: 'Light guide, about 20¢', deep: 'Deep guide, about $1.10' }

function Thread({ readId, title }: { readId: Id<'reads'>; title: string }) {
  const thread = useQuery(api.buddy.thread, { readId })
  const start = useMutation(api.buddy.start)
  const say = useMutation(api.buddy.say)
  const retry = useMutation(api.buddy.retry)
  const request = useMutation(api.guides.request)
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

  const guide = thread.guide
  // A light guide can go deep; a failed one is tried again at its own depth; with none, light is the first step.
  const next = guide?.state === 'ready' ? 'deep' : guide?.depth ?? 'light'
  // Opting in starts the research; the buddy's first reply waits for it, so the conversation starts at once either way.
  const begin = async (depth?: 'light' | 'deep') => {
    setError(null)
    try {
      if (depth) await request({ readId, depth })
      await start({ readId })
    } catch (e) {
      setError(errorText(e, "That didn't start. Check your connection and try again."))
    }
  }

  if (!turns.length) {
    return (
      <div className="stack">
        <p>Your buddy knows where you are in {title} and won't go past it. It has read your notes, and it will ask rather than tell.</p>
        {guide && guide.state !== 'failed'
          ? <div className="btn-row"><button type="button" className="btn btn-solid" onClick={() => void begin()}>Start talking</button></div>
          : (
            <>
              <p>It can also read up on the book first, so its questions fit where you are. Choose how much this book deserves:</p>
              <div className="btn-row">
                <button type="button" className="btn" onClick={() => void begin()}>Just talk</button>
                <button type="button" className="btn btn-solid" onClick={() => void begin('light')}>{GUIDE_LABEL.light}</button>
                <button type="button" className="btn" onClick={() => void begin('deep')}>{GUIDE_LABEL.deep}</button>
              </div>
              <p className="where">Just talk is free beyond the conversation. A light guide is a few key turns and questions. A deep one researches the book chapter by chapter. Either is written once and kept.</p>
            </>
          )}
        {error && <p role="alert">{error}</p>}
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
      {guide?.state === 'writing' && <p className="where" role="status">Your buddy is reading up on this book.</p>}
      {(!guide || guide.state === 'failed' || (guide.depth === 'light' && guide.state === 'ready')) && (
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => void request({ readId, depth: next })}>
            {guide?.state === 'ready' ? `Go deeper: ${GUIDE_LABEL.deep}` : guide ? `Try the guide again: ${GUIDE_LABEL[next]}` : GUIDE_LABEL.light}
          </button>
        </div>
      )}
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
