import { Link, useSearch } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { books } from './sample'
import { bookmarklet, readShare } from './share-read'

// ponytail: the screens are real, the data isn't. Nothing is saved yet, and the books "read" from an Instagram post
// are a fixed sample until the backend exists (SPEC 3.4). Replace SAMPLE_POST and the done state with Phase 1.
const LISTS = ['TBR', 'Booker 2026', 'Lent to Sam']
const SAMPLE_POST = [
  { title: 'Piranesi', author: 'Susanna Clarke' },
  { title: 'The Overstory', author: 'Richard Powers' },
  { title: 'Stoner', author: 'John Williams' },
  { title: 'Cloud Cuckoo Land', author: 'Anthony Doerr' },
]

const onShelves = (title: string) => books.some(b => b.title === title)

function Done({ message, popup }: { message: string; popup: boolean }) {
  useEffect(() => {
    if (!popup) return
    const timer = setTimeout(() => window.close(), 1800)
    return () => clearTimeout(timer)
  }, [popup])
  return (
    <div className="box stack" role="status">
      <p className="book-voice">{message}</p>
      <p className="where">Sample only: nothing is saved or sent to Hardcover yet.</p>
      {!popup && <div className="btn-row"><Link to="/shelves" className="btn btn-solid">Go to Shelves</Link></div>}
    </div>
  )
}

function FromGoodreads({ title: readTitle, author: readAuthor, popup }: { title: string; author: string | null; popup: boolean }) {
  const [title, setTitle] = useState(readTitle)
  const [author, setAuthor] = useState(readAuthor ?? '')
  const [list, setList] = useState(LISTS[0])
  const [done, setDone] = useState(false)
  const name = title.trim()

  if (done) return <Done message={`Added ${name} to ${list}.`} popup={popup} />
  return (
    <form className="stack" onSubmit={e => { e.preventDefault(); if (name) setDone(true) }}>
      <div className="field">
        <label htmlFor="share-title">Title</label>
        <input id="share-title" value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="share-author">Author</label>
        <input id="share-author" value={author} onChange={e => setAuthor(e.target.value)} />
      </div>
      <fieldset className="choices">
        <legend className="head">Which list?</legend>
        {LISTS.map(l => (
          <label key={l} className="choice">
            <input type="radio" name="list" checked={list === l} onChange={() => setList(l)} />
            {l}
          </label>
        ))}
      </fieldset>
      <p className="where">Also adds it to Hardcover.</p>
      <button type="submit" className="btn btn-solid" disabled={!name}>Add to {list}</button>
    </form>
  )
}

function FromInstagram({ handle: readHandle, popup }: { handle: string | null; popup: boolean }) {
  const [picked, setPicked] = useState(() => SAMPLE_POST.filter(b => !onShelves(b.title)).map(b => b.title))
  const [handle, setHandle] = useState(readHandle ?? '')
  const [done, setDone] = useState(false)
  const count = picked.length
  const who = handle.trim().replace(/^@/, '')

  if (done) return <Done message={`Added ${count} ${count === 1 ? 'book' : 'books'} to TBR${who ? `, from @${who}` : ''}.`} popup={popup} />
  return (
    <form className="stack" onSubmit={e => { e.preventDefault(); if (count) setDone(true) }}>
      <p className="where">Sample books: reading a real post needs the backend.</p>
      <fieldset className="choices">
        <legend className="head">Which ones?</legend>
        {SAMPLE_POST.map(b => {
          const owned = onShelves(b.title)
          return (
            <label key={b.title} className="choice" data-off={owned || undefined}>
              <input
                type="checkbox"
                disabled={owned}
                checked={picked.includes(b.title)}
                onChange={e => setPicked(e.target.checked ? [...picked, b.title] : picked.filter(t => t !== b.title))}
              />
              <span>
                <span className="choice-title">{b.title}</span>
                <span className="where"> {b.author}{owned ? ', already on your shelves' : ''}</span>
              </span>
            </label>
          )
        })}
      </fieldset>
      <div className="field">
        <label htmlFor="share-source">Source account</label>
        <input id="share-source" value={handle} placeholder="@account" autoComplete="off" onChange={e => setHandle(e.target.value)} />
      </div>
      <p className="where">Adds them to your TBR and to Hardcover{who ? `, with @${who} as the source` : ''}.</p>
      <button type="submit" className="btn btn-solid" disabled={!count}>
        {count ? `Add ${count} ${count === 1 ? 'book' : 'books'} to TBR` : 'Choose a book to add'}
      </button>
    </form>
  )
}

function HowTo() {
  const link = useRef<HTMLAnchorElement>(null)
  // React refuses to render a javascript: address, rightly, so it's set once the link is on the page.
  useEffect(() => { link.current?.setAttribute('href', bookmarklet(window.location.origin)) }, [])
  return (
    <div className="stack">
      <p>Share a Goodreads book, or an Instagram post or reel, to Margin from your phone's share sheet.</p>
      <p>On a computer, drag this to your bookmarks bar, and tap it on the page you want to send:</p>
      <div className="btn-row">
        <a ref={link} className="btn" onClick={e => e.preventDefault()}>Add to Margin</a>
      </div>
    </div>
  )
}

export function Share() {
  const { url, title, text, popup } = useSearch({ from: '/capture/share' })
  const read = readShare({ url, title, text })
  const isPopup = popup === 1
  const nothing = !url && !title && !text

  return (
    <div className="narrow stack">
      <h1 className="title-head">{read.kind === 'instagram' ? 'From a post' : read.kind === 'goodreads' ? 'Add a book' : 'Share to Margin'}</h1>
      <hr className="rule" />
      {read.kind === 'goodreads' && <FromGoodreads title={read.title} author={read.author} popup={isPopup} />}
      {read.kind === 'instagram' && <FromInstagram handle={read.handle} popup={isPopup} />}
      {read.kind === 'other' && (nothing ? <HowTo /> : (
        <div className="box stack">
          <p>Margin can't read books from this link yet. It reads Goodreads book pages, and Instagram posts and reels.</p>
          <div className="btn-row"><Link to="/capture" className="btn">Add it by hand</Link></div>
        </div>
      ))}
    </div>
  )
}
