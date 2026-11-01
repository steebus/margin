# Margin: plan (draft 1)

Each phase ends with something usable that is deployed. The order puts the
riskiest unknowns (does the buddy feel good? does capture work on Steve's
phone?) early, before the import plumbing.

## Phase 0: Foundations (≈ 2–3 sessions)
- Vite + React + TS + TanStack Router, Convex, Convex Auth with Google, deployed
  to Vercel from `main` with Convex deploy keys
- Lint, typecheck and vitest; CI on push; a `CLAUDE.md` for this repo
- Install impeccable and run its context setup to produce `PRODUCT.md` and
  `DESIGN.md` from `DESIGN-DIRECTION.md`
- Tokens, the three type voices, and paper and dark-desk themes
- Route tree and URL conventions (SPEC §4.1) scaffolded with placeholder
  pages, plus the View Transition and Motion setup
- **Spike:** the typewriter component (typing, carriage return, page feed,
  reduced motion). It is the brand, so it gets built first.
- PWA shell: manifest, install, offline shell

## Phase 1: Library and entries
- Book search (Hardcover → Open Library → Google Books), add with status and
  source
- Shelves, tags, progress logging, re-reads
- Entries: excerpt, note, summary, with position; a note attached to an excerpt
- People (recommenders), half-star ratings, author facts
- Desk: current book with actions, the latest-note space, the drawer
- Book page: library card, margin view of entries
- Shelf view and table view with filter and sort

## Phase 2: The buddy (core bet)
- Research workflow, which produces a cached guide (with eval fixtures: 10
  books Steve knows well, scored for accuracy and spoiler safety)
- Milestones, then the buddy queue, then typed delivery
- A conversation thread per read; Socratic tutor persona; corrections and
  overrides
- Memory: embeddings + search indexes on entries, rolling book, topic and
  profile summaries, and the buddy tool layer with `visibleTo`
  (SPEC §3.8)
- Web Push for absence and delay nudges
- Spoiler filter as a pure, tested function: `guideUpTo(position)`
- Cost meter and caps

## Phase 3: Capture
- Camera, then vision OCR, then the typed page, then highlight to excerpt plus
  a note
- Android share target; token capture endpoint
- LLM routing (which book, which kind) with an undo toast

## Phase 4: Hardcover two-way
- Token connect, full pull, matching and the review queue
- Push status, progress, rating and date changes, plus quotes and notes to
  the reading journal (per-entry toggle, default on); cron pull; per-field
  conflict rule

## Phase 5: Backfill imports
- Kindle `My Clippings.txt` and notebook export,
  `KoboReader.sqlite`, Play Books (Books API + Drive notes via Picker)
- Import jobs with progress, dedupe, and a report ("412 books, 3,180
  highlights, 27 need a look")

## Phase 6: Knowledge graph and explore
- Topic extraction from guides and entries; facets; reader confirmation; merge
  via embeddings
- Topic pages, the force graph, connective prompts back into the buddy

## Phase 7: Data viz and delight
- The stats sheet (charts per the dataviz rules), smart shelves
- Impeccable polish and delight passes; sound; spine rendering; library-card
  stamps

## Risks
| Risk | Mitigation |
|---|---|
| The LLM misplaces events or invents content for less-known books | `knownness` score, confidence per moment, generic fallback, reader corrections, eval set |
| Liberal animation hurts performance on mid-range Android | animate only transform and opacity; a 60fps budget checked in a Playwright trace on a throttled CPU; typewriter rendered to one text node per line, not per character in the DOM |
| Spoilers | data-level filter before the model sees anything; the buddy can't see past the reader's position |
| Amazon and Kobo have no APIs | file-based imports; scraping only as an opt-in bookmarklet |
| `drive.readonly` is a restricted Google scope | use `drive.file` + Picker; keep the OAuth app in testing mode while it's personal |
| LLM cost when backfilling hundreds of books | no guides for finished books; topics come from metadata + a cheap model in batch |
