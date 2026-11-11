import { createFileRoute, notFound } from '@tanstack/react-router'
import { KoboImport } from '../components/settings/KoboImport'

function Integration() {
  return (
    <div className="narrow stack">
      <h1 className="title-head">From Kobo</h1>
      <hr className="rule" />
      <KoboImport />
    </div>
  )
}

export const Route = createFileRoute('/settings/integrations/$provider')({
  // Only Kobo has an import page; any other provider is "Nothing filed here".
  beforeLoad: ({ params }) => { if (params.provider !== 'kobo') throw notFound() },
  component: Integration,
})
