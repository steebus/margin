'use node'

import Anthropic from '@anthropic-ai/sdk'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalAction } from './_generated/server'
import { BUDDY_EFFORT, citedFrom, type Found, BUDDY_MODEL, foundText, PERSONA, SEARCH_TOOL, TOPIC_TOOL, topicText } from './lib/buddy'

// Often enough to read as typing, without a database write for every word.
const WRITE_EVERY_MS = 350
const GUIDE_POLL_MS = 15_000
// Up to two searches, then it answers with what it found.
const MAX_ROUNDS = 3

function whyItFailed(e: unknown) {
  if (e instanceof Anthropic.AuthenticationError) return "Your buddy can't sign in: check ANTHROPIC_API_KEY."
  if (e instanceof Anthropic.PermissionDeniedError) return "Your buddy's API key isn't allowed to do this."
  if (e instanceof Anthropic.RateLimitError) return 'Your buddy is being asked too much at once. Try again in a minute.'
  if (e instanceof Anthropic.BadRequestError && /credit/i.test(e.message)) return 'Your buddy needs Anthropic credit, and it has run out.'
  if (e instanceof Anthropic.APIConnectionError) return "Your buddy couldn't be reached. Try again."
  if (e instanceof Anthropic.APIError) return `Your buddy hit a problem (${e.status}). Try again.`
  return 'Something went wrong. Try again.'
}

/** Writes one reply, streaming it into the database so it appears as it's written. */
export const reply = internalAction({
  args: { turnId: v.id('buddyTurns') },
  handler: async (ctx, { turnId }): Promise<void> => {
    const fail = async (text: string): Promise<void> => {
      await ctx.runMutation(internal.buddy.finishTurn, { turnId, text, state: 'failed' })
    }
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return fail('Your buddy needs ANTHROPIC_API_KEY set in Convex.')
    const facts = await ctx.runQuery(internal.buddy.context, { turnId })
    if (!facts) return
    if (facts.waitForGuide) {
      // The first time a book is opened, its guide is still being researched. Wait for it rather than talk blind.
      await ctx.runMutation(internal.buddy.writeSoFar, { turnId, text: 'Reading up on this book first. This takes a minute or two, once.' })
      await ctx.scheduler.runAfter(GUIDE_POLL_MS, internal.buddyNode.reply, { turnId })
      return
    }

    try {
      const client = new Anthropic({ apiKey })
      const messages: Anthropic.Beta.BetaMessageParam[] = [...facts.messages]
      const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
      let text = ''
      const found: Found[] = []
      let wrote = 0
      let writing: Promise<unknown> = Promise.resolve()

      for (let round = 0; round < MAX_ROUNDS; round++) {
        const stream = client.beta.messages.stream({
          model: BUDDY_MODEL,
          max_tokens: 16000,
          // If a safety classifier declines, the API re-runs on a fallback model rather than leaving the reader with nothing.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: BUDDY_EFFORT },
          tools: [SEARCH_TOOL, TOPIC_TOOL],
          // The last round has to answer with what it has.
          ...(round === MAX_ROUNDS - 1 ? { tool_choice: { type: 'none' } } : {}),
          system: [
            { type: 'text', text: PERSONA },
            { type: 'text', text: facts.guide ? `${facts.pack}\n\n${facts.guide}` : facts.pack, cache_control: { type: 'ephemeral' } },
          ],
          messages,
        } as Parameters<typeof client.beta.messages.stream>[0])

        stream.on('text', delta => {
          text += delta
          if (Date.now() - wrote < WRITE_EVERY_MS) return
          wrote = Date.now()
          const soFar = text
          writing = writing.then(() => ctx.runMutation(internal.buddy.writeSoFar, { turnId, text: soFar }))
        })
        const message = await stream.finalMessage()
        usage.input += message.usage.input_tokens
        usage.output += message.usage.output_tokens
        usage.cacheRead += message.usage.cache_read_input_tokens ?? 0
        usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0

        if (message.stop_reason === 'refusal') { await writing; return fail("Your buddy can't talk about that. Try asking another way.") }
        if (message.stop_reason !== 'tool_use') break

        // It wants to look something up in the reader's notes or topics. That runs here, and the answer goes back.
        messages.push({ role: 'assistant', content: message.content })
        const search = async (query: string) => {
          const hits = await ctx.runQuery(internal.buddy.searchEntries, { turnId, query })
          found.push(...hits)
          return hits
        }
        const results = await Promise.all(message.content.flatMap(block => block.type === 'tool_use' ? [block] : []).map(async block => {
          const input = block.input as { query?: unknown; topic?: unknown }
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: block.name === TOPIC_TOOL.name
              ? topicText(await ctx.runQuery(internal.buddy.topicLinks, { turnId, topic: String(input.topic ?? '') }))
              : foundText(await search(String(input.query ?? ''))),
          }
        }))
        messages.push({ role: 'user', content: results })
        if (text.trim()) text += ' '
      }
      await writing

      if (!text.trim()) return fail('Your buddy had nothing to say. Try again.')
      await ctx.runMutation(internal.buddy.finishTurn, { turnId, text: text.trim(), state: 'done', usage, cited: citedFrom(text, found) as Id<'entries'>[] })
    } catch (e) {
      console.error('The reply failed:', e instanceof Error ? e.message : e)
      await fail(whyItFailed(e))
    }
  },
})
