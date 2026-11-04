# Margin: build plan (v1)

How Margin gets built, in order. `SPEC.md` says what it is and
`DESIGN-DIRECTION.md` what it looks like. Each phase ends deployed and usable
on Steve's phone, and has a **Done when** checklist. Phases run in order; the
tasks inside a phase can overlap.

The order puts the riskiest unknowns first: does it look and feel like
Margin, and does the buddy feel good? The import plumbing comes later.

---

## Before Phase 0: accounts and keys (Steve, ~30 min)

| Need | Where | Becomes |
|---|---|---|
| Convex project, production only (Steve, 2026-11-02) | dashboard.convex.dev | `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, deploy key for Vercel |
| Vercel project linked to `steebus/margin` | vercel.com | production deploys from `main` |
| Google Cloud OAuth client (web), app in *testing* mode, Steve as test user | console.cloud.google.com | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (Convex env) |
| Anthropic API key | console.anthropic.com | `ANTHROPIC_API_KEY` (Convex env) |
| Hardcover API token (Phase 1) | hardcover.app → Settings → API | pasted in-app, encrypted at rest |
| Gemini API key, with billing on (Phase 1) | aistudio.google.com | `GEMINI_API_KEY` (Convex env) |
| VAPID key pair (Phase 2 push) | `npx web-push generate-vapid-keys` | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| Google Books API + Picker enabled on the same GCP project (Phase 5) | GCP console | same OAuth client + `VITE_GOOGLE_API_KEY` |

Secrets live in Convex env vars, never in the client bundle; anything prefixed
`VITE_` is public. For local scripts they sit in the gitignored `.env`. The repo is public.

## Repo layout

```
margin/
  src/
    routes/          TanStack Router file routes (SPEC §4.1)
    components/      UI, one folder per object (desk/, shelf/, thumb/, typewriter/ …)
    lib/             logic: parsers, cover drawing, theme, drawer rules (unit-tested)
    sample/          demonstration data, until Phase 1 replaces it
    styles/          tokens.css (both themes), app.css
    motion/, sw/     added when there's a second user of a spring, and with the PWA
  convex/
    schema.ts
    library/ entries/ buddy/ capture/ graph/ imports/ integrations/ push/
    lib/             visibleTo, guideUpTo, matching, dedupe (unit-tested)
  docs/              SPEC, PLAN, DESIGN-DIRECTION
  PRODUCT.md, DESIGN.md, CLAUDE.md
