// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const DAY = 24 * 60 * 60_000

test('after a simulated seven-day gap, a subscribed reader is due one nudge, and then not again that day', async () => {
  const t = convexTest(schema, import.meta.glob('./**/*.ts'))
  const userId = await t.run(ctx => ctx.db.insert('users', { name: 'Steve' }))
  const as = t.withIdentity({ subject: `${userId}|session` })
  await t.mutation(internal.hardcover.saveBooks, {
    userId,
    items: [{
      work: { hardcoverId: 1, slug: 'book-1', title: 'Book One', authors: ['An Author'], isbns: [], subjects: [], pages: 200 },
      read: { hardcoverUserBookId: 10, status: 'reading', percent: 25, format: 'print', owned: false },
    }],
  })
  const [{ readId }] = await as.query(api.library.myBooks, {})
  await as.mutation(api.library.logProgress, { readId, percent: 30 })

  await as.mutation(api.push.subscribe, { endpoint: 'https://push.example/abc', p256dh: 'key', auth: 'secret' })
  expect(await as.query(api.push.isSubscribed, { endpoint: 'https://push.example/abc' })).toBe(true)

  expect(await t.query(internal.push.due, { now: Date.now() + 6 * DAY })).toEqual([])
  const later = Date.now() + 8 * DAY
  const [due] = await t.query(internal.push.due, { now: later })
  expect(due.nudge).toEqual({ title: 'Book One has been quiet', body: 'Nothing logged for 8 days. Still reading it?', url: '/books/book-1' })
  expect(due.subs.map(s => s.endpoint)).toEqual(['https://push.example/abc'])

  await t.mutation(internal.push.sent, { ids: due.subs.map(s => s.id), at: later })
  expect(await t.query(internal.push.due, { now: later + 60_000 })).toEqual([])

  await as.mutation(api.push.unsubscribe, { endpoint: 'https://push.example/abc' })
  expect(await t.query(internal.push.due, { now: later + 2 * DAY })).toEqual([])
})
