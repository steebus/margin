import { createFileRoute } from '@tanstack/react-router'
import { Placeholder } from '../Placeholder'

export const Route = createFileRoute('/imports/$jobId')({
  component: () => <Placeholder title="Import report" />,
})
