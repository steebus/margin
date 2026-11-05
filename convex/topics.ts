import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { mutation, query, type QueryCtx } from './_generated/server'
import { positionOf } from './lib/books'
import { genresOf } from './lib/genres'
import { slugify } from './lib/hardcover'
import { buildTopics, isReserved, RESERVED, topicKey, type Reason, type Topic } from './lib/topics'

// Topic pages, the explore graph and hiding (docs/superpowers/specs/2026-11-04-topics-design.md).

type Book = {
  readId: Id<'reads'>
  slug: string
  title: string
  author: string
  status: Doc<'reads'>['status']
  coverUrl: string | null
  art: { small: string; large: string } | null
  at: number | null
  genres: string[]
}

/** Everything a topic is worked out from. Hidden topics are left out unless asked for. */
export async function libraryTopics(ctx: QueryCtx, userId: Id<'users'>, { withHidden = false } = {}) {
  const reads = await ctx.db.query('reads').withIndex('by_user_status', q => q.eq('userId', userId)).collect()
  const books = new Map<string, Book>()
  const works = []
  for (const read of reads) {
    const work = await ctx.db.get(read.workId)
    if (!work) continue
    books.set(read._id, {
      readId: read._id,
      slug: work.slug,
      title: work.title,
      author: work.authors[0] ?? 'Unknown author',
      status: read.status,
      coverUrl: work.coverUrl ?? null,
      art: read.artChoice !== 'cover' && work.artSmallUrl && work.artLargeUrl ? { small: work.artSmallUrl, large: work.artLargeUrl } : null,
      at: read.finishedAt ?? read.startedAt ?? null,
      genres: genresOf(work.tags, work.subjects),
    })
    works.push({ readId: read._id as string, slug: work.slug, title: work.title, authors: work.authors, status: read.status, tags: work.tags ?? [] })
  }
  const entries = (await ctx.db.query('entries').withIndex('by_user', q => q.eq('userId', userId)).collect())
    .filter(e => e.kind !== 'review' && books.has(e.readId))
  const hiddenRows = await ctx.db.query('hiddenTopics').withIndex('by_user', q => q.eq('userId', userId)).collect()
  const hidden = new Set(hiddenRows.map(r => r.key))
  const topics = buildTopics({
    works,
    entries: entries.map(e => ({ id: e._id, readId: e.readId, kind: e.kind, text: e.text, tags: e.tags ?? [], page: e.pos.page, createdAt: e.createdAt })),
    hidden: withHidden ? new Set() : hidden,
  })
  return { topics, books, entries: new Map(entries.map(e => [e._id as string, e])), hidden }
}

const signedIn = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx)
  if (!userId) throw new ConvexError('Sign in first')
  return userId
}

/** Every visible topic, most books first. */
export const list = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const { topics } = await libraryTopics(ctx, userId)
    return topics.map(t => ({ slug: t.slug, name: t.name, books: t.books.length, notes: t.entries.length }))
  },
})

const READ = new Set(['read', 'reading', 'paused', 'dnf'])
const reasonText = (r: Reason) =>
  r.kind === 'genre' ? 'genre'
  : r.kind === 'tag' ? 'tagged on Hardcover'
  : r.kind === 'note' ? (r.page ? `your note, p. ${r.page}` : 'your note')
  : r.page ? `your note mentions it, p. ${r.page}` : 'your note mentions it'

/** One topic as a timeline: books at the date they were read, notes at the date they were written, newest first. */
export const page = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    const { topics, books, entries, hidden } = await libraryTopics(ctx, userId, { withHidden: true })
    const topic = topics.find(t => t.slug === slug)
    if (!topic) return null
    const card = (b: Topic['books'][number]) => ({ ...books.get(b.readId)!, why: b.reasons.map(reasonText).join(' · ') })
    const cards = topic.books.map(card)
    const items = [
      ...cards.filter(b => READ.has(b.status)).map(book => ({ kind: 'book' as const, at: book.at, key: book.readId as string, book })),
      ...topic.entries.map(({ id, how }) => {
        const e = entries.get(id)!
        const book = books.get(e.readId)!
        const position = positionOf(e.pos)
        return {
          kind: 'entry' as const,
          at: e.createdAt,
          key: id,
          entry: { id, kind: e.kind, text: e.text, how, slug: book.slug, where: [book.title, position].filter(Boolean).join(', ') },
        }
      }),
    ].sort((a, b) => (b.at ?? -Infinity) - (a.at ?? -Infinity))
    const dated = items.flatMap(i => (i.at ? [new Date(i.at).getFullYear()] : []))
    return {
      name: topic.name,
      slug: topic.slug,
      key: topic.key,
      hidden: hidden.has(topic.key),
      items,
      tbr: cards.filter(b => !READ.has(b.status)),
      books: [...cards].sort((a, b) => a.title.localeCompare(b.title)),
      years: dated.length ? [Math.min(...dated), Math.max(...dated)] as const : null,
      notes: topic.entries.length,
    }
  },
})

