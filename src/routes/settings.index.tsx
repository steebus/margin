import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Settings, TABS } from '../components/settings/Settings'

export const Route = createFileRoute('/settings/')({
  validateSearch: z.object({ tab: z.enum(TABS).optional().catch(undefined) }),
  component: Settings,
})
