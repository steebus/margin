import { Link } from '@tanstack/react-router'
import { Camera, Check, MessageCircle, PenLine, Quote } from 'lucide-react'
import type { Book } from '../../lib/books'

/** What you do with a book: on the Desk for the current one, and on every book's page. */
export function QuickActions({ book, logging, onLog }: { book: Book; logging: boolean; onLog: () => void }) {
  return (
    <div className="actions">
      {book.status !== 'read' && (
        <button type="button" className="action" aria-expanded={logging} onClick={onLog}>
          <Check aria-hidden="true" strokeWidth={2.25} />Log progress
        </button>
      )}
      <Link to="/capture" search={{ book: book.slug, kind: 'excerpt' }} className="action"><Quote aria-hidden="true" strokeWidth={2.25} />Add excerpt</Link>
      <Link to="/capture/camera" className="action action-camera"><Camera aria-hidden="true" strokeWidth={2.25} />Camera</Link>
      <Link to="/capture" search={{ book: book.slug, kind: 'note' }} className="action"><PenLine aria-hidden="true" strokeWidth={2.25} />Add note</Link>
      <Link to="/books/$bookSlug/buddy" params={{ bookSlug: book.slug }} className="action"><MessageCircle aria-hidden="true" strokeWidth={2.25} />Talk</Link>
    </div>
  )
}
