import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Capture } from '../components/capture/Capture'

export const Route = createFileRoute('/capture/')({
  validateSearch: z.object({
    book: z.string().optional().catch(undefined),
    kind: z.enum(['excerpt', 'note', 'summary']).optional().catch(undefined),
    text: z.string().optional().catch(undefined),
    page: z.coerce.number().int().positive().optional().catch(undefined),
    popup: z.coerce.number().optional().catch(undefined),
  }),
  component: Capture,
})
