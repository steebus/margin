import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Placeholder } from '../components/placeholder/Placeholder'

export const Route = createFileRoute('/books/$bookSlug/entries/')({
  validateSearch: z.object({ kind: z.string().optional(), from: z.string().optional(), to: z.string().optional() }),
  component: () => <Placeholder title="Margin" />,
})
