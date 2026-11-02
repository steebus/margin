import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// A work is the book itself, shared between readers and re-reads. A read is one person's time with it.
const status = v.union(v.literal('tbr'), v.literal('reading'), v.literal('paused'), v.literal('read'), v.literal('dnf'))
const format = v.union(v.literal('print'), v.literal('ebook'), v.literal('audio'))
const ownership = v.union(v.literal('owned'), v.literal('borrowed'), v.literal('library'))
const sourceKind = v.union(
  v.literal('person'), v.literal('podcast'), v.literal('article'), v.literal('bookshop'), v.literal('library'),
  v.literal('social'), v.literal('algorithm'), v.literal('citation'), v.literal('other'),
)
const entryKind = v.union(v.literal('excerpt'), v.literal('note'), v.literal('summary'), v.literal('reflection'))
const origin = v.union(
  v.literal('manual'), v.literal('camera'), v.literal('share'), v.literal('kindle'),
  v.literal('kobo'), v.literal('playbooks'), v.literal('hardcover'),
)

export default defineSchema({
  ...authTables,

  works: defineTable({
    slug: v.string(),
    title: v.string(),
    authors: v.array(v.string()),
    year: v.optional(v.number()),
    isbns: v.array(v.string()),
    hardcoverId: v.optional(v.number()),
    olid: v.optional(v.string()),
    gbooksId: v.optional(v.string()),
    coverId: v.optional(v.number()),
    pages: v.optional(v.number()),
    subjects: v.array(v.string()),
    originalLanguage: v.optional(v.string()),
  })
    .index('by_slug', ['slug'])
    .index('by_hardcover', ['hardcoverId'])
    .searchIndex('search_title', { searchField: 'title' }),

  // One drawing per work (SPEC 3.11). Small and large are empty until it's ready.
  workArt: defineTable({
    workId: v.id('works'),
    state: v.union(v.literal('queued'), v.literal('ready'), v.literal('failed'), v.literal('rejected')),
    small: v.optional(v.id('_storage')),
    large: v.optional(v.id('_storage')),
    model: v.optional(v.string()),
    scene: v.optional(v.string()),
    prompt: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_work', ['workId'])
    .index('by_state', ['state']),

  authors: defineTable({
    name: v.string(),
    hardcoverId: v.optional(v.number()),
    gender: v.optional(v.string()),
    nationality: v.optional(v.string()),
    confirmed: v.boolean(),
  }).index('by_name', ['name']),

  // Anyone a book came from, including an Instagram account.
  people: defineTable({
    userId: v.id('users'),
    slug: v.string(),
    name: v.string(),
    note: v.optional(v.string()),
  })
    .index('by_user_slug', ['userId', 'slug'])
    .index('by_user_name', ['userId', 'name']),

  reads: defineTable({
    userId: v.id('users'),
    workId: v.id('works'),
    status,
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    progress: v.object({ percent: v.number(), page: v.optional(v.number()), chapter: v.optional(v.string()) }),
    format,
    ownership: v.optional(ownership),
    rating: v.optional(v.number()),
    source: v.optional(v.object({
      kind: sourceKind,
      personId: v.optional(v.id('people')),
      who: v.optional(v.string()),
      url: v.optional(v.string()),
      why: v.optional(v.string()),
      date: v.optional(v.number()),
    })),
    tagIds: v.array(v.id('tags')),
    shelfIds: v.array(v.id('shelves')),
    hardcoverUserBookId: v.optional(v.number()),
  })
    .index('by_user_status', ['userId', 'status'])
    .index('by_user_work', ['userId', 'workId'])
    .index('by_hardcover', ['hardcoverUserBookId']),

  progressLog: defineTable({
    userId: v.id('users'),
    readId: v.id('reads'),
    at: v.number(),
    percent: v.number(),
    page: v.optional(v.number()),
    chapter: v.optional(v.string()),
    origin,
  }).index('by_read', ['readId', 'at']),

  entries: defineTable({
    userId: v.id('users'),
    readId: v.id('reads'),
    kind: entryKind,
    text: v.string(),
    parentId: v.optional(v.id('entries')),
    pos: v.object({
      page: v.optional(v.number()),
      chapter: v.optional(v.string()),
      percent: v.optional(v.number()),
      loc: v.optional(v.string()),
      cfi: v.optional(v.string()),
    }),
    origin,
    // Keyed on work, normalised text and position, so re-importing is always safe.
    originKey: v.string(),
    imageId: v.optional(v.id('_storage')),
    createdAt: v.number(),
  })
    .index('by_read', ['readId', 'createdAt'])
    .index('by_user', ['userId', 'createdAt'])
    .index('by_user_origin_key', ['userId', 'originKey'])
    .searchIndex('search_text', { searchField: 'text', filterFields: ['userId', 'kind'] }),

  shelves: defineTable({
    userId: v.id('users'),
    slug: v.string(),
    name: v.string(),
    // A smart shelf is a saved filter, in the same grammar as the Shelves URL.
    filter: v.optional(v.string()),
    hardcoverListId: v.optional(v.number()),
  }).index('by_user_slug', ['userId', 'slug']),

  tags: defineTable({
    userId: v.id('users'),
    name: v.string(),
    colour: v.optional(v.string()),
  }).index('by_user_name', ['userId', 'name']),
})
