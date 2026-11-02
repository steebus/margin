import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalMutation } from './_generated/server'
import { LIBRARY_QUERY, mapUserBook, type HardcoverUserBook } from './lib/hardcover'

const PAGE = 100
const PAUSE_MS = 5000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function fetchPage(offset: number): Promise<HardcoverUserBook[]> {
  const key = process.env.HARDCOVER_API_KEY
  if (!key) throw new ConvexError('Hardcover is not connected: HARDCOVER_API_KEY is missing')
  const url = process.env.HARDCOVER_API_URL || 'https://api.hardcover.app/v1/graphql'
  const send = () => fetch(url, {
    method: 'POST',
    headers: { authorization: /^bearer /i.test(key) ? key : `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: LIBRARY_QUERY, variables: { limit: PAGE, offset } }),
  })
  let res = await send()
  if (res.status === 429) {
    await sleep(60_000)
    res = await send()
  }
  if (!res.ok) throw new ConvexError(`Hardcover answered ${res.status}. Try again in a minute.`)
  const json = await res.json()
  if (json.errors) throw new ConvexError('Hardcover refused the request. Check your API token, which expires each year.')
  return json.data?.me?.[0]?.user_books ?? []
}

/** Brings the reader's Hardcover library in. Only reads from Hardcover, and safe to run again. */
export const importLibrary = action({
  args: {},
  handler: async (ctx): Promise<{ added: number; existing: number }> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Sign in to import your library')
    let added = 0
    let existing = 0
    for (let offset = 0; ; offset += PAGE) {
      const page = await fetchPage(offset)
      const items = page.map(mapUserBook).filter(item => item !== null)
      const result: { added: number; existing: number } = await ctx.runMutation(internal.hardcover.saveBooks, { userId, items })
      added += result.added
      existing += result.existing
      if (page.length < PAGE) return { added, existing }
      await sleep(PAUSE_MS)
    }
  },
})

const status = v.union(v.literal('tbr'), v.literal('reading'), v.literal('paused'), v.literal('read'), v.literal('dnf'))
const format = v.union(v.literal('print'), v.literal('ebook'), v.literal('audio'))

export const saveBooks = internalMutation({
  args: {
    userId: v.id('users'),
    items: v.array(v.object({
      work: v.object({
        hardcoverId: v.number(),
        slug: v.string(),
        title: v.string(),
        authors: v.array(v.string()),
        year: v.optional(v.number()),
        isbns: v.array(v.string()),
        coverUrl: v.optional(v.string()),
        pages: v.optional(v.number()),
        subjects: v.array(v.string()),
      }),
      read: v.object({
        hardcoverUserBookId: v.number(),
        status,
        addedAt: v.optional(v.number()),
        startedAt: v.optional(v.number()),
        finishedAt: v.optional(v.number()),
        percent: v.number(),
        page: v.optional(v.number()),
        format,
        owned: v.boolean(),
        rating: v.optional(v.number()),
        recommendedBy: v.optional(v.string()),
      }),
    })),
  },
  handler: async (ctx, { userId, items }) => {
    let added = 0
    let existing = 0
    for (const { work, read } of items) {
      const known = await ctx.db.query('works').withIndex('by_hardcover', q => q.eq('hardcoverId', work.hardcoverId)).first()
      const { slug, ...metadata } = work
      // A slug never changes once minted, because links depend on it.
      const workId = known?._id ?? await ctx.db.insert('works', work)
      if (known) await ctx.db.patch(known._id, metadata)

      // Whatever the reader has done in Margin wins over a re-import.
      const mine = await ctx.db.query('reads').withIndex('by_user_work', q => q.eq('userId', userId).eq('workId', workId)).first()
      if (mine) {
        existing++
        continue
      }
      await ctx.db.insert('reads', {
        userId,
        workId,
        status: read.status,
        addedAt: read.addedAt,
        startedAt: read.startedAt,
        finishedAt: read.finishedAt,
        progress: { percent: read.percent, page: read.page },
        format: read.format,
        ownership: read.owned ? 'owned' : undefined,
        rating: read.rating,
        source: read.recommendedBy ? { kind: 'person', who: read.recommendedBy } : undefined,
        tagIds: [],
        shelfIds: [],
        hardcoverUserBookId: read.hardcoverUserBookId,
      })
      added++
    }
    return { added, existing }
  },
})
