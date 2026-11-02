import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../Placeholder'

export const Route = createFileRoute('/settings/')({
  component: () => <Placeholder title="Settings" />,
})
