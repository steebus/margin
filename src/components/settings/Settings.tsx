import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth, useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'

function Account() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : 'skip')
  const { signIn, signOut } = useAuthActions()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setFailed(false)
    try {
      await action()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <p role="status">Checking your account…</p>

  return (
    <div className="box stack">
      {isAuthenticated ? (
        <>
          <p>Signed in as <strong>{viewer?.name ?? viewer?.email ?? '…'}</strong></p>
          {viewer?.name && viewer.email && <p className="where">{viewer.email}</p>}
          <div className="btn-row">
            <button type="button" className="btn" disabled={busy} onClick={() => run(signOut)}>Sign out</button>
          </div>
        </>
      ) : (
        <>
          <p>Sign in to keep your books, notes and conversations.</p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-solid"
              disabled={busy}
              onClick={() => run(() => signIn('google', { redirectTo: `${window.location.origin}/settings` }))}
            >
              Sign in with Google
            </button>
          </div>
        </>
      )}
      {failed && <p role="alert">That didn't work. Check your connection and try again.</p>}
    </div>
  )
}

export function Settings() {
  return (
    <div className="narrow stack">
      <h1 className="title-head">Settings</h1>
      <hr className="rule" />
      <section className="stack" aria-labelledby="account-heading">
        <h2 id="account-heading" className="head">Account</h2>
        <Account />
      </section>
    </div>
  )
}
