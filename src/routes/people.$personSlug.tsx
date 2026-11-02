import { createFileRoute } from '@tanstack/react-router'
import { Person } from '../components/shelf/Person'

export const Route = createFileRoute('/people/$personSlug')({ component: Person })
