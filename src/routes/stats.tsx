import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Placeholder } from '../Placeholder'

export const Route = createFileRoute('/stats')({
  validateSearch: z.object({ range: z.string().optional(), chart: z.string().optional() }),
  component: () => <Placeholder title="Stats" />,
})
