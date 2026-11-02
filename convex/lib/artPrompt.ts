// The words behind every drawing, shared by the bulk script and regeneration.
export const IMAGE_MODEL = 'gemini-3.1-flash-lite-image'
export const TEXT_MODEL = 'gemini-3.1-flash-lite'
export const MAX_HINT = 200

type BookFacts = { title: string; authors: string[]; year?: number; subjects: string[] }

/**
 * Asks a small text model what to draw. The image model is never left to choose, because in testing it drew a
 * later event for a book still being read. A book's art must not spoil it (SPEC 3.11).
 */
export function subjectPrompt(book: BookFacts, options: { hint?: string; avoid?: string[] } = {}) {
  const avoid = options.avoid?.length ? `\nThese subjects are already used in this library, so pick something visibly different:\n- ${options.avoid.join('\n- ')}\n` : ''
  const hint = options.hint ? `\nThe reader asked for this direction, so follow it, within the rules above: "${options.hint}"\n` : ''
  return `Choose what to draw for a small engraved illustration in a reader's book catalog.

Book: "${book.title}" by ${book.authors.join(', ') || 'an unknown author'}${book.year ? ` (${book.year})` : ''}
Genres: ${book.subjects.join(', ') || 'unknown'}

Pick ONE concrete thing that is recognisably this book's world: an object, creature, plant, building or small place. Prefer one bold thing with a strong silhouette over a busy scene. Be specific and a little unexpected, not the first cliche for the genre.

Rules:
- Only use what a reader knows from the book's premise or its opening pages. Never a later event, twist, death, reveal or ending.
- People only as a distant or faceless figure. Never a real person's likeness, including the author.
- Don't describe any published book cover. Nothing that relies on words, letters or numbers.
- If you don't really know this book, draw from its title and genres instead of inventing plot.
${avoid}${hint}
Reply with JSON only: {"subject": "one short sentence describing the picture, with no reference to the book's title or characters' names"}`
}

/** The subject out of the text model's reply. Throws rather than drawing from something unusable. */
export function parseSubject(reply: string): string {
  const match = reply.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('The subject reply had no JSON in it')
  const subject = (JSON.parse(match[0]) as { subject?: unknown }).subject
  if (typeof subject !== 'string' || subject.trim().length < 5) throw new Error('The subject reply had no usable subject')
  return subject.trim().slice(0, 300)
}

export function imagePrompt(subject: string) {
  return `Draw one small ink illustration for a printed book catalog.

Subject: ${subject}

It must be instantly recognisable at the size of a postage stamp: one bold, simple shape with a strong silhouette, and few details.

Composition: the top quarter of the square is completely empty bare white paper, because a title gets printed there. The subject is large: it fills the lower three-quarters, nearly the full width of the square, and is grounded at the bottom edge. Ground, water or grass may run off the bottom and sides of the picture. There is no frame, border, box, rectangle, corner mark or panel of any kind, and no straight line around the picture. The drawing's edges thin out into a few loose hatch strokes and then bare paper, so you can't see where the picture ends. There is no sky drawn at all, only bare paper. There is nothing behind the subject.

Style: match the attached reference sheet exactly, in technique and composition but not subject. Pure black ink on pure white paper, like a fine old steel engraving in a Victorian book, not a linocut. Rich solid black shadows, with form modelled by many fine curved engraved lines. Mid-tones only from visible black hatch lines. Absolutely no grey wash, no shading gradient, and no fine overall texture. Lots of bare white paper.

No text, letters, numbers, titles or signatures. No colour.`
}
