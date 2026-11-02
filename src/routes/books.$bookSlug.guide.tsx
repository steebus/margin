import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../Placeholder'

export const Route = createFileRoute('/books/$bookSlug/guide')({
  component: () => <Placeholder title="Guide" />,
})
