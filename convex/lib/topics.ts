import { slugify } from './hardcover'

// Topics (design: docs/superpowers/specs/2026-11-04-topics-design.md). Nothing about a topic is stored except
// that Steve hid it: they're worked out from Hardcover's tags on his books, his note tags, and what his notes say.

/** Note tags that organise notes and are never topics. */
export const RESERVED = ['Theme', 'Chapter summary', 'why choose'] as const

/** One topic, however it's spelled: "Feminism.", " feminism" and "FEMINISM" are the same. */
export const topicKey = (name: string) =>
  name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim()

const reservedKeys = new Set(RESERVED.map(topicKey))
export const isReserved = (tag: string) => reservedKeys.has(topicKey(tag))

type CachedTag = { tag?: string | null; count?: number | null }
export type CachedTags = { Genre?: CachedTag[] | null; Tag?: CachedTag[] | null } & Record<string, unknown>
export type BookTag = { name: string; kind: 'genre' | 'tag'; count?: number }

const MAX_TAGS = 8
const KEPT_TAGS = 20

/** What's kept of a book's Hardcover tags: every genre, and its readers' tags with how many used each. */
export function bookTags(cached: CachedTags | null | undefined): BookTag[] {
  const names = (list?: CachedTag[] | null) => (list ?? []).filter(t => t.tag?.trim())
  const genres = names(cached?.Genre).map(t => ({ name: t.tag!.trim(), kind: 'genre' as const }))
  const tags = names(cached?.Tag).slice(0, KEPT_TAGS).map(t => ({ name: t.tag!.trim(), kind: 'tag' as const, count: t.count ?? 0 }))
  return [...genres, ...tags]
}

/**
 * Which of a book's tags count as topics. Every genre; a reader tag only when two readers used it or it's a topic
 * already, since one reader's "Weak Character Development" isn't a subject. At most 8 reader tags a book.
 */
export const topicTags = (tags: BookTag[], known: Set<string>) => [
  ...tags.filter(t => t.kind === 'genre'),
  ...tags.filter(t => t.kind === 'tag' && ((t.count ?? 0) >= 2 || known.has(topicKey(t.name)))).slice(0, MAX_TAGS),
]

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const patterns = new Map<string, RegExp>()
const patternFor = (name: string) => {
  let re = patterns.get(name)
  if (!re) {
    // Whole word or phrase, or that with a plain plural. Not inside a longer word: "feministic" isn't "feminism".
    re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(name.trim())}s?(?![\\p{L}\\p{N}])`, 'iu')
    patterns.set(name, re)
  }
  return re
}

/** Whether a note's words mention a topic by name. */
export const mentions = (text: string, name: string) =>
  text.toLowerCase().includes(name.trim().toLowerCase()) && patternFor(name).test(text)

export type WorkIn = {
  readId: string
  slug: string
  title: string
  authors: string[]
  status: string
  startedAt?: number
  finishedAt?: number
  coverUrl?: string
  artSmallUrl?: string
  tags: BookTag[]
}
export type EntryIn = { id: string; readId: string; kind: string; text: string; tags: string[]; page?: number; createdAt: number }
export type Reason = { kind: 'genre' | 'tag' | 'note' | 'mentions'; page?: number }
export type Topic = {
  key: string
  slug: string
  name: string
  books: { readId: string; reasons: Reason[] }[]
  entries: { id: string; how: 'tagged' | 'mentions' }[]
}

/** Every visible topic with its books and notes, most books first. */
export function buildTopics({ works, entries, hidden }: { works: WorkIn[]; entries: EntryIn[]; hidden: Set<string> }): Topic[] {
  const topics = new Map<string, Topic & { byRead: Map<string, Reason[]>; entryIds: Set<string> }>()
  const topicFor = (name: string) => {
    const key = topicKey(name)
    if (!key || hidden.has(key) || reservedKeys.has(key)) return null
    let topic = topics.get(key)
    if (!topic) {
      topic = { key, slug: slugify(key) || 'topic', name: name.trim(), books: [], entries: [], byRead: new Map(), entryIds: new Set() }
      topics.set(key, topic)
    }
    return topic
  }
  const addBook = (topic: NonNullable<ReturnType<typeof topicFor>>, readId: string, reason: Reason) => {
    const reasons = topic.byRead.get(readId) ?? []
    if (!reasons.some(r => r.kind === reason.kind)) reasons.push(reason)
    topic.byRead.set(readId, reasons)
  }
  const addEntry = (topic: NonNullable<ReturnType<typeof topicFor>>, id: string, how: 'tagged' | 'mentions') => {
    if (topic.entryIds.has(id)) return
    topic.entryIds.add(id)
    topic.entries.push({ id, how })
  }

  // Topics that exist apart from one-reader tags, so a lone reader tag can join one.
  const known = new Set([
    ...works.flatMap(w => w.tags.filter(t => t.kind === 'genre' || (t.count ?? 0) >= 2).map(t => topicKey(t.name))),
    ...entries.flatMap(e => e.tags.map(topicKey)),
  ])
  for (const work of works) for (const tag of topicTags(work.tags, known)) {
    const topic = topicFor(tag.name)
    if (topic) addBook(topic, work.readId, { kind: tag.kind })
  }
  for (const entry of entries) for (const tag of entry.tags) {
    const topic = topicFor(tag)
    if (!topic) continue
    addBook(topic, entry.readId, entry.page ? { kind: 'note', page: entry.page } : { kind: 'note' })
    addEntry(topic, entry.id, 'tagged')
  }
  // Mentions only join topics that exist already: a word in a note doesn't make a topic on its own.
  for (const topic of topics.values()) for (const entry of entries) {
    if (topic.entryIds.has(entry.id) || !mentions(entry.text, topic.name)) continue
    addEntry(topic, entry.id, 'mentions')
    addBook(topic, entry.readId, entry.page ? { kind: 'mentions', page: entry.page } : { kind: 'mentions' })
  }

  return [...topics.values()]
    .map(({ byRead, entryIds: _ids, ...topic }) => ({ ...topic, books: [...byRead].map(([readId, reasons]) => ({ readId, reasons })) }))
    .sort((a, b) => b.books.length - a.books.length || a.name.localeCompare(b.name))
}
