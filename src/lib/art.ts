/** Hardcover's image server refuses canvas access, so its covers are served through this site (see vercel.json). */
export function coverPath(url: string) {
  return url.replace('https://assets.hardcover.app/', '/hc-covers/')
}
