import * as z from 'zod/mini'

/** A search parameter that is ignored, not an error, when it's missing or malformed (a stale bookmark must still open). */
export const caught = <T extends z.ZodMiniType>(schema: T) => z.catch(z.optional(schema), undefined)

export const entriesSearch = z.object({ kind: caught(z.string()) })
export const addSearch = z.object({ q: caught(z.string()) })
export const statsSearch = z.object({ range: caught(z.string()) })
export const captureSearch = z.object({
  book: caught(z.string()),
  kind: caught(z.enum(['excerpt', 'note', 'summary'])),
  text: caught(z.string()),
  page: caught(z.pipe(z.coerce.number(), z.int().check(z.positive()))),
  popup: caught(z.coerce.number()),
})
export const shareSearch = z.object({
  url: caught(z.string()),
  title: caught(z.string()),
  text: caught(z.string()),
  popup: caught(z.coerce.number()),
})
export const exploreSearch = z.object({
  focus: caught(z.string()),
  depth: caught(z.pipe(z.coerce.number(), z.int().check(z.minimum(1), z.maximum(2)))),
  show: caught(z.string()),
})
export const notesSearch = z.object({
  q: caught(z.string()),
  kind: caught(z.string()),
  status: caught(z.string()),
  label: caught(z.string()),
  drawer: caught(z.coerce.boolean()),
  from: caught(z.pipe(z.coerce.number(), z.int())),
  to: caught(z.pipe(z.coerce.number(), z.int())),
  sort: caught(z.enum(['book', 'written', 'read', 'title'])),
  dir: caught(z.enum(['asc', 'desc'])),
})
