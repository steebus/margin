import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex-helpers/react/cache/hooks'
import { Waypoints } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'

/** Every topic on the shelves, most books first, with a filter for the long tail. */
export function TopicList() {
  const topics = useQuery(api.topics.list)
  const [words, setWords] = useState('')
  const shown = (topics ?? []).filter(t => t.name.toLowerCase().includes(words.trim().toLowerCase()))

  return (
    <div className="narrow stack">
      <h1 className="title-head">Topics</h1>
      <div className="tools-top">
        <label className="tools-search">
          <span className="sr-only">Find a topic</span>
          <input type="search" value={words} placeholder="Find a topic" onChange={e => setWords(e.target.value)} />
        </label>
        <Link to="/explore" className="btn"><Waypoints aria-hidden="true" strokeWidth={2.25} />Explore</Link>
      </div>
      <hr className="rule" />
      {topics === undefined && <p role="status">Gathering topics…</p>}
      {topics?.length === 0 && <p>No topics yet. They come from Hardcover's genres and tags on your books, and from the tags on your notes.</p>}
      {topics && topics.length > 0 && shown.length === 0 && <p>No topic matches that.</p>}
      <ul className="topic-index">
        {shown.map(t => (
          <li key={t.slug}>
            <Link to="/topics/$topicSlug" params={{ topicSlug: t.slug }}>
              <span className="topic-name">{t.name}</span>
              <span className="topic-count">{t.books}{t.notes > 0 && <> · {t.notes} {t.notes === 1 ? 'note' : 'notes'}</>}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
