import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../convex/_generated/api'
import { formatDate } from './books'

export type Everything = FunctionReturnType<typeof api.library.exportAll>
type Entry = Everything['entries'][number]

const HEADING: Record<string, string> = { excerpt: 'Excerpt', note: 'Note', summary: 'Summary', reflection: 'Reflection', review: 'Review' }

const quote = (text: string) => text.split('\n').map(line => `> ${line}`).join('\n')

function entryText(e: Entry, children: Entry[]) {
  const label = [HEADING[e.kind] ?? e.kind, e.position].filter(Boolean).join(', ')
  const lines = [`**${label}**`, '']
  if (e.question) lines.push(`*${e.question}*`, '')
  lines.push(e.kind === 'excerpt' ? quote(e.text) : e.text)
  for (const child of children) lines.push('', `Note: ${child.text}`)
  return lines.join('\n')
}

/** Your whole library as readable text: every book, its dates, and everything you wrote about it. */
export function toMarkdown({ books, entries }: Pick<Everything, 'books' | 'entries'>) {
  const sorted = [...books].sort((a, b) => a.title.localeCompare(b.title))
  return sorted.map(book => {
    const own = entries.filter(e => e.readId === book.readId).sort((a, b) => a.createdAt - b.createdAt)
    const facts = [
      `- Author: ${book.author}`,
      `- Status: ${book.status}`,
      book.published && `- Published: ${book.published}`,
      book.pages && `- Pages: ${book.pages}`,
      book.rating && `- Rating: ${book.rating} out of 5`,
      ...book.readings.map(r => `- Read: ${[r.startedAt && formatDate(r.startedAt), r.finishedAt && formatDate(r.finishedAt)].filter(Boolean).join(' to ')}`),
      book.recommendedBy && `- Recommended by: ${book.recommendedBy}`,
    ].filter(Boolean)
    const parts = own.filter(e => !e.parentId || !own.some(p => p.id === e.parentId)).map(e => entryText(e, own.filter(c => c.parentId === e.id)))
    return [`# ${book.title}`, '', ...facts, ...(parts.length ? ['', parts.join('\n\n')] : [])].join('\n')
  }).join('\n\n---\n\n') + '\n'
}

/** Hands a file to the browser to save. */
export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
