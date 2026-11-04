import { koboStatus, type KoboBook } from '../../convex/lib/kobo'
import { sameBook } from '../../convex/lib/match'

/**
 * The bookmarklet tapped on Kobo's My Books (kobo.com/<store>/library/books). Kobo's bot check stops servers reading
 * that page, but not the reader's own browser. It reads every page of books (title, authors, status and the book's id
 * from its Read Now link) and opens Margin's Kobo page with the list in the address's fragment, which never reaches a
 * server. Class names checked on 2026-11-04.
 */
export const koboBookmarklet = (origin: string) =>
  `javascript:(async()=>{if(!/(^|\\.)kobo\\.com$/.test(location.hostname)||!/\\/library\\/books/.test(location.pathname)){alert('Open My Books on kobo.com, then tap this again.');return}` +
  `const t=e=>(e&&e.textContent||'').replace(/\\s+/g,' ').trim();` +
  `const read=d=>[...d.querySelectorAll('li.item-wrapper.book')].map(li=>{const a=li.querySelector('a[href*="readnow.kobo.com"]');return{koboId:a?new URL(a.href).pathname.slice(1):null,title:t(li.querySelector('h2.title')),author:[...li.querySelectorAll('.contributor-name')].map(t).join(', '),statusText:t(li.querySelector('.item-status'))}});` +
  `const books=[],seen=new Set();for(let n=1;n<=50;n++){const h=await fetch(location.pathname+'?pageNumber='+n,{credentials:'include'}).then(r=>r.text());const got=read(new DOMParser().parseFromString(h,'text/html')).filter(b=>!seen.has(b.title+b.koboId));if(!got.length)break;got.forEach(b=>{seen.add(b.title+b.koboId);books.push(b)})}` +
  `if(!books.length){alert('Margin found no books on this page.');return}` +
  `location.href='${origin}/settings/integrations/kobo#'+encodeURIComponent(JSON.stringify(books))})()`

/** The books the bookmarklet sent, or null if the fragment isn't that. */
export function readKoboFragment(hash: string): KoboBook[] | null {
  try {
    const list = JSON.parse(decodeURIComponent(hash.replace(/^#/, '')))
    if (!Array.isArray(list)) return null
    return list.filter(b => b && typeof b.title === 'string' && b.title).map(b => ({
      koboId: typeof b.koboId === 'string' && /^[0-9a-f-]{36}$/i.test(b.koboId) ? b.koboId : null,
      title: b.title,
      author: typeof b.author === 'string' ? b.author : '',
      statusText: typeof b.statusText === 'string' ? b.statusText : '',
    }))
  } catch {
    return null
  }
}

type Shelved = { readId: string; title: string; author: string; status: string; percent: number }

export type KoboPlan<B extends Shelved> = {
  link: { book: B; koboId: string }[]
  finish: B[] // finished on Kobo, not marked read here
  progress: { book: B; percent: number }[] // further along on Kobo
  add: { kobo: KoboBook; status: 'read' | 'reading' | 'tbr'; percent: number }[]
  skipped: number // not owned (Kobo shows "Buy Now"), or a status Margin can't read
}

/** What Kobo's list would change. Only ever moves a book forward, as the Audible import does. */
export function planKobo<B extends Shelved>(kobo: KoboBook[], shelves: B[]): KoboPlan<B> {
  const plan: KoboPlan<B> = { link: [], finish: [], progress: [], add: [], skipped: 0 }
  for (const k of kobo) {
    const s = koboStatus(k.statusText)
    if (!s) { plan.skipped++; continue }
    const book = shelves.find(b => sameBook(b, k))
    if (!book) { plan.add.push({ kobo: k, ...s }); continue }
    if (k.koboId) plan.link.push({ book, koboId: k.koboId })
    if (book.status === 'read') continue
    if (s.status === 'read') plan.finish.push(book)
    else if (s.status === 'reading' && s.percent > book.percent) plan.progress.push({ book, percent: s.percent })
  }
  return plan
}
