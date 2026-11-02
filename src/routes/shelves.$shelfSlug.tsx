import { createFileRoute } from '@tanstack/react-router'
import { Shelf } from '../components/shelf/Shelves'
import { shelfSearch } from '../lib/shelf'

export const Route = createFileRoute('/shelves/$shelfSlug')({ validateSearch: shelfSearch, component: Shelf })
