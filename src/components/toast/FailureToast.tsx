import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useFailures } from '../../lib/quiet'

/**
 * A write the screen didn't wait for, refused by the server. It stays until dismissed, and holds the reader's words
 * so nothing typed is lost. One at a time, oldest first.
 */
export function FailureToast() {
  const [failures, dismiss] = useFailures()
  const [copied, setCopied] = useState(false)
  const failure = failures[0]
  const copy = async (words: string) => {
    try {
      await navigator.clipboard.writeText(words)
      setCopied(true)
    } catch { /* no clipboard: the words are on screen to select */ }
  }
  return (
    <AnimatePresence>
      {failure && (
        <motion.aside
          key={failure.id}
          className="toast"
          role="alert"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          <p className="toast-head">Not saved{failures.length > 1 ? ` (1 of ${failures.length})` : ''}</p>
          <p>{failure.message}</p>
          {failure.words && <p className="hand toast-words">{failure.words}</p>}
          <div className="btn-row">
            {failure.words && <button type="button" className="btn btn-solid" onClick={() => void copy(failure.words!)}>{copied ? 'Copied' : 'Copy the words'}</button>}
            <button type="button" className="btn" onClick={() => { setCopied(false); dismiss(failure.id) }}>Dismiss</button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
