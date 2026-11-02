import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../components/placeholder/Placeholder'

export const Route = createFileRoute('/topics/$topicSlug')({
  component: () => <Placeholder title="Topic" />,
})
