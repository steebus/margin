'use node'

import Anthropic from '@anthropic-ai/sdk'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { BUDDY_EFFORT, BUDDY_MODEL, PERSONA } from './lib/buddy'

// Often enough to read as typing, without a database write for every word.
const WRITE_EVERY_MS = 350

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

    try {
      const client = new Anthropic({ apiKey })
      const stream = client.beta.messages.stream({
        model: BUDDY_MODEL,
        max_tokens: 16000,
        // If a safety classifier declines, the API re-runs on a fallback model rather than leaving the reader with nothing.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: BUDDY_EFFORT },
        system: [
          { type: 'text', text: PERSONA },
          { type: 'text', text: facts.pack, cache_control: { type: 'ephemeral' } },
        ],
        messages: facts.messages,
      } as Parameters<typeof client.beta.messages.stream>[0])

      let text = ''
      let wrote = 0
      let writing: Promise<unknown> = Promise.resolve()
      stream.on('text', delta => {
        text += delta
        if (Date.now() - wrote < WRITE_EVERY_MS) return
        wrote = Date.now()
        const soFar = text
        writing = writing.then(() => ctx.runMutation(internal.buddy.writeSoFar, { turnId, text: soFar }))
      })
      const message = await stream.finalMessage()
      await writing

      if (message.stop_reason === 'refusal') return fail("Your buddy can't talk about that. Try asking another way.")
      if (!text.trim()) return fail('Your buddy had nothing to say. Try again.')
      const { input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens } = message.usage
      await ctx.runMutation(internal.buddy.finishTurn, {
        turnId,
        text,
        state: 'done',
        usage: { input: input_tokens, output: output_tokens, cacheRead: cache_read_input_tokens ?? 0, cacheWrite: cache_creation_input_tokens ?? 0 },
      })
    } catch (e) {
      console.error('The reply failed:', e instanceof Error ? e.message : e)
      await fail(whyItFailed(e))
    }
  },
})
