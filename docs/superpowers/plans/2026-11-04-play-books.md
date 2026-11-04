# Play Books import and review stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Settings button reads Play Books' library and notes docs in the browser; sure books come in, the rest wait in `/review`.

**Architecture:** Google sign-in and the Picker run in the page with a short-lived token. Parsing is pure in
`convex/lib/playbooks.ts`. Entries from any import are saved by one helper, `saveImported`, in `convex/lib/imported.ts`.
Undecided books are rows in `reviewItems`, resolved from `/review`.

**Tech Stack:** Convex, React, TanStack Router, Google Identity Services, Google Picker, Books API v1, Drive API v3, vitest.

**Spec:** `docs/superpowers/specs/2026-11-04-play-books-design.md`

## Global Constraints

- Tests stub `fetch`; never call Google or Hardcover. Fixtures are made up.
- Status only moves forward. Nothing guessed: undecided books go to `/review`.
- Hardcover search 300 ms apart.

## Review Focus

- A doc listing each annotation twice: one entry each.
- A hidden highlight with a note: a plain note at its page.
- A bookmark row (date only): nothing saved.
- Running the import twice: no new entries, no second review card.
- A review card left out: never offered again on re-import.

---

### Task 1: Shared saving and the notes parser
- `saveImported(ctx, userId, readId, origin, items: Imported[])` in `convex/lib/imported.ts`, `Imported = { key: string; text?: string; note?: string; page?: number; percent?: number; chapter?: string; at?: number }`: excerpt from `text` keyed `key`, note under it keyed `key + ':note'`; note-only is a plain note keyed `key`. Returns count added. Kobo's `saveNotes` uses it (its tests stay green).
- `parseNotesDoc(html: string): { title: string; volumeId: string | null; notes: PlayNote[] }`, `PlayNote = { page: number | null; highlight: string; note: string; at: number | null }`, in `convex/lib/playbooks.ts`; colours resolved from the doc's `<style>`; "Highlighted text cannot be displayed" → `highlight: ''`; date-only rows dropped; duplicates dropped.
- `shelfStatus(shelfId: number): 'read' | 'reading' | 'tbr' | null` (4, 3, 2).
- Tests with a made-up doc. Commit.

### Task 2: Server: review items, Play Books notes, Google config
- Schema `reviewItems { userId, source: 'playbooks', sourceId, title, author, isbn?, status?, notes: PlayNote[], state: 'waiting'|'added'|'left', createdAt }` index `by_user_state`, `by_user_source`.
- `convex/playbooks.ts`: `saveNotes({ readId, volumeId, notes })` (auth, via `saveImported`, keys `playbooks:<volumeId>:<page>:<normalised words>`), `queue({ items })` (upsert waiting, skip added/left).
- `convex/review.ts`: `waiting({})`, `count({})`, `leave({ id })`, `added({ id, readId })` (saves the card's notes, marks added).
- `convex/google.ts`: `clientConfig({})` → `{ clientId, apiKey }` (signed in only).
- Tests. Commit.

### Task 3: The Play Books screen, `/review`, Settings
- `src/lib/google.ts`: `googleToken(clientId, scopes): Promise<string>` and `pickDocs(token, apiKey): Promise<string[]>` (loads the scripts once).
- `src/components/settings/PlayBooksImport.tsx`: read shelves, pick docs, export + parse, plan, show, apply.
- `src/components/review/Review.tsx` on `src/routes/review.tsx`.
- Settings: Play Books section and the review count link. Build, lint, test, push. Steve runs it.
