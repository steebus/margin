import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { errorText } from '../../lib/books'

// Rough, from real runs: light was 4¢ on Red Rising, deep $1.48 before it was trimmed.
export const GUIDE_LABEL = { light: 'Light guide, about 10¢', deep: 'Deep guide, about $1.10' }

type Guide = { depth: 'light' | 'deep'; state: 'writing' | 'ready' | 'failed' } | null

/** The book's guide, opted into at a depth (SPEC 3.3): none, light, or deep, and light can go deeper. */
export function GuideControls({ readId, guide }: { readId: Id<'reads'>; guide: Guide }) {
  const request = useMutation(api.guides.request)
  const [error, setError] = useState<string | null>(null)
  const ask = async (depth: 'light' | 'deep') => {
    setError(null)
    try {
      await request({ readId, depth })
    } catch (e) {
      setError(errorText(e, "That didn't start. Check your connection and try again."))
    }
  }

  const ready = guide?.state === 'ready'
  return (
    <div className="stack">
      <p className="where">
        {!guide ? 'No guide yet. Your buddy talks from your notes and its own reading.'
          : guide.state === 'writing' ? `Your buddy is reading up on this book (${guide.depth}).`
            : ready ? `This book has a ${guide.depth} guide, cut at your place before your buddy sees it.`
              : "The guide didn't arrive. You can try again."}
      </p>
      {guide?.state !== 'writing' && !(ready && guide.depth === 'deep') && (
        <div className="btn-row">
          {!ready && <button type="button" className="btn" onClick={() => void ask(guide?.depth ?? 'light')}>{GUIDE_LABEL[guide?.depth ?? 'light']}</button>}
          {(!guide || ready) && <button type="button" className="btn" onClick={() => void ask('deep')}>{ready ? `Go deeper: ${GUIDE_LABEL.deep}` : GUIDE_LABEL.deep}</button>}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
