import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Shelves } from '../Shelves'

const str = z.string().optional()

export const Route = createFileRoute('/shelves/')({
  validateSearch: z.object({
    status: z.enum(['reading', 'tbr', 'read', 'paused', 'dnf']).optional().catch(undefined),
    tag: str,
    topic: str,
    source: str,
    format: str,
    rating: str,
    year: str,
    sort: str,
    view: z.enum(['catalog', 'table']).optional().catch(undefined),
  }),
  component: Shelves,
})
