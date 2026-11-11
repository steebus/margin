import { createFileRoute } from '@tanstack/react-router'
import { notesSearch } from '../lib/searchSchemas'
import { Notes } from '../components/notes/Notes'

export const Route = createFileRoute('/notes')({
  validateSearch: notesSearch,
  component: Notes,
})
