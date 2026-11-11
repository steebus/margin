import { createFileRoute } from '@tanstack/react-router'
import { entriesSearch } from '../lib/searchSchemas'
import { BookNotes } from '../components/book/BookNotes'

export const Route = createFileRoute('/books/$bookSlug/entries/')({
  validateSearch: entriesSearch,
  component: BookNotes,
})
