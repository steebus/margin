import '@fontsource/cinzel/latin-600.css'
import '@fontsource/oxanium/latin-500.css'
import '@fontsource/pirata-one/latin-400.css'
import '@fontsource/playfair-display/latin-700.css'
import '@fontsource/special-elite/latin-400.css'

import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useBooks, useEntries } from '../../lib/offline'
import { formatDate } from '../../lib/books'
import { faceOf, pileNotes, pileOf, spineOf, spineTitle } from '../../lib/pile'

/**
 * Which row is crossing the middle of the screen. Only that book unfurls its notes, so they get room to be read and
 * the rest of the pile stays quiet (Steve, 2026-11-03). The newest to arrive in the band wins.
 */
function useMiddleRow(list: React.RefObject<HTMLOListElement | null>, count: number) {
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    const inBand: string[] = []
    const observer = new IntersectionObserver(entries => {
      for (const e of entries) {
        const key = (e.target as HTMLElement).dataset.key!
        const at = inBand.indexOf(key)
        if (at >= 0) inBand.splice(at, 1)
        if (e.isIntersecting) inBand.push(key)
      }
      setOpen(inBand.at(-1) ?? null)
    }, { rootMargin: '-49% 0px -49% 0px' })
    for (const row of list.current?.children ?? []) observer.observe(row)
    return () => observer.disconnect()
  }, [list, count])
  return open
}

/** Every book read, lying flat in the order they were finished, with what you made of each down the side. */
export function Pile() {
  const books = useBooks()
  const entries = useEntries()

  const rows = pileOf(books ?? [])
  const list = useRef<HTMLOListElement>(null)
  const open = useMiddleRow(list, rows.length)
  const bySlug = Map.groupBy(entries ?? [], e => e.slug)
  const pages = rows.reduce((sum, r) => sum + (r.book.pages ?? 0), 0)
  let lastYear: number | null = null

  return (
    <div className="stack pile-page">
      <header className="shelves-head">
        <h1 className="title-head">The pile</h1>
        {books && <p>{rows.length} {rows.length === 1 ? 'book' : 'books'}, {pages.toLocaleString('en-GB')} pages</p>}
      </header>

      {books === undefined && <p role="status">Stacking your books…</p>}
      {books && rows.length === 0 && <p>Nothing finished yet. Books land here as you finish them.</p>}

      <ol className="pile" ref={list}>
        {rows.map(({ key, book, finishedAt, days }) => {
          const spine = spineOf(book.slug, book.pages)
          const year = finishedAt === null ? null : new Date(finishedAt).getUTCFullYear()
          const newYear = year !== null && year !== lastYear
          if (newYear) lastYear = year
          const written = bySlug.get(book.slug) ?? []
          const notes = pileNotes(written)
          const isOpen = open === key && notes.length > 0
          const roomy = spine.height >= 40
          return (
            <li key={key} data-key={key} data-open={isOpen || undefined} className="pile-row" style={{ height: spine.height }}>
              <div className="pile-book">
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
                    <span className="spine-title" data-face={faceOf(book.subjects)} style={{ WebkitLineClamp: spine.titleLines, '--title': `${spine.titleSize}px` } as React.CSSProperties}>{spineTitle(book.title)}</span>
                    <span className="spine-author">{book.author}</span>
                  </span>
                </Link>
              </div>
              <div className="pile-side" data-year={newYear || undefined}>
                {/* A thin book has room for one line beside it, so the count joins the date there. */}
                <p className="pile-date">
                  <span>
                    {finishedAt ? formatDate(finishedAt) : 'Date not recorded'}
                    {roomy && days !== null && `, ${days} ${days === 1 ? 'day' : 'days'}`}
                    {!roomy && written.length > 0 && <span className="pile-count"> · {written.length}</span>}
                  </span>
                  {newYear && <span className="pile-year">{year}</span>}
                </p>
                {roomy && written.length > 0 && <p className="pile-count">{written.length} {written.length === 1 ? 'note' : 'notes'}</p>}
                {notes.length > 0 && (
                  <Link to="/books/$bookSlug/entries" params={{ bookSlug: book.slug }} className="pile-unfurl" tabIndex={isOpen ? 0 : -1} aria-hidden={!isOpen}>
                    {notes.map((n, i) => <span key={i} className={n.kind === 'excerpt' ? 'pile-text' : 'pile-text hand'}>{n.text}</span>)}
                    {written.length > notes.length && <span className="pile-more">All {written.length} notes</span>}
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
