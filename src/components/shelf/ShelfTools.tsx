import { ArrowDown, ArrowUp, Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import type { Book } from '../../lib/books'
import { genresIn, GROUP_OPTIONS, SORTS, type Dir, type GroupId, type ShelfSearch, type SortId } from '../../lib/shelf'
import { SIZES, type Size } from './BookList'

const SIZE_KEY = 'margin.catalogSize'

export function useCatalogSize() {
  const [size, setSize] = useState<Size>(() => {
    try {
      const value = localStorage.getItem(SIZE_KEY)
      return SIZES.some(s => s.id === value) ? (value as Size) : 'medium'
    } catch {
      return 'medium'
    }
  })
  const choose = (next: Size) => {
    setSize(next)
    try { localStorage.setItem(SIZE_KEY, next) } catch { /* private window: it just won't persist */ }
  }
  return [size, choose] as const
}

type Props = {
  search: ShelfSearch
  onChange: (patch: Partial<ShelfSearch>) => void
  books: Book[]
  size: Size
  onSize: (size: Size) => void
  group?: GroupId | 'none'
}

/** Search stays out; sort, filter, view and size tuck behind one button, so the books come first on a phone. */
export function ShelfTools({ search, onChange, books, size, onSize, group }: Props) {
  const sort: SortId = search.sort ?? 'recent'
  const dir: Dir = search.dir ?? SORTS[sort].dir
  const view = search.view ?? 'catalog'
  const active = [search.format, search.rating, search.genre].filter(Boolean).length
  const [open, setOpen] = useState(false)
  const Arrow = dir === 'asc' ? ArrowUp : ArrowDown

  return (
    <div className="tools">
      <div className="tools-top">
        <label className="tools-search">
          <Search aria-hidden="true" strokeWidth={2.25} />
          <span className="sr-only">Search by title, author or genre</span>
          <input type="search" value={search.q ?? ''} placeholder="Title, author or genre" onChange={e => onChange({ q: e.target.value || undefined })} />
        </label>
        <button type="button" className="btn tools-view" aria-expanded={open} aria-controls="shelf-view" onClick={() => setOpen(!open)}>
          <SlidersHorizontal aria-hidden="true" strokeWidth={2.25} />View{active > 0 && <span className="tools-badge">{active}</span>}
        </button>
      </div>

      {open && (
        <div id="shelf-view" className="tools-panel">
          <div className="tools-row">
            <div className="field tools-sort">
              <label htmlFor="shelf-sort">Sort</label>
              <div className="tools-sort-row">
                <select id="shelf-sort" value={sort} onChange={e => onChange({ sort: e.target.value as SortId, dir: undefined })}>
                  {(Object.keys(SORTS) as SortId[]).map(id => <option key={id} value={id}>{SORTS[id].label}</option>)}
                </select>
                <button
                  type="button"
                  className="theme-toggle"
                  aria-label={dir === 'asc' ? 'Order: ascending' : 'Order: descending'}
                  onClick={() => onChange({ dir: dir === 'asc' ? 'desc' : 'asc' })}
                >
                  <Arrow aria-hidden="true" strokeWidth={2.25} />
                </button>
              </div>
            </div>
            {group !== undefined && (
              <div className="field">
                <label htmlFor="shelf-group">Group</label>
                <select id="shelf-group" value={group} onChange={e => onChange({ group: e.target.value as GroupId | 'none' })}>
                  <option value="none">No groups</option>
                  {GROUP_OPTIONS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="tools-row">
            <div className="field">
              <label htmlFor="shelf-format">Format</label>
              <select id="shelf-format" value={search.format ?? ''} onChange={e => onChange({ format: e.target.value || undefined })}>
                <option value="">Any</option>
                <option value="print">Print</option>
                <option value="ebook">Ebook</option>
                <option value="audio">Audiobook</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="shelf-rating">Rating</label>
              <select id="shelf-rating" value={search.rating ?? ''} onChange={e => onChange({ rating: e.target.value || undefined })}>
                <option value="">Any</option>
                {[5, 4, 3, 2].map(r => <option key={r} value={r}>{r === 5 ? '5 stars' : `${r} stars and up`}</option>)}
                <option value="none">Not rated</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="shelf-genre">Genre</label>
              <select id="shelf-genre" value={search.genre ?? ''} onChange={e => onChange({ genre: e.target.value || undefined })}>
                <option value="">Any</option>
                {genresIn(books).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="shelves-tools">
            <div className="segments" role="group" aria-label="View">
              {(['catalog', 'table'] as const).map(v => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => onChange({ view: v })}>{v === 'catalog' ? 'Catalog' : 'Table'}</button>
              ))}
            </div>
            {view === 'catalog' && (
              <div className="segments" role="group" aria-label="Cell size">
                {SIZES.map(s => <button key={s.id} type="button" aria-pressed={size === s.id} onClick={() => onSize(s.id)}>{s.label}</button>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
