import { createFileRoute } from '@tanstack/react-router'
import { statsSearch } from '../lib/searchSchemas'
import { Stats } from '../components/stats/Stats'

export const Route = createFileRoute('/stats')({
  validateSearch: statsSearch,
  component: Stats,
})
