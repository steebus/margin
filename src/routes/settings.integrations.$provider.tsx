import { createFileRoute } from '@tanstack/react-router'
import { KoboImport } from '../components/settings/KoboImport'
import { Placeholder } from '../components/placeholder/Placeholder'

function Integration() {
  const { provider } = Route.useParams()
  if (provider !== 'kobo') return <Placeholder title="Integration" />
  return (
    <div className="narrow stack">
      <h1 className="title-head">From Kobo</h1>
      <hr className="rule" />
      <KoboImport />
    </div>
  )
}

export const Route = createFileRoute('/settings/integrations/$provider')({ component: Integration })
