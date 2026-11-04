import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { Archive, LampDesk, Library, NotebookPen, PenLine, UserRound } from 'lucide-react'
import { BookActionsProvider } from '../components/book/BookActions'
import { SignIn } from '../components/settings/SignIn'
import { useOnline, useReplayOutbox } from '../lib/offline'

export const Route = createRootRoute({ component: Root })

const tabs = [
  { to: '/', label: 'Desk', Icon: LampDesk, match: (path: string) => path === '/' },
  { to: '/shelves', label: 'Shelves', Icon: Library, match: (path: string) => path.startsWith('/shelves') || path.startsWith('/pile') },
  { to: '/notes', label: 'Notes', Icon: NotebookPen, match: (path: string) => path.startsWith('/notes') || path.startsWith('/e/') },
  { to: '/drawer', label: 'Drawer', Icon: Archive, match: (path: string) => path.startsWith('/drawer') },
  { to: '/capture', label: 'Capture', Icon: PenLine, match: (path: string) => path.startsWith('/capture') },
] as const

function Root() {
  const path = useRouterState({ select: s => s.location.pathname })
  const { isLoading, isAuthenticated } = useConvexAuth()
  const online = useOnline()
  useReplayOutbox(isAuthenticated)
  // With no connection, sign-in can't be confirmed, so the shell opens on what this device already holds.
  const inside = isAuthenticated || (!online && isLoading)
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
        {inside ? <BookActionsProvider><Outlet /></BookActionsProvider> : isLoading ? <p role="status">Opening Margin…</p> : <SignIn />}
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
