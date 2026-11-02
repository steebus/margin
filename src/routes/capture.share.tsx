import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Share } from '../Share'

export const Route = createFileRoute('/capture/share')({
  validateSearch: z.object({
    url: z.string().optional().catch(undefined),
    title: z.string().optional().catch(undefined),
    text: z.string().optional().catch(undefined),
    popup: z.coerce.number().optional().catch(undefined),
  }),
  component: Share,
})
