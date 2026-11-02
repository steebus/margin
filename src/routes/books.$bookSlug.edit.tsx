import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../components/placeholder/Placeholder'

export const Route = createFileRoute('/books/$bookSlug/edit')({
  component: () => <Placeholder title="Edit book" />,
})
