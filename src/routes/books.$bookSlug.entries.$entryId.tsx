import { createFileRoute } from '@tanstack/react-router'
import { EntryPage } from '../components/notes/EntryPage'

export const Route = createFileRoute('/books/$bookSlug/entries/$entryId')({ component: EntryPage })
