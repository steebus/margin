import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../components/placeholder/Placeholder'

export const Route = createFileRoute('/books/$bookSlug/reads/$n')({
  component: () => <Placeholder title="Read" />,
})
