import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Notes } from '../components/notes/Notes'

export const Route = createFileRoute('/notes')({
  validateSearch: z.object({ q: z.string().optional().catch(undefined), kind: z.string().optional().catch(undefined) }),
  component: Notes,
})
