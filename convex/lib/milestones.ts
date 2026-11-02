// Milestones (SPEC 3.3): the places in a book where the buddy leaves a note. Pure, so it can be tested.
import type { Guide } from './guide'

export type Milestone = { key: string; percent: number; text: string }

// Without a guide it can trust, the buddy marks the same checkpoints in every book. They say nothing about the plot.
const CHECKPOINTS: Milestone[] = [
  { key: 'g:10', percent: 10, text: "You're properly into it now. What has caught your attention so far?" },
  { key: 'g:25', percent: 25, text: 'A quarter of the way through. Is this the book you expected it to be?' },
  { key: 'g:50', percent: 50, text: 'Halfway. If you had to say what this book is about, so far, what would you say?' },
  { key: 'g:75', percent: 75, text: 'Three quarters in. What are you hoping the rest of it does?' },
  { key: 'g:90', percent: 90, text: 'Nearly there. Has anything changed in how you read it since the start?' },
]

// ponytail: greedy thinning of the question bank, so a reader logging small steps isn't asked at every one.
const MIN_GAP = 8

/** The guide's questions where it knows the book, spaced out, or the plain checkpoints where it doesn't. */
export function milestonesFor(guide: Guide | null): Milestone[] {
  if (!guide || guide.knownness === 'barely') return CHECKPOINTS
  const out: Milestone[] = []
  guide.questions
    .map((q, i) => ({ key: `q:${i}`, percent: q.percent, text: q.text }))
    .filter(m => m.percent > 0 && m.percent < 100)
    .sort((a, b) => a.percent - b.percent)
    .forEach(m => { if (!out.length || m.percent - out.at(-1)!.percent >= MIN_GAP) out.push(m) })
  return out.length ? out : CHECKPOINTS
}

/**
 * The milestone a move from one place to another crosses: the furthest one, so a jump of half the book leaves one
 * note, not five. Finishing has its own question (the reflection), so a move to the end leaves none.
 */
export function crossed(milestones: Milestone[], from: number, to: number): Milestone | null {
  if (to >= 100 || to <= from) return null
  return milestones.filter(m => m.percent > from && m.percent <= to).at(-1) ?? null
}