/** A book's visible topics, for its page. */
export const forBook = query({
  args: { readId: v.id('reads') },
  handler: async (ctx, { readId }) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const { topics } = await libraryTopics(ctx, userId)
    return topics.filter(t => t.books.some(b => b.readId === readId)).map(t => ({ slug: t.slug, name: t.name }))
  },
})

/** The whole library as dots: topics with two books or more, Margin's genres, and the books under them. */
export const graph = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { nodes: [], links: [] }
    const { topics, books } = await libraryTopics(ctx, userId)
    const shown = topics.filter(t => t.books.length >= 2)
    const nodes: { id: string; kind: 'topic' | 'genre' | 'book'; label: string; slug: string; size: number; status?: string }[] = []
    const links: { source: string; target: string }[] = []
    const seen = new Set<string>()
    const addBook = (book: Book) => {
      const id = `book:${book.slug}`
      if (!seen.has(id)) {
        seen.add(id)
        nodes.push({ id, kind: 'book', label: book.title, slug: book.slug, size: 1, status: book.status })
      }
      return id
    }
    for (const t of shown) {
      nodes.push({ id: `topic:${t.slug}`, kind: 'topic', label: t.name, slug: t.slug, size: t.books.length })
      for (const b of t.books) links.push({ source: `topic:${t.slug}`, target: addBook(books.get(b.readId)!) })
    }
    // A genre's slug is its name, which is what the shelves filter by.
    const genres = new Map<string, Book[]>()
    for (const book of books.values()) for (const genre of book.genres) genres.set(genre, [...genres.get(genre) ?? [], book])
    for (const [genre, under] of genres) {
      const id = `genre:${slugify(genre)}`
      nodes.push({ id, kind: 'genre', label: genre, slug: genre, size: under.length })
      for (const book of under) links.push({ source: id, target: addBook(book) })
    }
    return { nodes, links }
  },
})

/** Every tag Steve has used and every topic name, for the tag field's suggestions. Reserved labels first. */
export const tagNames = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const { topics, entries, hidden } = await libraryTopics(ctx, userId, { withHidden: true })
    const names = new Map<string, { name: string; reserved: boolean; hidden: boolean }>()
    const add = (name: string) => {
      const key = topicKey(name)
      if (key && !names.has(key)) names.set(key, { name, reserved: isReserved(name), hidden: hidden.has(key) })
    }
    RESERVED.forEach(add)
    for (const e of entries.values()) (e.tags ?? []).forEach(add)
    topics.forEach(t => add(t.name))
    return [...names.values()]
  },
})

export const hide = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await signedIn(ctx)
    const { topics } = await libraryTopics(ctx, userId)
    const topic = topics.find(t => t.slug === slug)
    if (!topic) return
    await ctx.db.insert('hiddenTopics', { userId, key: topic.key, name: topic.name })
  },
})

export const unhide = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const userId = await signedIn(ctx)
    const rows = await ctx.db.query('hiddenTopics').withIndex('by_user', q => q.eq('userId', userId).eq('key', key)).collect()
    for (const row of rows) await ctx.db.delete(row._id)
  },
})

/** Hidden topics, for Settings. */
export const hidden = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return []
    const rows = await ctx.db.query('hiddenTopics').withIndex('by_user', q => q.eq('userId', userId)).collect()
    return rows.map(r => ({ key: r.key, name: r.name ?? r.key })).sort((a, b) => a.name.localeCompare(b.name))
  },
})
