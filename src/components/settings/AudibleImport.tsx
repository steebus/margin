import { useAction, useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { planAudible, readAudible, type AudibleBook, type AudiblePlan } from '../../lib/audible'
import { errorText, type Book } from '../../lib/books'
import { useBooks } from '../../lib/offline'

type Choice = 'finish' | 'progress' | 'addFinished' | 'addReading' | 'addUnstarted'
const LABELS: Record<Choice, string> = {
  finish: 'Finished on Audible: mark them read',
  progress: 'Further along on Audible: move them on',
  addFinished: 'Finished, not on your shelves: add them as read',
  addReading: 'Started, not on your shelves: add them as reading',
  addUnstarted: "Never started: add them to your TBR",
}
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Audible has no API, so its library comes in as audible-cli's export. Nothing is written until the reader says so,
 * and everything written goes to Hardcover as usual. Running it again changes nothing new.
 */
export function AudibleImport() {
  const books = useBooks(true)
  const search = useAction(api.books.search)
  const addBooks = useMutation(api.books.addBooks)
  const setStatus = useMutation(api.library.setStatus)
  const logProgress = useMutation(api.library.logProgress)
  const [plan, setPlan] = useState<AudiblePlan<Book> | null>(null)
  const [chosen, setChosen] = useState<Set<Choice>>(new Set(['finish', 'progress', 'addFinished', 'addReading']))
  const [running, setRunning] = useState<string | null>(null)
  const [report, setReport] = useState<{ done: number; missing: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async (file: File) => {
    setError(null)
    setReport(null)
    const audible = readAudible(await file.text())
    if (!audible.length) return setError("That doesn't look like an Audible export. It should be the file audible-cli's library export makes.")
    setPlan(planAudible(audible, books ?? []))
  }

  /** Finds a book on Hardcover and adds it as an audiobook. False if nothing was found. */
  const add = async (a: AudibleBook, status: 'read' | 'reading' | 'tbr') => {
    const found = (await search({ q: `${a.title} ${a.author}` }))[0]
    if (!found) return false
    if (found.onShelves) return true
    const [added] = await addBooks({ books: [found.book], status, format: 'audio', undated: status === 'read' })
    if (status === 'reading' && a.percent > 0) await logProgress({ readId: added.readId, percent: a.percent })
    return true
  }

  const apply = async () => {
    if (!plan) return
    setError(null)
    const missing: string[] = []
    let done = 0
    const steps: [string, () => Promise<boolean>][] = [
      ...(chosen.has('finish') ? plan.finish.map(f => [f.book.title, () => setStatus({ readId: f.book.readId, status: 'read', undated: true }).then(() => true)] as [string, () => Promise<boolean>]) : []),
      ...(chosen.has('progress') ? plan.progress.map(p => [p.book.title, () => logProgress({ readId: p.book.readId, percent: p.audible.percent }).then(() => true)] as [string, () => Promise<boolean>]) : []),
      ...(chosen.has('addFinished') ? plan.addFinished.map(a => [a.title, () => add(a, 'read')] as [string, () => Promise<boolean>]) : []),
      ...(chosen.has('addReading') ? plan.addReading.map(a => [a.title, () => add(a, 'reading')] as [string, () => Promise<boolean>]) : []),
      ...(chosen.has('addUnstarted') ? plan.addUnstarted.map(a => [a.title, () => add(a, 'tbr')] as [string, () => Promise<boolean>]) : []),
    ]
    try {
      for (const [i, [title, step]] of steps.entries()) {
        setRunning(`${i + 1} of ${steps.length}: ${title}`)
        if (await step()) done++
        else missing.push(title)
        await pause(300) // gentle on the book search behind it
      }
      setReport({ done, missing })
      setPlan(null)
    } catch (e) {
      setError(errorText(e, `It stopped after ${done}. Check your connection; running it again carries on from there.`))
    } finally {
      setRunning(null)
    }
  }

  const toggle = (c: Choice) => setChosen(prev => { const next = new Set(prev); if (next.has(c)) next.delete(c); else next.add(c); return next })
  const rows: [Choice, { title: string }[]][] = plan ? [
    ['finish', plan.finish.map(f => f.book)], ['progress', plan.progress.map(p => p.book)],
    ['addFinished', plan.addFinished], ['addReading', plan.addReading], ['addUnstarted', plan.addUnstarted],
  ] : []

  return (
    <div className="stack">
      <p>Audible has no way in for other apps, so your library comes as a file. On a computer, install <a href="https://github.com/mkb79/audible-cli">audible-cli</a>, sign in with <code>audible quickstart</code>, then run <code>audible library export</code> and choose the file it makes here.</p>
      <div className="field">
        <label htmlFor="audible-file">Audible library export</label>
        <input id="audible-file" type="file" accept=".tsv,.csv,.json,text/*,application/json" disabled={!!running || books === undefined} onChange={e => { const f = e.target.files?.[0]; if (f) void load(f) }} />
      </div>

      {plan && (
        <div className="stack">
          <p>{plan.same.toLocaleString('en-GB')} already match. Choose what to change; it all goes to Hardcover too.</p>
          {rows.filter(([, list]) => list.length).map(([c, list]) => (
            <details key={c} className="gaps">
              <summary>
                <label className="check" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={chosen.has(c)} onChange={() => toggle(c)} />
                  {LABELS[c]}
                </label>
                <span className="where">{list.length}</span>
              </summary>
              <ul className="gaps-list">{list.map((b, i) => <li key={i}>{b.title}</li>)}</ul>
            </details>
          ))}
          <div className="btn-row">
            <button type="button" className="btn btn-solid" disabled={!!running || !rows.some(([c, list]) => chosen.has(c) && list.length)} onClick={() => void apply()}>Make these changes</button>
          </div>
        </div>
      )}
      {running && <p role="status">{running}</p>}
      {report && (
        <p role="status">
          Done: {report.done.toLocaleString('en-GB')} changed.
          {report.missing.length > 0 && ` Not found on Hardcover, so left out: ${report.missing.join('; ')}.`}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
