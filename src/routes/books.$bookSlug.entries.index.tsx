import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { BookNotes } from '../components/book/BookNotes'

export const Route = createFileRoute('/books/$bookSlug/entries/')({
  validateSearch: z.object({ kind: z.string().optional().catch(undefined) }),
  component: BookNotes,
})
