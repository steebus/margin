import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../Placeholder'

export const Route = createFileRoute('/topics/$topicSlug')({
  component: () => <Placeholder title="Topic" />,
})
