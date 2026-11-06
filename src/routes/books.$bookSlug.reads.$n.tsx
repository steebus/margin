import { createFileRoute } from '@tanstack/react-router'
import { ReadPage } from '../components/book/ReadPage'

export const Route = createFileRoute('/books/$bookSlug/reads/$n')({ component: ReadPage })
