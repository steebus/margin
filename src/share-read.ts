// What arrives when something is shared to Margin: Android's share sheet or the bookmarklet send a link, a page
// title and maybe some words. readShare works out what it is, and whatever can be known without fetching. Pure.
export type SharedIn = { url?: string | null; title?: string | null; text?: string | null }

export type ShareRead =
  | { kind: 'goodreads'; url: string; title: string; author: string | null }
  | { kind: 'instagram'; url: string; code: string; handle: string | null }
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

export function readShare(input: SharedIn): ShareRead {
  const text = input.text?.trim() ?? ''
  const raw = input.url?.trim() || FIRST_URL.exec(text)?.[0] || ''
  const url = raw ? cleanUrl(raw) : null
  if (!url) return { kind: 'other', url: null }
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
  return { kind: 'other', url }
}

/** The bookmarklet: the page's address and title, and any words selected on it. */
export const bookmarklet = (origin: string) =>
  `javascript:(()=>{const s=String(getSelection()).trim().slice(0,3000);window.open('${origin}/capture/share?popup=1&url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+(s?'&text='+encodeURIComponent(s):''),'margin-share','width=480,height=760')})()`
