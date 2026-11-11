import { createFileRoute } from '@tanstack/react-router'
import { addSearch } from '../lib/searchSchemas'
import { AddBook } from '../components/capture/AddBook'

export const Route = createFileRoute('/capture/add')({
  validateSearch: addSearch,
  component: AddBook,
})
