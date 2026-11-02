import { createFileRoute } from '@tanstack/react-router'
import { Buddy } from '../Buddy'

export const Route = createFileRoute('/books/$bookSlug/buddy')({ component: Buddy })
