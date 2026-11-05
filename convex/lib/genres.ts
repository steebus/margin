import { topicKey, type BookTag } from './topics'

// Margin's genres (Steve, 2026-11-06): what kind of book it is, a fixed list of our own, apart from topics (what it's
// about). Filled from Hardcover's genres and readers' tags; any name here goes to genre and never becomes a topic.
// Aliases are in topicKey's form. Drawn from what Steve's 657 books carry; add a spelling here when one is missed.
export const GENRES: Record<string, string[]> = {
  'Fantasy': ['fantasy', 'high fantasy', 'epic fantasy', 'dark fantasy', 'fantasy fiction', 'urban fantasy', 'sword and sorcery', 'magic'],
  'Science fiction': ['science fiction', 'hard science fiction', 'space opera', 'cyberpunk', 'military science fiction'],
  'LitRPG': ['litrpg', 'gamelit', 'progression fantasy'],
  'Dystopian': ['dystopian', 'dystopia', 'post apocalyptic', 'apocalyptic'],
  'Literary fiction': ['literary fiction', 'literary', 'contemporary fiction', 'world literature', 'english fiction'],
  'Classics': ['classics', 'classic', 'classic literature'],
  'Mystery & crime': ['mystery', 'crime', 'detective and mystery stories', 'mystery thriller', 'crime mystery thriller', 'cozy mystery'],
  'Thriller': ['thriller', 'suspense', 'thriller suspense', 'psychological thriller', 'psychothriller'],
  'Horror': ['horror', 'gothic', 'supernatural', 'paranormal'],
  'Historical fiction': ['historical fiction', 'historical'],
  'Romance': ['romance'],
  'Young adult': ['young adult', 'ya', 'juvenile fiction'],
  'Humour': ['humor', 'comedy humor', 'satire'],
  'Adventure': ['adventure', 'action adventure', 'action', 'adventure stories', 'aventure'],
  'Magical realism': ['magical realism'],
  'Short stories': ['short stories', 'literary collections', 'anthologies'],
  'Poetry': ['poetry'],
  'Graphic novels': ['comics', 'graphic novels', 'comics graphic novels', 'manga'],
  'History': ['history', 'military history', 'world history'],
  'Biography & memoir': ['biography', 'biography autobiography', 'autobiography', 'memoir', 'memoirs'],
  'Science': ['science', 'popular science', 'mathematics', 'physics', 'biology', 'nature'],
  'Philosophy': ['philosophy'],
  'Psychology': ['psychology'],
  'Business & economics': ['business economics', 'business', 'economics', 'finance', 'business careers', 'money'],
  'Politics & society': ['politics', 'political science', 'social science', 'politics social sciences', 'sociology'],
  'Self-help': ['self improvement', 'personal growth', 'personal development'],
  'Religion': ['religion', 'spirituality'],
  'Essays': ['essays', 'literary criticism'],
  'Plays': ['drama', 'dramas plays', 'plays'],
  'Technology': ['technology', 'computers', 'engineering'],
  'Family & relationships': ['family relationships', 'parenting'],
  'Art & photography': ['art', 'photography'],
}

// Hardcover's joined shelves: both genres, but only counted when the book names neither on its own, so a fantasy
// novel tagged "Science Fiction & Fantasy" stays Fantasy.
const JOINED: Record<string, string[]> = {
  'science fiction fantasy': ['Science fiction', 'Fantasy'],
  'fantasy science fiction': ['Fantasy', 'Science fiction'],
}

// Built on first use: topics.ts imports this file, so topicKey isn't ready while it loads.
let byKey: Map<string, string> | undefined
const keyed = () => (byKey ??= new Map(Object.entries(GENRES).flatMap(([genre, keys]) => keys.map(k => [topicKey(k), genre] as const))))

/** The genre a Hardcover genre or tag names, if it names one. */
export const genreOf = (name: string) => keyed().get(topicKey(name)) ?? null

/** Whether a name belongs to genre rather than topics, including Hardcover's joined shelves. */
export const isGenreName = (name: string) => keyed().has(topicKey(name)) || topicKey(name) in JOINED

const MAX = 3

/**
 * A book's genres, most used first, at most three. Hardcover's genres come first; a reader tag counts once two
 * readers used it. Books from before tags were kept fall back to their stored genre names.
 */
export function genresOf(tags: BookTag[] | undefined, subjects: string[] = []): string[] {
  const names = tags?.length
    ? tags.filter(t => t.kind === 'genre' || (t.count ?? 0) >= 2).map(t => t.name)
    : subjects
  const found: string[] = []
  for (const name of names) {
    const genre = genreOf(name)
    if (genre && !found.includes(genre)) found.push(genre)
  }
  if (!found.length) {
    for (const name of names) for (const genre of JOINED[topicKey(name)] ?? []) if (!found.includes(genre)) found.push(genre)
  }
  return found.slice(0, MAX)
}
