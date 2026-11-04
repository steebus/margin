// Whether two records name the same book: main title (before a subtitle) and the first author's surname.
// Shared by the Audible and Kobo imports. An empty author on either side matches any author.
const plain = (s: string) => s.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const mainTitle = (s: string) => plain(s.split(/:\s|\s\(/)[0])
const surname = (s: string) => plain(s.split(',')[0].replace(/\+\d+$/, '')).split(' ').at(-1) ?? ''

export function sameBook(a: { title: string; author: string }, b: { title: string; author: string }) {
  if (mainTitle(a.title) !== mainTitle(b.title)) return false
  return !a.author.trim() || !b.author.trim() || surname(a.author) === surname(b.author)
}
