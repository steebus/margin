import { createFileRoute } from '@tanstack/react-router'
import { AuthorPage } from '../components/author/AuthorPage'

export const Route = createFileRoute('/authors/$authorSlug')({ component: AuthorPage })
