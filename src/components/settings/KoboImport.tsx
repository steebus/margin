import { Link } from '@tanstack/react-router'
import { useAction, useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { sameBook } from '../../../convex/lib/match'
import { errorText, type Book } from '../../lib/books'
import { planKobo, readKoboFragment, type KoboPlan } from '../../lib/kobo'
import { useBooks } from '../../lib/offline'

type Hit = FunctionReturnType<typeof api.books.search>[number]
type Adding = KoboPlan<Book>['add'][number]
type Found = { add: Adding; hits: Hit[]; sure: boolean }
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Kobo's book list, sent by the bookmarklet in the address's fragment. Books are matched to the shelves, missing ones
 * found on Hardcover, and each is linked to its Kobo id so the server can pull its notes. Nothing is written until the
 * reader says so, and it all goes to Hardcover as usual.
 */
export function KoboImport() {
  const books = useBooks()
  const search = useAction(api.books.search)
  const addBooks = useMutation(api.books.addBooks)
  const setStatus = useMutation(api.library.setStatus)
  const logProgress = useMutation(api.library.logProgress)
  const link = useMutation(api.kobo.link)
  const pull = useAction(api.kobo.pull)
  const [sent] = useState(() => readKoboFragment(window.location.hash))
  const [found, setFound] = useState<Found[] | null>(null)
  // For each unsure book: the Hardcover id picked, or 0 to leave it out.
  const [picked, setPicked] = useState<Record<number, number>>({})
  const [running, setRunning] = useState<string | null>(null)
  const [report, setReport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const plan = sent && books ? planKobo(sent, books) : null

  // The list is in the address only to get here: take it out so it isn't kept in history.
  useEffect(() => { if (window.location.hash) history.replaceState(null, '', window.location.pathname) }, [])

  useEffect(() => {
    if (!plan || found) return
    void (async () => {
      const out: Found[] = []
      try {
        for (const [i, add] of plan.add.entries()) {
          setRunning(`Looking on Hardcover, ${i + 1} of ${plan.add.length}: ${add.kobo.title}`)
          const hits = (await search({ q: `${add.kobo.title} ${add.kobo.author.split(',')[0]}` })).slice(0, 5)
          out.push({ add, hits, sure: !!hits[0] && sameBook({ title: hits[0].book.title, author: hits[0].book.authors[0] ?? '' }, add.kobo) })
          await pause(300)
        }
        setFound(out)
      } catch (e) {
        setError(errorText(e, "Hardcover's search didn't answer. Check your connection and reload."))
      } finally {
        setRunning(null)
      }
    })()
  }, [plan === null]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!sent) {
    return (
      <div className="box stack">
        <p>Nothing came from Kobo. Open My Books on kobo.com and tap the bookmarklet from Settings.</p>
        <div className="btn-row"><Link to="/settings" className="btn">Go to Settings</Link></div>
      </div>
    )
  }
  if (!plan) return <p role="status">Opening your shelves…</p>

  const apply = async () => {
    if (!found) return
    setError(null)
    const links: { readId: Id<'reads'>; koboId: string }[] = plan.link.map(l => ({ readId: l.book.readId as Id<'reads'>, koboId: l.koboId }))
    let changed = 0
    try {
      for (const b of plan.finish) { setRunning(`Marking read: ${b.title}`); await setStatus({ readId: b.readId, status: 'read', undated: true }); changed++ }
      for (const p of plan.progress) { setRunning(`Moving on: ${p.book.title}`); await logProgress({ readId: p.book.readId, percent: p.percent }); changed++ }
      for (const [i, f] of found.entries()) {
        const hit = f.sure && picked[i] === undefined ? f.hits[0] : f.hits.find(h => h.book.hardcoverId === picked[i])
        if (!hit) continue
        setRunning(`Adding: ${f.add.kobo.title}`)
        const [added] = await addBooks({ books: [hit.book], status: f.add.status, format: 'ebook', undated: f.add.status === 'read' })
        if (f.add.status === 'reading' && f.add.percent > 0) await logProgress({ readId: added.readId, percent: f.add.percent })
        if (f.add.kobo.koboId) links.push({ readId: added.readId, koboId: f.add.kobo.koboId })
        changed++
        await pause(300)
      }
      setRunning('Linking books to Kobo')
      await link({ links })
      setRunning('Pulling notes from Kobo')
      const pulled = await pull({})
      setFound([])
      setReport(`${changed} ${changed === 1 ? 'book' : 'books'} changed or added, ${links.length} linked to Kobo, ${pulled.highlights} new highlights and notes.${pulled.error ? ` ${pulled.error}` : ''}`)
    } catch (e) {
      setError(errorText(e, `It stopped after ${changed}. Check your connection; running the bookmarklet again carries on from there.`))
    } finally {
      setRunning(null)
    }
  }

  const sure = found?.filter(f => f.sure) ?? []
  const unsure = found?.map((f, i) => ({ f, i })).filter(({ f }) => !f.sure) ?? []

  return (
    <div className="stack">
      {report ? <p role="status" className="book-voice">{report}</p> : (
        <>
          <p>{sent.length} books on Kobo{plan.skipped ? `, ${plan.skipped} of them not bought (left out)` : ''}. Everything here goes to Hardcover too.</p>
          <ul className="gaps-list">
            {plan.link.length > 0 && <li>{plan.link.length} already on your shelves, to link to Kobo</li>}
            {plan.finish.length > 0 && <li>Finished on Kobo, to mark read: {plan.finish.map(b => b.title).join('; ')}</li>}
            {plan.progress.length > 0 && <li>Further along on Kobo, to move on: {plan.progress.map(p => `${p.book.title} (${p.percent}%)`).join('; ')}</li>}
            {sure.length > 0 && <li>Not on your shelves, to add: {sure.map(f => f.add.kobo.title).join('; ')}</li>}
          </ul>
          {unsure.length > 0 && (
            <div className="stack">
              <h3 className="head">Check these</h3>
              {unsure.map(({ f, i }) => (
                <fieldset key={i} className="stack">
                  <legend>{f.add.kobo.title}{f.add.kobo.author ? `, ${f.add.kobo.author}` : ''}</legend>
                  {f.hits.map(h => (
                    <label key={h.book.hardcoverId} className="check">
                      <input type="radio" name={`kobo-${i}`} checked={picked[i] === h.book.hardcoverId} onChange={() => setPicked(p => ({ ...p, [i]: h.book.hardcoverId }))} />
                      {h.book.title}, {h.book.authors.join(', ') || 'unknown author'}{h.book.year ? ` (${h.book.year})` : ''}
                    </label>
                  ))}
                  <label className="check">
                    <input type="radio" name={`kobo-${i}`} checked={!picked[i]} onChange={() => setPicked(p => ({ ...p, [i]: 0 }))} />
                    {f.hits.length ? 'None of these: leave it out' : 'Nothing found on Hardcover: leave it out'}
                  </label>
                </fieldset>
              ))}
            </div>
          )}
          <div className="btn-row">
            <button type="button" className="btn btn-solid" disabled={!found || !!running} onClick={() => void apply()}>Make these changes</button>
          </div>
        </>
      )}
      {running && <p role="status">{running}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
