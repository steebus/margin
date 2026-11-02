import { createFileRoute } from '@tanstack/react-router'
import { Pile } from '../components/pile/Pile'

export const Route = createFileRoute('/pile')({ component: Pile })
