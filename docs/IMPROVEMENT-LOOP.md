# Margin: continuous improvement loop

A standing backlog and the rules for working through it, one small piece per run. `SPEC.md` says what Margin
is, `PLAN.md` how it was built; this file is what to make better next, and how an unattended run does it safely.

Started 2026-11-10 from a read of the whole codebase at `5e210e8`. The first backlog came from reading code, the
build output and the tests, not from the running app, and items say how sure they are. Since then there is fixture
mode (§1a), so a run can look at every screen on a made-up library. It still can't see Steve's real one.

---

## 1. How a run works

Each run does one cycle, then stops. A run is small on purpose: one item, or two that touch the same code.

1. **Read** `CLAUDE.md`, this file, and the parts of `SPEC.md` / `DESIGN.md` the chosen item touches.
2. **Check the ground.** `git log` since the last entry in §6, and CI and the Vercel deploy for the last commit
   on `main`. If either is red, fixing that is the whole run (Steve, 2026-11-10: a failed build is picked up by
   the next run). Revert the commit that broke it if the fix isn't obvious within the run.
3. **Assess** (10 minutes, not the whole run). Look at one area with fresh eyes, rotating through §4's themes in
   order (the last one assessed is in §6). Add what you find to the backlog with evidence. Re-check one existing
   item against the code: if it's fixed, stale or wrong, say so and move it to §7.
4. **Choose** the top item by §3 that is `ready`, fits the run, and is inside §2's limits. Prefer finishing a
   started item over starting one.
5. **Do it.** Reproduce a bug in a test before fixing it. Logic goes in `src/lib/` or `convex/lib/` with its
   test. Keep the change to what the item needs.
6. **Verify.** `npm run lint`, `npm test`, `npm run build`, all green. For anything visible, look at it in
   fixture mode (§1a) before and after, phone and desktop, both themes, and read the shots: don't only count them.
7. **Update this file** in the same change: the item's status, §6's log, anything learned, new items found on
   the way. A run that changes code and not this file isn't finished.
8. **Hand over** as §2 says, and stop. End with a short report: what changed, how it was checked, what it couldn't
   check, and anything Steve should look at on his phone.

If nothing is `ready` and safe, the run only assesses, updates the plan, and says what it needs from Steve.

**Schedule (Steve, 2026-11-10):** one agent every four hours, never two at once. *Steve, 2026-11-10: hourly is fine
(run 10 found it firing hourly; commits at :37 every hour).* The "every fourth run" and "one class D a day" counts are
per run, so they come round faster.

**Suggested instruction for the scheduled job:** "Read `docs/IMPROVEMENT-LOOP.md` in `steebus/margin` and do one
run exactly as §1 describes, inside §2's limits. Finish by telling me what changed, what you verified and how,
and what you need from me."

### 1a. Fixture mode: how a run looks at the app

```
npm run fixtures                     # writes the made-up library, then serves Margin on it at localhost:5173
node scripts/fixture-shots.mjs       # every screen, phone and desktop, both themes, into fixture-shots/
```

- No sign-in, no Convex, no Hardcover. `fixtures/library.ts` is an invented library (42 books in every status, a
  very long title, a book with no author, audiobooks, a re-read, half stars, a 1,500-character excerpt, a buddy
  conversation, a waiting reflection, a failed sync). `fixtures/generate.test.ts` seeds it into an in-memory
  database and asks Margin's **real queries** for each screen's answer, so the fixtures can't drift from what the
  server returns. It runs in `npm test` too, where it fails if the seed breaks the schema or a query throws.
- `src/fixtures/backend.tsx` stands in for the Convex client. Writes are accepted and forgotten, except a screen's
  own optimistic update, which shows. Actions that would reach a real service refuse.
- `?fixture=empty` is a reader with no books; `?fixture=slow` never answers, for loading states;
  `?fixture=library` goes back. `fixture-shots.mjs` takes `--fixture`, `--only desk,book`, `--base`, `--out`,
  `--scale 2`.
- The shots script prints anything wider than its screen (by rects) and any page error, and writes
  `report.json`. In a full-page shot the fixed tab bar is drawn once, part-way down: that's the capture, not a bug.
  The Settings integrations tab reports one failed request where the sandbox blocks Google's script.
- A production build never contains any of this: the mode is a build-time constant in `src/main.tsx`. Check with
  `grep -rl "fixture data" dist/` (nothing) after a build if `main.tsx` or the fixtures change.
- **When a screen needs data the fixtures lack, add it to `fixtures/library.ts`** in the same change. When a
  screen starts asking a new query, add it to `generate.test.ts`, or the screen gets `null` in fixture mode.
- What it can't show: real drawings (fixture art is a plain ink stand-in), cross-hatched covers (they need
  Hardcover's images), the typewriter streaming a live reply, push, the service worker, real sizes of data.

### 1b. Recorded Hardcover replies: what Hardcover really sends

`fixtures/hardcover/*.json` are real replies from Steve's account (recorded 2026-11-11), each with the exact query
and variables that produced it. Read them before writing a Hardcover test or guessing a field's shape; build test
replies from them rather than by hand. `convex/lib/hardcoverRecorded.test.ts` runs them through `mapUserBook`,
`mapJournal`, `mapSearch` and `listSlug`, and fails if Margin's queries no longer match the recorded ones.

| File | Query | What's in it |
|---|---|---|
| `me.json` | `{ me { id } }` | the user id |
| `library.json` | `LIBRARY_QUERY` | 11 books picked for variety: every status, audio and ebook editions, a review, a recommendation, a re-read, a half star |
| `journals.json` | the import's quote/note query | 2 quotes, 2 notes, 2 tagged notes; `metadata.position` with and without a page |
| `journal-events.json` | every event, newest 500 | one of each type seen: `progress_updated`, `user_book_read_started`, `user_book_read_finished`, `status_want_to_read`, `quote`, `note` (metadata differs by type) |
| `sync.json` | the two-minute sync | books changed and journal events in the last 30 days, including `list_book` events |
| `lists.json` | `LISTS_QUERY` | 3 lists, 5 books each |
| `search.json` | `SEARCH_QUERY`, "piranesi" | Hardcover's full search document, unmapped |
| `read-length.json`, `user-book-by-book.json` | the outbox's lookups before it writes | |

- **Scrubbed** (the repo is public): Steve's user id, user_book, read, journal and list ids are renumbered from 1000,
  consistently across files; his reviews, notes and quotes are replaced by "Scrubbed text, N characters long";
  `recommended_by`, list names and slugs, usernames are replaced. Catalog facts (titles, authors, editions, covers,
  Hardcover's tags, book ids) and dates are real. Note tags are Steve's and kept, because H10 needs them.
- **Re-record** only when a query in `convex/lib/hardcover.ts` changes or Hardcover's shape is in doubt:
  `node --env-file=.env scripts/hardcover-record.mjs`. It sends queries only (it refuses anything with `mutation`),
  at Margin's pace, about a minute. An unattended run can't: the key is only on Steve's machine. Ask instead.
  After re-recording, `grep -rn steebus fixtures/hardcover` must find nothing, and read the diff before committing.

## 2. Limits for an unattended run

Margin's one Convex deployment is production and holds the real library, and Margin writes to Steve's real
Hardcover account. Pushing to `main` deploys both. So:

- **Push to `main`** (Steve, 2026-11-10: "this is a bit of a test, I'm happy to have the agent push to main",
  and merges are automatic). One commit or a short series per run, in the repo's commit style, only after lint,
  tests and build are green locally. Pushing deploys Vercel and Convex, so after the push watch CI and the
  deploy; if either fails, fix or revert before stopping.
- **Never** run `npx convex dev`, `npx convex deploy`, `npx convex import`, or any script against the live
  deployment by hand: the only deploy is the one the push to `main` causes. Never call Hardcover with a mutation; tests stub `fetch`. Never spend money: no art batches, no
  guide runs, no eval runs that call a model.
- **No data migrations and no schema change that rewrites or narrows existing data.** Adding an optional field or
  an index is fine. Anything more is written up as a proposal in the item and left for Steve.
- **Visible design changes ship small and reversible.** One surface per run, checked in fixture mode in both
  themes and both widths, described in the run's report so Steve can look and say no. A change of direction (a new
  layout for a whole screen, a new typeface, a different palette) is still a proposal: write it in §5 with
  screenshots saved under `docs/proposals/` and wait.
