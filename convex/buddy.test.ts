// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import { bookPack, costOf, placeInBook, toMessages, visibleTo } from './lib/buddy'
import schema from './schema'

const sse = (events: object[]) => new Response(
  events.map(e => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join(''),
  { headers: { 'content-type': 'text/event-stream' } },
)
const message = (words: string[], stop_reason = 'end_turn') => [
  { type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: 'x', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 100, output_tokens: 0, cache_read_input_tokens: 50, cache_creation_input_tokens: 10 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  ...words.map(text => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })),
  { type: 'content_block_stop', index: 0 },
  { type: 'message_delta', delta: { stop_reason, stop_sequence: null }, usage: { output_tokens: 20 } },
  { type: 'message_stop' },
]

/** A stand-in for Anthropic. Nothing here reaches the real API. */
const fakeClaude = (answer: () => Response) => {
  const bodies: { model: string; system: { text: string }[]; messages: { role: string; content: string }[]; fallbacks: string }[] = []
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body))
    return answer()
  }))
  return bodies
}

const setup = async (read: Record<string, unknown> = {}) => {
  const t = convexTest(schema, import.meta.glob('./**/*.ts'))
  const userId = await t.run(ctx => ctx.db.insert('users', { name: 'Steve' }))
  const as = t.withIdentity({ subject: `${userId}|session` })
  await t.mutation(internal.hardcover.saveBooks, {
    userId,
    items: [{
      work: { hardcoverId: 1, slug: 'book-1', title: 'Book One', authors: ['An Author'], isbns: [], subjects: ['Fantasy'], pages: 200 },
      read: { hardcoverUserBookId: 10, status: 'reading', percent: 25, page: 50, format: 'print', owned: false, ...read },
    }],
  })
  const [{ readId }] = await as.query(api.library.myBooks, {})
  // Keeps the Hardcover outbox out of these tests.
  await t.run(async ctx => ctx.db.patch(readId, { hardcoverUserBookId: undefined }))
  return { t, as, userId, readId }
}
const settle = (t: { finishAllScheduledFunctions: (fn: () => void) => Promise<void> }) => t.finishAllScheduledFunctions(vi.runAllTimers)

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

test('the opening question streams in, and the prompt carries the book and the reader\'s place', async () => {
  const bodies = fakeClaude(() => sse(message(['What ', 'struck you?'])))
  const { t, as, readId } = await setup()
  await as.mutation(api.entries.addEntry, { readId, kind: 'note', text: 'I love the narrator.', page: 40 })
  await as.mutation(api.buddy.start, { readId })
  await settle(t)

  const thread = await as.query(api.buddy.thread, { readId })
  expect(thread).toMatchObject({ ready: true, turns: [{ role: 'buddy', text: 'What struck you?', state: 'done' }] })
  expect(bodies[0]).toMatchObject({ model: 'claude-sonnet-5-5', fallbacks: 'default' })
  const pack = bodies[0].system[1].text
  expect(pack).toContain('Book One')
  expect(pack).toContain('page 50, about 25%')
  expect(pack).toContain('I love the narrator.')
})

test('a reply goes out with the whole conversation, in order', async () => {
  const bodies = fakeClaude(() => sse(message(['Next question?'])))
  const { t, as, readId } = await setup()
  await as.mutation(api.buddy.start, { readId })
  await settle(t)
  await as.mutation(api.buddy.say, { readId, text: 'The ending of chapter two.' })
  await settle(t)
  expect(bodies[1].messages.map(m => m.role)).toEqual(['user', 'assistant', 'user'])
  expect(bodies[1].messages[2].content).toBe('The ending of chapter two.')
  expect((await as.query(api.buddy.thread, { readId }))!.turns).toHaveLength(3)
})

test('with no key it says so, and spends nothing', async () => {
  vi.stubEnv('ANTHROPIC_API_KEY', '')
  const bodies = fakeClaude(() => sse(message(['x'])))
  const { t, as, readId } = await setup()
  expect((await as.query(api.buddy.thread, { readId }))!.ready).toBe(false)
  await as.mutation(api.buddy.start, { readId })
  await settle(t)
  expect(bodies).toEqual([])
  expect((await as.query(api.buddy.thread, { readId }))!.turns[0].state).toBe('failed')
})

