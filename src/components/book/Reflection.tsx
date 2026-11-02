import { Link } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { errorText } from '../../lib/books'
import { Typewriter } from '../typewriter/Typewriter'

type Prompt = { id: Id<'reflectionPrompts'>; question: string; title?: string; slug?: string }

/** The buddy's question on finishing a book: typed out, answered in the reader's own hand. */
export function Reflection({ prompt }: { prompt: Prompt }) {
  const answer = useMutation(api.reflect.answer)
  const skip = useMutation(api.reflect.skip)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const words = text.trim()

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await answer({ promptId: prompt.id, text: words })
    } catch (e) {
      setError(errorText(e, "That didn't save. Your words are still here: check your connection and try again."))
      setSaving(false)
    }
  }

  return (
    <form className="reflection" onSubmit={e => { e.preventDefault(); if (words) void save() }}>
      {prompt.slug && <p className="where">You finished <Link to="/books/$bookSlug" params={{ bookSlug: prompt.slug }}>{prompt.title}</Link></p>}
      <Typewriter text={prompt.question} />
      <div className="field">
        <label htmlFor={`answer-${prompt.id}`} className="sr-only">Your answer</label>
        <textarea id={`answer-${prompt.id}`} className="hand" rows={4} value={text} placeholder="What you think" onChange={e => setText(e.target.value)} />
      </div>
      <div className="btn-row">
        <button type="submit" className="btn btn-solid" disabled={!words || saving}>{saving ? 'Saving…' : 'Save reflection'}</button>
        <button type="button" className="btn" onClick={() => void skip({ promptId: prompt.id })}>Not this one</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
