import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../Placeholder'

export const Route = createFileRoute('/books/$bookSlug/reads/$n')({
  component: () => <Placeholder title="Read" />,
})
