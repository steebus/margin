import { createFileRoute } from '@tanstack/react-router'
import { BookPage } from '../BookPage'

export const Route = createFileRoute('/books/$bookSlug/')({ component: BookPage })
