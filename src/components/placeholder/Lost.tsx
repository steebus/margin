import { Link } from '@tanstack/react-router'

/** The page a bad address lands on. The router puts it inside the shell, so the tab bar is still there. */
export function NotFoundPage() {
  return (
    <div className="narrow stack">
      <h1 className="title-head">Nothing filed here</h1>
      <p>This address doesn't match a page in Margin.</p>
      <div className="btn-row"><Link to="/" className="btn btn-solid">Back to the Desk</Link></div>
    </div>
  )
}

/** What a thrown render error shows in place of a blank page. The words you've written are safe: they live on the server. */
export function ErrorPage({ reset }: { error?: unknown; reset?: () => void }) {
  return (
    <div className="narrow stack" role="alert">
      <h1 className="title-head">That page slipped</h1>
      <p>Something went wrong drawing this page. Nothing you've written is lost.</p>
      <div className="btn-row">
        <button type="button" className="btn btn-solid" onClick={() => reset?.()}>Try again</button>
        <Link to="/" className="btn">Back to the Desk</Link>
      </div>
    </div>
  )
}
