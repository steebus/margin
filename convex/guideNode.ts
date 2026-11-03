'use node'

import Anthropic from '@anthropic-ai/sdk'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { DEPTHS, guidePrompt, parseGuide, type GuideUsage } from './lib/guide'

// Research can pause partway, for the server to keep searching. Enough rounds for that, and no more.
const MAX_ROUNDS = 4

/** Researches one book's guide. Costs real money, so it only runs when the reader asks for one, at the depth they chose. */
export const write = internalAction({
  args: { guideId: v.id('guides') },
  handler: async (ctx, { guideId }): Promise<void> => {
    const book = await ctx.runQuery(internal.guides.facts, { guideId })
    if (!book) return
    const usage: GuideUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, searches: 0 }
    const fail = async (error: string) => { await ctx.runMutation(internal.guides.save, { guideId, error, usage }) }
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return fail('ANTHROPIC_API_KEY is missing')

    try {
      const client = new Anthropic({ apiKey })
      const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: guidePrompt(book, book.depth) }]
      const settings = DEPTHS[book.depth]
      let reply = ''
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const message = await client.beta.messages.stream({
          model: settings.model,
          max_tokens: settings.maxTokens,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: settings.effort },
          tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: settings.searches }],
          messages,
        } as Parameters<typeof client.beta.messages.stream>[0]).finalMessage()

        usage.input += message.usage.input_tokens
        usage.output += message.usage.output_tokens
        usage.cacheRead += message.usage.cache_read_input_tokens ?? 0
        usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0
        usage.searches += (message.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0

        if (message.stop_reason === 'refusal') return fail('The research was declined')
        if (message.stop_reason === 'pause_turn') {
          // The whole turn goes back as it came, so the server carries on where it stopped.
          messages.push({ role: 'assistant', content: message.content })
          continue
        }
        reply = message.content.flatMap(block => (block.type === 'text' ? [block.text] : [])).join('')
        break
      }
      const guide = parseGuide(reply)
      if (!guide) return fail('The research came back without a usable guide')
      await ctx.runMutation(internal.guides.save, { guideId, guide, usage })
    } catch (e) {
      console.error('The guide failed:', e instanceof Error ? e.message : e)
      await fail(e instanceof Anthropic.APIError ? `Anthropic answered ${e.status}` : 'The research failed')
    }
  },
})
