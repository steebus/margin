import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { LampDesk, Library, NotebookPen, PenLine, UserRound, Waypoints } from 'lucide-react'
import { BookActionsProvider } from '../components/book/BookActions'
import { OfflineLine } from '../components/offline/OfflineLine'
import { SignIn } from '../components/settings/SignIn'
import { FailureToast } from '../components/toast/FailureToast'
import { hasSavedSignIn, useReplayOutbox } from '../lib/offline'
import { Opening } from '../components/opening/Opening'

export const Route = createRootRoute({ component: Root })

const tabs = [
  { to: '/', label: 'Desk', Icon: LampDesk, match: (path: string) => path === '/' },
  { to: '/shelves', label: 'Shelves', Icon: Library, match: (path: string) => path.startsWith('/shelves') || path.startsWith('/pile') },
  { to: '/notes', label: 'Notes', Icon: NotebookPen, match: (path: string) => path.startsWith('/notes') || path.startsWith('/e/') },
  { to: '/explore', label: 'Explore', Icon: Waypoints, match: (path: string) => path.startsWith('/explore') || path.startsWith('/topics') },
  { to: '/capture', label: 'Capture', Icon: PenLine, match: (path: string) => path.startsWith('/capture') },
] as const

function Root() {
  const path = useRouterState({ select: s => s.location.pathname })
  const { isLoading, isAuthenticated } = useConvexAuth()
  useReplayOutbox(isAuthenticated)
  // While Convex confirms a sign-in this device already holds, the shell opens on what the device remembers.
  const inside = isAuthenticated || (isLoading && hasSavedSignIn())
  return (
    <div className="app">
      <main className="page">
        <div className="corner">
          {inside && (
            <Link to="/settings" className="theme-toggle" aria-label="Settings and account" title="Settings and account">
              <UserRound aria-hidden="true" strokeWidth={2.25} />
            </Link>
          )}
        </div>
        {inside ? <BookActionsProvider><OfflineLine /><Outlet /><FailureToast /></BookActionsProvider> : isLoading ? <Opening what="Margin" /> : <SignIn />}
      </main>
      {inside && <nav className="tabs" aria-label="Main">
        {tabs.map(({ to, label, Icon, match }) => (
          <Link key={to} to={to} aria-current={match(path) ? 'page' : undefined}>
            <Icon aria-hidden="true" strokeWidth={2.25} />
            {label}
          </Link>
        ))}
      </nav>}
    </div>
  )
}
