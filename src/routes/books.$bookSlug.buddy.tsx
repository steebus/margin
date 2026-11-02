import { createFileRoute } from '@tanstack/react-router'
import { Buddy } from '../components/buddy/Buddy'

export const Route = createFileRoute('/books/$bookSlug/buddy')({ component: Buddy })
