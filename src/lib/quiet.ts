import { useEffect, useState } from 'react'
import { progressAt } from '../../convex/lib/books'
import { errorText } from './books'
import { keepThenSend, type Queued } from './outbox'

// Writes the reader shouldn't wait for (Steve, 2026-11-06): the screen moves on at once, the write goes in the
// background, and only a failure speaks up, in a toast that stays until dismissed. A lost connection isn't a failure:
// the write is kept on the device and goes on the next replay. Only a refusal from the server is.

export type Failure = { id: number; message: string; words?: string }

const listeners = new Set<(f: Failure) => void>()
let next = 0

export function sendQuietly(name: Queued['name'], args: Record<string, unknown>, send: () => Promise<unknown>, failure: { message: string; words?: string }) {
  return keepThenSend(name, args, send).then(() => true, e => {
    const f = { id: ++next, message: `${failure.message} ${errorText(e, '')}`.trim(), words: failure.words }
    for (const listen of listeners) listen(f)
    return false
  })
}

/** Failures waiting to be read, oldest first, with a way to clear one. */
export function useFailures() {
  const [failures, setFailures] = useState<Failure[]>([])
  useEffect(() => {
    const add = (f: Failure) => setFailures(all => [...all, f])
    listeners.add(add)
    return () => { listeners.delete(add) }
  }, [])
  return [failures, (id: number) => setFailures(all => all.filter(f => f.id !== id))] as const
}

type Placed = { readId: string; percent: number; page: number | null; seconds: number | null; pages: number | null; audioSeconds: number | null }

/** A book moved to a logged place, as the server will have it: the screen shows it before the answer comes back. */
export function movedTo<T extends Placed>(book: T, at: { page?: number; seconds?: number; percent?: number }): T {
  const placed = progressAt(at, book.pages ?? undefined, book.audioSeconds ?? undefined)
  if (!placed) return book
  return { ...book, percent: placed.percent, page: placed.page ?? book.page, seconds: placed.seconds ?? book.seconds }
}
