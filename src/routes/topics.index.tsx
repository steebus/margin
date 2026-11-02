import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../components/placeholder/Placeholder'

export const Route = createFileRoute('/topics/')({
  component: () => <Placeholder title="Topics" />,
})
