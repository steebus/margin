import '@fontsource/league-gothic/latin-400.css'
import '@fontsource-variable/source-serif-4/index.css'
import '@fontsource/courier-prime/latin-400.css'
import '@fontsource/kalam/latin-400.css'
import './styles/tokens.css'
import './styles/app.css'

import { createRouter, RouterProvider } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree, defaultViewTransition: true })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </StrictMode>,
)
