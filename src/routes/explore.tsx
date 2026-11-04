import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Explore } from '../components/explore/Explore'

export const Route = createFileRoute('/explore')({
  validateSearch: z.object({
    focus: z.string().optional().catch(undefined),
    depth: z.coerce.number().int().min(1).max(2).optional().catch(undefined),
  }),
  component: Explore,
})
