import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError, v } from 'convex/values'
import { action } from './_generated/server'
import { askGemini, REFUSED_AS_RECITATION } from './lib/gemini'
import { parseTranscript, TRANSCRIBE_PROMPT, type Transcript } from './lib/transcript'

const MAX_IMAGE = 8_000_000

/** Reads a photographed page. The photo goes to Gemini and is never stored (SPEC 3.4). */
export const transcribe = action({
  args: { image: v.string() },
  handler: async (ctx, { image }): Promise<Transcript & { refused?: boolean }> => {
    if (!await getAuthUserId(ctx)) throw new ConvexError('Sign in to read a page')
    if (image.length > MAX_IMAGE) throw new ConvexError('That photo is too large')
    let reply: string
    try {
      reply = await askGemini([{ text: TRANSCRIBE_PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: image } }], 'Reading a page')
    } catch (e) {
      // Not a failure: the reader's device can read their own photo instead (src/lib/ocr.ts).
      if ((e as { data?: unknown })?.data === REFUSED_AS_RECITATION) return { paragraphs: [], page: null, chapter: null, refused: true }
      throw e
    }
    const read = parseTranscript(reply)
    if (!read) throw new ConvexError("The page couldn't be read. Try again with the whole page in frame.")
    return read
  },
})
