# Margin: continuous improvement loop

A standing backlog and the rules for working through it, one small piece per run. `SPEC.md` says what Margin
is, `PLAN.md` how it was built; this file is what to make better next, and how an unattended run does it safely.

Started 2026-11-10 from a read of the whole codebase at `5e210e8`. Nothing in the first backlog was observed in
the running app: no run can sign in as Steve, so every item is from reading code, the build output and the tests.
Items say how sure they are.

---

## 1. How a run works

Each run does one cycle, then stops. A run is small on purpose: one item, or two that touch the same code.

1. **Read** `CLAUDE.md`, this file, and the parts of `SPEC.md` / `DESIGN.md` the chosen item touches.
2. **Check the ground.** `git log` since the last entry in §6, open pull requests from earlier runs, and CI on
   `main`. If CI on `main` is red, fixing that is the run. If an earlier run's pull request is still open, don't
   stack a second change on the same files.
3. **Assess** (10 minutes, not the whole run). Look at one area with fresh eyes, rotating through §4's themes in
   order (the last one assessed is in §6). Add what you find to the backlog with evidence. Re-check one existing
   item against the code: if it's fixed, stale or wrong, say so and move it to §7.
4. **Choose** the top item by §3 that is `ready`, fits the run, and is inside §2's limits. Prefer finishing a
   started item over starting one.
5. **Do it.** Reproduce a bug in a test before fixing it. Logic goes in `src/lib/` or `convex/lib/` with its
   test. Keep the change to what the item needs.
6. **Verify.** `npm run lint`, `npm test`, `npm run build`, all green. For anything visible, screenshots at phone
   (412×915) and desktop (1280×800) widths, both themes, attached to the pull request.
7. **Update this file** in the same change: the item's status, §6's log, anything learned, new items found on
   the way. A run that changes code and not this file isn't finished.
8. **Hand over** as §2 says, and stop.

If nothing is `ready` and safe, the run only assesses, updates the plan, and says what it needs from Steve.

**Suggested instruction for the scheduled job:** "Read `docs/IMPROVEMENT-LOOP.md` in `steebus/margin` and do one
run exactly as §1 describes, inside §2's limits. Finish by telling me what changed, what you verified and how,
and what you need from me."

## 2. Limits for an unattended run

Margin's one Convex deployment is production and holds the real library, and Margin writes to Steve's real
Hardcover account. Pushing to `main` deploys both. So:

- **Hand over by pull request, never by pushing to `main`.** One branch and one pull request per run, CI green,
  with what was verified and what wasn't. Steve merges. (Open question Q1: whether some classes may merge
  themselves.)
- **Never** run `npx convex dev`, `npx convex deploy`, `npx convex import`, or any script against the live
  deployment. Never call Hardcover with a mutation; tests stub `fetch`. Never spend money: no art batches, no
  guide runs, no eval runs that call a model.
- **No data migrations and no schema change that rewrites or narrows existing data.** Adding an optional field or
  an index is fine. Anything more is written up as a proposal in the item and left for Steve.
- **Visible design changes are proposals.** `PLAN.md` says a visible design change is shown to Steve before it
  ships: the pull request carries before and after screenshots and waits. Fixes to something plainly broken
  (overflow, unreadable contrast, a control that can't be reached) count as bugs, not design changes.
- **Don't reopen decisions.** `PLAN.md` lists what was dropped (in-app camera, Kindle imports, the capture
  endpoint, model-chosen books). Dated notes saying "Steve, 2026-…" are decisions. A run may add a question to
  §5; it may not build the other answer.
- **Secrets.** The repo is public. Nothing from `.env`, Convex env or a token goes in code, tests, logs, this
  file or a pull request.
- **Every animation ships with its reduced-motion path in the same change.** Books are 2:3. The hand script is
  for the reader's words only.
- A run that can't verify something says so. "Tests pass" is not "works on the phone".

### Risk classes

