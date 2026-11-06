import { createFileRoute } from '@tanstack/react-router'
import { BookEdit } from '../components/book/BookEdit'

export const Route = createFileRoute('/books/$bookSlug/edit')({ component: BookEdit })
