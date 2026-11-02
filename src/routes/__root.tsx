import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useConvexAuth } from 'convex/react'
import { Archive, LampDesk, Library, Moon, NotebookPen, PenLine, Sun, UserRound } from 'lucide-react'
import { SignIn } from '../components/settings/SignIn'
import { setTheme, useTheme } from '../lib/theme'

export const Route = createRootRoute({ component: Root })

const tabs = [
  { to: '/', label: 'Desk', Icon: LampDesk, match: (path: string) => path === '/' },
  { to: '/shelves', label: 'Shelves', Icon: Library, match: (path: string) => path.startsWith('/shelves') || path.startsWith('/books') || path.startsWith('/pile') },
  { to: '/notes', label: 'Notes', Icon: NotebookPen, match: (path: string) => path.startsWith('/notes') },
  { to: '/drawer', label: 'Drawer', Icon: Archive, match: (path: string) => path.startsWith('/drawer') },
  { to: '/capture', label: 'Capture', Icon: PenLine, match: (path: string) => path.startsWith('/capture') },
] as const

function ThemeToggle() {
  const theme = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  const Icon = theme === 'dark' ? Sun : Moon
  return (
    <button type="button" className="theme-toggle" aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`} onClick={() => setTheme(next)}>
      <Icon aria-hidden="true" strokeWidth={2.25} />
    </button>
  )
}

function Root() {
  const path = useRouterState({ select: s => s.location.pathname })
  const { isLoading, isAuthenticated } = useConvexAuth()
  return (
    <div className="app">
      <main className="page">
        <div className="corner">
          {isAuthenticated && (
            <Link to="/settings" className="theme-toggle" aria-label="Settings and account" title="Settings and account">
              <UserRound aria-hidden="true" strokeWidth={2.25} />
            </Link>
          )}
          <ThemeToggle />
        </div>
        {isLoading ? <p role="status">Opening Margin…</p> : isAuthenticated ? <Outlet /> : <SignIn />}
      </main>
      {isAuthenticated && <nav className="tabs" aria-label="Main">
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
