import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../Placeholder'

export const Route = createFileRoute('/e/$entryId')({
  component: () => <Placeholder title="Entry" />,
})