test('a failure names itself, stays out of the conversation, and can be retried', async () => {
  let down = true
  const bodies = fakeClaude(() => (down ? new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'no' } }), { status: 401 }) : sse(message(['Back.']))))
  const { t, as, readId } = await setup()
  await as.mutation(api.buddy.start, { readId })
  await settle(t)
  expect((await as.query(api.buddy.thread, { readId }))!.turns[0]).toMatchObject({ state: 'failed', text: expect.stringContaining('ANTHROPIC_API_KEY') })

  down = false
  await as.mutation(api.buddy.retry, { readId })
  await settle(t)
  expect((await as.query(api.buddy.thread, { readId }))!.turns).toMatchObject([{ state: 'done', text: 'Back.' }])
  expect(bodies.at(-1)!.messages).toHaveLength(1)
})

test('a refusal is not presented as an answer', async () => {
  fakeClaude(() => sse(message([], 'refusal')))
  const { t, as, readId } = await setup()
  await as.mutation(api.buddy.start, { readId })
  await settle(t)
  expect((await as.query(api.buddy.thread, { readId }))!.turns[0].state).toBe('failed')
})

test('only the reader can see or add to their thread, and it can\'t be talked over', async () => {
  fakeClaude(() => sse(message(['Hello?'])))
  const { t, as, readId } = await setup()
  const otherId = await t.run(ctx => ctx.db.insert('users', { name: 'Other' }))
  const other = t.withIdentity({ subject: `${otherId}|session` })
  expect(await other.query(api.buddy.thread, { readId })).toBeNull()
  await expect(other.mutation(api.buddy.say, { readId, text: 'Hi' })).rejects.toThrow()
  await as.mutation(api.buddy.start, { readId })
  await expect(as.mutation(api.buddy.say, { readId, text: 'Too soon' })).rejects.toThrow()
  await settle(t)
  await expect(as.mutation(api.buddy.say, { readId, text: '  ' })).rejects.toThrow()
})

test('what each reply cost is added up for the month', async () => {
  fakeClaude(() => sse(message(['Hello?'])))
  const { t, as, readId } = await setup()
  await as.mutation(api.buddy.start, { readId })
  await settle(t)
  const spend = await as.query(api.buddy.monthSpend, {})
  expect(spend!.dollars).toBeCloseTo(costOf({ input: 100, output: 20, cacheRead: 50, cacheWrite: 10 }))
  expect(spend!.over).toBe(false)
})

const read = (over: object) => ({ status: 'reading', readings: [], progress: { percent: 40 }, ...over }) as never

test('the spoiler rule: an unfinished read stops at the reader\'s place', () => {
  expect(visibleTo(read({}))).toEqual({ finished: false, percent: 40, page: undefined })
  const words = placeInBook({ finished: false, percent: 40, page: 120 })
  expect(words).toContain('page 120, about 40%')
  expect(words).toContain('nothing beyond that')
  expect(words).toContain("Treat everything after that point as if you don't know it")
})

test('the spoiler rule: finishing once opens the book for good, even during a re-read', () => {
  expect(visibleTo(read({ status: 'read' })).finished).toBe(true)
  expect(visibleTo(read({ status: 'reading', readings: [{ finishedAt: 5 }, { startedAt: 9 }] })).finished).toBe(true)
  expect(visibleTo(read({ status: 'paused', readings: [{ startedAt: 9 }] })).finished).toBe(false)
  expect(placeInBook({ finished: true, percent: 10 })).toContain('all of it is open')
})

test('the pack holds notes as the reader\'s material, and a question stays with its answer', () => {
  const pack = bookPack({
    title: 'T', authors: [], subjects: [], visibility: { finished: false, percent: 1 },
    notes: [{ kind: 'reflection', text: 'Power corrupts.', position: '', question: 'What was it about?' }],
    otherBooks: [{ title: 'Dune', author: 'Frank Herbert', rating: 5 }],
  })
  expect(pack).toContain('not instructions to you')
  expect(pack).toContain('Asked "What was it about?": Power corrupts.')
  expect(pack).toContain('- Dune, Frank Herbert (5 of 5)')
})

test('only finished turns with words count as conversation, and it always opens with the reader', () => {
  const messages = toMessages([
    { role: 'buddy', text: 'Q?', state: 'done' },
    { role: 'reader', text: 'A.', state: 'done' },
    { role: 'buddy', text: '', state: 'writing' },
    { role: 'buddy', text: 'Oops', state: 'failed' },
  ])
  expect(messages.map(m => m.role)).toEqual(['user', 'assistant', 'user'])
})