| Class | Means | Hand-over |
|---|---|---|
| **A** | Tests, docs, dead code, build size, internal refactor with tests unchanged | pull request |
| **B** | Behaviour fix with a new test, no schema change, nothing visible beyond the fix | pull request |
| **C** | Visible design or copy change, new feature, new dependency | pull request with screenshots; Steve decides |
| **D** | Hardcover write paths, sync conflict rules, schema, auth, cost | pull request plus a written risk note; Steve tests on the real account before merging |

## 3. Choosing what's next

Score = (how much Steve feels it × how sure we are it's real) ÷ size, then by class: when two score alike, the
lower class goes first. Rules that override the score:

1. Data loss or silent corruption beats everything.
2. A thing that makes later runs better at verifying (fixtures, tests, measurements) beats a feature of the
   same size.
3. No more than one class C or D pull request open at a time.
4. Every fourth run is a delight or design item, so the loop doesn't only ever fix plumbing.

Sizes: **S** under an hour, **M** a run, **L** more than a run (split it before starting).
Status: `ready`, `needs Steve` (see §5), `started`, `in review` (pull request open), `done`, `dropped`.

## 4. Backlog

Ids are stable. New items take the next number in their theme. Evidence is a file and function, so it survives
line numbers moving.

### E: enabling work (do these first; they make every later run trustworthy)

| Id | Item | Evidence | Size | Class | Status |
|---|---|---|---|---|---|
| E1 | **A fixture mode for looking at the app.** No run can sign in, so no run can see a screen. A dev-only way to render routes on recorded, made-up library data (a fake `useBooks`/`useEntries`/`useActivity` source behind a `?fixture` flag or a `/__fixtures` route excluded from production builds) lets runs take screenshots, check overflow and reduced motion, and run Lighthouse. | `src/lib/offline.ts` is already the one place most screens get data | M | A | ready |
| E2 | **Screenshot and overflow check script** on top of E1: every route, two widths, two themes, saved as artifacts; fails on an element wider than the viewport (measure rects, as `CLAUDE.md` says, and scroll with the real wheel so lazy cells load). | `CLAUDE.md` notes on `overflow-x: clip` and lazy cells | M | A | ready after E1 |
| E3 | **Lint `convex/` and `scripts/` too.** `npm run lint` is `oxlint src`, so half the code is never linted. Fix what it finds in a separate commit. | `package.json` | S | A | ready |
| E4 | **Bundle budget in CI.** Record the main chunk's size and fail the build if it grows more than 5% without the budget being raised on purpose. Baseline 2026-11-10: `index` 620 kB (194 kB gzip), precache 77 files, 1,439 kB. | `npm run build` output | S | A | ready |
| E5 | **Recorded Hardcover fixtures.** `PLAN.md`'s risk table promises "recorded fixtures in tests" for Hardcover; the sync tests build their own replies by hand. Record the shapes of real read-only replies (scrubbed) so a schema change on Hardcover's side shows up as a failing test. Needs Steve to capture them once. | `convex/hardcoverSync.test.ts`, `PLAN.md` Risks | M | A | needs Steve |

### H: Hardcover connection

| Id | Item | Evidence | Sure? | Size | Class | Status |
|---|---|---|---|---|---|---|
| H1 | **The two-minute pull can stall for good.** When a page comes back full (100 books or 100 journal rows changed since the cursor), the cursor is kept where it was, so the next run asks the same question and gets the same 100. The comment says "only move as far as what was actually seen"; the code doesn't move at all. Fix: ask for `updated_at`, and move the cursor to the newest one seen (or page with an offset until short). Triggered by a bulk change on Hardcover, or a long outage followed by a backlog. | `convex/hardcover.ts` `syncAll`, the `full` branch | Sure from the code; never seen live | M | D | ready |
| H2 | **A review cleared in Margin comes back.** `saveReview` deletes the review entry when the words are emptied, but the push only sends `review_raw` when there are words, so Hardcover keeps the old review and the next pull re-creates the entry. Fix needs care: sending `null` blindly could wipe a review written on Hardcover moments ago. Suggest a `reviewCleared` marker on the read, sent once. | `convex/library.ts` `saveReview`; `convex/hardcover.ts` `flush` (`review_raw`) and `saveBooks` (review block) | Sure from the code | M | D | ready |
| H3 | **An edited review can be put back by the pull.** `saveBooks` skips a read's fields while Margin has a change waiting, but the review block below it doesn't check, so Hardcover's old text can overwrite Margin's new text before the push leaves, and then the old text is what's pushed. Most likely right after finishing a book, which is when reviews get written. | `convex/hardcover.ts` `saveBooks`: `waiting` guards the read patch, not the review | Fairly sure | S | D | ready |
| H4 | **Sync trouble is only visible in Settings.** SPEC §3.4.1 says a failed push shows on the book's page; it doesn't. Add a small "not on Hardcover yet / couldn't send: why" line to the book page and a quiet mark on the Desk when the last sync failed or anything has waited more than an hour. | `syncStatus` is used only in `Settings.tsx` | Sure | M | C | ready |
| H5 | **Say when the token has gone.** A 401 or 403 from Hardcover is stored as "Hardcover answered 401." and retried for ever. Recognise it, stop hammering, say "Hardcover's token has expired: put a new one in the Convex env", and send one push nudge. Check Hardcover's docs for when tokens expire. | `gql` in `convex/hardcover.ts` | Sure | S | B | ready |
| H6 | **One pace for all callers, and honour `Retry-After`.** The pull, the hourly compare and the outbox each wait 4.5 s on their own, so together they can go three times the intended rate; a 429 always sleeps a flat 60 s. Check Hardcover's current published limits first (the "15" in SPEC was read from a header on 2026-11-02 with the window unknown) and write the real numbers into SPEC. | `pace`, `gql`, `syncAll`, `reconcile`, `flush` | Sure about the code; the limit itself needs checking | M | D | ready |
| H7 | **Give up gracefully.** An outbox row that keeps failing retries hourly for ever with no way to see or drop it. After N tries, mark it stuck, show it in Settings with the error and "try again" / "discard". | `fail`, `retryDelayMs`; `syncStatus` counts at most 100 and shows one error | Sure | M | C | ready |
| H8 | **Notes and books removed on Hardcover stay in Margin.** SPEC §3.5 records this as a known gap because deletions aren't reported. The hourly compare already reads the whole library; it could also list journal ids and offer (not silently apply) "3 notes were removed on Hardcover: remove here too?". | SPEC §3.5 "Not synced" | A design question | L | D | needs Steve (Q3) |
| H9 | **Fields that only travel one way.** Owned, recommended-by and date added come in from Hardcover but a change in Margin never goes back; the push sends status, rating and review only. Decide which should be two-way. | `flush` `update_user_book` object vs `mapUserBook` | Sure | M | D | needs Steve (Q4) |
| H10 | **Confirm the journal tag shape.** Tags are sent as `{category: 'general', spoiler: false, tag}`, marked unverified in the code. One real tagged note from Steve, then a fixture and a test. | `journalObject` in `convex/lib/hardcover.ts` | Open | S | D | needs Steve |
| H11 | **Lighter hourly compare.** Every hour the whole library is fetched with full metadata to catch read-date changes. Split it: dates and read ids hourly, titles/tags/author facts daily. Fewer and smaller requests, and fewer reactive wake-ups. | `reconcile`, `LIBRARY_QUERY` | Sure it's heavier than needed; gain unmeasured | M | D | ready |
| H12 | **Finish Phase 4's own checks.** `PLAN.md` still lists "progress logged on Hardcover appears in Margin within 2 minutes" and "a re-pull creates no duplicates" as not checked. Steve checks the first; a test can cover the second (import twice, compare counts). | `PLAN.md` Phase 4 | n/a | S | A | ready (the test half) |
| H13 | **Offline writes keep their own time.** A note or progress written offline is stamped when it's replayed, not when it was written, and a stale offline progress can move a book backwards over a newer place that arrived from Hardcover. Carry the written-at time in the queued write, and ignore a queued progress older than the read's latest log. | `src/lib/outbox.ts`; `logProgress` and `addEntry` use `Date.now()` | Sure | M | B | ready |
| H14 | **Books Hardcover doesn't have.** SPEC §3.1 says search falls back to Open Library, then Google Books. Only Hardcover is searched, so a book it lacks can't be added. | `convex/books.ts` `search` | Sure | L | C | needs Steve (Q5) |
| H15 | **Progress history from Hardcover's journal.** Hardcover keeps dated progress events; Margin's `progressLog` only starts when Margin did. Reading those in (read-only) would fill the Desk's chart and "pages by month" for years before Margin. Explore the journal's event types first. | `mapJournal` drops everything but quotes and notes | An idea | M | B | ready (explore, read-only fixture needed: E5) |
| H16 | **Series from Hardcover.** On finishing a book that's in a series, offer the next one for the TBR. Needs Hardcover's series fields in the library query. | not built | An idea | M | C | needs Steve |

### B: bugs and correctness

| Id | Item | Evidence | Sure? | Size | Class | Status |
|---|---|---|---|---|---|---|
| B1 | **Words written offline can vanish without a word.** When a queued write is refused on replay, it's removed from the device and only logged to the console. It should raise the same "Not saved" toast as a live refusal, holding the words. | `useReplayOutbox` in `src/lib/offline.ts`; `FailureToast` already takes `words` | Sure | S | B | ready |
| B2 | **No error or not-found screens.** No route has an `errorComponent` or `notFoundComponent`, so a thrown render error is a blank page and a bad address shows the router's default. Add one of each in the catalog's voice, with a way back to the Desk. | no matches for either in `src/` | Sure | S | C | ready |
| B3 | **Signing out leaves queued writes behind.** `forgetDevice` clears the cached library but not the IndexedDB outbox, so writes queued under one sign-in replay under the next. One reader today, so harmless; wrong the day there are two. | `forgetDevice`, `deviceStore` | Sure | S | B | ready |
| B4 | **A write can be sent twice.** `keepThenSend` stores then sends; if the connection flaps, `replay` can send the same stored write while the first is still in flight. Entries dedupe; progress gets two log rows, which doubles a step on the Desk chart. Hold a lock while replaying, or skip ids in flight. | `src/lib/outbox.ts` | Fairly sure | S | B | ready |
| B5 | **`activity` reads the clock inside a query.** Convex queries should be deterministic; `Date.now()` in one defeats caching and can give a stale "two weeks". Pass `now` from the client as `since` already is. | `convex/library.ts` `activity` | Sure | S | B | ready |
| B6 | **Three routes are still placeholders:** `/books/:slug/guide`, `/imports/:jobId`, `/settings/integrations/:provider`. Build, redirect or remove each, and make SPEC §4.1 match. | `src/routes/*` importing `Placeholder` | Sure | S each | C | needs Steve (Q6) |
| B7 | **Docs have drifted.** `SPEC.md` repeats §3.6 to §6 twice, and the first §3.6 says there is no Explore screen. `README.md` says the buddy and art are "still to come". SPEC §4 says `injectManifest` and a share-target POST handler; the build is `generateSW` with a GET share target. `PLAN.md`'s repo layout lists folders that don't exist. Bring them in line with what's built. | the files themselves | Sure | S | A | ready |

### O: optimisation

| Id | Item | Evidence | Sure? | Size | Class | Status |
|---|---|---|---|---|---|---|
| O1 | **The Desk downloads every note ever written** to show one toast and decide an empty state. `allEntries` returns the full text of every entry, and re-sends all of it whenever any entry changes. Give the Desk a small query (latest entry, a count, one random pick) and keep `allEntries` for Notes, the Drawer and the Pile. | `Desk.tsx` uses `useEntries`; `convex/library.ts` `allEntries` | Sure | M | B | ready |
| O2 | **The offline copy is kept in localStorage,** which holds about 5 MB and is written synchronously on every live update. A few thousand highlights will pass that, and the write fails silently, so offline reading quietly stops working. Measure the real sizes first; if they're near, move the copies to IndexedDB. | `remember` in `src/lib/offline.ts` swallows the quota error | A risk, unmeasured | M | B | ready (measure first; needs Steve's numbers or E1) |
| O3 | **Main chunk is 620 kB (194 kB gzip).** By source share it's roughly react-dom 30%, Motion 26%, zod 18%, convex 9%, Margin's own code 9% (rough: measured on source, not output). Candidates: Motion's `LazyMotion` with the `m` components; zod only where a route validates search params, or `zod/mini`; check the Desk's route isn't dragging other screens in. Measure each change against E4's baseline. | build output; source-map estimate 2026-11-10 | Sure of the size; gains unmeasured | M | A | ready |
| O4 | **Fonts.** Five display faces for the Pile's spines are imported by the Desk's `RecentPile` too, and Source Serif ships Cyrillic, Greek and Vietnamese subsets into the precache (about 90 kB) for an English library. Import only the Latin subsets; keep the Pile faces out of first paint. | `RecentPile.tsx`, `Pile.tsx`, `main.tsx`; `dist/assets/*.woff2` | Sure | S | A | ready |
| O5 | **`myBooks` re-sends the whole library on any change to any read.** Fine at 600 books; watch it. If Shelves ever janks on a sync, split the hot fields (progress, status) from the cold ones. Measure before touching. | `convex/library.ts` `myBooks` | A watch item | L | B | ready (measure only) |
| O6 | **Lighthouse pass** (PLAN Phase 7.3: 90+ for accessibility and performance on mobile; SPEC §6: LCP under 2.5 s on mid-range Android). Never run. Needs E1 to get past sign-in. | `PLAN.md` Phase 7 | n/a | M | A | ready after E1 |
| O7 | **Tests run one worker per file.** Vitest reports about 1.75 s to save with `isolate: false`. Try it; keep it only if nothing leaks between files. | `npm test` output | Sure | S | A | ready |

