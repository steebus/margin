import { createFileRoute } from '@tanstack/react-router'
import { TopicList } from '../components/topic/TopicList'

export const Route = createFileRoute('/topics/')({ component: TopicList })
