// ponytail: hand-stored test drawings, until the art pipeline exists (SPEC 3.11). Only books that happen to match get one.
const DEMO = new Set([
  'the-left-hand-of-darkness-guin', 'middlemarch-eliot', 'beloved-morrison', 'moby-dick-melville', 'mrs-dalloway-woolf',
  'house-of-leaves-danielewski', 'stoner-williams', 'kindred-butler', 'gilead-robinson', 'to-the-lighthouse-woolf',
])

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function artFor(title: string, author: string) {
  const slug = slugify(`${title} ${author.split(' ').at(-1)}`)
  return DEMO.has(slug) ? { small: `/art-demo/${slug}-256.webp`, large: `/art-demo/${slug}-512.webp` } : null
}

/** Hardcover's image server refuses canvas access, so its covers are served through this site (see vercel.json). */
export function coverPath(url: string) {
  return url.replace('https://assets.hardcover.app/', '/hc-covers/')
}
