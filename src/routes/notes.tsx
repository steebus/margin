import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Notes } from '../components/notes/Notes'

export const Route = createFileRoute('/notes')({
  validateSearch: z.object({
    q: z.string().optional().catch(undefined),
    kind: z.string().optional().catch(undefined),
    status: z.string().optional().catch(undefined),
    from: z.coerce.number().int().optional().catch(undefined),
    to: z.coerce.number().int().optional().catch(undefined),
    sort: z.enum(['book', 'written', 'read', 'title']).optional().catch(undefined),
    dir: z.enum(['asc', 'desc']).optional().catch(undefined),
  }),
  component: Notes,
})
