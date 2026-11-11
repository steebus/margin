/** The name a book's cover carries while it flies from a shelf to the book's page (View Transitions). */
export const COVER_FLIGHT = 'book-cover'

/**
 * Names the cover inside a tapped book so the router's view transition carries it to the book page's cover,
 * which always has the name. Only the tapped one is named, because a name must be unique on a page and
 * hundreds of named covers would make every transition heavy. The name is taken off again once the page has
 * changed, so the next tap starts clean.
 */
export function flyCover(tapped: Element, keepFor = 800) {
  const cover = tapped.querySelector<HTMLElement>('.thumb')
  if (!cover) return
  cover.style.setProperty('view-transition-name', COVER_FLIGHT)
  setTimeout(() => cover.style.removeProperty('view-transition-name'), keepFor)
}
