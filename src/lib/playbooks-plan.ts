import { sameBook } from '../../convex/lib/match'
import { shelfStatus, STATUS_RANK, type PlayNote } from '../../convex/lib/playbooks'
import type { PlayVolume } from './google'

type Status = 'read' | 'reading' | 'tbr'
type Shelved = { readId: string; title: string; author: string; status: string }
export type PlayBook = { sourceId: string; title: string; author: string; isbn?: string; status: Status | null; notes: PlayNote[] }
export type PlayDoc = { title: string; volumeId: string | null; notes: PlayNote[] }

export type PlayPlan<B extends Shelved> = {
  onShelves: { book: B; play: PlayBook; move: Status | null }[]
  toAdd: PlayBook[] // a known status: added if Hardcover clearly has it, else reviewed
  toReview: PlayBook[] // Play Books doesn't say how far the reader got
}

/** The furthest along of a book's shelves, or null when none of them says. */
const statusOf = (shelves: number[]) =>
  shelves.map(shelfStatus).filter((s): s is Status => s !== null).sort((a, b) => STATUS_RANK[b] - STATUS_RANK[a])[0] ?? null

/** One list of books from the library and the notes docs, with each doc joined to its book by Google's volume id. */
export function playBooks(volumes: PlayVolume[], docs: PlayDoc[]): PlayBook[] {
  const books = new Map<string, PlayBook>(volumes.map(v => [v.volumeId, { sourceId: v.volumeId, title: v.title, author: v.author, isbn: v.isbn, status: statusOf(v.shelves), notes: [] }]))
  for (const doc of docs) {
    const book = (doc.volumeId && books.get(doc.volumeId)) || [...books.values()].find(b => sameBook(b, { title: doc.title, author: '' }))
    if (book) book.notes.push(...doc.notes)
    else { const id = doc.volumeId ?? `doc:${doc.title}`; books.set(id, { sourceId: id, title: doc.title, author: '', status: null, notes: doc.notes }) }
  }
  return [...books.values()]
}

/** What Play Books would change. Only ever moves a book forward; anything uncertain waits for the reader. */
export function planPlayBooks<B extends Shelved>(books: PlayBook[], shelves: B[]): PlayPlan<B> {
  const plan: PlayPlan<B> = { onShelves: [], toAdd: [], toReview: [] }
  for (const play of books) {
    const book = shelves.find(b => sameBook(b, play))
    if (book) {
      const move = book.status === 'read' ? null
        : play.status === 'read' ? 'read'
        : play.status === 'reading' && (book.status === 'tbr' || book.status === 'paused') ? 'reading' : null
      if (move || play.notes.length) plan.onShelves.push({ book, play, move })
    } else (play.status ? plan.toAdd : plan.toReview).push(play)
  }
  return plan
}
