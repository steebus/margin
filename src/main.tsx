import '@fontsource/league-gothic/latin-400.css'
import './styles/fonts.css'
import '@fontsource/courier-prime/latin-400.css'
import '@fontsource/kalam/latin-400.css'
import './styles/tokens.css'
import './styles/app.css'

import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { ConvexReactClient } from 'convex/react'
import { ConvexQueryCacheProvider } from 'convex-helpers/react/cache/provider'
import { MotionConfig } from 'motion/react'
import { lazy, StrictMode, Suspense, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { watchThemeColor } from './lib/theme'
import { watchForUpdates } from './lib/updates'
import { routeTree } from './routeTree.gen'

watchForUpdates()
watchThemeColor()
// The old drawings cache held opaque responses, which count as ~7 MB each. Gone once it's deleted.
void globalThis.caches?.delete('drawings')

// `npm run fixtures` runs Margin on a made-up library with no server (src/fixtures/backend.tsx). The mode is a
// constant in any build, so a production bundle never contains the fixtures or the code that serves them.
const FixtureBackend = import.meta.env.MODE === 'fixtures' ? lazy(() => import('./fixtures/backend')) : null

function Backend({ children }: { children: ReactNode }) {
  if (FixtureBackend) return <Suspense><FixtureBackend>{children}</FixtureBackend></Suspense>
  return <ConvexAuthProvider client={convex!}>{children}</ConvexAuthProvider>
}

const convex = FixtureBackend ? null : new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)
const router = createRouter({ routeTree, defaultViewTransition: true })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Backend>
      {/* Each screen's data stays live for five minutes after leaving it, so going back shows it at once. */}
      <ConvexQueryCacheProvider>
        <MotionConfig reducedMotion="user">
          <RouterProvider router={router} />
        </MotionConfig>
      </ConvexQueryCacheProvider>
    </Backend>
  </StrictMode>,
)
