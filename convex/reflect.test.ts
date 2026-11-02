// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import { fallbackQuestion, parseQuestion } from './lib/reflection'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')
const setup = () => convexTest(schema, modules)
type T = ReturnType<typeof setup>

const QUESTION = 'What did the desert change about how you think of power, given your note on prophecy?'

const reader = async (t: T) => {
  const userId = await t.run(ctx => ctx.db.insert('users', { name: 'Steve' }))
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) }
}
const item = (status: 'reading' | 'read', hardcoverUserBookId?: number) => ({
  work: { hardcoverId: 1, slug: 'book-1', title: 'Book 1', authors: ['An Author'], isbns: [], subjects: [], pages: 200 },
  read: { hardcoverUserBookId: hardcoverUserBookId ?? 10, status, percent: status === 'read' ? 100 : 10, format: 'print' as const, owned: false },
})

// Only Gemini is expected: nothing reaches Hardcover, because the books in these tests have no outbox work to do.
const stubGemini = (reply: Response | Error) => {
  const fn = vi.fn(async () => {
    if (reply instanceof Error) throw reply
    return reply.clone()
  })
  vi.stubGlobal('fetch', fn)
  return fn
}
const answerWith = (question: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ question }) }] } }] }))

const prompts = (t: T) => t.run(ctx => ctx.db.query('reflectionPrompts').collect())
const settle = async (t: T) => { await t.finishAllScheduledFunctions(vi.runAllTimers) }

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  vi.stubEnv('HARDCOVER_API_KEY', 'test-key')
  vi.stubEnv('HARDCOVER_PACE_MS', '0')
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

test('an import is history, so it asks nothing', async () => {
  const t = setup()
  const { userId } = await reader(t)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item('read')] })
  expect(await prompts(t)).toHaveLength(0)
})

test('a book finished on Hardcover gets a question, once', async () => {
  const t = setup()
  stubGemini(answerWith(QUESTION))
  const { userId, as } = await reader(t)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item('reading')] })
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item('read')], update: true })
  await settle(t)
  expect((await as.query(api.reflect.waiting, {})).map(p => p.question)).toEqual([QUESTION])

  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item('reading')], update: true })
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item('read')], update: true })
  await settle(t)
  expect(await prompts(t)).toHaveLength(1)
})

test('a book finished in Margin gets one too, and the answer keeps its question', async () => {
  const t = setup()
  stubGemini(answerWith(QUESTION))
  const { userId, as } = await reader(t)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item('reading')] })
  await t.run(async ctx => {
    const read = (await ctx.db.query('reads').first())!
    await ctx.db.patch(read._id, { hardcoverUserBookId: undefined })
  })
  const [{ readId }] = await as.query(api.library.myBooks, {})
  await as.mutation(api.library.setStatus, { readId, status: 'read' })
  await settle(t)

  const found = await as.query(api.library.bookBySlug, { slug: 'book-1' })
  expect(found!.prompt!.question).toBe(QUESTION)
  await expect(as.mutation(api.reflect.answer, { promptId: found!.prompt!.id, text: '   ' })).rejects.toThrow()
  await as.mutation(api.reflect.answer, { promptId: found!.prompt!.id, text: 'That prophecy is a trap.' })

  const after = await as.query(api.library.bookBySlug, { slug: 'book-1' })
  expect(after!.prompt).toBeNull()
  expect(after!.entries[0]).toMatchObject({ kind: 'reflection', text: 'That prophecy is a trap.', question: QUESTION })
  expect(await as.query(api.reflect.waiting, {})).toEqual([])
})

test('if the model fails, the book still gets a plain question', async () => {
  const t = setup()
  stubGemini(new Response('nope', { status: 500 }))
  const { userId, as } = await reader(t)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item('reading')] })
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item('read')], update: true })
  await settle(t)
  expect((await as.query(api.reflect.waiting, {}))[0].question).toBe(fallbackQuestion('Book 1'))
})

test('a question can be passed on, and only by the reader it was asked of', async () => {
  const t = setup()
  stubGemini(answerWith(QUESTION))
  const { userId, as } = await reader(t)
  const other = await reader(t)
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item('reading')] })
  await t.mutation(internal.hardcover.saveBooks, { userId, items: [item('read')], update: true })
  await settle(t)
  const [{ id }] = await as.query(api.reflect.waiting, {})
  await expect(other.as.mutation(api.reflect.skip, { promptId: id })).rejects.toThrow()
  await as.mutation(api.reflect.skip, { promptId: id })
  expect(await as.query(api.reflect.waiting, {})).toEqual([])
})

test('a reply with no usable question is no question', () => {
  expect(parseQuestion('{"question": "Why did the ending land the way it did?"}')).toBe('Why did the ending land the way it did?')
  expect(parseQuestion('sorry')).toBeNull()
  expect(parseQuestion('{"question": ""}')).toBeNull()
})
