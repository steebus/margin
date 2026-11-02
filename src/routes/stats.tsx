import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Stats } from '../components/stats/Stats'

export const Route = createFileRoute('/stats')({
  validateSearch: z.object({ range: z.string().optional().catch(undefined) }),
  component: Stats,
})
