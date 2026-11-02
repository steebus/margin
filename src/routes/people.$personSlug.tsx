import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../Placeholder'

export const Route = createFileRoute('/people/$personSlug')({
  component: () => <Placeholder title="Person" />,
})
