import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { ArrowLeft, ChartColumn, Layers, Plus } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { useBooks } from '../../lib/offline'
import { filterBooks, groupBooks, mergeSearch, parseSaved, SHELVES, sortBooks, type GroupId, type ShelfSearch } from '../../lib/shelf'
import { BookTable, Catalog, type Size } from './BookList'
import { ReadingStrip } from './ReadingStrip'
import { SaveView } from './SaveView'
import { ShelfTools, useCatalogSize } from './ShelfTools'
import type { Book } from '../../lib/books'
import { Opening } from '../opening/Opening'

const PREVIEW = 12

function NoMatch({ onClear }: { onClear: () => void }) {
  return (
    <div className="box stack">
      <p>No books match that.</p>
      <div className="btn-row"><button type="button" className="btn" onClick={onClear}>Clear the search and filters</button></div>
    </div>
  )
}

function List({ books, search, size, onChange }: { books: Book[]; search: ShelfSearch; size: Size; onChange: (patch: Partial<ShelfSearch>) => void }) {
  return search.view === 'table'
    ? <BookTable books={books} sort={search.sort ?? 'recent'} dir={search.dir} onSort={(sort, dir) => onChange({ sort, dir })} />
    : <Catalog books={books} size={size} />
}

/** Every shelf at a glance, separated by reading status. Each one opens into its own page. */
export function Shelves() {
  const search = useSearch({ from: '/shelves/' })
  const navigate = useNavigate({ from: '/shelves/' })
  const books = useBooks()
  const lists = useQuery(api.books.myLists)
  const [size, setSize] = useCatalogSize()
  const onChange = (patch: Partial<ShelfSearch>) => navigate({ search: prev => ({ ...prev, ...patch }), replace: true })

  const narrowed = !!(search.q || search.format || search.rating || search.genre)
  const shown = sortBooks(filterBooks(books ?? [], search), search.sort, search.dir)

  return (
    <div className="stack shelves">
      <header className="shelves-head">
        <h1 className="title-head">Shelves</h1>
        <p>{books === undefined ? '' : `${shown.length} ${shown.length === 1 ? 'book' : 'books'}`}</p>
      </header>

      {books === undefined && <Opening what="your shelves" />}

      {books?.length === 0 && (
        <div className="box stack">
          <p>Your shelves are empty. Bring your books in from Hardcover to start.</p>
          <div className="btn-row"><Link to="/settings" search={{ tab: 'integrations' }} className="btn btn-solid">Go to Settings</Link></div>
        </div>
      )}

      {books && books.length > 0 && (
        <>
          <div className="btn-row btn-row-fill">
            <Link to="/pile" className="btn"><Layers aria-hidden="true" strokeWidth={2.25} />The pile</Link>
            <Link to="/stats" className="btn"><ChartColumn aria-hidden="true" strokeWidth={2.25} />Stats</Link>
            <Link to="/capture/add" className="btn"><Plus aria-hidden="true" strokeWidth={2.25} />Add a book</Link>
          </div>
          <ShelfTools search={search} onChange={onChange} books={books} size={size} onSize={setSize} />
          <SaveView search={search} />
          {shown.length === 0 && <NoMatch onClear={() => onChange({ q: undefined, format: undefined, rating: undefined, genre: undefined })} />}
          {SHELVES.map(shelf => {
            const all = shown.filter(b => b.status === shelf.status)
            if (!all.length) return null
            // A search shows everything it found. Otherwise each shelf is a sample of itself.
            const list = narrowed ? all : all.slice(0, PREVIEW)
            return (
              <section key={shelf.slug} className="stack" aria-labelledby={`shelf-${shelf.slug}`}>
                <h2 id={`shelf-${shelf.slug}`} className="year">
                  <Link to="/shelves/$shelfSlug" params={{ shelfSlug: shelf.slug }} search={search}>{shelf.label} <span className="shelf-count">{all.length}</span></Link>
                </h2>
                {/* What you're reading gets room for its art, unless you've asked for a table. */}
                {shelf.status === 'reading' && search.view !== 'table'
                  ? <ReadingStrip books={list} />
                  : <List books={list} search={search} size={size} onChange={onChange} />}
                {list.length < all.length && (
                  <div className="btn-row"><Link to="/shelves/$shelfSlug" params={{ shelfSlug: shelf.slug }} search={search} className="btn">All {all.length} {shelf.label}</Link></div>
                )}
              </section>
            )
          })}
          {!!lists?.length && (
            <section className="stack" aria-labelledby="lists-heading">
              <h2 id="lists-heading" className="year"><span>Lists and saved shelves</span></h2>
              <ul className="list-links">
                {lists.map(l => (
                  <li key={l.id}>
                    <Link to="/shelves/$shelfSlug" params={{ shelfSlug: l.slug }} search={search}>
                      {l.name} {!l.filter && <span className="shelf-count">{shown.filter(b => b.shelfIds.includes(l.id)).length}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

/** One shelf in full. This is where books group by month, year, date published, days to read and so on. */
export function Shelf() {
  const { shelfSlug } = useParams({ from: '/shelves/$shelfSlug' })
  const url = useSearch({ from: '/shelves/$shelfSlug' })
  const navigate = useNavigate({ from: '/shelves/$shelfSlug' })
  const books = useBooks()
  const [size, setSize] = useCatalogSize()
  const lists = useQuery(api.books.myLists)
  const status = SHELVES.find(s => s.slug === shelfSlug)
  const list = lists?.find(l => l.slug === shelfSlug)
  const removeView = useMutation(api.books.removeView)
  const saved = list?.filter ? parseSaved(list.filter) : null
  const search = saved ? mergeSearch(saved, url) : url
  const shelf = status ?? list
  const label = status?.label ?? list?.name ?? ''
  const onChange = (patch: Partial<ShelfSearch>) => navigate({ search: prev => ({ ...prev, ...patch }), replace: true })

  if (!shelf && lists === undefined) return <Opening what="your shelf" />
  if (!shelf) {
    return (
      <div className="narrow stack">
        <h1 className="title-head">Shelf not found</h1>
        <div className="btn-row"><Link to="/shelves" className="btn btn-solid">Go to Shelves</Link></div>
      </div>
    )
  }

  const here = (books ?? []).filter(b => (
    status ? b.status === status.status
      : saved ? !saved.status || b.status === saved.status
        : b.shelfIds.includes(list!.id)
  ))
  const shown = sortBooks(filterBooks(here, search), search.sort, search.dir)
  const group: GroupId | 'none' = search.group ?? (status?.status === 'read' ? 'year' : 'none')
  const { group: _group, ...shared } = url

  return (
    <div className="stack shelves">
      <Link to="/shelves" search={shared} className="back"><ArrowLeft aria-hidden="true" strokeWidth={2.25} />Shelves</Link>
      <header className="shelves-head">
        <h1 className="title-head">{label}</h1>
        <p>{books === undefined ? '' : `${shown.length} ${shown.length === 1 ? 'book' : 'books'}`}</p>
      </header>

      {books === undefined && <Opening what="your shelf" />}

      {books && (
        <>
          {status?.status === 'read' && <Link to="/pile" className="btn pile-link"><Layers aria-hidden="true" strokeWidth={2.25} />See them as a pile</Link>}
          <ShelfTools search={search} onChange={onChange} books={here} size={size} onSize={setSize} group={group} />
          {saved
            ? <button type="button" className="text-link save-view" onClick={() => { void removeView({ id: list!.id }); void navigate({ to: '/shelves' }) }}>Delete this saved shelf</button>
            : status && <SaveView search={search} status={status.status} />}
          {shown.length === 0 && (here.length ? <NoMatch onClear={() => onChange({ q: undefined, format: undefined, rating: undefined, genre: undefined })} /> : <p>Nothing on this shelf yet.</p>)}
          {group === 'none'
            ? shown.length > 0 && <List books={shown} search={search} size={size} onChange={onChange} />
            : groupBooks(shown, group).map(g => (
              <section key={g.label} className="stack" aria-label={g.label}>
                <h2 className="year"><span>{g.label} <span className="shelf-count">{g.books.length}</span></span></h2>
                <List books={g.books} search={search} size={size} onChange={onChange} />
              </section>
            ))}
        </>
      )}
    </div>
  )
}
