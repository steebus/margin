import { Link } from '@tanstack/react-router'

export function Placeholder({ title }: { title: string }) {
  return (
    <section className="placeholder">
      <h1>{title}</h1>
      <p>This page isn't built yet.</p>
      <Link to="/" className="btn">Back to the Desk</Link>
    </section>
  )
}
