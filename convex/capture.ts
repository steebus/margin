import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { action } from './_generated/server'
import { askGemini } from './lib/gemini'
import { parseTranscript, TRANSCRIBE_PROMPT, type Transcript } from './lib/transcript'

const MAX_IMAGE = 8_000_000

/** Reads a photographed page. The photo goes to Gemini and is never stored (SPEC 3.4). */
export const transcribe = action({
  args: { image: v.string() },
  handler: async (ctx, { image }): Promise<Transcript> => {
    if (!await getAuthUserId(ctx)) throw new ConvexError('Sign in to read a page')
    if (image.length > MAX_IMAGE) throw new ConvexError('That photo is too large')
    const reply = await askGemini([{ text: TRANSCRIBE_PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: image } }], 'Reading a page')
    const read = parseTranscript(reply)
    if (!read) throw new ConvexError("The page couldn't be read. Try again with the whole page in frame.")
    return read
  },
})
