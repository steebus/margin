// A made-up library for fixture mode (docs/IMPROVEMENT-LOOP.md E1). None of it is Steve's: the titles, authors and
// notes are invented, and chosen to stretch the screens (a very long title, a book with no author, one with no
// length, an audiobook, a re-read, half stars, a 1,500-character excerpt). Dates hang off `now`, so the Desk's
// two-week window always has something in it.
import type { Id } from '../convex/_generated/dataModel'
import type { MutationCtx } from '../convex/_generated/server'
import { entryKey } from '../convex/lib/entryKey'
import { guideSchema } from '../convex/lib/guide'
import { slugFor } from '../convex/lib/hardcover'

const DAY = 86_400_000

/** The same "random" library every time, so two runs' screenshots can be compared. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// A drawing stands in for generated art: black ink on white at 2:3, so the day and night blend modes can be seen.
const drawing = (n: number) => {
  const r = seeded(n)
  const strokes = Array.from({ length: 46 }, () => {
    const x = 20 + r() * 160
    const y = 150 + r() * 130
    return `M${x.toFixed(0)} ${y.toFixed(0)}l${(r() * 30 - 15).toFixed(0)} ${(r() * 34 - 6).toFixed(0)}`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#fff"/>`
    + `<circle cx="${60 + n % 5 * 20}" cy="${190 + n % 3 * 12}" r="${34 + n % 4 * 6}" fill="#000"/>`
    + `<path d="${strokes}" stroke="#000" stroke-width="2" fill="none"/><path d="M0 285h200" stroke="#000" stroke-width="6"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

type Status = 'tbr' | 'reading' | 'paused' | 'read' | 'dnf'
type Made = {
  title: string
  authors: string[]
  status: Status
  format?: 'print' | 'ebook' | 'audio'
  pages?: number
  audioHours?: number
  percent?: number
  rating?: number
  genres?: string[]
  tags?: string[]
  who?: string
}

const BOOKS: Made[] = [
  // In hand.
  { title: 'The Salt Road Home', authors: ['Imre Valdane'], status: 'reading', pages: 412, percent: 38, genres: ['Fantasy', 'Adventure'], tags: ['found family', 'grief'] },
  { title: 'A Field Guide to Getting Lost in Small Towns, With Notes on Returning: Essays', authors: ['Odalys Brennick'], status: 'reading', format: 'ebook', pages: 288, percent: 71, genres: ['Nonfiction', 'Essays'], tags: ['place', 'memory'] },
  { title: 'Tidewater', authors: ['Kesi Amadou-Leigh', 'Ruth Calloway'], status: 'reading', format: 'audio', audioHours: 11.5, percent: 12, genres: ['Literary Fiction'], tags: ['grief', 'the sea'] },
  { title: 'Lanterns for the Drowned', authors: ['Tomasz Wierzba'], status: 'reading', pages: 1184, percent: 4, genres: ['Fantasy', 'Epic'], tags: ['war', 'found family'] },
  { title: 'The Quiet Machine', authors: ['Halden Roux'], status: 'paused', pages: 336, percent: 44, genres: ['Science Fiction'], tags: ['artificial intelligence'] },
  { title: 'Bread and Ashes', authors: ['Miren Etxarri'], status: 'paused', format: 'ebook', pages: 240, percent: 18, genres: ['Historical Fiction'], tags: ['war', 'memory'] },
  // Stopped.
  { title: 'Ninety Rules for a Calmer Mind', authors: ['Dr. P. L. Hartsong'], status: 'dnf', pages: 220, percent: 22, genres: ['Self Help'] },
  { title: 'The Cartographer of Nowhere', authors: ['Selim Aydar'], status: 'dnf', format: 'audio', audioHours: 19, percent: 9, genres: ['Fantasy'] },
  // Waiting. The first five were added inside the Desk's two weeks.
  { title: 'Ember', authors: ['Noor Haddad'], status: 'tbr', pages: 198, genres: ['Poetry'], tags: ['grief'], who: 'Marguerite' },
  { title: 'What the Orchard Remembers', authors: ['Anselm Okoro'], status: 'tbr', pages: 352, genres: ['Literary Fiction'], tags: ['memory', 'place'], who: '@slowpages' },
  { title: 'Signal & Noise & Everything After', authors: ['Juno Park'], status: 'tbr', pages: 304, genres: ['Science Fiction'], tags: ['first contact'], who: '@slowpages' },
  { title: 'The Unfinished Cathedral', authors: ['Bartolomeu Sá'], status: 'tbr', pages: 640, genres: ['Historical Fiction'], tags: ['faith', 'place'] },
  { title: 'Hollow Kings', authors: ['R. A. Thornbury'], status: 'tbr', format: 'audio', audioHours: 23.25, genres: ['Fantasy', 'Epic'], tags: ['war'] },
  { title: 'A Short History of Rivers', authors: ['Ilse Vandermeer'], status: 'tbr', pages: 272, genres: ['Nonfiction', 'History'], tags: ['place', 'the sea'] },
  { title: 'Pamphlet', authors: [], status: 'tbr', genres: [] },
  { title: 'Żółć: opowiadania', authors: ['Zofia Księżyc'], status: 'tbr', pages: 176, genres: ['Short Stories'], tags: ['translation'] },
  { title: 'The Long Way Round the Sun', authors: ['Dev Rasgotra'], status: 'tbr', pages: 480, genres: ['Science Fiction'], tags: ['found family', 'first contact'], who: 'Marguerite' },
  { title: 'Small Mercies, Large Debts', authors: ['Calla Whitlow'], status: 'tbr', pages: 320, genres: ['Mystery', 'Thriller'] },
  { title: 'How Glass Is Made', authors: ['Petra Lindqvist'], status: 'tbr', pages: 144, genres: ['Nonfiction'], tags: ['craft'] },
  { title: 'Nightjar', authors: ['Oisín Brady'], status: 'tbr', pages: 256, genres: ['Horror'], tags: ['place'] },
  { title: 'The Weight of Feathers and Other Lies', authors: ['Amara Diallo'], status: 'tbr', format: 'ebook', pages: 368, genres: ['Romance', 'Fantasy'] },
  { title: 'Letters to a Lighthouse Keeper', authors: ['Greta Solheim'], status: 'tbr', pages: 208, genres: ['Literary Fiction'], tags: ['the sea', 'epistolary'] },
  // Finished, newest first. The first two were finished inside the Desk's two weeks.
  { title: 'The Glass Orchard', authors: ['Anselm Okoro'], status: 'read', pages: 304, rating: 4.5, genres: ['Literary Fiction'], tags: ['memory', 'grief'] },
  { title: 'Crown of Thistles', authors: ['R. A. Thornbury'], status: 'read', format: 'audio', audioHours: 17, rating: 4, genres: ['Fantasy', 'Epic'], tags: ['war', 'found family'] },
  { title: 'Understory', authors: ['Ilse Vandermeer'], status: 'read', pages: 256, rating: 5, genres: ['Nonfiction', 'Nature'], tags: ['place', 'craft'] },
  { title: 'The Last Honest Thief', authors: ['Calla Whitlow'], status: 'read', pages: 384, rating: 3, genres: ['Mystery'] },
  { title: 'Parallax', authors: ['Juno Park'], status: 'read', format: 'ebook', pages: 296, rating: 4, genres: ['Science Fiction'], tags: ['first contact', 'artificial intelligence'] },
  { title: 'Seven Winters', authors: ['Miren Etxarri'], status: 'read', pages: 448, rating: 5, genres: ['Historical Fiction'], tags: ['war', 'memory', 'grief'] },
  { title: 'The Beekeeper of Almsford', authors: ['Greta Solheim'], status: 'read', pages: 224, rating: 3.5, genres: ['Literary Fiction'], tags: ['place'] },
  { title: 'Iron in the Blood', authors: ['Tomasz Wierzba'], status: 'read', pages: 912, rating: 4.5, genres: ['Fantasy', 'Epic'], tags: ['war'] },
  { title: 'On Not Finishing Things', authors: ['Odalys Brennick'], status: 'read', pages: 160, rating: 4, genres: ['Nonfiction', 'Essays'], tags: ['craft', 'memory'] },
  { title: 'Moth', authors: ['Noor Haddad'], status: 'read', pages: 96, genres: ['Poetry'], tags: ['grief'] },
  { title: 'A House with No Doors', authors: ['Oisín Brady'], status: 'read', format: 'audio', audioHours: 8.75, rating: 2, genres: ['Horror'] },
  { title: 'The Arithmetic of Stars', authors: ['Dev Rasgotra'], status: 'read', pages: 512, rating: 4, genres: ['Science Fiction'], tags: ['found family'] },
  { title: 'Salt', authors: ['Kesi Amadou-Leigh'], status: 'read', pages: 208, rating: 5, genres: ['Literary Fiction'], tags: ['the sea', 'grief'] },
  { title: 'The Clockmaker’s Apprentice and the City That Forgot the Hour', authors: ['Selim Aydar'], status: 'read', pages: 432, rating: 3.5, genres: ['Fantasy', 'Young Adult'] },
  { title: 'Field Notes from the Interior', authors: ['Bartolomeu Sá'], status: 'read', pages: 280, rating: 4, genres: ['Travel', 'Nonfiction'], tags: ['place'] },
  { title: 'Thaw', authors: ['Petra Lindqvist'], status: 'read', format: 'ebook', pages: 190, rating: 0.5, genres: ['Thriller'] },
  { title: 'The Second Life of Ada Voss', authors: ['Amara Diallo'], status: 'read', pages: 344, rating: 4.5, genres: ['Romance', 'Historical Fiction'], tags: ['memory'] },
  { title: 'Wolves of the Low Country', authors: ['Imre Valdane'], status: 'read', pages: 398, rating: 4, genres: ['Fantasy', 'Adventure'], tags: ['found family', 'war'] },
  { title: 'An Inventory of Small Losses', authors: ['Halden Roux'], status: 'read', pages: 176, rating: 3, genres: ['Short Stories', 'Science Fiction'], tags: ['artificial intelligence', 'grief'] },
  { title: 'Harbour Lights', authors: ['Ruth Calloway'], status: 'read', pages: 264, genres: ['Literary Fiction'], tags: ['the sea'] },
]

const EXCERPTS = [
  'She had learned to read the weather in other people’s faces long before she could read a map.',
  'Nobody tells you that a homecoming is mostly arithmetic: what is still here, what is not, and what you owe for the difference.',
  'The road did not end so much as lose interest.',
  'Grief, he said, is only love with nowhere left to go, and then he laughed at himself for saying something so tidy.',
  'We kept the lamp lit not because anyone was coming but because the dark had started to feel like agreement.',
  'A town is a kind of sentence, and everyone who stays is a word that refuses to be struck out.',
  'It is a strange thing to be the last person who remembers how a room smelled.',
  'The machine was not cruel. That was the difficulty: there was nobody there to forgive.',
]
const NOTES = [
  'This is the third time water stands in for memory. Deliberate?',
  'Reminds me of the orchard book: the same refusal to say what was lost.',
  'Not sure I buy this. He forgives too quickly.',
  'The narrator is lying here, I think. Check against chapter 2.',
  'Underlined mostly for the rhythm.',
  'Is this the turn? Everything before it reads differently now.',
]
const LONG_EXCERPT = Array.from({ length: 9 }, (_, i) => `${EXCERPTS[i % EXCERPTS.length]} And so the afternoon went on as afternoons do, one small refusal after another, until the light itself seemed to be making up its mind.`).join(' ')

const COUNTRIES = ['United Kingdom', 'United States', 'Nigeria', 'Poland', 'Spain', 'Brazil', 'Ireland', 'Sweden', 'India', 'Turkey']

/** Fills an empty database with one reader and their library. Returns the reader's id. */
export async function seed(ctx: MutationCtx, now: number): Promise<Id<'users'>> {
  const r = seeded(7)
  const userId = await ctx.db.insert('users', { name: 'Fixture Reader', email: 'reader@example.com' })

  const booker = await ctx.db.insert('shelves', { userId, slug: 'prize-longlist', name: 'Prize longlist', hardcoverListId: 501 })
  const lent = await ctx.db.insert('shelves', { userId, slug: 'lent-out', name: 'Lent out', hardcoverListId: 502 })
  await ctx.db.insert('shelves', { userId, slug: 'five-star-audio', name: 'Loved, by ear', filter: JSON.stringify({ format: 'audio', rating: 4, status: 'read' }) })

  const people = new Map<string, Id<'people'>>()
  for (const name of ['Marguerite', '@slowpages']) {
    people.set(name, await ctx.db.insert('people', { userId, name, slug: name.replace(/^@/, '').toLowerCase() }))
  }

  const reads: { readId: Id<'reads'>; workId: Id<'works'>; book: Made; pages?: number }[] = []
  let finishedAt = now - 3 * DAY
  let tbr = 0
  for (const [i, book] of BOOKS.entries()) {
    const hardcoverId = 9000 + i
    const format = book.format ?? 'print'
    const audioSeconds = book.audioHours ? Math.round(book.audioHours * 3600) : undefined
    const workId = await ctx.db.insert('works', {
      slug: slugFor(book.title, book.authors, hardcoverId),
      title: book.title,
      authors: book.authors,
      year: 1968 + Math.floor(r() * 58),
      isbns: [],
      hardcoverId,
      pages: book.pages,
      audioSeconds,
      subjects: book.genres ?? [],
      tags: [
        ...(book.genres ?? []).map(name => ({ name, kind: 'genre' as const, count: 40 + Math.floor(r() * 400) })),
        ...(book.tags ?? []).map(name => ({ name, kind: 'tag' as const, count: 2 + Math.floor(r() * 30) })),
      ],
      ...(i % 3 === 0 ? { artSmallUrl: drawing(i), artLargeUrl: drawing(i) } : {}),
      ...(book.authors.length ? { authorGender: r() < 0.5 ? 'woman' : 'man', authorCountry: COUNTRIES[i % COUNTRIES.length] } : {}),
      ...(i % 4 === 0 ? { authorBipoc: r() < 0.5 } : {}),
    })

    const percent = book.status === 'read' ? 100 : book.status === 'tbr' ? 0 : book.percent ?? 0
    let startedAt: number | undefined
    let finished: number | undefined
    let addedAt = now - (200 + Math.floor(r() * 900)) * DAY
    let readings: { hardcoverId?: number; startedAt?: number; finishedAt?: number }[] = []
    if (book.status === 'read') {
      finished = finishedAt
      startedAt = finished - (6 + Math.floor(r() * 40)) * DAY
      readings = [{ hardcoverId: 70000 + i, startedAt, finishedAt: finished }]
      // One book read twice, for the reads page.
      if (book.title === 'Salt') readings = [{ hardcoverId: 60000 + i, startedAt: startedAt - 800 * DAY, finishedAt: startedAt - 790 * DAY }, ...readings]
      finishedAt -= (8 + Math.floor(r() * 70)) * DAY
    } else if (book.status === 'tbr') {
      if (tbr < 5) addedAt = now - (1 + tbr * 2.5) * DAY
      tbr++
    } else {
      startedAt = now - (10 + Math.floor(r() * 50)) * DAY
      readings = [{ hardcoverId: 70000 + i, startedAt }]
    }

    const who = book.who
    const readId = await ctx.db.insert('reads', {
      userId,
      workId,
      status: book.status,
      addedAt,
      startedAt,
      finishedAt: finished,
      readings,
      progress: {
        percent,
        page: book.pages && percent ? Math.round((percent / 100) * book.pages) : undefined,
        seconds: audioSeconds && percent ? Math.round((percent / 100) * audioSeconds) : undefined,
      },
      format,
      ownership: i % 5 === 0 ? 'owned' : undefined,
      rating: book.rating,
      source: who ? { kind: who.startsWith('@') ? 'social' : 'person', who, personId: people.get(who), date: addedAt } : undefined,
      tagIds: [],
      shelfIds: [...(i % 7 === 2 ? [booker] : []), ...(i % 11 === 5 ? [lent] : [])],
      hardcoverUserBookId: 80000 + i,
      hardcoverEditionId: 30000 + i,
      ...(book.title === 'Thaw' ? { edits: { title: 'Thaw (corrected title)' } } : {}),
    })
    reads.push({ readId, workId, book, pages: book.pages })

    // Books in hand have a fortnight of logs, and one from before it so the line has somewhere to start.
    if (book.status === 'reading' && book.title !== 'Lanterns for the Drowned') {
      const steps = [20, 12, 9, 6, 3, 1]
      for (const [n, daysAgo] of steps.entries()) {
        const at = Math.max(0, Math.round(percent * (0.35 + 0.65 * (n / (steps.length - 1)))))
        await ctx.db.insert('progressLog', { userId, readId, at: now - daysAgo * DAY, percent: at, page: book.pages ? Math.round((at / 100) * book.pages) : undefined, origin: n % 2 ? 'hardcover' : 'manual' })
      }
    }
  }

  // Notes and underlined lines, on the books in hand and most finished ones.
  const tagSets = [['grief'], ['Theme', 'memory'], [], ['Chapter summary'], ['place', 'craft'], []]
  let n = 0
  const write = async (target: (typeof reads)[number], kind: 'excerpt' | 'note' | 'summary', text: string, at: number, extra: { parentId?: Id<'entries'>; tags?: string[]; page?: number } = {}) => {
    const page = extra.page ?? (target.pages ? 1 + Math.floor(r() * target.pages) : undefined)
    const pos = page ? { page } : { percent: Math.floor(r() * 100) }
    n++
    return ctx.db.insert('entries', {
      userId, readId: target.readId, kind, text, parentId: extra.parentId, pos, origin: n % 4 === 0 ? 'kobo' : n % 3 === 0 ? 'hardcover' : 'manual',
      originKey: entryKey(target.workId, kind, text, pos), createdAt: at, ...(extra.tags?.length ? { tags: extra.tags } : {}),
      ...(n % 3 === 0 ? { hardcoverJournalId: 40000 + n } : {}),
    })
  }
  for (const [i, target] of reads.entries()) {
    if (target.book.status === 'tbr' || target.book.status === 'dnf') continue
    const count = target.book.status === 'reading' ? 5 : i % 3 === 0 ? 0 : 1 + (i % 4)
    for (let k = 0; k < count; k++) {
      const at = target.book.status === 'read' ? now - (20 + i * 23 + k * 2) * DAY : now - (k * 2.2 + 0.4) * DAY
      const line = `${EXCERPTS[(i + k) % EXCERPTS.length]}${k ? ` (${target.book.title}, ${k})` : ''}`
      const excerpt = await write(target, 'excerpt', k === 3 ? LONG_EXCERPT : line, at, { tags: tagSets[(i + k) % tagSets.length] })
      if (k % 2 === 0) await write(target, 'note', NOTES[(i + k) % NOTES.length], at + 60_000, { parentId: excerpt, tags: tagSets[(i + k + 1) % tagSets.length] })
    }
    if (i % 5 === 1) await write(target, 'summary', 'Part one: the return, the house, the first refusal. Nothing is said outright; everything is weather.', now - (15 + i * 20) * DAY, { tags: ['Chapter summary'] })
    if (target.book.rating && target.book.rating >= 4.5) {
      await ctx.db.insert('entries', {
        userId, readId: target.readId, kind: 'review', text: `Stayed with me for weeks. ${target.book.title} does the hard thing of being quiet without being slight.`,
        pos: {}, origin: 'manual', originKey: `margin-review:${target.readId}`, createdAt: now - (10 + i * 20) * DAY,
      })
    }
  }

  const byTitle = (title: string) => reads.find(x => x.book.title === title)!

  // One finished book has its reflection answered, and the latest finish is still waiting to be asked about.
  const answered = byTitle('Seven Winters')
  const question = 'You marked the bread scene twice. What did it change about how you read the ending?'
  await ctx.db.insert('reflectionPrompts', { userId, readId: answered.readId, state: 'answered', question, createdAt: now - 150 * DAY })
  await ctx.db.insert('entries', {
    userId, readId: answered.readId, kind: 'reflection', question, text: 'That the ending is a kindness and not a defeat. I had it backwards until then.',
    pos: {}, origin: 'manual', originKey: entryKey(answered.workId, 'reflection', 'That the ending is a kindness and not a defeat. I had it backwards until then.', {}), createdAt: now - 149 * DAY,
  })
  await ctx.db.insert('reflectionPrompts', {
    userId, readId: byTitle('The Glass Orchard').readId, state: 'waiting',
    question: 'You kept underlining what the orchard remembers. Whose memory did you end up trusting?', createdAt: now - 3 * DAY,
  })

  // The book with a buddy: a guide, a conversation under way, and a milestone note waiting on another.
  const talking = byTitle('The Salt Road Home')
  await ctx.db.insert('guides', {
    workId: talking.workId, userId, state: 'ready', depth: 'light', version: 2, createdAt: now - 30 * DAY,
    usage: { input: 21000, output: 5200, cacheRead: 0, cacheWrite: 0, searches: 2 },
    guide: guideSchema.parse({
      knownness: 'partly',
      structure: [{ label: 'Part one: Leaving', percent: 0 }, { label: 'Part two: The road', percent: 30 }, { label: 'Part three: Salt', percent: 68 }],
      themes: [
        { name: 'Homecoming as debt', gloss: 'What a return costs, and who is owed.', readings: ['Commonly read as a novel of reconciliation', 'Some read it as a refusal of one'], from: 0, confidence: 'medium' },
        { name: 'Found family', gloss: 'The company on the road stands in for the one left behind.', readings: ['A consolation', 'A second betrayal'], from: 25, confidence: 'high' },
        { name: 'The sea', gloss: 'Arrives late and changes what the road was for.', readings: [], from: 70, confidence: 'low' },
      ],
      moments: [
        { percent: 8, what: 'The letter arrives and is not opened.', spoiler: 'minor', confidence: 'high' },
        { percent: 33, what: 'The company forms at the ford.', spoiler: 'minor', confidence: 'medium' },
        { percent: 72, what: 'The road reaches the salt flats.', spoiler: 'major', confidence: 'medium' },
      ],
      questions: [
        { percent: 10, register: 'noticing', text: 'What did you make of the letter staying shut?' },
        { percent: 35, register: 'craft', text: 'Why do you think the ford scene is told from so far away?' },
        { percent: 75, register: 'predictive', text: 'Where do you think the road was always going?' },
      ],
      sources: ['https://example.com/an-interview', 'https://example.com/a-review'],
    }),
  })
  const turns: ['buddy' | 'reader', string][] = [
    ['buddy', 'You’re a third of the way in, just past the ford. What did you make of the letter staying shut all this time?'],
    ['reader', 'I think she already knows what it says. Opening it would make it true.'],
    ['buddy', 'That’s a reading with some company: a few critics take the letter as the book’s one honest object. But you said “make it true”. True for whom, do you think: her, or the people waiting on the answer?'],
    ['reader', 'For her. Everyone else decided years ago.'],
  ]
  for (const [k, [role, text]] of turns.entries()) {
    await ctx.db.insert('buddyTurns', { userId, readId: talking.readId, role, text, state: 'done', createdAt: now - 2 * DAY + k * 90_000, ...(role === 'buddy' ? { usage: { input: 4200, output: 180, cacheRead: 3900, cacheWrite: 0 } } : {}) })
  }
  await ctx.db.insert('buddyQueue', {
    userId, readId: byTitle('A Field Guide to Getting Lost in Small Towns, With Notes on Returning: Essays').readId, milestoneKey: 'check-75', percent: 75,
    text: 'You’re nearly three quarters through. Which of these towns would you actually go back to, and what does that say about the essays you skipped?', state: 'pending', createdAt: now - DAY,
  })

  // Settings has something to say in every panel.
  await ctx.db.insert('integrations', { userId, provider: 'hardcover', hardcoverUserId: 4242, cursor: new Date(now - 150_000).toISOString(), lastSyncAt: now - 90_000 })
  await ctx.db.insert('hardcoverOutbox', { userId, kind: 'read', readId: talking.readId, version: 1, attempts: 2, nextAt: now + 4 * 60_000, lastError: 'Hardcover answered 502.' })
  await ctx.db.insert('koboLinks', { userId, cookie: 'fixture', lastPullAt: now - 5 * 3_600_000, lastReport: { books: 6, highlights: 41 } })
  await ctx.db.insert('hiddenTopics', { userId, key: 'young adult', name: 'Young Adult' })
  await ctx.db.insert('reviewItems', {
    userId, source: 'playbooks', sourceId: 'pb-1', title: 'The Glass Orchard (Anniversary Edition)', author: 'A. Okoro', status: 'read', state: 'waiting', createdAt: now - 2 * DAY,
    notes: [{ page: 14, highlight: EXCERPTS[6], note: 'Same line I marked in the paperback.', at: now - 400 * DAY }],
  })
  await ctx.db.insert('reviewItems', { userId, source: 'playbooks', sourceId: 'pb-2', title: 'Untitled document', author: '', state: 'waiting', createdAt: now - 2 * DAY, notes: [] })

  return userId
}

/** Books a search "finds", for the add-a-book screens. */
export const SEARCH_HITS = [
  { hardcoverId: 9000, title: 'The Salt Road Home', authors: ['Imre Valdane'], year: 2019, pages: 412 },
  { hardcoverId: 9901, title: 'The Salt Road', authors: ['Imre Valdane'], year: 2014, pages: 388 },
  { hardcoverId: 9902, title: 'Salt Roads of the Old World: A History', authors: ['Ilse Vandermeer', 'Bartolomeu Sá'], year: 2001, pages: 520 },
  { hardcoverId: 9903, title: 'Study Guide: The Salt Road Home', authors: [], year: 2021 },
].map(hit => ({ book: { ...hit, slug: slugFor(hit.title, hit.authors, hit.hardcoverId), isbns: [] as string[], subjects: [] as string[] }, onShelves: hit.hardcoverId === 9000 }))
