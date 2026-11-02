import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { errorText } from '../../lib/books'

type Cover = { choice: 'drawing' | 'cover'; hasDrawing: boolean; hasRealCover: boolean; state: string | null; error: string | null }

export function CoverControls({ readId, cover }: { readId: Id<'reads'>; cover: Cover }) {
  const regenerate = useMutation(api.art.regenerate)
  const setArtChoice = useMutation(api.art.setArtChoice)
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
    <section className="cover-controls" aria-labelledby="cover-heading">
      <h2 id="cover-heading" className="head">Picture</h2>
      {cover.hasDrawing && (
        <div className="segments" role="group" aria-label="Which picture to show">
          <button type="button" aria-pressed={cover.choice === 'drawing'} onClick={() => void setArtChoice({ readId, choice: 'drawing' })}>Drawing</button>
          <button type="button" aria-pressed={cover.choice === 'cover'} onClick={() => void setArtChoice({ readId, choice: 'cover' })}>
            {cover.hasRealCover ? 'Real cover' : 'Title only'}
          </button>
        </div>
      )}
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
    </section>
  )
}