```

## Working conventions
- Work lands on `main`; push after each finished piece of work. Vercel and
  Convex deploy from `main`.
- Before every push: `npm run lint && npm run typecheck && npm test`, plus
  `npm run build` when the change could break the build.
- Pure logic (spoiler rule, slugs, parsers, matching) lives in `lib/` with
  vitest tests. Convex functions get `convex-test` tests where they hold
  rules.
- Every surface gets an impeccable critique pass before it's called done. A
  visible design change is shown to Steve before it ships.
- The design mockups are references, treated as 80% targets for now (Steve,
  2026-11-02). Match their character; they aren't measured specs.
- Every animation ships with its reduced-motion version in the same commit.

---

## Phase 0: Look, feel and skeleton (2–3 sessions)

**Goal:** an installable, empty Margin that already looks and moves like
itself.

1. **Scaffold.**
   - Vite + React 19 + TS (strict), oxlint, vitest
   - TanStack Router (file-based, with zod search params)
   - Convex, with Convex Auth and the Google provider
   - GitHub Actions CI running lint, typecheck, test and build
   - Vercel connected; the Convex deploy runs inside the Vercel build
2. **CLAUDE.md** for the repo: the conventions above, where work goes, and
   the deploy check.
3. **Impeccable.** Used as the installed plugin.
   - Run its context setup against `DESIGN-DIRECTION.md` to produce
     `PRODUCT.md` and `DESIGN.md`.
   - Let it choose the four typefaces (book serif, typewriter, hand, UI) and
     the palette for both themes.
4. **Tokens.**
   - `tokens.css` holds colour, type ramp, spacing, radii, shadows,
     durations and springs.
   - Daylight and desk-at-night themes follow the system setting, with a
     manual toggle.
   - Self-hosted fonts.
5. **Typewriter spike** (`components/typewriter`):
   - Text is typed one character at a time with per-glyph ink and baseline
     jitter.
   - A carriage return at line end, and the sheet feeds up and scrolls into
     view.
   - Tap to finish instantly; optional sound; a designed reduced-motion
     path.
   - One element per glyph, for the uneven ink, with finished lines left alone. Must
     hold 60fps on a throttled CPU; render lines to canvas if the trace says otherwise.
6. **Routes.**
   - The full route tree from SPEC §4.1 as placeholder sheets
   - The bottom tab bar (Desk · Shelves · Capture · Explore)
   - Sheets as routes, closed with Back
   - View Transitions between routes, plus one shared-element demo (card →
     page)
7. **PWA.**
   - Manifest with icons, theme colour and standalone display
   - Service worker (vite-plugin-pwa, injectManifest) for the offline shell
     and the install prompt
   - Safe-area insets

**Done when:**
- [ ] Signing in with Google works on the deployed URL.
- [ ] It installs on Steve's Android phone and opens standalone.
- [ ] Every route in §4.1 resolves, and Back closes sheets.
- [ ] The typewriter types a sample buddy note on the Desk at 60fps on a 4×
  throttled CPU, with reduced motion verified.
- [ ] `DESIGN.md` and `PRODUCT.md` exist and Steve has approved the look.

## Phase 1: Library and entries (3–4 sessions)

**Goal:** Margin replaces wherever Steve keeps his reading today.

1. **Schema.** The tables are `works`, `authors`, `reads`, `progressLog`,
   `entries`, `shelves`, `tags`, `people`. Every row carries a `userId`.
2. **Book search and add.**
   - Search Hardcover, then Open Library, then Google Books, merged and
     de-duplicated by ISBN.
   - Adding a book takes status, format and source (kind, who → `people`,
     URL, why, date).
3. **Reads.**
   - Statuses, dates, half-star rating
   - Progress by percent, page or chapter, written to `progressLog`
   - A re-read creates a new read on the same work
4. **Entries.**
   - Kinds: excerpt, note, summary, reflection
   - Each has a position and can have a parent excerpt
   - Markdown-lite editor; offline outbox in IndexedDB
5. **Desk.** Current book stack and actions, the latest-note space, the
   drawer (random entry weighted toward ones not seen in a while).
6. **Book page.** Library-card history stamps; the margin view of entries
   (excerpts in the book serif with the highlighter wash, notes in hand
   beside them).
7. **Shelves.**
   - Three views: spines, grid, table
   - Filter and sort through URL params
   - Smart shelves saved from a filter
   - Virtualised to 2,000 books
8. **People pages.** Each recommender's page lists what came from them and
   how it rated.
9. **Export.** Full JSON, plus Markdown per book.
10. **Cover art** (SPEC §3.11). `workArt`, scene selection with a small text
    model, a Gemini action with post-processing, batch jobs, reject and regenerate.
11. **Adding books by sharing** (SPEC §3.4.1).
    - The manifest's `share_target` and the bookmarklet both open `/capture/share`.
    - Goodreads: confirm one book, choose a list, TBR by default.
    - Instagram: the caption and account from the embed page, the small model lists
      the books, and a checklist adds them to the TBR with the account as source.
    - Each added book goes to Hardcover straight away, ahead of the sync in Phase 4.

**Done when:**
- [ ] Steve has logged his current books and TBR from the phone.
- [ ] Sharing an Instagram post from the phone adds its books to the TBR, with
  the account as source, and they appear on Hardcover.
- [ ] Every book shows generated art, or its cross-hatch while that's on the way.
- [ ] An excerpt with a note attached shows correctly in the margin view.
- [ ] Shelf filters survive a reload and a shared link.
- [ ] Entries written offline sync when the connection returns.
- [ ] Unit tests cover slugs, position maths, the filter grammar and drawer
  weighting.

## Phase 2: The buddy (4–5 sessions, the core bet)

**Goal:** reading a book with Margin feels like having a tutor in the margin.

1. **Guide workflow** (Convex Workflow component):
   - Steps: research with web search → structure → themes → moments →
     question bank → knownness.
   - Uses the most capable model; cached per work, with a version number.
2. **Eval set.**
   - Ten books Steve knows well.
   - A script scores each guide for position accuracy and for spoiler safety
     at five positions.
   - Run on every change to the guide prompt.
3. **Spoiler rule.**
   - `guideUpTo(position)` and `visibleTo(read)` are pure functions in
     `convex/lib`, with exhaustive tests.
   - Finished books and re-reads are fully visible.
4. **Milestones.** Each progress write checks for crossings and enqueues to
   `buddyQueue`. The book shows a typed buddy note when opened. Snooze and
   pass are available.
5. **Conversation.**
   - Socratic tutor persona on the mid-tier model, with streaming replies.
   - The context pack is prompt-cached.
   - Tools: `search_entries`, `get_book`, `list_books`, `get_topic`,
     `related_topics`, `get_guide`, `get_thread`.
   - Citations render as entry cards.
6. **Memory.**
   - A full-text index on entries first. Gemini embeddings added only if keyword search visibly misses things
     (Steve, 2026-11-02: Gemini rather than Voyage, and calls go to each provider directly, not through Vercel's AI Gateway).
   - Hybrid search with reciprocal rank fusion.
   - The small model writes rolling book, topic and profile summaries after
     each session.
   - Re-reads see the earlier reads' memory.
7. **Corrections.** "Hasn't happened yet" and "wrong for my edition" are
   stored as overrides for that read.
8. **Push.**
   - Web Push with VAPID, subscribed from Settings.
   - A daily cron checks for 7 days with no progress, 3 days with an
     unanswered note, and a review-queue backlog.
   - One push a day at most, with quiet hours.
9. **Cost meter.**
   - Tokens are logged per call.
   - Monthly spend is shown in Settings, with an alert at $20.

**Done when:**
- [ ] Steve has finished a real book with the buddy and wants to keep using
  it. This is the gate for the whole project.
- [ ] Zero spoilers across the eval set at every tested position.
- [ ] The buddy correctly cites a note from a different book in conversation.
- [ ] A push arrives after a simulated 7-day gap.

## Phase 3: Capture (done 2026-11-04)

Rethought on 2026-11-04 (Steve): photo-to-text is done in another app (Google Lens, the phone's own text
grab), and the text is shared to Margin. Margin doesn't read photos itself.

1. **Share text in.** Text shared to Margin (`share_target` or the bookmarklet, via `/capture/share`) opens
   the ordinary capture form at `/capture`, filled in, the same form as a typed quote.
   - It's always an excerpt. An optional note can go with it, saved under it in the same write
     (`addEntry`'s `note`), so it survives the offline outbox.
   - The book starts on the latest one: the book being read with the most recent progress or entry
     (`library.latestRead`), unless the shared words name a book on the shelves. The list shows books
     being read first, then everything else.
   - A page in the shared words fills in the page field.

**Dropped on 2026-11-04, don't build:** the in-app camera (Gemini transcription and the Tesseract
fallback, both removed), the Instagram screenshot reader, guessing Kindle and Play Books share formats beyond the "Title by Author" line `readWords` already reads,
the small model choosing the book with an undo toast, and the HTTP capture endpoint for scripts.
Phase 5's Kobo file import is separate and still planned; Kindle imports were dropped too.

## Phase 4: Hardcover two-way (done 2026-11-04)

Built early, on 2026-11-02, because Steve wanted it tight (SPEC §3.5). Lists sync both ways and author facts
come in. Steve called it done on 2026-11-04, having seen Margin's changes reach Hardcover.

**Changed 2026-11-04:** the token stays in the Convex env (`HARDCOVER_API_KEY`); pasting it in-app was dropped,
since Margin has one reader. The `/review` queue moved to Phase 5, where the first weak matches come from.

1. **Connect.** The token in the Convex env.
2. **Full pull.** Library, statuses, dates, ratings, progress, lists and
   reading journal.
3. **Matching.** ISBN, then a Hardcover id, then a fuzzy title+author match.
   Hardcover's own books always carry their id, so nothing here is weak.
4. **Push.** Status, progress, rating and dates go up on change. Quotes and
   notes go up as journal entries, controlled by a per-entry toggle (default
   on).
5. **Sync.**
   - A cron pull every 2 minutes, and changes pushed within seconds.
   - Conflicts: the newest timestamp wins, per field.
   - Margin owns entries.
   - Author facts (gender, nationality) are pulled into `authors`.

**Done when:**
- [x] Changes made in Margin appear on Hardcover (Steve, 2026-11-04).
- [ ] Progress logged on Hardcover appears in Margin within 2 minutes. Not checked yet.
- [ ] A re-pull creates no duplicates. Not checked yet.

## Phase 5: Backfill imports (2–3 sessions)

Kindle imports were dropped on 2026-11-04 (Steve): don't build them.

1. **Import jobs.** Upload, then parse, then match, then dedupe, then a
   report ("412 books, 3,180 highlights, 27 need a look"). Resumable.
   Parsers are tested against real samples.
2. **Review queue** (moved from Phase 4). Weak matches from an import go to
   the `/review` card stack instead of being guessed. Built 2026-11-04 for
   Play Books (one card at a time, buttons for now); Kobo chooses its unsure
   books on its own page.
3. **Kobo** (built 2026-11-04, `docs/superpowers/specs/2026-11-04-kobo-pull-design.md`). No `KoboReader.sqlite`:
   Steve's notes are cloud-synced. A bookmarklet on My Books sends the book list to `/settings/integrations/kobo`,
   which matches, adds and links books (unsure ones are chosen there). The server pulls each linked book's
   annotations with Steve's pasted cookie, from Settings and daily at 19:00 UTC (5am Brisbane). Kobo's library page refuses
   servers (a bot check), so the list can't be pulled on the server.
4. **Play Books** (built 2026-11-04, `docs/superpowers/specs/2026-11-04-play-books-design.md`). A Settings button,
   in the browser: Google's token client for `books` and `drive.file`, the Books API for shelves, and the Picker for
   the "Notes from" docs, read from Drive's HTML export. Books it can't place (unknown status, or no clear Hardcover
   match) wait in `/review`. No daily pull: Steve presses the button.
5. **Backfill rule.** No guides or buddy notes for finished books. Topics
   come from a cheap batch job.

**Done when:** Steve's Kobo and Play Books history is in, and
re-running each import adds nothing.

## Phase 6: Knowledge graph and explore (2–3 sessions)

1. **Topic extraction** from guides, entries and metadata. Facets as in
   SPEC §3.6. Suggested topics need the reader's confirmation; near
   duplicates are merged by embedding.
2. **Topic pages.** Books, entries, and the topic memory: how Steve's
   thinking moved over time.
3. **`/explore`.** The force graph, with focus and depth set in the URL;
   focusing a topic pulls its books in.
4. **Connective prompts.** The buddy can say "this echoes X", drawing from
   the graph.
5. **"Ask your library".** A box on top of the same tool layer.

**Done when:** "show me everything about ergodic texts" returns books,
excerpts and notes, and the graph renders Steve's full library smoothly on
the phone.

## Phase 7: Data and delight (2 sessions)

1. **`/stats`.**
   - Charts built to the dataviz rules: pages and books over time, status
     flow and TBR age, which sources and people lead to the best books,
     topics over time, ratings, format mix, time to finish, author facts.
2. **Delight.**
   - Impeccable's delight, animate and polish passes on every surface
   - Spine rendering from cover colour and page count
   - Library-card stamps, swinging tags, typewriter sound
3. **Audit.** An impeccable audit, a Lighthouse pass (PWA, a11y, perf) and a
   reduced-motion sweep.

**Done when:** every surface has passed critique, Lighthouse scores 90+ for
a11y and performance on mobile, and Steve has nothing left that annoys him.

## Held for after the build (Steve, 2026-11-03)

- **Pile:** thinner books; on a phone, unfurl summaries only in the middle area to save space. Not loving the book style.
- **Missing data:** built 2026-11-03 as Missing details on /stats.
- **Grouping:** note, quote and progress are similar actions and could sit together.
- **Audible sync:** built 2026-11-03 as an import of audible-cli's export in Settings (Audible has no API). It shows what would change, then marks finished books read without a made-up date, moves progress on, and adds missing audiobooks through Hardcover search. Re-running it changes nothing new.

---

## Risks

| Risk | Mitigation |
|---|---|
| The LLM misplaces events or invents content for less-known books | `knownness` score, confidence per moment, generic fallback, reader corrections, eval set run on every prompt change |
| Spoilers | data-level `guideUpTo` and `visibleTo` before the model sees anything; tested exhaustively |
| Liberal animation hurts performance on mid-range Android | animate only transform and opacity; trace on a 4× throttled CPU; one text node per typewriter line |
| Amazon and Kobo have no APIs | file-based imports only |
| `drive.readonly` is a restricted Google scope | `drive.file` + Picker; keep the OAuth app in testing mode while it's personal |
| LLM cost on backfill | no guides for finished books; topics from metadata and a cheap batch model; a $20 alert |
| Hardcover API changes (it's in beta) | one client module behind an interface, with recorded fixtures in tests |
| Convex isn't offline-first | a small IndexedDB outbox for entry and progress writes only; everything else needs a connection |
