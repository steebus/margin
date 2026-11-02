'use node'

import { v } from 'convex/values'
import sharp from 'sharp'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { frameArt } from './lib/artFrame'
import { IMAGE_MODEL, imagePrompt, parseSubject, subjectPrompt, TEXT_MODEL } from './lib/artPrompt'

const API = 'https://generativelanguage.googleapis.com/v1beta'

async function askForSubject(key: string, prompt: string) {
  const res = await fetch(`${API}/models/${TEXT_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.9 } }),
  })
  if (!res.ok) throw new Error(`Choosing a subject failed (${res.status})`)
  const json = await res.json()
  return parseSubject(json.candidates?.[0]?.content?.parts?.[0]?.text ?? '')
}

async function draw(key: string, prompt: string, reference: string) {
  const res = await fetch(`${API}/interactions`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      input: [{ type: 'text', text: prompt }, { type: 'image', mime_type: 'image/png', data: reference }],
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '1:1', image_size: '1K' },
    }),
  })
  if (!res.ok) throw new Error(`Drawing failed (${res.status})`)
  const json = await res.json()
  let data: string | undefined = json.output_image?.data
  for (const step of json.steps ?? []) for (const block of step.content ?? []) if (block.type === 'image' && block.data) data = block.data
  if (!data) throw new Error('Gemini declined to draw this one. Try a different direction.')
  return Buffer.from(data, 'base64')
}

/** Draws one book's picture now, at the standard price. The bulk run uses scripts/art-batch.mjs at half price. */
export const generate = internalAction({
  args: { workId: v.id('works'), hint: v.optional(v.string()) },
  handler: async (ctx, { workId, hint }) => {
    try {
      const key = process.env.GEMINI_API_KEY
      if (!key) throw new Error('Drawing is not set up: GEMINI_API_KEY is missing.')
      const book = await ctx.runQuery(internal.art.bookFacts, { workId })
      if (!book) throw new Error('That book no longer exists')

      const avoid = book.previous ? [book.previous, ...book.avoid] : book.avoid
      const scene = await askForSubject(key, subjectPrompt(book, { hint, avoid }))
      const prompt = imagePrompt(scene)
      const reference = await fetch(`${process.env.SITE_URL}/art/style-reference.png`)
      if (!reference.ok) throw new Error('The style reference is missing')
      const image = await draw(key, prompt, Buffer.from(await reference.arrayBuffer()).toString('base64'))
      const { small, large } = await frameArt(sharp, image)

      const upload = async (file: Buffer) => {
        const url: string = await ctx.runMutation(internal.art.uploadUrl, {})
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: new Uint8Array(file) })
        if (!res.ok) throw new Error('Storing the drawing failed')
        return (await res.json()).storageId
      }
      await ctx.runMutation(internal.art.saveArt, { workId, small: await upload(small), large: await upload(large), model: IMAGE_MODEL, scene, prompt })
    } catch (e) {
      await ctx.runMutation(internal.art.artFailed, { workId, error: e instanceof Error ? e.message : 'The drawing failed' })
    }
  },
})
