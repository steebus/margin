// What arrives when something is shared to Margin: Android's share sheet or the bookmarklet send a link, a page
// title and maybe some words. readShare works out what it is, and whatever can be known without fetching. Pure.
export type SharedIn = { url?: string | null; title?: string | null; text?: string | null }

export type ShareRead =
  | { kind: 'goodreads'; url: string; title: string; author: string | null }
  | { kind: 'instagram'; url: string; code: string; handle: string | null }
  | { kind: 'words'; quote: string; title: string | null; author: string | null; page: number | null }
  | { kind: 'other'; url: string | null }

const TRACKING = /^(utm_\w+|fbclid|gclid|mc_[ce]id|igsh|igshid|si|ref|ref_src|ac|from_search|qid|rank)$/i
const FIRST_URL = /https?:\/\/[^\s<>"')\]]+/i

export function cleanUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    // A copy, because deleting while iterating the live list skips entries.
    for (const key of Array.from(u.searchParams.keys())) if (TRACKING.test(key)) u.searchParams.delete(key)
    return u.toString()
  } catch {
    return null
  }
}

const host = (u: URL) => u.hostname.toLowerCase().replace(/^(www|m)\./, '')

/** "The Overstory by Richard Powers | Goodreads", or the same wrapped in words by the Android app. */
function goodreadsBook(u: URL, title: string, text: string) {
  const words = [title, text.replace(FIRST_URL, '')].map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  for (const said of words) {
    const m = /^(?:check out\s+|i'm reading\s+|i am reading\s+)?(.+?)\s+by\s+(.+?)(?:\s*[|:-]\s*goodreads.*|\s+on goodreads.*)?[\s:.!-]*$/i.exec(said)
    if (m) return { title: m[1].trim(), author: m[2].trim() }
  }
  // Failing that, the address itself: /book/show/40180098-the-overstory.
  const slug = /\/book\/show\/\d+[.-]([^/?#]+)/.exec(u.pathname)?.[1] ?? ''
  const fromSlug = slug.replace(/[._-]+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase())
  return { title: fromSlug || words[0]?.replace(/\s*[|:-]\s*goodreads.*$/i, '').trim() || '', author: null }
}

const QUOTES = /^[\s"'“”‘’«»]+|[\s"'“”‘’«»]+$/g
// "Title by Author", maybe after a dash or "from", maybe with a page: the line a reading app adds under a highlight.
const ATTRIBUTION = /^(?:[-—–~]\s*)?(?:from\s+|excerpt from\s+)?["“]?(.+?)["”]?\s+by\s+(.+?)(?:[,.]?\s*(?:page|p\.|pg\.?)\s*(\d+))?[\s.,]*$/i

/**
 * Words shared from a reading app or anywhere else: the quote, and the book it names if it names one. Play Books and
 * Kindle put "Title by Author" on a line of its own under the highlight, and sometimes a page.
 */
export function readWords(text: string, title?: string | null): { quote: string; title: string | null; author: string | null; page: number | null } {
  const url = FIRST_URL.exec(text)?.[0] ?? ''
  const fromUrl = /[?&]pg=GBS\.PA(\d+)/.exec(url)?.[1] ?? /[?&]page=(\d+)/.exec(url)?.[1]
  const lines = text.replace(FIRST_URL, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  let book: { title: string; author: string; page?: string } | null = null
  const last = lines.at(-1)
  if (lines.length > 1 && last) {
    const m = ATTRIBUTION.exec(last)
    if (m) { book = { title: m[1].trim(), author: m[2].trim(), page: m[3] }; lines.pop() }
  }
  const page = Number(book?.page ?? fromUrl ?? /\b(?:page|p\.)\s*(\d+)\b/i.exec(text)?.[1] ?? NaN)
  return {
    quote: lines.join('\n').replace(QUOTES, ''),
    title: book?.title ?? (title?.trim() || null),
    author: book?.author ?? null,
    page: Number.isFinite(page) ? page : null,
  }
}

export function readShare(input: SharedIn): ShareRead {
  const text = input.text?.trim() ?? ''
  const raw = input.url?.trim() || FIRST_URL.exec(text)?.[0] || ''
  const url = raw ? cleanUrl(raw) : null
  const words = () => {
    const read = readWords(text, input.title)
    return read.quote ? { kind: 'words' as const, ...read } : null
  }
  if (!url) return words() ?? { kind: 'other', url: null }
  const u = new URL(url)

  if (host(u) === 'goodreads.com' && /\/book\/show\//.test(u.pathname)) {
    return { kind: 'goodreads', url, ...goodreadsBook(u, input.title?.trim() ?? '', text) }
  }
  if (host(u) === 'instagram.com') {
    // /p/CODE/, /reel/CODE/, /reels/CODE/ and /tv/CODE/, sometimes under the account's name.
    const m = /^(?:\/([\w.]+))?\/(?:p|reel|reels|tv)\/([\w-]+)/.exec(u.pathname)
    if (m) {
      const said = /@([\w.]{2,30})/.exec(`${input.title ?? ''} ${text.replace(FIRST_URL, '')}`)?.[1]
      return { kind: 'instagram', url: `https://www.instagram.com/p/${m[2]}/`, code: m[2], handle: m[1] ?? said ?? null }
    }
  }
  return words() ?? { kind: 'other', url }
}

/** The bookmarklet: the page's address and title, and any words selected on it. */
export const bookmarklet = (origin: string) =>
  `javascript:(()=>{const s=String(getSelection()).trim().slice(0,3000);window.open('${origin}/capture/share?popup=1&url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+(s?'&text='+encodeURIComponent(s):''),'margin-share','width=480,height=760')})()`

const plain = (s: string) => s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/**
 * The book shared words belong to: the one they name, matched by title (and author, when two share a title).
 * Failing that, the book in hand if there's only one. Otherwise null, and the reader chooses.
 */
export function matchBook<B extends { title: string; author: string; status: string }>(books: B[], title: string | null, author: string | null): B | null {
  if (title) {
    const want = plain(title)
    const named = books.filter(b => plain(b.title) === want || plain(b.title.split(/:\s/)[0]) === want)
    const byAuthor = author ? named.filter(b => plain(b.author).includes(plain(author).split(' ').at(-1) ?? '')) : named
    if (byAuthor.length) return byAuthor.find(b => b.status === 'reading') ?? byAuthor[0]
  }
  const inHand = books.filter(b => b.status === 'reading')
  return inHand.length === 1 ? inHand[0] : null
}