- **Motion is never reduced** (Steve, 2026-11-10: "I don't want to reduce motion. I enjoy the animations and
  transitions"). No run removes, shortens or simplifies an animation or a transition to save bytes, frames or
  effort, and none adds new reduced-motion work. The reduced-motion rules already in `app.css` stay as they are.
  A performance item that would cost motion is dropped, or done another way.
- **Don't reopen decisions.** `PLAN.md` lists what was dropped (in-app camera, Kindle imports, the capture
  endpoint, model-chosen books). Dated notes saying "Steve, 2026-…" are decisions. A run may add a question to
  §5; it may not build the other answer.
- **Secrets.** The repo is public. Nothing from `.env`, Convex env or a token goes in code, tests, logs, this
  file or a pull request.
- Books are 2:3. The hand script is for the reader's words only.
- A run that can't verify something says so. "Tests pass" is not "works on the phone".

### Risk classes

| Class | Means | Before pushing to `main` |
|---|---|---|
| **A** | Tests, docs, dead code, build size, internal refactor with tests unchanged | checks green |
| **B** | Behaviour fix with a new test, no schema change, nothing visible beyond the fix | checks green, and the new test failed before the fix |
| **C** | Visible design or copy change, new feature, new dependency | the above, plus fixture shots read before and after |
| **D** | Hardcover write paths, sync conflict rules, schema, auth, cost | the above, plus a test for every path that writes to Hardcover, a risk note in the commit message and the run's report, and no other change in the same run. One class D change per day at most, so its effect on the real account can be seen before the next. |

## 3. Choosing what's next

