import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Camera } from '../components/capture/Camera'

export const Route = createFileRoute('/capture/camera')({
  validateSearch: z.object({ book: z.string().optional().catch(undefined) }),
  component: Camera,
})
