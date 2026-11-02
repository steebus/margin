// Reading a photographed page. The words and parsing are pure, so both can be tested without Gemini.
export const TRANSCRIBE_PROMPT = `This is a photo of a page of a printed book. Transcribe it exactly as printed.

Rules:
- Each paragraph is one string. Rejoin lines, and rejoin words hyphenated across a line break.
- Keep the author's spelling and punctuation. Don't correct or summarise anything.
- Leave out the page number and running headers and footers.
- If two pages show, transcribe the one that fills more of the photo.
- If this isn't a page of text, or it can't be read, return no paragraphs.

Reply with JSON only: {"paragraphs": ["..."], "page": 123 or null, "chapter": "the chapter, only if a running header or heading names one" or null}`

export type Transcript = { paragraphs: string[]; page: number | null; chapter: string | null }

/** What the model read, or null when the reply isn't usable. A page number that isn't a plain one is left out. */
export function parseTranscript(reply: string): Transcript | null {
  try {
    const json = JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] ?? '') as { paragraphs?: unknown; page?: unknown; chapter?: unknown }
    if (!Array.isArray(json.paragraphs)) return null
    const paragraphs = json.paragraphs.filter((p): p is string => typeof p === 'string').map(p => p.trim()).filter(Boolean)
    const page = typeof json.page === 'number' && Number.isInteger(json.page) && json.page > 0 ? json.page : null
    const chapter = typeof json.chapter === 'string' && json.chapter.trim() ? json.chapter.trim().slice(0, 120) : null
    return { paragraphs, page, chapter }
  } catch {
    return null
  }
}
