import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../components/placeholder/Placeholder'

export const Route = createFileRoute('/capture/camera')({
  component: () => <Placeholder title="Camera" />,
})