### U: UI and UX

Every item here is class C unless it's a plain bug. All need E1 before a run can see its own work.

| Id | Item | Evidence | Size | Status |
|---|---|---|---|---|
| U1 | **An accessibility sweep, one surface per run:** focus order and visible focus, names on icon buttons, contrast in both themes (WCAG AA is a brand commitment), 48dp targets, nothing hover-only, toasts announced once. Start with the Desk and the book page. | `PRODUCT.md` Accessibility; never audited | M each | ready after E1 |
| U2 | **A reduced-motion sweep.** Nine places mention reduced motion; `PLAN.md` wants a designed path for every animation. List every animation, tick the ones with a designed still version, fix the rest. | `grep prefers-reduced-motion` | M | ready after E1 |
| U3 | **Loading and empty states.** Several screens show a bare "Opening…" line. DESIGN-DIRECTION asks for "something small and alive". Design one empty state and one loading state and use them everywhere. | `Desk.tsx`, `__root.tsx` | M | ready after E1 |
| U4 | **The review queue is buttons "for now".** PLAN and DESIGN-DIRECTION describe an index-card stack to swipe. | `PLAN.md` Phase 5.2; `Review.tsx` | M | ready after E1 |
| U5 | **The Pile, as Steve left it:** thinner books; on a phone, unfurl summaries only in the middle; "not loving the book style". | `PLAN.md` Held for after the build | M | needs Steve (what style instead?) |
| U6 | **Grouping note, quote and progress** as one action, since they're similar. | `PLAN.md` Held for after the build | M | needs Steve |
| U7 | **Offline is invisible.** Nothing says "you're offline: showing your last visit" or "2 notes waiting to send". A small, quiet line when either is true. | `useOnline`, `deviceStore.all` exist; nothing renders them | S | ready |
| U8 | **Five tabs where the design says four.** The bar is Desk, Shelves, Notes, Explore, Capture; DESIGN-DIRECTION and PLAN say Desk, Shelves, Capture, Explore. Either the doc or the bar is out of date. | `__root.tsx` `tabs` | S | needs Steve (which is right?) |

