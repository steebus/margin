// A book's guide (SPEC 3.3), and the spoiler rule that cuts it at the reader's place. Pure, so both can be tested.
import { z } from 'zod'
import type { Visibility } from './buddy'

// Research is the spec's job for the most capable model. One guide per work, made once and kept.
export const GUIDE_MODEL = 'claude-opus-5-5'
export const GUIDE_VERSION = 1
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5, search: 0.01 }

export type GuideUsage = { input: number; output: number; cacheRead: number; cacheWrite: number; searches: number }
export const guideCost = (u: GuideUsage) =>
  (u.input * PRICE.input + u.output * PRICE.output + u.cacheRead * PRICE.cacheRead + u.cacheWrite * PRICE.cacheWrite) / 1_000_000 + u.searches * PRICE.search

const percent = z.number().min(0).max(100)
const confidence = z.enum(['high', 'medium', 'low']).catch('low')
const text = (max: number) => z.string().trim().min(1).transform(s => s.slice(0, max))
const list = <T extends z.ZodType>(item: T, max: number) =>
  z.array(z.unknown()).catch([]).transform(items => items.flatMap(i => {
    const ok = item.safeParse(i)
    return ok.success ? [ok.data as z.infer<T>] : []
  }).slice(0, max))

export const guideSchema = z.object({
  knownness: z.enum(['well', 'partly', 'barely']).catch('barely'),
  structure: list(z.object({ label: text(120), percent }), 80),
  themes: list(z.object({ name: text(80), gloss: text(400), readings: list(text(200), 4), from: percent.catch(0), confidence }), 12),
  moments: list(z.object({ percent, what: text(300), spoiler: z.enum(['minor', 'major']).catch('major'), confidence }), 60),
  questions: list(z.object({
    percent,
    register: z.enum(['noticing', 'craft', 'personal', 'predictive', 'connective']).catch('noticing'),
    text: text(300),
  }), 60),
  sources: list(z.string().url(), 20),
})
export type Guide = z.infer<typeof guideSchema>

type Facts = { title: string; authors: string[]; year?: number; pages?: number; isbn?: string }

export const guidePrompt = (book: Facts) => `You're preparing a reading guide for "${book.title}" by ${book.authors.join(', ') || 'an unknown author'}${book.year ? ` (${book.year})` : ''}${book.pages ? `, ${book.pages} pages` : ''}${book.isbn ? `, ISBN ${book.isbn}` : ''}.

A reading companion will use it to talk with someone partway through the book, and will only ever be shown the parts before their place in it. So every item needs an honest position, as a percent of the way through the text.

Research first. Search the web for interviews with the author, criticism and reviews, reading-group guides and chapter summaries, until you know the book's structure and its main turns well, or have found that little is written about it.

Then write the guide:
- structure: the parts and chapters in order, each with the percent where it starts.
- themes: what the book is about, each with a short gloss, the readings it's commonly given, and "from": the percent by which a reader has met it. A theme that only emerges late must say so.
- moments: the key events and turns, each with its percent, what happens, and how much it would spoil a reader who hasn't reached it ("minor" or "major").
- questions: good questions to ask a reader at given points, in five registers: noticing (what struck you), craft (why tell it this way), personal (does it touch your life), predictive (what do you think happens), connective (what does it echo). A question at a percent may only rely on what comes before it. A predictive question must not hint at the answer.
- knownness: "well" if you and your sources know the book in detail, "partly", or "barely".
- sources: the addresses you relied on.

Be honest above all. Never invent events, characters or quotations. If you can't place something, leave it out. If little is known, say "barely" and keep moments to what you're sure of: an empty list is better than a guess.

End your reply with the guide as one JSON object in a \`\`\`json block, shaped like this:
{"knownness": "well", "structure": [{"label": "Part One", "percent": 0}], "themes": [{"name": "...", "gloss": "...", "readings": ["..."], "from": 0, "confidence": "high"}], "moments": [{"percent": 12, "what": "...", "spoiler": "minor", "confidence": "medium"}], "questions": [{"percent": 10, "register": "noticing", "text": "..."}], "sources": ["https://..."]}`

/** The guide out of the model's reply: the last JSON block. Null if there isn't a usable one. */
export function parseGuide(reply: string): Guide | null {
  const blocks = [...reply.matchAll(/```json\s*([\s\S]*?)```/g)].map(m => m[1])
  const raw = blocks.at(-1) ?? reply.match(/\{[\s\S]*\}/)?.[0]
  if (!raw) return null
  try {
    const parsed = guideSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * The spoiler rule, applied to the data. Before the model sees anything, the guide is cut at the reader's place:
 * nothing positioned after it survives. A finished book is open in full.
 */
export function guideUpTo(guide: Guide, { finished, percent: at }: Visibility): Guide {
  if (finished) return guide
  return {
    ...guide,
    structure: guide.structure.filter(s => s.percent <= at),
    themes: guide.themes.filter(t => t.from <= at),
    moments: guide.moments.filter(m => m.percent <= at),
    questions: guide.questions.filter(q => q.percent <= at),
  }
}

/** The cut guide in words, for the buddy's prompt. */
export function guideText(guide: Guide, finished: boolean) {
  const lines = [
    finished
      ? "A guide to this book, researched in advance. The reader has finished it, so all of it is open."
      : "A guide to this book, researched in advance and already cut at the reader's place: nothing after it is here, and you must not add anything from beyond it yourself.",
    `How well this book is known: ${guide.knownness}.${guide.knownness === 'barely' ? ' Lean on the reader rather than the guide.' : ''}`,
  ]
  if (guide.structure.length) lines.push(`Structure so far: ${guide.structure.map(s => `${s.label} (${s.percent}%)`).join('; ')}`)
  if (guide.themes.length) lines.push(`Themes:\n${guide.themes.map(t => `- ${t.name}: ${t.gloss}${t.readings.length ? ` Commonly read as: ${t.readings.join('; ')}.` : ''} (${t.confidence} confidence)`).join('\n')}`)
  if (guide.moments.length) lines.push(`What has happened:\n${guide.moments.map(m => `- ${m.percent}%: ${m.what} (${m.confidence} confidence)`).join('\n')}`)
  if (guide.questions.length) lines.push(`Questions you could ask, by register:\n${guide.questions.map(q => `- [${q.register}, ${q.percent}%] ${q.text}`).join('\n')}`)
  return lines.join('\n\n')
}
