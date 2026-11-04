import { createFileRoute } from '@tanstack/react-router'
import { Review } from '../components/review/Review'

export const Route = createFileRoute('/review')({ component: Review })
