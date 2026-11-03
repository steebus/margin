import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { errorText } from '../../lib/books'
import { Thumb } from '../thumb/Thumb'

type Drawing = { id: Id<'pastArt'> | null; small: string; large: string }
type Cover = { choice: 'drawing' | 'cover'; hasDrawing: boolean; hasRealCover: boolean; state: string | null; error: string | null; drawings: Drawing[] }
type Book = { title: string; coverUrl: string | null; status: string }

/** Every picture this book could wear: its drawings, newest kept first, then the real cover. Nothing is thrown away. */
export function CoverControls({ readId, book, cover }: { readId: Id<'reads'>; book: Book; cover: Cover }) {
  const regenerate = useMutation(api.art.regenerate)
  const setArtChoice = useMutation(api.art.setArtChoice)
  const chooseArt = useMutation(api.art.chooseArt)
  const [hint, setHint] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const drawing = cover.state === 'queued'

  const draw = async () => {
    setSending(true)
    setError(null)
    try {
      await regenerate({ readId, hint: hint.trim() || undefined })
      setHint('')
    } catch (e) {
      setError(errorText(e, "That didn't start. Check your connection and try again."))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="cover-controls">
      <ul className="gallery" aria-label="Pictures to choose from">
        {cover.drawings.map((d, i) => {
          const on = cover.choice === 'drawing' && d.id === null
          return (
            <li key={d.id ?? 'current'}>
              <button type="button" aria-pressed={on} aria-label={`Drawing ${i + 1}`} onClick={() => void (d.id ? chooseArt({ readId, pastId: d.id }) : setArtChoice({ readId, choice: 'drawing' }))}>
                <Thumb book={{ ...book, art: { small: d.small, large: d.large } }} marks={false} />
              </button>
            </li>
          )
        })}
        <li>
          <button type="button" aria-pressed={cover.choice === 'cover' || !cover.hasDrawing} aria-label={cover.hasRealCover ? 'The real cover' : 'Title only'} onClick={() => void setArtChoice({ readId, choice: 'cover' })}>
            <Thumb book={{ ...book, art: null }} marks={false} />
          </button>
        </li>
      </ul>
      <form className="stack" onSubmit={e => { e.preventDefault(); void draw() }}>
        <div className="field">
          <label htmlFor="cover-hint">Direction, if you have one</label>
          <input id="cover-hint" value={hint} maxLength={200} placeholder="A lamp in a dark window" autoComplete="off" onChange={e => setHint(e.target.value)} />
        </div>
        <button type="submit" className="btn" disabled={sending || drawing}>
          {drawing ? 'Drawing, about 30 seconds…' : cover.hasDrawing ? 'Draw a new one' : 'Draw one'}
        </button>
      </form>
      {cover.state === 'failed' && cover.error && <p role="alert">{cover.error}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