Score = (how much Steve feels it × how sure we are it's real) ÷ size, then by class: when two score alike, the
lower class goes first. Rules that override the score:

1. Data loss or silent corruption beats everything.
2. A thing that makes later runs better at verifying (fixtures, tests, measurements) beats a feature of the
   same size.
3. Never two class D changes in a row.
4. Every fourth run is a delight or design item, so the loop doesn't only ever fix plumbing.

Sizes: **S** under an hour, **M** a run, **L** more than a run (split it before starting).
Status: `ready`, `needs Steve` (see §5), `started`, `done`, `dropped`.

## 4. Backlog

Ids are stable. New items take the next number in their theme. Evidence is a file and function, so it survives
line numbers moving.

### E: enabling work (do these first; they make every later run trustworthy)

| Id | Item | Evidence | Size | Class | Status |
|---|---|---|---|---|---|
| E1 | **A fixture mode for looking at the app.** No run can sign in, so no run can see a screen. A dev-only way to render routes on recorded, made-up library data (a fake `useBooks`/`useEntries`/`useActivity` source behind a `?fixture` flag or a `/__fixtures` route excluded from production builds) lets runs take screenshots, check overflow and reduced motion, and run Lighthouse. | `src/lib/offline.ts` is already the one place most screens get data | M | A | **done 2026-11-10**, see §1a |
| E2 | **Screenshot and overflow check script** on top of E1: every route, two widths, two themes, saved as artifacts; fails on an element wider than the viewport (measure rects, as `CLAUDE.md` says, and scroll with the real wheel so lazy cells load). | `CLAUDE.md` notes on `overflow-x: clip` and lazy cells | M | A | **done 2026-11-10** as `scripts/fixture-shots.mjs`. Left: a production-mode fixture build for Lighthouse (O6) |
| ~~E5~~ | **Done 2026-11-11, see §1b and §7.** ~~Recorded Hardcover fixtures.~~ `PLAN.md`'s risk table promises "recorded fixtures in tests" for Hardcover; the sync tests build their own replies by hand. Record the shapes of real read-only replies (scrubbed) so a schema change on Hardcover's side shows up as a failing test. Needs Steve to capture them once. | `convex/hardcoverSync.test.ts`, `PLAN.md` Risks | M | A | **done** |

### H: Hardcover connection

| Id | Item | Evidence | Sure? | Size | Class | Status |
|---|---|---|---|---|---|---|
| H1 | **The two-minute pull can stall for good.** When a page comes back full (100 books or 100 journal rows changed since the cursor), the cursor is kept where it was, so the next run asks the same question and gets the same 100. The comment says "only move as far as what was actually seen"; the code doesn't move at all. Fix: ask for `updated_at`, and move the cursor to the newest one seen (or page with an offset until short). Triggered by a bulk change on Hardcover, or a long outage followed by a backlog. | `convex/hardcover.ts` `syncAll`, the `full` branch | Sure from the code; never seen live | M | D | **done 2026-11-12** (Steve's session, `fc61b14`: the cursor moves past a full page), see git log |
| H2 | **A review cleared in Margin comes back.** `saveReview` deletes the review entry when the words are emptied, but the push only sends `review_raw` when there are words, so Hardcover keeps the old review and the next pull re-creates the entry. Fix needs care: sending `null` blindly could wipe a review written on Hardcover moments ago. Suggest a `reviewCleared` marker on the read, sent once. | `convex/library.ts` `saveReview`; `convex/hardcover.ts` `flush` (`review_raw`) and `saveBooks` (review block) | Sure from the code | M | D | ready |
| ~~H3~~ | **Done 2026-11-11 (run 37), see §7.** ~~An edited review can be put back by the pull.~~ | | | | | done |
| ~~H4~~ | **Done 2026-11-11 (runs 41 and 42), see §7.** ~~Sync trouble is only visible in Settings.~~ | | | | | done |
| H6 | **One pace for all callers, and honour `Retry-After`.** The pull, the hourly compare and the outbox each wait 4.5 s on their own, so together they can go three times the intended rate; a 429 always sleeps a flat 60 s. Check Hardcover's current published limits first (the "15" in SPEC was read from a header on 2026-11-02 with the window unknown) and write the real numbers into SPEC. | `pace`, `gql`, `syncAll`, `reconcile`, `flush` | Sure about the code; the limit itself needs checking | M | D | ready |
| ~~H7~~ | **Done 2026-11-12 (run 43), see §7.** ~~Give up gracefully.~~ | | | | | done |
| H8 | **Notes and books removed on Hardcover stay in Margin.** SPEC §3.5 records this as a known gap because deletions aren't reported. The hourly compare already reads the whole library; it could also list journal ids and offer (not silently apply) "3 notes were removed on Hardcover: remove here too?". | SPEC §3.5 "Not synced" | A design question | L | D | decided: see H17 |
| H9 | **Fields that only travel one way.** Owned, recommended-by and date added come in from Hardcover but a change in Margin never goes back; the push sends status, rating and review only. **Decided (Steve, 2026-11-10): any field Hardcover supports goes back to it.** First list what `UserBookUpdateInput` and the read and journal inputs accept (from Hardcover's docs or a read-only introspection fixture, E5), then send every one Margin holds, one field per run, each with a test and the same "a waiting change wins" rule. Margin-only corrections (`reads.edits`) stay Margin's. | `flush` `update_user_book` object vs `mapUserBook` | Sure | M, then S each | D | ready |
| H10 | **Confirm the journal tag shape.** Tags are sent as `{category: 'general', spoiler: false, tag}`, marked unverified in the code. Half done 2026-11-11: `fixtures/hardcover/journals.json` has two real tagged notes, so the shape Hardcover *returns* (`taggings { tag { tag } }`) is recorded and tested. The shape it *accepts* on `insert_reading_journal` still isn't; check Hardcover's schema (introspection is a read) or ask Steve to tag one note from Margin and look on Hardcover. | `journalObject` in `convex/lib/hardcover.ts`; §1b | Open | S | D | ready (the write half) |
| H11 | **Lighter hourly compare.** Every hour the whole library is fetched with full metadata to catch read-date changes. Split it: dates and read ids hourly, titles/tags/author facts daily. Fewer and smaller requests, and fewer reactive wake-ups. | `reconcile`, `LIBRARY_QUERY` | Sure it's heavier than needed; gain unmeasured | M | D | done (2026-11-12): the compare runs daily instead, and tag-count drift no longer rewrites works |
| H12 | **Finish Phase 4's own checks.** The test half is **done 2026-11-11 (run 23)**, see §7. Left for Steve: "progress logged on Hardcover appears in Margin within 2 minutes" (`PLAN.md` Phase 4). | `PLAN.md` Phase 4 | n/a | S | A | Steve's half only |
| H14 | **Books Hardcover doesn't have.** SPEC §3.1 says search falls back to Open Library, then Google Books. Only Hardcover is searched, so a book it lacks can't be added. | `convex/books.ts` `search` | Sure | L | C | **dropped 2026-11-10: Steve doesn't need books Hardcover lacks.** Take the Open Library and Google Books fallback out of SPEC §3.1 and PLAN (B7) |
| H15 | **Progress history from Hardcover's journal.** Hardcover keeps dated progress events; Margin's `progressLog` only starts when Margin did. Reading those in (read-only) would fill the Desk's chart and "pages by month" for years before Margin. Explore the journal's event types first. | `mapJournal` drops everything but quotes and notes; `fixtures/hardcover/journal-events.json` has a real `progress_updated` (`metadata.progress`, `progress_pages`, `progress_seconds`, `*_was`, `*_delta`, `user_book_read_id`) and read started/finished events | An idea | M | B | ready (fixtures in §1b) |
| H16 | **Series from Hardcover.** On finishing a book that's in a series, offer the next one for the TBR. Needs Hardcover's series fields in the library query. | not built | An idea | M | C | needs Steve |
| H17 | **Offer to remove what Hardcover removed** (Steve, 2026-11-10; this is H8 decided). The hourly compare lists the journal ids and books Hardcover still has; anything Margin holds with a Hardcover id that's gone is shown in Settings and on its book, with "Remove here too" and "Keep". Never removed without the tap. Kept ones aren't offered again. | H8 | Decided | L: split into books, then notes | D | ready |

### B: bugs and correctness

No open items (B6 done, §7).

### O: optimisation

| Id | Item | Evidence | Sure? | Size | Class | Status |
|---|---|---|---|---|---|---|
| O2 | **The offline copy is kept in localStorage,** which holds about 5 MB and is written synchronously on every live update. A few thousand highlights will pass that, and the write fails silently, so offline reading quietly stops working. **Measured run 55** from the fixture answers (`src/fixtures/data.json`, JSON length): `myBooks` 1.5 kB a book, `allEntries` 0.45 kB a note (fixture notes are short; real highlights run longer), `graph` 20 kB (one copy). So 600 books and 2,000 notes is about 2.0M characters, 600 and 5,000 about 3.4M, 1,000 and 10,000 about 6.3M. Browsers allow roughly 5M characters (5 MB) per origin, shared with the other keys. Not over today, but 5,000 notes is within reach. **Steve, 2026-11-12: up to 1,000 books** (notes not yet given). At 1,000 books the books alone are about 1.5M characters, so the cap is reached at roughly 7,700 notes of the fixture's short length, and sooner with real highlights (at 1.5 kB a note, about 2,300). **Steve, 2026-11-12: about 5 notes a book, so up to 5,000 notes.** That is 3.8M characters at the fixture's note length and about 5.5M at 0.8 kB a note, so it is at or over the cap, not near it: **do the move to IndexedDB** (class B, no schema change; keep the localStorage copy readable for one release so nobody loses an offline copy). Steve's real counts would settle it: ask for them, or read `margin.cache.*` lengths in his browser console. If near, move the copies to IndexedDB. | `remember` in `src/lib/offline.ts` swallows the quota error | A risk, unmeasured | M | B | ready (measure first; needs Steve's numbers or E1) |
| O3 | **Main chunk was 620 kB (194 kB gzip); zod half done 2026-11-11 (run 22), now 553 kB (173 kB gzip).** Left, by source share: react-dom ~30%, Motion ~26%, convex ~9%. Candidates: Motion's `LazyMotion` with the `m` components (watch that it can't cost any animation, §2); check the Desk's route isn't dragging other screens in. Measure each change against `npm run budget`. | build output; source-map estimate 2026-11-10 | Sure of the size; gains unmeasured | M | A | started |
| O5 | **`myBooks` re-sends the whole library on any change to any read.** Fine at 600 books; watch it. If Shelves ever janks on a sync, split the hot fields (progress, status) from the cold ones. Measure before touching. | `convex/library.ts` `myBooks` | A watch item | L | B | ready (measure only) |
| O6 | **Lighthouse pass** (PLAN Phase 7.3: 90+ for accessibility and performance on mobile; SPEC §6: LCP under 2.5 s on mid-range Android). **First pass done 2026-11-12 (run 49)**, numbers in O8. Left: Notes' contrast item, a signed-in run on real data (Steve's). | `PLAN.md` Phase 7 | n/a | M | A | started |
| O8 | **Lighthouse numbers (run 49).** Fixture build (`vite build --mode fixtures`, `vite preview`, `npx lighthouse@12`, Lighthouse's default mobile throttling, headless Chromium; data is invented, so a guide, not Steve's numbers). Performance / accessibility: Desk 90 / 96, Shelves 77 / 96, Notes 80 / 96. LCP 2.9 / 3.1 / 3.5 s (SPEC wants under 2.5), TBT 130 / 290 / 190 ms. **Layout shift** CLS 0.06 / 0.17 / 0.10 (Shelves `section.stack` and Notes `div.notes-wall` over 0.1: the grid pops in after the first paint). Accessibility fails left: `.strip-card` names ("Text inside the element is not included in the accessible name": its `aria-label` is title, author and percent, the visible text differs somewhere, probably the cover's own text or "Audiobook"); the loading line's colour at 4.32:1 (probably caught mid-fade, `opening-in`; re-check with a settled page). **Shelves shift fixed run 50** (it was the heading and buttons re-wrapping when the fonts arrived, not the grid; the first screen's three fonts are now preloaded in `index.html`: CLS 0.16 to 0 unthrottled, measured with a layout-shift observer). `.strip-card` name fixed run 51 (an audiobook's card prints "Audiobook", which the name lacked; `stripName`, `src/lib/stripName.ts`, tested; not re-run in Lighthouse). **Run 53:** Notes' shift measured again with a layout-shift observer (fixture build, 390 px, unthrottled): no shifts, so the font preload fixed it too; the loading line is `--ink` at full opacity once `opening-in` ends (the 4.32:1 was mid-fade), so nothing to fix. Left: LCP over 2.5 s (Notes 3.5 s in the throttled run; not re-run). | this file | Sure for the fixture build | M | C | started |

### U: UI and UX

Every item here is class C unless it's a plain bug. Look at each in fixture mode (§1a) before and after.

| Id | Item | Evidence | Size | Status |
|---|---|---|---|---|
| ~~U9~~ | **Closed 2026-11-10 (Steve: dim, don't invert; SPEC §3.11 corrected).** ~~Drawings in the dark theme.~~ In fixture mode a book with a drawing shows as a pale panel with black ink on Shelves at night, where SPEC §3.11 says `invert` plus `screen`. It may be the stand-in art (an SVG, not a WebP), a decision since the spec, or a bug. Check with Steve's eyes on a real drawing before touching it. | `fixture-shots/shelves.phone.dark.png` | S | closed |
| U1 | **An accessibility sweep, one surface per run:** focus order and visible focus, names on icon buttons, contrast in both themes (WCAG AA is a brand commitment), 48dp targets, nothing hover-only, toasts announced once. Start with the Desk and the book page. **Targets and names swept on every screen by run 31, contrast of the tokens and every text opacity by run 34, focus rings and dialog focus read in code by run 35 (see §6). Keyboard pass done by run 45 (below). Text over covers read by run 46 (titles sit on a paper strip, fine); marks over art fixed run 46. Left: nothing known.** | `PRODUCT.md` Accessibility; never audited | M each | started |
| ~~U2~~ | **Dropped 2026-11-10 (Steve doesn't want motion reduced).** ~~A reduced-motion sweep.~~ Nine places mention reduced motion; `PLAN.md` wants a designed path for every animation. List every animation, tick the ones with a designed still version, fix the rest. | `grep prefers-reduced-motion` | M | ready |
| ~~U3~~ | **Done 2026-11-11 (runs 38 and 39), see §7.** ~~Loading and empty states.~~ Several screens showed a bare "Opening…" line. DESIGN-DIRECTION asks for "something small and alive". Design one empty state and one loading state and use them everywhere. | `Desk.tsx`, `__root.tsx` | M | done |
| U4 | **The review queue is buttons "for now".** PLAN and DESIGN-DIRECTION describe an index-card stack to swipe. Stack look and deal-in **done 2026-11-12 (run 47)**, §7. Left: the swipe itself (accept, reject, flick to skip); the card holds a form and radios, so a gesture needs care not to fight them. | `PLAN.md` Phase 5.2; `Review.tsx` | M | started |
| U5 | **The Pile, as Steve left it:** thinner books; on a phone, unfurl summaries only in the middle; "not loving the book style". | `PLAN.md` Held for after the build | M | needs Steve (what style instead?) |
| U6 | **Grouping note, quote and progress** as one action, since they're similar. | `PLAN.md` Held for after the build | M | needs Steve |
| ~~U7~~ | **Done 2026-11-11 (run 29), see §7.** ~~Offline is invisible.~~ | | S | done |
| U8 | **Five tabs where the design said four.** Steve, 2026-11-10: five is right (Desk, Shelves, Notes, Explore, Capture). The brief, plan, spec and DESIGN.md now say so. | `__root.tsx` `tabs` | S | **done 2026-11-10** |

### D: surprise and delight

Steve enjoys the animations and transitions, so this theme adds motion and never takes it away. "Delight, but
never in the way": nothing here may add a tap or delay an input. Every fourth run picks from here (§3).

| Id | Item | Notes | Size | Status |
|---|---|---|---|---|
| D1 | **Check the motion table.** Audit done 2026-11-10 (run 8), see the table below. Build the missing moments one at a time, cheapest first (D10 to D16). | `docs/DESIGN-DIRECTION.md` Motion table | S each | audit **done**; builds ready |
| D10 | ~~**Highlighter dries.** The mustard swipe on a marked line should follow the finger, then desaturate a touch. Neither exists: the highlight in the margin block (`app.css` ~523) is static. Cheapest: a one-off colour transition on first render.~~ | `app.css` "In the margin on its book's page" | S | **done 2026-11-10** (§7) |
| D13 | **Ribbon bookmark** drapes and sways; logging progress drags it down. There is no ribbon element at all (progress is a bar and a percentage, per the Fair-catalog section). Needs Steve: does the ribbon still belong? | no `ribbon` in `src/components` | S | needs Steve |
| ~~D14~~ | **Done 2026-11-11 (run 36), see §7.** ~~Spines lean on a fast scroll.~~ | | M | done |
| ~~D15~~ | **Done 2026-11-11 (run 40), see §7.** ~~Adding a book slides into its slot.~~ | | M | done |
| D16 | **Library card stamp for each event** (thunk, rotation, ink spread) beyond the status stamp. `stamp-land` scales in; there is no rotation or ink spread, and haptics fire only on finish. | `app.css` `stamp-land` | S | **done 2026-11-11 (run 24)**, see §7; haptics on other status changes and ratings done run 56; other events' stamps left |

**D1's audit (2026-11-10, by reading code, not the running app):**

| Moment | State |
|---|---|
| Buddy note typing, strike, carriage creep | exists (`Typewriter.tsx`, `strike`) |
| Clack and ding | missing (D5) |
| Route changes | default view transition only, 120 ms (D2 for the shared element) |
| Shelves lean / slide-in | missing (D14, D15) |
| Ribbon | missing (D13) |
| Highlighter swipe and dry | missing (D10) |
| Handwriting reveal | partial: biro marks draw (`pen`), notes don't (D11) |
| Library card stamp | partial: `stamp-land`, haptic on finish (D6, D16) |
| Tags | missing (D12) |
| The drawer | exists: card rises with a tilt, exits flicked right (`Drawer.tsx`) |
| Review queue swipe | missing (U4) |
| Explore graph | exists: d3 force layout settles; spring physics and iron-filings focus not checked |
| Empty states | missing (U3) |

| ~~D2~~ | **Done 2026-11-11 (run 32), see §7.** ~~Shelf to book as one movement.~~ | | S | done |
| D4 | **A year in the catalog.** A printable end-of-year sheet in the Fair-catalog look: the year's books as stamps, pages, the most-marked book, the line most returned to. December is close. | `stats.ts` has most of the numbers | L | needs Steve |
| ~~D5~~ | **Done 2026-11-11 (run 28), see §7.** ~~Typewriter sound, off by default.~~ | | S | done |
| D6 | **Finishing a book** beyond the stamp: the book walks to the Pile. (The date stamp is **done 2026-11-12, run 44**, §7; the spine dropping onto the Pile on the review page **done run 52**, §7.) | `a3985b8` added stamps; compare with the brief | M | started |
| ~~D7~~ | **Done 2026-11-12 (run 48), see §7.** ~~Citation cards in the buddy's replies.~~ | | M | done |
| D8 | **New books get drawn on their own.** SPEC §3.11 says a book being read is drawn straight away; today nothing is drawn until the bulk script runs. Costs money per book, so it needs a yes and a cap. | SPEC §3.11 "When it runs" | M | **dropped 2026-11-10: Steve doesn't want books drawn automatically.** SPEC §3.11 should say so (B7) |
| D9 | **Pull to refresh on the Desk** that asks Hardcover now, not at the next two-minute tick. | DESIGN-DIRECTION "pull-to-refresh where it means something" | S | ready (class D: it calls the sync) |

### S: spec items not yet built (pointers, so they aren't lost)

Rolling memory summaries and the other buddy tools (§3.8); the eval set at ten books (`docs/eval/` has one);
the review-queue nudge (§3.3); drawer filters and actions (§3.9); "ask your library" (waits, by decision);
author-fact gaps filled by a model (§3.7). None is for an unattended run to start without Steve choosing it.

## 5. Questions for Steve

Answer in this file, dated, and the items unblock.

**Answered 2026-11-10:**
- Hourly runs are fine (Q12). CI alone is the deploy check for now; Vercel's connector isn't needed (Q13).
- The guide route is removed (Q6; B6 is down to two placeholders).
- Drawings don't invert at night: they're dimmed, as built (Q10; U9 closed, SPEC §3.11 corrected).
- Merges are automatic, and runs push to `main` (§2).
- One agent every four hours. A failed build is the next run's job (§1).
- Removed on Hardcover: Margin offers to remove it, and never does it unasked (H17).
- Books are not drawn automatically (D8 dropped).
- Motion is not to be reduced (§2; U2 dropped).
- No one big annoyance right now, so §3's scoring decides.
- Any field Hardcover supports goes back to it when changed in Margin (H9).
- Books Hardcover lacks aren't needed (H14 dropped).
- Five tabs is right; the docs were brought into line (U8).
- Recorded Hardcover replies are in `fixtures/hardcover/` (Q11, 2026-11-11; E5 done, H10 half done, see §1b).

**Open:**
- (2026-11-12, run 60) The safe, small supply is empty; every `ready` item is class D or needs a device. Which next?
  H2 (a cleared review comes back), H6 (one pace for Hardcover calls), or something else. And, for O2, how many notes the real library
  holds (books: up to 1,000, answered 2026-11-12). Until answered, runs only assess.

## 6. Run log

Newest first. One entry per run: date, what was assessed, what was done, how it was verified, what's waiting.

- **2026-11-12, run 62 (unattended; assess only).** Ground: `main` at `afe4aad`, CI green (Vercel not checked, Q13). Nothing
  landed since run 61 and the question under "Open" in §5 is still unanswered. Re-checked H6 against the code: still real
  (`pace` sleeps a flat 4.5 s per caller, `gql` sleeps a flat 60 s on a 429, `convex/hardcover.ts` lines 21 and 41), still
  class D. No code change. Verified: docs only. **Needs Steve:** the §5 question (H2, H6 or something else; real counts for O2).

- **2026-11-12, run 61 (unattended; assess only).** Ground: `main` at `3e3c37a`, CI green (Vercel not checked, Q13). Nothing
  landed since run 60. Re-checked H2 against the code: still real (`saveReview` deletes the review entry, `flush` sends
  `review_raw` only when there are words, `convex/hardcover.ts` ~609), so it stays `ready`, class D. Nothing else is both safe
  and small, so no code change. Verified: docs only. **Needs Steve:** the question under "Open" in §5 (H2, H6 or something
  else; real book and note counts for O2). Runs will keep assessing until it is answered.

- **2026-11-12, run 60 (unattended; a delight run, and the tenth-run review of §8).** Ground: `main` at `e0f2407`, CI green
  (Vercel not checked, Q13). **Review:** since run 50's review, 10 commits on `main` (one by Steve, H1/H11; nine by the loop),
  none reverted or hand-edited (the one "reverted" in the log, run 54, never shipped), so by the only proxy there is, Steve left
  them alone. The scoring keeps picking small safe class A/C items, and the safe supply is now empty: runs 57 to 59 found nothing
  both safe and small, and every `ready` item left is class D (H2, H6, H9, H10, H17, D9) or needs a phone or Steve's numbers
  (O2, O3, O8's LCP, U4's swipe). No change to §1 to §3. The file had passed 400 lines, so this run pruned it: runs 57 to 59
  are one entry and run 20 is one line. No code change. Verified: docs only; `main` was already green. **Needs Steve:** pick
  what the loop does next (see the note under "Open" in §5); until then runs only assess.

- **Runs 57 to 59 (assess only).** Read Stats, Capture, the Pile, a finished read's page, a person's page, Topics and the empty reader in fixture mode (phone and desktop, both themes): nothing wider than its screen, no errors, nothing to fix. Empty lines on Notes and Explore stay plain text as U3 decided. Asked Steve for his real book and note counts (O2) and whether he wants H2 or H6 next.

- **2026-11-12, run 56 (unattended; a delight run).** Ground: `main` at `f464f5b`, CI green (Vercel not checked, Q13). Did the
  haptics half of D16 (class C): on a book's page every status change now gives one soft tick (15 ms; finishing keeps its two
  thunks) and a rating change a lighter one (10 ms), `navigator.vibrate`, as Capture and Progress already do. Adds no tap or
  wait; nothing visual changed, so no fixture shots. Verified: lint, 341 tests, build and budget green. Not checked: a phone
  (only Android Chrome vibrates; iOS ignores it). Remaining safe supply: U4's swipe, O3 (Motion), O8's LCP. Run 57 is a normal pick.

- **2026-11-12, run 55 (unattended; a normal pick).** Ground: `main` at `85a34e4`, CI green (Vercel not checked, Q13). Measured
  O2 (class A, no code change): the offline copy's size per book and note, extrapolated, in O2. Not over the cap at 600 books
  and 2,000 notes (about 2.0M characters), but near it by 5,000 notes (3.4M); needs Steve's real counts. Also pruned this file
  (it had passed 400 lines): runs 44 to 49 are one line. Verified: fixtures regenerated and measured; docs only, so lint,
  tests and build were not changed by this run. Not checked: a real browser's quota, Steve's data. Remaining safe supply: U4's
  swipe, O3 (Motion), O8's LCP. Run 56 is a delight run.

- **2026-11-12, run 54 (unattended; a delight run).** Ground: `main` at `fdc99c1`, CI green (Vercel not checked, Q13). Tried D2's
  Back half (the cover flying home to its shelf cell): a `returnCover(slug)` on the Back button and a `data-returning` name on the
  cell. Built, lint, 342 tests, build and budget green, then **reverted unshipped**: in fixture mode the shelf's cells render
  after the view transition has taken its new snapshot (MutationObserver: 0 cells, then 28), so only `::view-transition-old(book-cover)`
  ever existed, with or without the change. Fixture data arrives async; whether the real app's cached books render in the same commit
  is unknown and can't be seen from here. Left in D2 as a note. No code change. Remaining safe supply: U4's swipe, O3 (Motion),
  O8's LCP. Run 55 is a normal pick.

- **Runs 53 to 50.** O8: Notes has no layout shift and the loading line was a mid-fade reading (53); D6 spine onto the Pile (52); `.strip-card` name, H1 marked done (51); font preload for Shelves, and the tenth-run review (50: 31 loop commits, none reverted, no change to §1 to §3). All in §7 or O8.

- **Runs 49 to 44.** O6 first Lighthouse pass and the toast `div` (O8); D7 citation cards; U4 stack and deal; U1 marks over covers; U1 keyboard pass (nothing to fix); D6 date stamp. All in §7, each checked by lint, tests, build, budget and fixture shots.

- **Runs 43 to 39.** H7 stuck changes; H4 Desk mark and book-page line; D15 adding a book slides into its slot; U3 empty states (§7). Run 43 left: lint, 331 tests, build and budget green, Settings read in fixture mode.

- **Runs 38 to 32.** U3 loading line; H3 review put back (class D); D14 spines lean; U1 focus order (read, nothing to fix); U1 contrast; B6 placeholders; D2 cover flight. All in §7, each checked by lint, tests, build and fixture shots.

- **Runs 31 to 26.** U1 Stats and Topics targets (§7); U1 Shelves/Notes/Pile/Explore targets measured, nothing to fix; U7 offline line; D5 typewriter sound; H13 offline writes keep their time; H5 token message (§7). Run 32 onward are below.

- **Run 24.** D16 stamp turns and inks (§7). **Run 23.** H12 re-pull test (§7). **Run 22.** O3 zod half, main chunk 619 to 553 kB (§7). **Run 21.** U1 Desk targets (§7).

- **Run 20 (a delight run, and the first tenth-run review, §8).** 10 loop commits since run 10, none reverted; no change to §1 to §3. Did D12 tags swing (§7).

- **Run 19.** U10 disabled solid buttons readable (§7). **Run 18.** O1 the Desk stops downloading every note (§7). **Run 17.** B2 error and not-found screens (§7). **Run 16.** D11 handwriting reveal (§7). **Run 15.** Assessed Capture, Review, Explore, Stats; U11 radio dots (§7).

- **2026-11-11 (with Steve).** E5 done: recorded, scrubbed Hardcover replies in `fixtures/hardcover/` (§1b); Q11 answered.
- **2026-11-10, run 14.** Assessed Stats, Review, Capture, Settings; filed U10, U11; did B7 (docs drift).
- **Run 13.** O7: tests share workers (`isolate: false`). **Run 12.** D10 highlighter dries; read four more screens.
- **Run 11.** O4 fonts: Source Serif Latin faces only; the Pile-faces half dropped.
- **2026-11-10, after run 10 (with Steve).** Answers recorded in §5: hourly stays, CI alone checks the deploy, guide route gone, drawings dim and never invert.
- **Run 10 (the first loop review).** The job runs hourly, not four-hourly; no pull requests exist, so reverts and hand-edits of loop commits are the proxy; assessment must read at least four unread fixture screens each run; every `ready` H item is class D or C.
- **Runs 9 to 3.** B8, B4 and B3, B5, B1, D3, E4 (bundle budget in CI), each as in §7. The theme U assessment slipped for several runs because it needs a browser pass; run 6 did the first four screens.
- **Run 2.** E3: lint covers `convex/` and `scripts/`. **Run 1 (with Steve).** Built fixture mode (E1, most of E2), recorded Steve's answers. **Run 0 (the audit).** Read the docs and most of the code; wrote this file at `5e210e8`. Not yet looked at closely: the buddy (`convex/buddy*.ts`), Explore's cost on a phone, Shelves at 2,000 books, the Kobo and Play Books imports, `app.css` for dead rules.

## 7. Done and dropped

Move items here with the date and the commit or the reason. Keep the id so old log entries still make sense.

- **D6 (spine onto the Pile)** Done 2026-11-12 (run 52, class C): finishing a book lands on its review page, which now opens with that book's own Pile spine (`spineOf`, same binding, width and face as on the Pile) dropping onto a rule and settling with a bounce (`pile-drop`, 0.52 s, `.pile-drop`, `app.css`; `PileDrop`, `FinishReview.tsx`). Decoration only (`aria-hidden`). Adds no tap or wait. Replays whenever that page opens.
- **O8 (font preload)** Done 2026-11-12 (run 50, class C): `index.html` preloads League Gothic, Source Serif 4 and Courier Prime (Latin), the first screen's faces, so Shelves' heading and button row no longer re-wrap (a 0.16 layout shift) when they swap in. Same files the CSS names; no animation touched.
- **D7 (citation cards)** Done 2026-11-12 (run 48, class C): when the buddy's reply names the book a note it found came from (as the persona asks), that note shows under the reply as an index card (up to three, `citedFrom`, `convex/lib/buddy.ts`, tested), linking to `/e/:entryId`. `buddyTurns.cited` (optional, additive) holds the ids; `buddy.thread` resolves them to title, kind and the first 160 characters, dropping any since deleted. Cards deal on one after another (`cite-deal`, `app.css`). A reply that names no book cites nothing; topic_links notes aren't cited. Adds no tap or wait.

- **U4 (stack and deal)** Done 2026-11-12 (run 47, class C): the Review card sits on a stack: when more cards wait, one or two card edges peek out below it (`.review-stack`, `data-behind`, `app.css`), and each new top card is dealt on (`review-deal`, 0.38 s, slight overshoot and tilt). No new tap or wait. Left: the swipe.
- **U1 (marks over covers)** Done 2026-11-12 (run 46, class C): `.thumb[data-art] .mark` and the read tick on an art cell use `--cover-biro` (`#2346c8`, tokens.css) with a `--cover-paper` halo in both themes, since cover art is pale in both. In dark the pale biro was about 1.5:1 on it. Marks on plain covers are unchanged.
- **D6 (date stamp)** Done 2026-11-12 (run 44, class C): on a finished book's page the "Finished 9 Nov 2026" line is a second, smaller stamp (`.stamp-date`, `app.css`) in the book face, turned +2 deg against READ's -5, landing 300 ms after it with its own small thunk (`stamp-date-land`). Replays when the status or finish date changes. No new tap or wait. Left: the book walking to the Pile.
- **H7 (stuck changes)** Done 2026-11-12 (run 43, class C): after 6 failed tries (`STUCK_AFTER`, `convex/lib/outbox.ts`) an outbox row counts as stuck. `syncStatus` lists up to 10 (`stuck`: label, last error, tries; additive), Settings > Integrations > Hardcover shows each with "Try again" (`retryStuck`: tries reset, sent at once) and "Discard" (`discardStuck`: only for stuck rows, only your own; Margin keeps what it holds, Hardcover is never told, and the next pull may bring Hardcover's version back). Retry timing is unchanged (still backs off to an hour). Tests in `convex/hardcoverSync.test.ts`; the fixtures hold one stuck row.

- **H4 (Desk mark)** Done 2026-11-12 (run 42, class C): `syncStatus` also returns `oldestAt` (additive); the Desk shows a typewriter-face line under the dateline (`deskSyncMark`, `src/lib/syncNote.ts`, tested) when the last sync failed ("Hardcover isn't answering. Margin will keep trying.") or a change has waited an hour ("N changes still waiting for Hardcover."). Nothing otherwise.

- **H4 (book page sync line)** Done 2026-11-11 (run 41, class C): `hardcover.bookSync` (by the outbox's `by_read` index) gives a read's waiting change, since when and the last error; the book page shows a typewriter-face line under the progress (`SyncNote`, wording in `src/lib/syncNote.ts`, tested): the reason at once after a failed try, "Not yet on Hardcover" after 10 minutes, nothing otherwise. The Desk's quiet mark isn't built.

- **D15 (slide into slot)** Done 2026-11-11 (run 40, class C): a book added to the shelf grid while Shelves is open drops in (0.42 s, slight overshoot) and the cells it displaces glide to their new places (0.38 s), a FLIP with the Web Animations API in `useSlotIn` (`BookList.tsx`; `arrivals` in `src/lib/slotIn.ts`, tested). Only one to three added books and none removed count, so the first render, sorts, filters and big sync batches don't shuffle. The table view and the Desk's strip are unchanged. Adds no tap or wait.

- **U3 (empty state)** Done 2026-11-11 (run 39, class C): one `Empty` component (`src/components/empty/`): a small line-drawn shelf (one book leans in once, 0.7 s), a heading, one line and the way forward. The Desk and Shelves' "Your shelves are empty" use it. Other bare "Nothing …" lines (Review, Notes search, topic, author) are search or filter results, not first-run emptiness, and were left as they are.

- **U3 (loading line)** Done 2026-11-11 (run 38, class C): the ten bare "Opening …" lines (Desk, Shelves, Notes, Capture, drawer, author, person, Kobo import, app start) are one `Opening` component (`src/components/opening/`): typewriter face, dots typed one at a time, and it fades in after 250 ms so a quick answer never flashes it. Still `role="status"`. The empty-state half isn't built.

- **H3 (review put back)** Done 2026-11-11 (run 37, class D): `saveBooks` now looks up the read's waiting outbox row once, before the read patch, and leaves an existing review's text alone while one is waiting, so Hardcover's old text can't overwrite Margin's new text before the push leaves. A review that doesn't exist yet is still created (that's H2's territory: a review *cleared* in Margin while waiting is not touched here). Test: `a review edited in Margin is not put back by a pull before it is sent` failed before the change. Writes nothing new to Hardcover.

- **D14 (spines lean)** Done 2026-11-11 (run 36, class C): scrolling the Pile fast tips its spines up to about 1 degree, alternate rows opposite ways, and they spring back (420 ms, slight overshoot) when the scroll slows. `useSpineLean` in `Pile.tsx` writes `--lean` to the list from the scroll speed (`leanFor`, `src/lib/scrollLean.ts`, tested); `.spine` uses the `rotate` property, so hover's slide is untouched. Reading-pace scrolling doesn't move anything. Tune `LEAN_FROM` and `LEAN_FULL` if it's too shy or too much.

- **U1 (contrast)** Done 2026-11-11 (run 34, class C): token ratios on paper, light/dark: ink 12.9/13.4, biro 5.2/7.7, rule 2.8/5.4, grey 2.4/3.3. Ink, biro are fine as text; rule and grey are never used as text colour except the filter-count badge, whose number was paper on magenta (2.8:1 in light), now `--cover-ink` (4.6 light, 5.7 dark). Form placeholders at 0.6 opacity were 4.3:1 in light, now 0.65 (5.0). Other text opacities (0.7 and up) pass in both themes; 0.45 on disabled outline buttons and 0.6 on `.choice[data-off]` and disabled quiet links are inactive controls, exempt. `--grey` is only for spines and strokes, which need 3:1 only where meaning depends on them: not measured. Rule: keep text at or above 0.65 ink opacity in light.

- **B6 (placeholders)** Done 2026-11-11 (run 33, class C): `/imports/:jobId` is removed (no import-job table or code existed; it now shows "Nothing filed here"), and an unknown `/settings/integrations/:provider` is a not-found instead of "This page isn't built yet"; only `kobo` has a page. The `Placeholder` component and its CSS are gone; SPEC §4.1 matches.

- **D2 (cover flight)** Done 2026-11-11 (run 32, class C): tapping a book on Shelves (grid) or a card in the Desk's reading strip carries its cover to the book page's header over 0.42 s (`flyCover`, `src/lib/coverFlight.ts`; `view-transition-name: book-cover` on the book page's cover, `app.css`). Only the tapped cover is named, and the name is removed after 0.8 s, since names must be unique and hundreds would slow every transition. Not covered: the table view, Notes and other entrances to a book (they crossfade as before), and going Back (tried run 54, reverted: the shelf's cells render after the transition's new snapshot in fixture mode, so the name had nothing to land on; try only if the real app renders the shelf in the same commit, e.g. by measuring on a phone, or by holding the transition until the cells exist).

- **U1 (Stats and Topics targets)** Done 2026-11-11 (run 31, class C): on a touch screen (`pointer: coarse`) Stats' bar rows are 44 px tall (were 32) and the topic page's "Topics" back link is 44 px tall (was 18). With a mouse the Stats chart keeps its denser rows. Capture, Review, Settings and the drawer measured fine.

- **U7 (offline line)** Done 2026-11-11 (run 29, class C): a small typewriter-face line above every page (`OfflineLine`, `src/components/offline/`) says "Offline: showing your last visit." when the browser is offline, and "N notes and places waiting to send." when the device's outbox holds writes (counted on connection change and every 4 s). Nothing shows when online with nothing waiting. Wording in `src/lib/offlineLine.ts`, tested.

- **D5 (typewriter sound)** Done 2026-11-11 (run 28, class C): Settings > Account > Appearance has "Typewriter sound", off unless turned on and kept on this device (`localStorage`, `margin.typeSound`). On, the buddy's and the Desk's typewriter clicks for each letter, thuds on a space and rings a bell at the end of a line, synthesised with Web Audio (no files). `src/lib/typeSound.ts` (`strikeFor` is tested). Adds no tap or wait.

- **H13 (offline writes keep their time)** Done 2026-11-11 (run 27, class B): a queued write carries `writtenAt` (`Queued`, `src/lib/outbox.ts`), sent on replay as an optional argument. `addEntry` stamps the note with it (never later than now); `logProgress` logs the place at that time, and if the book already has a later log, the old place stays in the history but doesn't move the book. Writes queued before this have no stamp and replay as before. Tests: `convex/library.test.ts`, `convex/entries.test.ts`, `src/lib/outbox.test.ts`. Still open: a status change or other write made offline isn't queued at all (only notes and progress are), so nothing else is affected.

- **H5 (token message)** Done 2026-11-11 (run 26, class B): a 401 or 403 from Hardcover now reads "Hardcover's token has been refused (401): put a new HARDCOVER_API_KEY in the Convex env." in Settings' sync line, instead of "Hardcover answered 401." (`gql`, `convex/hardcover.ts`; `convex/hardcoverToken.test.ts`, which failed before the change). Left out on purpose: the outbox already backs off to an hour (`retryDelayMs`) and the pull is two-minutely and cheap, so "stop hammering" and a push nudge were not built; say if you want either. Hardcover's token expiry is still unchecked.

- **D16 (stamp)** Done 2026-11-11 (run 24, class C): the status stamp on a book's page now comes down turning (-12 to -5 deg), dips to 96% scale as the thunk, and an ink ring spreads from its edge and clears (`stamp-land`, `stamp-ink`, `app.css`). Plays when the status changes or the page opens, as before. No new tap or wait.

- **H12 (re-pull test)** Done 2026-11-11 (run 23, class A): `convex/hardcoverSync.test.ts` imports the recorded library, journals and lists (§1b) twice and checks the second pass adds no books, reads, notes or shelves and changes nothing on the shelf. Steve's half ("within 2 minutes") is still his to check.

- **O3 (zod)** Done 2026-11-11 (run 22, class A): every route's search schema uses `zod/mini` (`src/lib/searchSchemas.ts`, `shelfSearch` in `shelf.ts`, Settings' tab), which tree-shakes; the main chunk is 66 kB smaller raw, 18 kB gzip. `src/lib/searchSchemas.test.ts` pins what each schema accepts and drops. Server code (`convex/lib/guide.ts`) still uses full zod. Write new route schemas with `caught(...)` from that file.

- **U1 (Desk targets)** Done 2026-11-11 (run 21, class C): the Desk's "Newly on the TBR" spines were 26 to 33 px tall; `miniHeight` (`src/lib/pile.ts`) keeps them at 48 px or more, still taller for a thicker book (48 to 74 px, was 15 to 68). The Pile page is unchanged.

- **D12** Tags swing on their string. Done 2026-11-11 (run 20, class C): a tag added to a note while its page is open
  (`landedSince`, as D11) swings once from its top-left over 0.7 s (`tag-swing`, `app.css`) and settles. Tags already
  there don't move. The "flutter when filtered" half isn't built: filtering has no tag UI of its own to flutter.

- **U10** Disabled solid buttons. Done 2026-11-11 (run 19, class C): `.btn-solid:disabled` is at 65% opacity (was 45%), so "Save excerpt" and the other solid buttons keep their label at about 5:1 in light and 6:1 in dark, and still read as off beside an enabled one. Outline buttons stay at 45%. Part of U1's contrast pass.

- **O1** The Desk no longer downloads every note. Done 2026-11-11 (run 18, class B): `library.entryDates` returns only
  id and written-at for each entry; the Desk uses it for the empty state, "on this day" and the random pick, then asks
  `entries.entry` for the one note's words when its toast is due. Notes, Drawer and Pile still use `allEntries`.

- **B2** Error and not-found screens. Done 2026-11-10 (run 17, class C): `src/components/placeholder/Lost.tsx`, set as the router's `defaultNotFoundComponent` ("Nothing filed here", back to the Desk) and `defaultErrorComponent` ("That page slipped", Try again and Back to the Desk), both inside the shell so the tab bar stays. A route's own `NotFoundBook` is unchanged.

- **D11** Handwriting reveal. Done 2026-11-10 (run 16, class C): a note that lands on a book's page while it's open (an
  entry not in the list when it first showed, `landedSince` in `src/lib/newEntries.ts`) is written out left to right
  over 0.7 s (`write-out`, a clip-path sweep, `app.css`). Entries already there on arrival don't animate, so
  nothing replays on each visit. Applies to the book page's margin list only; Notes, Drawer and Desk unchanged.

- **U11** Uneven radio dots. Done 2026-11-10 (run 15, class C): `.check input` in `app.css` is `flex: none`, so a wrapped label no longer squeezes its radio or checkbox. Fixes Review's matches and the same list on Share, Add a book and the Kobo import.

- **E5** Recorded Hardcover fixtures. Done 2026-11-11 (with Steve, class A): `fixtures/hardcover/*.json` from
  `scripts/hardcover-record.mjs`, tested by `convex/lib/hardcoverRecorded.test.ts`. How to use and re-record: §1b.
  Existing sync tests still build replies by hand; moving them onto the recordings is fine work for a class A run.

- **B7** Docs drift. Done 2026-11-10 (run 14, class A): SPEC's duplicated §3.6 to §6 removed (the copy with the
  current Explore text stays); architecture sketch says `generateSW` and a GET share target; README status and PLAN's
  repo layout match what's built; SPEC §3.1 and PLAN no longer promise Open Library or Google Books (H14), and §3.11
  says books aren't drawn automatically (D8).

- **O7** Tests share workers. Done 2026-11-10 (run 13, class A): `vitest.config.ts` sets `isolate: false`, with
  `unstubGlobals` and `unstubEnvs` so a stub can't outlive its test. If a test starts failing only in the full run,
  suspect state shared between files first.

- **D10** Highlighter dries. Done 2026-11-10 (run 12, class C): a marked line on the book page sweeps in left to right
  (1.1 s) wet, then dries to its old resting tint (`highlight-swipe`, a registered `--wet` property, `app.css`). Plays
  once when the line first renders; one fragment per wrapped line.

- **O4** Fonts. Done 2026-11-10 (run 11, class A): `src/styles/fonts.css` declares Source Serif 4's Latin and Latin
  Extended faces only (same files and ranges as the package), replacing its `index.css`; Cyrillic, Greek and
  Vietnamese (~90 kB of precache) are gone. The Pile-faces half is dropped: already Latin-only, and the Desk uses them.

- **B8** `sendOrKeep` late path could double a progress log. Done 2026-11-10 (run 9, class B): the kept copy is marked
  in flight until the original settles, so a replay skips it; if the original lands the copy is removed, if it fails
  the copy stays for the replay.

- **B4** A write sent twice. Done 2026-11-10 (run 7, class B): `outbox.ts` tracks ids being sent; `replay` skips them,
  so a replay (or two at once) no longer re-sends a write `keepThenSend` still has in flight. The `sendOrKeep` late
  path was B8 (done, run 9).
- **B3** Signing out leaves queued writes. Done 2026-11-10 (run 7, class B): `forgetDevice` calls `clearOutbox`.

- **B5** `activity` read the clock. Done 2026-11-10 (run 6, class B): the query uses `windowEnd(since)` (start of
  tomorrow, `convex/lib/activity.ts`, tested) in place of `Date.now()`, so it is deterministic. Same totals: logs
  later today still count, since the window already ends tomorrow.

- **B1** Words written offline vanishing. Done 2026-11-10 (run 5, class B): `replay` takes an `onRefused(item, error)`;
  `useReplayOutbox` passes `sayReplayFailure` (`src/lib/quiet.ts`, `replayFailure` tested), so a queued note the
  server refuses raises the same "Not saved" toast holding its words (note and excerpt text), and a refused progress
  log says which place didn't save. Still taken off the device, as a refusal is final.

- **E3** Lint `convex/` and `scripts/` too. Done 2026-11-10: `npm run lint` is now `oxlint src convex scripts`; the
  one finding (a regex `$` in `convex/lib/playbooks.ts`) became `endsWith`. CI runs `npm run lint`, so it's covered.

- **E4** Bundle budget in CI. Done 2026-11-10: `npm run budget` after the build in CI. Baseline: `index` 620,585
  bytes raw, 192,100 gzip (level 9; Vite's report says 194 kB at its own level). Raise `bundle-budget.json` on purpose.

- **D3** On this day. Done 2026-11-10 (run 4, class C): when the drawer's weekly toast is due and a note was written on
  today's date in an earlier year, it shows that note headed "Three years ago today" (`onThisDay`, `yearsAgoToday` in
  `src/lib/drawer-rules.ts`, tested). Otherwise it's the random note as before. Nothing added to tap or wait for. The
  note's earlier-year match uses the reader's local calendar day. Fixtures hold one such line (two years ago today).

- **D16 (haptics)** Done 2026-11-12 (run 56, class C): the book page's Status select ticks once (15 ms) on any change besides Read, which keeps its two thunks, and the Rating select ticks lighter (10 ms). `BookPage.tsx`.
- **O6 (aria role on the toast)** Done 2026-11-12 (run 49, class C): the Desk's drawer toast is a `motion.div` with `role="status"` (was `motion.aside`, a role ARIA forbids on `aside`; Lighthouse's `aria-allowed-role`). No visual change.

## 8. Keeping this plan good

The plan is part of the work, and a run may improve it as well as follow it.

- **Evidence or it isn't an item.** A file and function, a measurement, or Steve's words. "Could be nicer" is
  not an item.
- **Split anything L** before starting it. Merge duplicates. Drop what a decision in `PLAN.md` rules out.
- **Re-score when facts change:** an item measured and found harmless goes down or out; one Steve mentions
  goes up.
- **Keep it short.** Done items leave §4 for §7. §6 keeps the last ten runs in full and one line each for older
  ones. If this file passes about 400 lines, the next run's job is pruning it.
- **Learned rules go in `CLAUDE.md`,** not here, when they'd save any future session a mistake (a gotcha in the
  build, a thing that looks broken and isn't).
- **Every tenth run is a review of the loop itself:** what share of runs' commits Steve left alone (there are no
  pull requests: count reverts and hand-edits of loop commits), which kind were undone and why, whether the scoring is picking what he'd pick. Change §1 to §3 to fit, and say
  what changed in the log.
