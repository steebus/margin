import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../convex/_generated/api'

export type Book = FunctionReturnType<typeof api.library.myBooks>[number]
export type Status = Book['status']

export const formatDate = (time: number) =>
  new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Why a query failed, in words a reader can use. Convex hides other errors in production. */
export const errorText = (error: unknown, fallback: string) => {
  const data = (error as { data?: unknown })?.data
  return typeof data === 'string' ? data : fallback
}
