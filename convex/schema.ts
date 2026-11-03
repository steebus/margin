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
const entryKind = v.union(v.literal('excerpt'), v.literal('note'), v.literal('summary'), v.literal('reflection'), v.literal('review'))
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
    coverUrl: v.optional(v.string()),
    artSmallUrl: v.optional(v.string()),
    artLargeUrl: v.optional(v.string()),
    pages: v.optional(v.number()),
    audioSeconds: v.optional(v.number()),
    subjects: v.array(v.string()),
    originalLanguage: v.optional(v.string()),
    // The first author's, from Hardcover, for the stats. Missing where Hardcover doesn't know.
    authorGender: v.optional(v.string()),
    authorCountry: v.optional(v.string()),
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
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_work', ['workId'])
    .index('by_state', ['state']),

  // Drawings a work used to show, kept so the reader can go back to one (Steve, 2026-11-03). The current one is in workArt.
  pastArt: defineTable({
    workId: v.id('works'),
    small: v.id('_storage'),
    large: v.id('_storage'),
    smallUrl: v.string(),
    largeUrl: v.string(),
    scene: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_work', ['workId', 'createdAt']),

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
    addedAt: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    progress: v.object({ percent: v.number(), page: v.optional(v.number()), seconds: v.optional(v.number()), chapter: v.optional(v.string()) }),
    // How this reader likes to log this book. Works out a default from the format until they choose.
    progressUnit: v.optional(v.union(v.literal('page'), v.literal('time'), v.literal('percent'))),
    // Each time through the book, oldest first. startedAt and finishedAt above are always the latest one's.
    readings: v.optional(v.array(v.object({ hardcoverId: v.optional(v.number()), startedAt: v.optional(v.number()), finishedAt: v.optional(v.number()) }))),
    // Reads removed here, still to be removed from Hardcover. Only ever explicit, so a stale copy can't delete anything.
    deletedReadings: v.optional(v.array(v.number())),
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
    // Whether this reader wants the drawing or the cross-hatch of the real cover. The drawing unless they say.
    artChoice: v.optional(v.union(v.literal('drawing'), v.literal('cover'))),
    // How many percent the guide runs ahead of this reader's edition, from their "hasn't happened yet" (SPEC 3.3).
    guideLag: v.optional(v.number()),
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
    // A reflection keeps the question it answers.
    question: v.optional(v.string()),
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
    hardcoverJournalId: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_read', ['readId', 'createdAt'])
    .index('by_user', ['userId', 'createdAt'])
    .index('by_user_origin_key', ['userId', 'originKey'])
    .index('by_user_journal', ['userId', 'hardcoverJournalId'])
    .searchIndex('search_text', { searchField: 'text', filterFields: ['userId', 'kind'] }),

  // A book's researched guide (SPEC 3.3), shared by every read of the work. The guide's shape is checked by
  // lib/guide.ts when it's written, so it's stored as it came.
  guides: defineTable({
    workId: v.id('works'),
    userId: v.id('users'),
    state: v.union(v.literal('writing'), v.literal('ready'), v.literal('failed')),
    // Chosen by the reader (lib/guide.ts DEPTHS). Missing on guides written before depths, which were deep.
    depth: v.optional(v.union(v.literal('light'), v.literal('deep'))),
    version: v.number(),
    guide: v.optional(v.any()),
    error: v.optional(v.string()),
    usage: v.optional(v.object({ input: v.number(), output: v.number(), cacheRead: v.number(), cacheWrite: v.number(), searches: v.number() })),
    createdAt: v.number(),
  })
    .index('by_work', ['workId'])
    .index('by_user', ['userId', 'createdAt']),

  // The conversation about one read. A reply is written into its row as it streams in.
  buddyTurns: defineTable({
    userId: v.id('users'),
    readId: v.id('reads'),
    role: v.union(v.literal('buddy'), v.literal('reader')),
    text: v.string(),
    state: v.union(v.literal('writing'), v.literal('done'), v.literal('failed')),
    usage: v.optional(v.object({ input: v.number(), output: v.number(), cacheRead: v.number(), cacheWrite: v.number() })),
    createdAt: v.number(),
  })
    .index('by_read', ['readId', 'createdAt'])
    .index('by_user', ['userId', 'createdAt']),

  // A note the buddy leaves when progress crosses a milestone (SPEC 3.3), waiting on the book until it's dealt with.
  buddyQueue: defineTable({
    userId: v.id('users'),
    readId: v.id('reads'),
    milestoneKey: v.string(),
    percent: v.number(),
    text: v.string(),
    state: v.union(v.literal('pending'), v.literal('snoozed'), v.literal('answered'), v.literal('passed')),
    snoozedUntil: v.optional(v.number()),
    createdAt: v.number(),
  }).index('by_read', ['readId', 'createdAt']),

  // A device that has said yes to nudges (SPEC 3.3), and when it was last sent one.
  pushSubscriptions: defineTable({
    userId: v.id('users'),
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    lastSentAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_endpoint', ['endpoint'])
    .index('by_user', ['userId']),

  // The reader telling the buddy it got something wrong for this read, kept so it isn't said again (SPEC 3.3).
  corrections: defineTable({
    userId: v.id('users'),
    readId: v.id('reads'),
    kind: v.union(v.literal('notYet'), v.literal('edition')),
    quote: v.string(),
    createdAt: v.number(),
  }).index('by_read', ['readId', 'createdAt']),

  // The question asked when a book is finished. One per read, however many times it's marked finished.
  reflectionPrompts: defineTable({
    userId: v.id('users'),
    readId: v.id('reads'),
    state: v.union(v.literal('writing'), v.literal('waiting'), v.literal('answered'), v.literal('skipped')),
    question: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_read', ['readId'])
    .index('by_user_state', ['userId', 'state', 'createdAt']),

  shelves: defineTable({
    userId: v.id('users'),
    slug: v.string(),
    name: v.string(),
    // A smart shelf is a saved filter, in the same grammar as the Shelves URL.
    filter: v.optional(v.string()),
    hardcoverListId: v.optional(v.number()),
  }).index('by_user_slug', ['userId', 'slug']),

  // One row per connected reader. Sync starts once the first import has run.
  integrations: defineTable({
    userId: v.id('users'),
    provider: v.literal('hardcover'),
    hardcoverUserId: v.number(),
    cursor: v.string(),
    lastSyncAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_provider', ['provider']),

  // Changes waiting to reach Hardcover. A read's row always pushes its latest state, so changes coalesce.
  hardcoverOutbox: defineTable({
    userId: v.id('users'),
    kind: v.union(v.literal('read'), v.literal('entry'), v.literal('deleteJournal'), v.literal('addBook'), v.literal('listBook'), v.literal('unlistBook')),
    readId: v.optional(v.id('reads')),
    entryId: v.optional(v.id('entries')),
    journalId: v.optional(v.number()),
    shelfId: v.optional(v.id('shelves')),
    version: v.number(),
    attempts: v.number(),
    nextAt: v.number(),
    lastError: v.optional(v.string()),
  })
    .index('by_next', ['nextAt'])
    .index('by_user', ['userId'])
    .index('by_read', ['readId']),

  tags: defineTable({
    userId: v.id('users'),
    name: v.string(),
    colour: v.optional(v.string()),
  }).index('by_user_name', ['userId', 'name']),
})
