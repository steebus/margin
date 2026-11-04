import { createFileRoute } from '@tanstack/react-router'
import { TopicPage } from '../components/topic/TopicPage'

export const Route = createFileRoute('/topics/$topicSlug')({ component: TopicPage })
