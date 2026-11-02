// Demonstration data only. Phase 1 replaces it with the real library.
// Cover ids come from Open Library; the entries and the buddy's words are written for this demo.
import library from './library.json'

export type Status = 'reading' | 'tbr' | 'read' | 'paused' | 'dnf'

const ratings: Record<string, number> = {
  Beloved: 4.5, 'Moby-Dick': 4, 'Mrs Dalloway': 5, 'The Dispossessed': 4.5, 'Pale Fire': 4, 'The Waves': 3.5,
  Kindred: 5, Gilead: 4.5, Stoner: 5, 'Wide Sargasso Sea': 4, Housekeeping: 4.5, Possession: 4, 'Bleak House': 3.5,
  'Jane Eyre': 4, 'To the Lighthouse': 5, 'Invisible Man': 4.5, Sula: 4,
}
const tags: Record<string, string[]> = {
  Beloved: ['Memory', 'Recommended by Sam'],
  'The Left Hand of Darkness': ['Winter', 'Recommended by Sam'],
}

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ponytail: real Gemini scenes from the second art test, stored by hand until the pipeline exists (SPEC 3.11).
// The other books show their fallback. Delete public/art-demo and this list with Phase 1.
const demoArt = new Set([
  'The Left Hand of Darkness', 'Middlemarch', 'Beloved', 'Moby-Dick', 'Mrs Dalloway',
  'House of Leaves', 'Stoner', 'Kindred', 'Gilead', 'To the Lighthouse',
])

export const books = library.map((b, i) => {
  const slug = slugify(`${b.title} ${b.author.split(' ').at(-1)}`)
  return {
    ...b,
    status: b.status as Status,
    code: `A-${i + 1}`,
    slug,
    rating: ratings[b.title] ?? null,
    tags: tags[b.title] ?? [],
    art: demoArt.has(b.title) ? { small: `/art-demo/${slug}-256.webp`, large: `/art-demo/${slug}-512.webp` } : null,
  }
})
export type Book = (typeof books)[number]

const byTitle = (title: string) => books.find(b => b.title === title)!

export const current = [
  {
    book: byTitle('The Left Hand of Darkness'),
    percent: 34,
    format: 'print' as const,
    prompt:
      'Genly calls every Gethenian "he", then complains that he can\'t read them. What is that pronoun doing to how you see Estraven so far?',
  },
  {
    book: byTitle('Middlemarch'),
    percent: 61,
    format: 'audiobook' as const,
    prompt: 'Lydgate keeps telling himself his marriage is his own business. Has the town let him have one private thing so far?',
  },
]
export type Current = (typeof current)[number]

export const latestEntry = {
  text: 'The cold is doing as much work as any of the characters. Reread the arrival scene.',
  where: 'The Left Hand of Darkness, page 98',
}

export type Entry = { position: string; quote?: string; note: string; summary?: boolean }

export const margins: Record<string, Entry[]> = {
  [byTitle('The Left Hand of Darkness').slug]: [
    { position: 'Page 1', quote: "I'll make my report as if I told a story", note: 'Already telling me how to read him.' },
    { position: 'Page 98', note: 'The cold is doing as much work as any of the characters.' },
    { position: 'Chapter 3', note: "Estraven falls and Genly can't tell why. Nor can I.", summary: true },
  ],
}

export const cards = [
  { added: '3 Sep', event: 'Added' },
  { added: '12 Oct', event: 'Started' },
  { added: '28 Oct', event: '34%' },
]

export type Turn = { who: 'buddy' | 'reader'; text: string; cites?: { note: string; where: string } }

export const threads: Record<string, Turn[]> = {
  [byTitle('The Left Hand of Darkness').slug]: [
    { who: 'buddy', text: current[0].prompt },
    { who: 'reader', text: "It makes Estraven read like a man who's hiding something. Maybe that's Genly, not Estraven." },
    {
      who: 'buddy',
      text: "Some readers take that as the book's point. You noted the cold on page 98. Is the cold doing the same thing to Genly?",
      cites: { note: 'The cold is doing as much work as any of the characters.', where: 'Your note, page 98' },
    },
  ],
}

export type DrawerEntry = { kind: 'excerpt' | 'note'; text: string; note?: string; where: string; book: string }

// Finished books only, so nothing here is past the reader's position in a current read.
export const drawer: DrawerEntry[] = [
  {
    kind: 'excerpt',
    text: 'Mrs. Dalloway said she would buy the flowers herself.',
    note: 'One errand and I already know who she is. How?',
    where: 'Mrs Dalloway, page 1',
    book: 'Mrs Dalloway',
  },
  {
    kind: 'note',
    text: 'Dorothea keeps choosing duty and calling it desire. I did this at her age too.',
    where: 'Middlemarch, this read',
    book: 'Middlemarch',
  },
  {
    kind: 'excerpt',
    text: 'Call me Ishmael.',
    note: 'Three words, and he vanishes for whole chapters after. I stopped minding. Why?',
    where: 'Moby-Dick, page 1',
    book: 'Moby-Dick',
  },
  {
    kind: 'note',
    text: 'Reread the last page twice. The quiet is the point.',
    where: 'Stoner, 2025',
    book: 'Stoner',
  },
]

export const slugFor = (title: string) => byTitle(title).slug
