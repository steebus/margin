import { createFileRoute } from '@tanstack/react-router'
import { exploreSearch } from '../lib/searchSchemas'
import { Explore } from '../components/explore/Explore'

export const Route = createFileRoute('/explore')({
  validateSearch: exploreSearch,
  component: Explore,
})
