import { useNavigate } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Typewriter } from '../typewriter/Typewriter'

type Note = { id: Id<'buddyQueue'>; percent: number; text: string }

/** The buddy's note for a milestone, typed out when the book opens. Answering carries it into the conversation. */
export function BuddyNote({ note, slug }: { note: Note; slug: string }) {
  const answer = useMutation(api.milestones.answer)
  const snooze = useMutation(api.milestones.snooze)
  const pass = useMutation(api.milestones.pass)
  const navigate = useNavigate()

  return (
    <section className="reflection" aria-label="A note from your buddy">
      <p className="where">Your buddy, at {note.percent}%</p>
      <Typewriter text={note.text} />
      <div className="btn-row">
        <button type="button" className="btn btn-solid" onClick={async () => {
          await answer({ noteId: note.id })
          await navigate({ to: '/books/$bookSlug/buddy', params: { bookSlug: slug } })
        }}>Answer</button>
        <button type="button" className="btn" onClick={() => void snooze({ noteId: note.id })}>Tomorrow</button>
        <button type="button" className="btn" onClick={() => void pass({ noteId: note.id })}>Pass</button>
      </div>
    </section>
  )
}
