import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Drawer } from '../Drawer'

export const Route = createFileRoute('/drawer')({
  validateSearch: z.object({
    kind: z.enum(['excerpt', 'note']).optional().catch(undefined),
    topic: z.string().optional(),
  }),
  component: Drawer,
})
