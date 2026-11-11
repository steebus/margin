import { createFileRoute } from '@tanstack/react-router'
import { captureSearch } from '../lib/searchSchemas'
import { Capture } from '../components/capture/Capture'

export const Route = createFileRoute('/capture/')({
  validateSearch: captureSearch,
  component: Capture,
})
