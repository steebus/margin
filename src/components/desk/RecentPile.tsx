import '@fontsource/cinzel/latin-600.css'
import '@fontsource/oxanium/latin-500.css'
import '@fontsource/pirata-one/latin-400.css'
import '@fontsource/playfair-display/latin-700.css'
import '@fontsource/special-elite/latin-400.css'

import { Link } from '@tanstack/react-router'
import { faceOf, spineOf, spineTitle } from '../../lib/pile'

type Added = { slug: string; title: string; author: string; pages: number | null; subjects: string[] }

/** The books put on the TBR in the window, stacked like the pile, at a smaller scale. */
export function RecentPile({ books }: { books: Added[] }) {
  return (
    <ol className="mini-pile" aria-label="Added to your TBR">
      {books.map(book => {
        const spine = spineOf(book.slug, book.pages)
        return (
          <li key={book.slug} style={{ height: Math.round(spine.height * 0.7) }}>
            <Link
              to="/books/$bookSlug"
              params={{ bookSlug: book.slug }}
              className="spine"
              data-look={spine.look}
              data-thin={spine.thin || undefined}
              style={{ width: `${spine.width}%`, marginLeft: `${((100 - spine.width) * spine.shift) / 100}%` }}
            >
              <span className="spine-etch" aria-hidden="true" />
              <span className="spine-label">
                <span className="spine-title" data-face={faceOf(book.subjects)} style={{ WebkitLineClamp: 1, '--title': `${Math.min(spine.titleSize, 15)}px` } as React.CSSProperties}>{spineTitle(book.title)}</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
