import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Placeholder } from '../Placeholder'

export const Route = createFileRoute('/explore')({
  validateSearch: z.object({ focus: z.string().optional(), depth: z.coerce.number().optional().catch(undefined) }),
  component: () => <Placeholder title="Explore" />,
})
