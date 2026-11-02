import { useAuthActions } from '@convex-dev/auth/react'
import { useState } from 'react'

export function SignIn() {
  const { signIn } = useAuthActions()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="narrow stack">
      <h1 className="title-head">Margin</h1>
      <hr className="rule" />
      <p className="book-voice">Your books, your notes and the lines you underlined.</p>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-solid"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setFailed(false)
            try {
              // Back to this exact address, so something shared to Margin survives signing in.
              await signIn('google', { redirectTo: window.location.href })
            } catch {
              setFailed(true)
              setBusy(false)
            }
          }}
        >
          Sign in with Google
        </button>
      </div>
      {failed && <p role="alert">That didn't work. Check your connection and try again.</p>}
    </div>
  )
}
