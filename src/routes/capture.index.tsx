import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Capture } from '../components/capture/Capture'

export const Route = createFileRoute('/capture/')({
  validateSearch: z.object({
    book: z.string().optional().catch(undefined),
    kind: z.enum(['excerpt', 'note', 'summary']).optional().catch(undefined),
  }),
  component: Capture,
})
