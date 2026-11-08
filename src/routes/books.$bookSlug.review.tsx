import { createFileRoute } from '@tanstack/react-router'
import { FinishReview } from '../components/book/FinishReview'

export const Route = createFileRoute('/books/$bookSlug/review')({ component: FinishReview })
