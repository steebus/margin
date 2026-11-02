import { useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { errorText, type Status } from '../../lib/books'
import { savedFilter, type ShelfSearch } from '../../lib/shelf'

/** Keeps a search and filter as a smart shelf of its own (SPEC 3.1). Only offered once there's something to keep. */
export function SaveView({ search, status }: { search: ShelfSearch; status?: Status }) {
  const saveView = useMutation(api.books.saveView)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!search.q && !search.format && !search.rating && !search.genre) return null
  if (!open) return <button type="button" className="text-link save-view" onClick={() => setOpen(true)}>Save this as a shelf</button>
  const save = async () => {
    setError(null)
    try {
      const slug = await saveView({ name, filter: savedFilter(search, status) })
      void navigate({ to: '/shelves/$shelfSlug', params: { shelfSlug: slug } })
    } catch (e) {
      setError(errorText(e, "That didn't save. Check your connection and try again."))
    }
  }
  return (
    <form className="reply" onSubmit={e => { e.preventDefault(); if (name.trim()) void save() }}>
      <label className="sr-only" htmlFor="view-name">Name this shelf</label>
      <input id="view-name" className="view-name" autoFocus value={name} placeholder="Name this shelf" onChange={e => setName(e.target.value)} />
      <button type="submit" className="btn btn-solid" disabled={!name.trim()}>Save</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
