import { createFileRoute } from '@tanstack/react-router'
import * as z from 'zod/mini'
import { caught } from '../lib/searchSchemas'
import { Settings, TABS } from '../components/settings/Settings'

export const Route = createFileRoute('/settings/')({
  validateSearch: z.object({ tab: caught(z.enum(TABS)) }),
  component: Settings,
})
