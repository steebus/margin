import { createFileRoute } from '@tanstack/react-router'
import { Shelves } from '../components/shelf/Shelves'
import { shelfSearch } from '../lib/shelf'

export const Route = createFileRoute('/shelves/')({ validateSearch: shelfSearch, component: Shelves })
