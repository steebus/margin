import { useEffect, useState } from 'react'
import { progressAt } from '../../convex/lib/books'
import { movedIn } from '../../convex/lib/activity'
import { errorText } from './books'
import { keepThenSend, type Queued } from './outbox'

// Writes the reader shouldn't wait for (Steve, 2026-11-06): the screen moves on at once, the write goes in the
// background, and only a failure speaks up, in a toast that stays until dismissed. A lost connection isn't a failure:
// the write is kept on the device and goes on the next replay. Only a refusal from the server is.

export type Failure = { id: number; message: string; words?: string }

const listeners = new Set<(f: Failure) => void>()
let next = 0

const say = (f: Omit<Failure, 'id'>) => {
  const failure = { ...f, id: ++next }
  for (const listen of listeners) listen(failure)
}

/** A queued write the server refused when it was replayed: the same "Not saved" toast, holding the words. */
export function replayFailure(item: Queued, error: unknown): Omit<Failure, 'id'> {
  if (item.name === 'logProgress') return { message: `A place logged offline didn't save. ${errorText(error, '')}`.trim() }
  const { kind, text, note } = item.args as { kind?: string; text?: string; note?: string }
  const words = [text, note?.trim()].filter(Boolean).join('\n\n')
  return { message: `A ${kind === 'excerpt' ? 'line' : kind ?? 'note'} written offline didn't save. ${errorText(error, '')}`.trim(), words: words || undefined }
}

export const sayReplayFailure = (item: Queued, error: unknown) => say(replayFailure(item, error))

export function sendQuietly(name: Queued['name'], args: Record<string, unknown>, send: () => Promise<unknown>, failure: { message: string; words?: string }) {
  return keepThenSend(name, args, send).then(() => true, e => {
    say({ message: `${failure.message} ${errorText(e, '')}`.trim(), words: failure.words })
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

type Window = {
  logs: { readId: string; logs: { at: number; percent: number }[] }[]
  pages: number
  audioSeconds: number
}
type Moving = { readId: string; percent: number; startedAt: number | null; format: string; pages: number | null; audioSeconds: number | null }

/**
 * The Desk's window with one more log in it, as the server will have it once it answers: the line gains a step and
 * the pages (or listening) read move by what that log added.
 */
export function withLogged<T extends Window>(activity: T, book: Moving, percent: number, since: number, now: number): T {
  const before = activity.logs.find(l => l.readId === book.readId)?.logs ?? []
  const after = [...before, { at: now, percent }]
  const gain = movedIn(after, since, now, book.startedAt) - movedIn(before, since, now, book.startedAt)
  const logs = before.length || activity.logs.some(l => l.readId === book.readId)
    ? activity.logs.map(l => (l.readId === book.readId ? { ...l, logs: after } : l))
    : [...activity.logs, { readId: book.readId, logs: after }]
  return {
    ...activity,
    logs,
    pages: book.format === 'audio' ? activity.pages : Math.round(activity.pages + gain * (book.pages ?? 0)),
    audioSeconds: book.format === 'audio' ? Math.round(activity.audioSeconds + gain * (book.audioSeconds ?? 0)) : activity.audioSeconds,
  }
}
