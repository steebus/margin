// Working out which books a shared post is talking about. Pure, so it can be tested without Instagram or Gemini.

const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"')
  .replace(/&#039;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')

/** The account and words on an Instagram embed page. Either can be missing: not every post serves them. */
export function instagramCaption(html: string): { account: string | null; caption: string | null } {
  const block = html.match(/<div class="Caption">([\s\S]*?)<div class="CaptionComments">/)?.[1]
  if (!block) return { account: null, caption: null }
  const account = block.match(/class="CaptionUsername"[^>]*>([^<]+)</)?.[1]?.trim() ?? null
  const words = decode(block.replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/, '').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, ''))
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { account, caption: words || null }
}

export const MAX_MENTIONS = 8

export const mentionsPrompt = (text: string) => `These words are from a social media post, or a screenshot of one. List the books they name.

Rules:
- Only books the post is actually talking about as books. Don't guess at books from a description, and don't add others by the same author.
- Leave out films, shows, people and pets, even if they share a name with a book.
- Copy the title as a book would print it, and the author if the words give one.
- confidence is from 0 to 1: how sure you are that this is a book's title.
- At most ${MAX_MENTIONS} books, most likely first.

The words:
"""
${text.slice(0, 6000)}
"""

Reply with JSON only: {"books": [{"title": "...", "author": "..." or null, "confidence": 0.9}]}`

export type Mention = { title: string; author: string | null; confidence: number }

export function parseMentions(reply: string): Mention[] {
  try {
    const { books } = JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] ?? '') as { books?: unknown }
    if (!Array.isArray(books)) return []
    return books.flatMap((b: { title?: unknown; author?: unknown; confidence?: unknown }) =>
      typeof b?.title === 'string' && b.title.trim()
        ? [{ title: b.title.trim(), author: typeof b.author === 'string' && b.author.trim() ? b.author.trim() : null, confidence: typeof b.confidence === 'number' ? b.confidence : 0.5 }]
        : []).slice(0, MAX_MENTIONS)
  } catch {
    return []
  }
}

const plain = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, '').replace(/^the /, '').trim()

/** Whether a search result is the book that was named, not just the nearest thing search could find. */
export function sameBook(named: string, found: string) {
  const a = plain(named)
  const b = plain(found)
  return !!a && !!b && (b === a || b.startsWith(`${a} `) || a.startsWith(`${b} `))
}

/** Typed titles, one per line, tidied of list marks and repeats. */
export function titlesFrom(text: string) {
  const lines = text.split('\n').map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean)
  return [...new Set(lines)].slice(0, MAX_MENTIONS)
}
