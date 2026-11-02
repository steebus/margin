import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../components/placeholder/Placeholder'

export const Route = createFileRoute('/e/$entryId')({
  component: () => <Placeholder title="Entry" />,
})
