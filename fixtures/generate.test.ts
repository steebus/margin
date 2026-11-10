// @vitest-environment edge-runtime
// Builds fixture mode's data (docs/IMPROVEMENT-LOOP.md E1): seeds an in-memory database with fixtures/library.ts and
// asks Margin's real queries for every screen's answer, so the fixtures can't drift from what the server returns.
// It runs with `npm test` too, where it proves the seed is valid against the schema and every query answers.
// The file it writes is gitignored; `npm run fixtures` makes it fresh, so its dates are always recent.
import { mkdirSync, writeFileSync } from 'node:fs'
import { convexTest } from 'convex-test'
import { getFunctionName, type FunctionReference } from 'convex/server'
import { expect, test, vi } from 'vitest'
import { api } from '../convex/_generated/api'
import { windowStart } from '../convex/lib/activity'
import schema from '../convex/schema'
import { SEARCH_HITS, seed } from './library'

const modules = import.meta.glob('../convex/**/*.ts')

type Answer = { args: Record<string, unknown>; value: unknown }

test('the made-up library answers every query the screens ask', async () => {
  // The buddy's screen asks whether a key is set, to offer the conversation at all.
  vi.stubEnv('ANTHROPIC_API_KEY', 'fixture')
  const now = Date.now()
  const t = convexTest(schema, modules)
  const userId = await t.run(ctx => seed(ctx, now))
  const emptyId = await t.run(ctx => ctx.db.insert('users', { name: 'New Reader', email: 'new@example.com' }))

  const collect = async (as: ReturnType<typeof t.withIdentity>, full: boolean) => {
    const queries: Record<string, Answer[]> = {}
    const ask = async (query: FunctionReference<'query'>, args: Record<string, unknown> = {}) => {
      const value = await as.query(query, args as never)
      ;(queries[getFunctionName(query)] ??= []).push({ args, value: value ?? null })
      return value as never
    }
    const books: { readId: string; slug: string }[] = await ask(api.library.myBooks)
    const entries: { id: string }[] = await ask(api.library.allEntries)
    await ask(api.library.latestRead)
    await ask(api.library.activity, { since: windowStart(now) })
    await ask(api.books.myLists)
    await ask(api.buddy.monthSpend)
    await ask(api.google.clientConfig)
    await ask(api.hardcover.syncStatus)
    await ask(api.kobo.status)
    await ask(api.push.publicKey)
    await ask(api.reflect.waiting)
    await ask(api.review.waiting)
    await ask(api.topics.graph)
    await ask(api.topics.hidden)
    await ask(api.topics.tagNames)
    await ask(api.users.viewer)
    const topics: { slug: string }[] = await ask(api.topics.list)
    if (!full) return queries
    for (const { slug } of topics) await ask(api.topics.page, { slug })
    for (const { id } of entries) await ask(api.entries.entry, { id })
    for (const { readId, slug } of books) {
      await ask(api.library.bookBySlug, { slug })
      await ask(api.topics.forBook, { readId })
      await ask(api.buddy.thread, { readId })
      await ask(api.buddy.guideSoFar, { readId })
    }
    return queries
  }

  const library = await collect(t.withIdentity({ subject: `${userId}|session` }), true)
  const empty = await collect(t.withIdentity({ subject: `${emptyId}|session` }), false)

  // The library has what the screens need to show: every status, something in hand, and words to read.
  const books = library['library:myBooks'][0].value as { status: string }[]
  expect(new Set(books.map(b => b.status))).toEqual(new Set(['tbr', 'reading', 'paused', 'read', 'dnf']))
  expect((library['library:allEntries'][0].value as unknown[]).length).toBeGreaterThan(40)
  expect((library['topics:list'][0].value as unknown[]).length).toBeGreaterThan(5)
  expect(library['reflect:waiting'][0].value).not.toEqual([])
  expect(empty['library:myBooks'][0].value).toEqual([])

  mkdirSync(new URL('../src/fixtures/', import.meta.url), { recursive: true })
  writeFileSync(new URL('../src/fixtures/data.json', import.meta.url), JSON.stringify({ generatedAt: now, library, empty, search: SEARCH_HITS }))
})
