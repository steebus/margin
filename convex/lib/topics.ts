import { isGenreName } from './genres'
import { slugify } from './hardcover'

// Topics (design: docs/superpowers/specs/2026-11-04-topics-design.md). Nothing about a topic is stored except
// that Steve hid it: they're worked out from Hardcover's tags on his books, his note tags, and what his notes say.

/** Note tags that organise notes and are never topics. */
export const RESERVED = ['Theme', 'Chapter summary', 'why choose'] as const

// Spellings readers use for the same subject, keyed and valued in topicKey's own form.
const SAME: Record<string, string> = {
  'sci fi': 'science fiction', scifi: 'science fiction', nonfiction: 'non fiction', humour: 'humor', humorous: 'humor',
  'self help': 'self improvement', thrillers: 'thriller', 'short story': 'short stories',
}

/** One topic, however it's spelled: "Feminism.", " feminism", "FEMINISM" are one, as are "Sci-fi" and "Science Fiction". */
export const topicKey = (name: string) => {
  const key = name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim()
  return SAME[key] ?? key
}

// What Hardcover's tags carry that isn't a subject (checked on Steve's library, 2026-11-04): its review form's answers
// ("Plot driven", "Unloveable Characters", on nearly every book), moods and pace, catch-alls, and readers' own shelf and
// format labels. Only Hardcover's tags are screened: a tag Steve puts on a note is always his topic.
const NOT_SUBJECTS = new Set([
  'plot driven', 'character driven', 'a mix driven', 'n a driven', 'loveable characters', 'unloveable characters',
  'strong character development', 'weak character development', 'diverse characters', 'not diverse characters',
  'flaws of characters a main focus', 'fast paced', 'medium paced', 'slow paced', 'dark', 'tense', 'adventurous',
  'inspiring', 'thought provoking', 'emotional', 'funny', 'hopeful', 'informative', 'lighthearted', 'mysterious',
  'reflective', 'relaxing', 'sad', 'challenging', 'fiction', 'non fiction', 'general', 'novel', 'novels', 'literature',
  'adult', 'english', 'book', 'books', 'genre fiction', 'female author', 'male author', 'series', 'bookclub', 'book club',
  'library', 'wishlist', 'favorites', 'favourites', 'physical', 'paperback', 'hardcover', 'ebook', 'audiobook',
  'audible', 'kindle', 'kobo', 'audiobooks', 'ebooks', 'movie', 'reference', 'how to', 'authors', 'novella', 'owned', 'dual format', 'united states', 'did not finish', 'dnf', 'abandoned',
  'currently reading', 'want to read', 'tbr', 'unread',
])
const NOT_SUBJECT_PATTERN = /import|owned|\bown\b|format|\bread\b|reading plan|^phase|^to |#|\d{4}|^audible|^kindle|^from /

/** Whether a Hardcover genre or tag names a subject, rather than a mood, a review answer or someone's shelf. */
export const isSubject = (name: string) => {
  const key = topicKey(name)
  return key.length > 1 && !NOT_SUBJECTS.has(key) && !NOT_SUBJECT_PATTERN.test(key)
}

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
  ...tags.filter(t => t.kind === 'genre' && isSubject(t.name)),
  ...tags.filter(t => t.kind === 'tag' && isSubject(t.name) && ((t.count ?? 0) >= 2 || known.has(topicKey(t.name)))).slice(0, MAX_TAGS),
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
  // The reader's own corrections: topics put on this book by name, and topics taken off it by key.
  added?: string[]
  removed?: string[]
}
export type EntryIn = { id: string; readId: string; kind: string; text: string; tags: string[]; page?: number; createdAt: number }
export type Reason = { kind: 'genre' | 'tag' | 'note' | 'mentions' | 'yours'; page?: number }
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
    // Genres are their own dimension (lib/genres.ts), so "Fantasy" is never a topic, wherever it comes from.
    if (!key || hidden.has(key) || reservedKeys.has(key) || isGenreName(name)) return null
    let topic = topics.get(key)
    if (!topic) {
      topic = { key, slug: slugify(key) || 'topic', name: name.trim(), books: [], entries: [], byRead: new Map(), entryIds: new Set() }
      topics.set(key, topic)
    } else if (topic.name === topic.name.toLowerCase() && name.trim() !== name.trim().toLowerCase()) {
      // A capitalised spelling reads better than a lower-case one: "Grief", not "grief".
      topic.name = name.trim()
    }
    return topic
  }
  const removed = new Map(works.map(w => [w.readId, new Set(w.removed ?? [])]))
  const addBook = (topic: NonNullable<ReturnType<typeof topicFor>>, readId: string, reason: Reason) => {
    // Taken off this book by the reader: its notes can still be on the topic, the book isn't.
    if (removed.get(readId)?.has(topic.key)) return
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
    ...works.flatMap(w => w.tags.filter(t => isSubject(t.name) && (t.kind === 'genre' || (t.count ?? 0) >= 2)).map(t => topicKey(t.name))),
    ...entries.flatMap(e => e.tags.map(topicKey)),
    ...works.flatMap(w => (w.added ?? []).map(topicKey)),
  ])
  for (const work of works) for (const name of work.added ?? []) {
    const topic = topicFor(name)
    if (topic) addBook(topic, work.readId, { kind: 'yours' })
  }
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
