import type { ReactNode } from 'react'

/** The shared empty state: an index card with one line ruled on it, a few books leaning on a shelf, a heading and a
 *  way forward. For a screen that has nothing to show yet and something the reader can do about it. */
export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="empty stack" aria-label={title}>
      <svg className="empty-shelf" viewBox="0 0 96 40" aria-hidden="true" focusable="false">
        <g fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 36h88" />
          <path d="M16 36V10h9v26M25 36V16h8v20" />
          <path d="M44 36 52 9l8 2-7 25" className="empty-lean" />
          <path d="M70 36V20h9v16" strokeDasharray="2 4" />
        </g>
      </svg>
      <h2 className="head empty-title">{title}</h2>
      <p>{children}</p>
      {action && <div className="btn-row">{action}</div>}
    </section>
  )
}
