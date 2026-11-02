import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../Placeholder'

export const Route = createFileRoute('/shelves/$shelfSlug')({
  component: () => <Placeholder title="Shelf" />,
})
