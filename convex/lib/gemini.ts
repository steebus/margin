import { ConvexError } from 'convex/values'
import { TEXT_MODEL } from './artPrompt'

type Part = { text: string } | { inline_data: { mime_type: string; data: string } }

/** The one failure worth naming: the balance has run out, and only the reader can top it up. */
export const failureText = (status: number, doing: string) =>
  status === 402 || status === 429
    ? `${doing} needs Gemini credit, and it has run out. Add some in Google AI Studio.`
    : `${doing} failed just now (${status}). Try again.`

/** Gemini's own filter declined to repeat text it recognises as published. */
export const REFUSED_AS_RECITATION = 'recitation'

/** Asks the small model for JSON, and returns the words of its reply. A fraction of a penny. */
export async function askGemini(parts: Part[], doing: string, temperature = 0) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new ConvexError(`${doing} is not set up: GEMINI_API_KEY is missing.`)
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature } }),
  })
  if (!res.ok) throw new ConvexError(failureText(res.status, doing))
  const json = await res.json()
  if (json.candidates?.[0]?.finishReason === 'RECITATION') throw new ConvexError(REFUSED_AS_RECITATION)
  return (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '') as string
}
