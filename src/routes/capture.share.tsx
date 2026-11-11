import { createFileRoute } from '@tanstack/react-router'
import { shareSearch } from '../lib/searchSchemas'
import { Share } from '../components/share/Share'

export const Route = createFileRoute('/capture/share')({
  validateSearch: shareSearch,
  component: Share,
})
