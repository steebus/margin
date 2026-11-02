import { Link, useSearch } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { errorText } from '../../lib/books'
import { shrinkPhoto } from '../../lib/photo'
import { bookmarklet, readShare } from '../../lib/share-read'
import { bookLine, ListChoice, type Result } from '../capture/AddBook'

type Candidate = FunctionReturnType<typeof api.share.findTitles>['found'][number]

function Done({ message, popup, slug }: { message: string; popup: boolean; slug?: string }) {
  useEffect(() => {
    if (!popup) return
    const timer = setTimeout(() => window.close(), 1800)
    return () => clearTimeout(timer)
  }, [popup])
  return (
    <div className="box stack" role="status">
      <p className="book-voice">{message}</p>
      {!popup && (
        <div className="btn-row">
          {slug && <Link to="/books/$bookSlug" params={{ bookSlug: slug }} className="btn btn-solid">Open it</Link>}
          <Link to="/shelves/$shelfSlug" params={{ shelfSlug: 'tbr' }} className={slug ? 'btn' : 'btn btn-solid'}>Go to your TBR</Link>
        </div>
      )}
    </div>
  )
}

function FromGoodreads({ url, title, author, popup }: { url: string; title: string; author: string | null; popup: boolean }) {
  const search = useAction(api.books.search)
  const addBooks = useMutation(api.books.addBooks)
  const [results, setResults] = useState<Result[] | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [list, setList] = useState<Id<'shelves'> | ''>('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const chosen = results?.find(r => r.book.hardcoverId === picked)?.book

  useEffect(() => {
    search({ q: [title, author].filter(Boolean).join(' ') })
      .then(found => {
        setResults(found.slice(0, 5))
        setPicked(found[0] && !found[0].onShelves ? found[0].book.hardcoverId : null)
      })
      .catch(e => setError(errorText(e, "The search didn't work. Check your connection and try again.")))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    if (!chosen) return
    setBusy(true)
    setError(null)
    try {
      const [{ slug }] = await addBooks({ books: [chosen], status: 'tbr', ...(list ? { listId: list } : {}), source: { kind: 'other', url } })
      setDone(slug)
    } catch (e) {
      setError(errorText(e, "That didn't save. Check your connection and try again."))
    } finally {
      setBusy(false)
    }
  }

  if (done) return <Done message={`Added ${chosen?.title ?? title} to your TBR.`} popup={popup} slug={done} />
  if (error && !results) return <p role="alert">{error}</p>
  if (!results) return <p role="status">Looking for {title}…</p>
  if (!results.length) {
    return (
      <div className="box stack">
        <p>Hardcover has nothing for "{title}".</p>
        <div className="btn-row"><Link to="/capture/add" search={{ q: title }} className="btn">Search by hand</Link></div>
      </div>
    )
  }
  return (
    <form className="stack" onSubmit={e => { e.preventDefault(); void add() }}>
      <fieldset className="choices">
        <legend className="head">Which one?</legend>
        {results.map(({ book, onShelves }) => (
          <label key={book.hardcoverId} className="choice" data-off={onShelves || undefined}>
            <input type="radio" name="book" disabled={onShelves} checked={picked === book.hardcoverId} onChange={() => setPicked(book.hardcoverId)} />
            <span><span className="choice-title">{book.title}</span><span className="where"> {bookLine(book)}{onShelves ? ', already on your shelves' : ''}</span></span>
          </label>
        ))}
      </fieldset>
      <ListChoice value={list} onChange={setList} />
      <p className="where">Goes on your TBR, and to Hardcover.</p>
      <button type="submit" className="btn btn-solid" disabled={busy || !chosen}>{busy ? 'Adding…' : 'Add to TBR'}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}

function FromPost({ url, code, handle: readHandle, words, popup }: { url: string; code: string; handle: string | null; words: string; popup: boolean }) {
  const readPost = useAction(api.share.readPost)
  const readWords = useAction(api.share.readWords)
  const findTitles = useAction(api.share.findTitles)
  const transcribe = useAction(api.capture.transcribe)
  const addBooks = useMutation(api.books.addBooks)
  const [found, setFound] = useState<Candidate[]>([])
  const [unticked, setUnticked] = useState<number[]>([])
  const [ticked, setTicked] = useState<number[]>([])
  const [missed, setMissed] = useState<string[]>([])
  const [handle, setHandle] = useState(readHandle ?? '')
  const [typed, setTyped] = useState('')
  const [reading, setReading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const take = (result: { found: Candidate[]; missed: string[] }) => {
    setFound(prev => [...prev, ...result.found.filter(c => !prev.some(p => p.book.hardcoverId === c.book.hardcoverId))])
    setMissed(result.missed)
  }
  const reader = async (work: () => Promise<void>) => {
    setReading(true)
    setError(null)
    setNote(null)
    try {
      await work()
    } catch (e) {
      setError(errorText(e, "That didn't work. Check your connection and try again."))
    } finally {
      setReading(false)
    }
  }

  // Words selected on the page travel with the bookmarklet, and are read first (SPEC 3.4.1).
  useEffect(() => {
    void reader(async () => {
      if (words) return take(await readWords({ text: words }))
      const post = await readPost({ code })
      if (post.account) setHandle(h => h || post.account!)
      take(post)
      if (!post.hadWords) setNote("Instagram didn't give Margin any words from this post. A reel's books are often only spoken or on screen, so type the titles or use a screenshot.")
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isPicked = (c: Candidate) => !c.onShelves && (c.ticked ? !unticked.includes(c.book.hardcoverId) : ticked.includes(c.book.hardcoverId))
  const toggle = (c: Candidate, on: boolean) => {
    const id = c.book.hardcoverId
    if (c.ticked) setUnticked(on ? unticked.filter(x => x !== id) : [...unticked, id])
    else setTicked(on ? [...ticked, id] : ticked.filter(x => x !== id))
  }
  const picked = found.filter(isPicked)
  const count = picked.length
  const who = handle.trim().replace(/^@/, '')

  const add = async () => {
    setSaving(true)
    setError(null)
    try {
      await addBooks({ books: picked.map(c => c.book), status: 'tbr', source: { kind: 'social', who: who ? `@${who}` : undefined, url } })
      navigator.vibrate?.(15)
      setDone(`Added ${count} ${count === 1 ? 'book' : 'books'} to your TBR${who ? `, from @${who}` : ''}.`)
    } catch (e) {
      setError(errorText(e, "That didn't save. Check your connection and try again."))
    } finally {
      setSaving(false)
    }
  }

  if (done) return <Done message={done} popup={popup} />
  return (
    <div className="stack">
      {reading && <p role="status">Reading, this can take half a minute…</p>}
      {note && <p>{note}</p>}
      {error && <p role="alert">{error}</p>}

      {found.length > 0 && (
        <form className="stack" onSubmit={e => { e.preventDefault(); if (count) void add() }}>
          <fieldset className="choices">
            <legend className="head">Which ones?</legend>
            {found.map(c => (
              <label key={c.book.hardcoverId} className="choice" data-off={c.onShelves || undefined}>
                <input type="checkbox" disabled={c.onShelves} checked={isPicked(c)} onChange={e => toggle(c, e.target.checked)} />
                <span><span className="choice-title">{c.book.title}</span><span className="where"> {bookLine(c.book)}{c.onShelves ? ', already on your shelves' : ''}</span></span>
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="share-source">Source account</label>
            <input id="share-source" value={handle} placeholder="@account" autoComplete="off" onChange={e => setHandle(e.target.value)} />
          </div>
          <p className="where">Adds them to your TBR and to Hardcover{who ? `, with @${who} as the source` : ''}.</p>
          <button type="submit" className="btn btn-solid" disabled={!count || saving}>
            {saving ? 'Adding…' : count ? `Add ${count} ${count === 1 ? 'book' : 'books'} to TBR` : 'Choose a book to add'}
          </button>
        </form>
      )}

      {missed.length > 0 && <p className="where">Couldn't find: {missed.join(', ')}.</p>}

      {!reading && (
        <form className="stack" onSubmit={e => { e.preventDefault(); if (typed.trim()) void reader(async () => { take(await findTitles({ text: typed })); setTyped('') }) }}>
          <div className="field">
            <label htmlFor="share-typed">{found.length ? 'Any others? Type titles, one a line' : 'Type the titles, one a line'}</label>
            <textarea id="share-typed" rows={3} value={typed} onChange={e => setTyped(e.target.value)} />
          </div>
          <div className="btn-row">
            <button type="submit" className="btn" disabled={!typed.trim()}>Find them</button>
            <label className="btn">
              Use a screenshot
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) void reader(async () => {
                    const page = await transcribe({ image: await shrinkPhoto(file) })
                    if (!page.paragraphs.length) { setNote('No words could be read from that screenshot.'); return }
                    take(await readWords({ text: page.paragraphs.join('\n') }))
                  })
                }}
              />
            </label>
          </div>
        </form>
      )}
    </div>
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
      <div className="btn-row"><Link to="/capture/add" className="btn btn-solid">Search for a book</Link></div>
    </div>
  )
}

export function Share() {
  const { url, title, text, popup } = useSearch({ from: '/capture/share' })
  const read = readShare({ url, title, text })
  const isPopup = popup === 1
  const nothing = !url && !title && !text
  const selected = text?.replace(/https?:\/\/\S+/g, '').trim() ?? ''

  return (
    <div className="narrow stack">
      <h1 className="title-head">{read.kind === 'instagram' ? 'From a post' : read.kind === 'goodreads' ? 'Add a book' : 'Share to Margin'}</h1>
      <hr className="rule" />
      {read.kind === 'goodreads' && <FromGoodreads url={read.url} title={read.title} author={read.author} popup={isPopup} />}
      {read.kind === 'instagram' && <FromPost url={read.url} code={read.code} handle={read.handle} words={selected} popup={isPopup} />}
      {read.kind === 'other' && (nothing ? <HowTo /> : (
        <div className="box stack">
          <p>Margin can't read books from this link yet. It reads Goodreads book pages, and Instagram posts and reels.</p>
          <div className="btn-row"><Link to="/capture/add" className="btn">Search for a book</Link></div>
        </div>
      ))}
    </div>
  )
}
