import { createFileRoute } from '@tanstack/react-router'
import { BookPage } from '../components/book/BookPage'

export const Route = createFileRoute('/books/$bookSlug/')({ component: BookPage })