### D: surprise and delight

Each is a proposal with screenshots or a short recording. "Delight, but never in the way": nothing here may add
a tap or delay an input. Every fourth run picks from here (§3).

| Id | Item | Notes | Size | Status |
|---|---|---|---|---|
| D1 | **Check the motion table.** DESIGN-DIRECTION lists twelve moments (ribbon, highlighter drying, handwriting reveal, tags swinging, spines leaning, the drawer's flick…). Mark which exist, and build the missing ones one at a time, cheapest first. | The audit itself is class A | S, then S each | ready |
| D2 | **Shelf to book as one movement.** Only the router's default view transition is on. Name the thumbnail so it travels from the shelf cell to the book page header. | `main.tsx` `defaultViewTransition`; no `view-transition-name` on thumbs | M | ready after E1 |
| D3 | **On this day.** The drawer's toast, when there's a note or a finished book from this date in an earlier year, says so: "Three years ago today you underlined this." | `drawer-rules.ts` already weights by age | S | ready |
| D4 | **A year in the catalog.** A printable end-of-year sheet in the Fair-catalog look: the year's books as stamps, pages, the most-marked book, the line most returned to. December is close. | `stats.ts` has most of the numbers | L | needs Steve |
| D5 | **Typewriter sound,** off by default, as the brief always described. | `Typewriter.tsx` has no audio | S | ready |
| D6 | **Finishing a book** beyond the stamp: the library card gets its date stamp with the thunk and slight turn the brief describes, and the book walks to the Pile. | `a3985b8` added stamps; compare with the brief | M | ready after E1 |
| D7 | **Citation cards in the buddy's replies** (SPEC §3.8: a cited entry renders as a clickable index card). Not built. | `Buddy.tsx` | M | ready |
| D8 | **New books get drawn on their own.** SPEC §3.11 says a book being read is drawn straight away; today nothing is drawn until the bulk script runs. Costs money per book, so it needs a yes and a cap. | SPEC §3.11 "When it runs" | M | needs Steve (Q7) |
| D9 | **Pull to refresh on the Desk** that asks Hardcover now, not at the next two-minute tick. | DESIGN-DIRECTION "pull-to-refresh where it means something" | S | ready (class D: it calls the sync) |

### S: spec items not yet built (pointers, so they aren't lost)

Rolling memory summaries and the other buddy tools (§3.8); the eval set at ten books (`docs/eval/` has one);
the review-queue nudge (§3.3); drawer filters and actions (§3.9); "ask your library" (waits, by decision);
author-fact gaps filled by a model (§3.7). None is for an unattended run to start without Steve choosing it.

## 5. Questions for Steve

Answer in this file, dated, and the items unblock.

- **Q1.** May class A and B pull requests merge themselves when CI is green, or does everything wait for you?
- **Q2.** How often should the loop run, and may it open a pull request while one is still waiting?
- **Q3.** (H8) When a note or book is removed on Hardcover: keep it in Margin as now, offer to remove it, or
  remove it?
- **Q4.** (H9) Which of owned, recommended-by and date added should go back to Hardcover when changed here?
- **Q5.** (H14) Do you ever need a book Hardcover doesn't have? If not, drop the fallback from SPEC.
- **Q6.** (B6) The guide page: build it (the guide so far, cut at your place), or remove the route?
- **Q7.** (D8) Draw a book automatically when it's started? At about 3.4 cents each, with what monthly cap?
- **Q8.** What annoys you most right now? One line here outranks everything in §4.

## 6. Run log

Newest first. One entry per run: date, what was assessed, what was done, how it was verified, what's waiting.

- **2026-11-10, run 0 (the audit).** Read every doc, the Hardcover sync, the server library and entries
  code, the offline layer, the shell and the Desk; grepped the rest. `lint`, `test` (260 pass) and `build` green
  at `5e210e8`. Wrote this file. Changed no code. Not looked at closely yet, so start assessments here: the buddy
  and guide (`convex/buddy*.ts`, `guide*.ts`), Explore's layout cost on a phone, Shelves at 2,000 books, the Kobo
  and Play Books imports, `app.css` (1,144 lines) for dead rules. **Next theme to assess: U** (needs E1, so do
  E1 first).

## 7. Done and dropped

Move items here with the date and the commit or the reason. Keep the id so old log entries still make sense.

*(nothing yet)*

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
- **Every tenth run is a review of the loop itself:** what share of pull requests Steve merged unchanged, which
  kind were rejected and why, whether the scoring is picking what he'd pick. Change §1 to §3 to fit, and say
  what changed in the log.
