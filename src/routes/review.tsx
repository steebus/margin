import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../Placeholder'

export const Route = createFileRoute('/review')({
  component: () => <Placeholder title="Review matches" />,
})
