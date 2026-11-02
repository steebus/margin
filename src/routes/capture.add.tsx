import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AddBook } from '../components/capture/AddBook'

export const Route = createFileRoute('/capture/add')({
  validateSearch: z.object({ q: z.string().optional().catch(undefined) }),
  component: AddBook,
})
