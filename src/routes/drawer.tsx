import { createFileRoute, redirect } from '@tanstack/react-router'

// The drawer opens from Notes now (Explore took its tab), so old links land there with it open.
export const Route = createFileRoute('/drawer')({
  beforeLoad: () => { throw redirect({ to: '/notes', search: { drawer: true }, replace: true }) },
})
