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

**Schedule (Steve, 2026-11-10):** one agent every four hours, never two at once.

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
| H8 | **Notes and books removed on Hardcover stay in Margin.** SPEC §3.5 records this as a known gap because deletions aren't reported. The hourly compare already reads the whole library; it could also list journal ids and offer (not silently apply) "3 notes were removed on Hardcover: remove here too?". | SPEC §3.5 "Not synced" | A design question | L | D | decided: see H17 |
| H9 | **Fields that only travel one way.** Owned, recommended-by and date added come in from Hardcover but a change in Margin never goes back; the push sends status, rating and review only. **Decided (Steve, 2026-11-10): any field Hardcover supports goes back to it.** First list what `UserBookUpdateInput` and the read and journal inputs accept (from Hardcover's docs or a read-only introspection fixture, E5), then send every one Margin holds, one field per run, each with a test and the same "a waiting change wins" rule. Margin-only corrections (`reads.edits`) stay Margin's. | `flush` `update_user_book` object vs `mapUserBook` | Sure | M, then S each | D | ready |
| H10 | **Confirm the journal tag shape.** Tags are sent as `{category: 'general', spoiler: false, tag}`, marked unverified in the code. One real tagged note from Steve, then a fixture and a test. | `journalObject` in `convex/lib/hardcover.ts` | Open | S | D | needs Steve |
| H11 | **Lighter hourly compare.** Every hour the whole library is fetched with full metadata to catch read-date changes. Split it: dates and read ids hourly, titles/tags/author facts daily. Fewer and smaller requests, and fewer reactive wake-ups. | `reconcile`, `LIBRARY_QUERY` | Sure it's heavier than needed; gain unmeasured | M | D | ready |
| H12 | **Finish Phase 4's own checks.** `PLAN.md` still lists "progress logged on Hardcover appears in Margin within 2 minutes" and "a re-pull creates no duplicates" as not checked. Steve checks the first; a test can cover the second (import twice, compare counts). | `PLAN.md` Phase 4 | n/a | S | A | ready (the test half) |
| H13 | **Offline writes keep their own time.** A note or progress written offline is stamped when it's replayed, not when it was written, and a stale offline progress can move a book backwards over a newer place that arrived from Hardcover. Carry the written-at time in the queued write, and ignore a queued progress older than the read's latest log. | `src/lib/outbox.ts`; `logProgress` and `addEntry` use `Date.now()` | Sure | M | B | ready |
| H14 | **Books Hardcover doesn't have.** SPEC §3.1 says search falls back to Open Library, then Google Books. Only Hardcover is searched, so a book it lacks can't be added. | `convex/books.ts` `search` | Sure | L | C | **dropped 2026-11-10: Steve doesn't need books Hardcover lacks.** Take the Open Library and Google Books fallback out of SPEC §3.1 and PLAN (B7) |
| H15 | **Progress history from Hardcover's journal.** Hardcover keeps dated progress events; Margin's `progressLog` only starts when Margin did. Reading those in (read-only) would fill the Desk's chart and "pages by month" for years before Margin. Explore the journal's event types first. | `mapJournal` drops everything but quotes and notes | An idea | M | B | ready (explore, read-only fixture needed: E5) |
| H16 | **Series from Hardcover.** On finishing a book that's in a series, offer the next one for the TBR. Needs Hardcover's series fields in the library query. | not built | An idea | M | C | needs Steve |
| H17 | **Offer to remove what Hardcover removed** (Steve, 2026-11-10; this is H8 decided). The hourly compare lists the journal ids and books Hardcover still has; anything Margin holds with a Hardcover id that's gone is shown in Settings and on its book, with "Remove here too" and "Keep". Never removed without the tap. Kept ones aren't offered again. | H8 | Decided | L: split into books, then notes | D | ready |

### B: bugs and correctness

| Id | Item | Evidence | Sure? | Size | Class | Status |
|---|---|---|---|---|---|---|
| B2 | **No error or not-found screens.** No route has an `errorComponent` or `notFoundComponent`, so a thrown render error is a blank page and a bad address shows the router's default. Add one of each in the catalog's voice, with a way back to the Desk. | no matches for either in `src/` | Sure | S | C | ready |
| B3 | **Signing out leaves queued writes behind.** `forgetDevice` clears the cached library but not the IndexedDB outbox, so writes queued under one sign-in replay under the next. One reader today, so harmless; wrong the day there are two. | `forgetDevice`, `deviceStore` | Sure | S | B | ready |
| B4 | **A write can be sent twice.** `keepThenSend` stores then sends; if the connection flaps, `replay` can send the same stored write while the first is still in flight. Entries dedupe; progress gets two log rows, which doubles a step on the Desk chart. Hold a lock while replaying, or skip ids in flight. | `src/lib/outbox.ts` | Fairly sure | S | B | ready |
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
| O6 | **Lighthouse pass** (PLAN Phase 7.3: 90+ for accessibility and performance on mobile; SPEC §6: LCP under 2.5 s on mid-range Android). Never run. Needs E1 to get past sign-in. | `PLAN.md` Phase 7 | n/a | M | A | ready |
| O7 | **Tests run one worker per file.** Vitest reports about 1.75 s to save with `isolate: false`. Try it; keep it only if nothing leaks between files. | `npm test` output | Sure | S | A | ready |

### U: UI and UX

Every item here is class C unless it's a plain bug. Look at each in fixture mode (§1a) before and after.

| Id | Item | Evidence | Size | Status |
|---|---|---|---|---|
| U9 | **Drawings in the dark theme.** In fixture mode a book with a drawing shows as a pale panel with black ink on Shelves at night, where SPEC §3.11 says `invert` plus `screen`. It may be the stand-in art (an SVG, not a WebP), a decision since the spec, or a bug. Check with Steve's eyes on a real drawing before touching it. | `fixture-shots/shelves.phone.dark.png` | S | needs Steve |
| U1 | **An accessibility sweep, one surface per run:** focus order and visible focus, names on icon buttons, contrast in both themes (WCAG AA is a brand commitment), 48dp targets, nothing hover-only, toasts announced once. Start with the Desk and the book page. | `PRODUCT.md` Accessibility; never audited | M each | ready |
| ~~U2~~ | **Dropped 2026-11-10 (Steve doesn't want motion reduced).** ~~A reduced-motion sweep.~~ Nine places mention reduced motion; `PLAN.md` wants a designed path for every animation. List every animation, tick the ones with a designed still version, fix the rest. | `grep prefers-reduced-motion` | M | ready |
| U3 | **Loading and empty states.** Several screens show a bare "Opening…" line. DESIGN-DIRECTION asks for "something small and alive". Design one empty state and one loading state and use them everywhere. | `Desk.tsx`, `__root.tsx` | M | ready |
| U4 | **The review queue is buttons "for now".** PLAN and DESIGN-DIRECTION describe an index-card stack to swipe. | `PLAN.md` Phase 5.2; `Review.tsx` | M | ready |
| U5 | **The Pile, as Steve left it:** thinner books; on a phone, unfurl summaries only in the middle; "not loving the book style". | `PLAN.md` Held for after the build | M | needs Steve (what style instead?) |
| U6 | **Grouping note, quote and progress** as one action, since they're similar. | `PLAN.md` Held for after the build | M | needs Steve |
| U7 | **Offline is invisible.** Nothing says "you're offline: showing your last visit" or "2 notes waiting to send". A small, quiet line when either is true. | `useOnline`, `deviceStore.all` exist; nothing renders them | S | ready |
| U8 | **Five tabs where the design said four.** Steve, 2026-11-10: five is right (Desk, Shelves, Notes, Explore, Capture). The brief, plan, spec and DESIGN.md now say so. | `__root.tsx` `tabs` | S | **done 2026-11-10** |

### D: surprise and delight

Steve enjoys the animations and transitions, so this theme adds motion and never takes it away. "Delight, but
never in the way": nothing here may add a tap or delay an input. Every fourth run picks from here (§3).

| Id | Item | Notes | Size | Status |
|---|---|---|---|---|
| D1 | **Check the motion table.** DESIGN-DIRECTION lists twelve moments (ribbon, highlighter drying, handwriting reveal, tags swinging, spines leaning, the drawer's flick…). Mark which exist, and build the missing ones one at a time, cheapest first. | The audit itself is class A | S, then S each | ready |
| D2 | **Shelf to book as one movement.** Only the router's default view transition is on. Name the thumbnail so it travels from the shelf cell to the book page header. | `main.tsx` `defaultViewTransition`; no `view-transition-name` on thumbs | M | ready |
| D4 | **A year in the catalog.** A printable end-of-year sheet in the Fair-catalog look: the year's books as stamps, pages, the most-marked book, the line most returned to. December is close. | `stats.ts` has most of the numbers | L | needs Steve |
| D5 | **Typewriter sound,** off by default, as the brief always described. | `Typewriter.tsx` has no audio | S | ready |
| D6 | **Finishing a book** beyond the stamp: the library card gets its date stamp with the thunk and slight turn the brief describes, and the book walks to the Pile. | `a3985b8` added stamps; compare with the brief | M | ready |
| D7 | **Citation cards in the buddy's replies** (SPEC §3.8: a cited entry renders as a clickable index card). Not built. | `Buddy.tsx` | M | ready |
| D8 | **New books get drawn on their own.** SPEC §3.11 says a book being read is drawn straight away; today nothing is drawn until the bulk script runs. Costs money per book, so it needs a yes and a cap. | SPEC §3.11 "When it runs" | M | **dropped 2026-11-10: Steve doesn't want books drawn automatically.** SPEC §3.11 should say so (B7) |
| D9 | **Pull to refresh on the Desk** that asks Hardcover now, not at the next two-minute tick. | DESIGN-DIRECTION "pull-to-refresh where it means something" | S | ready (class D: it calls the sync) |

### S: spec items not yet built (pointers, so they aren't lost)

Rolling memory summaries and the other buddy tools (§3.8); the eval set at ten books (`docs/eval/` has one);
the review-queue nudge (§3.3); drawer filters and actions (§3.9); "ask your library" (waits, by decision);
author-fact gaps filled by a model (§3.7). None is for an unattended run to start without Steve choosing it.

## 5. Questions for Steve

Answer in this file, dated, and the items unblock.

**Answered 2026-11-10:**
- Merges are automatic, and runs push to `main` (§2).
- One agent every four hours. A failed build is the next run's job (§1).
- Removed on Hardcover: Margin offers to remove it, and never does it unasked (H17).
- Books are not drawn automatically (D8 dropped).
- Motion is not to be reduced (§2; U2 dropped).
- No one big annoyance right now, so §3's scoring decides.
- Any field Hardcover supports goes back to it when changed in Margin (H9).
- Books Hardcover lacks aren't needed (H14 dropped).
- Five tabs is right; the docs were brought into line (U8).

**Open:**
- **Q6.** (B6) The guide page: build it (the guide so far, cut at your place), or remove the route?
- **Q10.** (U9) Should a drawing invert at night, as SPEC §3.11 says?
- **Q11.** (E5, H10) Could you capture a few read-only Hardcover replies, and tag one real note there, so the
  sync tests rest on real shapes?

## 6. Run log

Newest first. One entry per run: date, what was assessed, what was done, how it was verified, what's waiting.

- **2026-11-10, run 6 (unattended).** Ground: `main` at `ffd27d1`, CI green (Vercel not checked: no deploy status
  reachable from here). Assessed theme U at last, reading fixture shots of Desk, book, Shelves and Notes (phone and
  desktop, light and dark; 16 shots, nothing wider than its screen, no errors). Seen: on the phone Desk the progress
  chart's first-point label ("13%") sits on the start of its line, small and unchanged by this run; the rest read
  fine. Not read: the other 25 screens, so U assessment continues next run. Did B5 (class B), see §7. Verified:
  lint clean, 272 tests (1 new; the function it tests didn't exist before), build and budget green (main chunk
  618.0 kB), no fixture code in `dist/`. Not checked: the Desk on the real library. Local `git reset --hard` was
  refused by the sandbox, so the run fast-forwarded `main` instead.

- **2026-11-10, run 5 (unattended).** Ground: `main` at `48e6ebf`, CI green. Did B1 (class B, data-loss rule §3.1),
  see §7. Re-checked B5 against the code: still real (`Date.now()` at `convex/library.ts` `activity`, the `movedIn`
  call). Verified: the three new tests failed before the fix and pass after; lint clean, 271 tests, build and budget
  green (main chunk 618.0 kB, slightly under budget); no fixture code in `dist/`. Not checked: a refusal on replay
  in a real browser (no way to make the server refuse in fixture mode), and the toast wording on a phone.
  Assessment of the run-1 shots (theme U) **still not done, a fourth run in a row**: next run does it first, before
  choosing anything.

- **2026-11-10, run 4 (unattended; a delight run, §3.4).** Ground: `main` at `8294a89`, CI green. Did D3 (class C),
  see §7. Verified: lint clean, 268 tests (3 new), build and budget green (main chunk unchanged); fixture-mode Desk
  read by eye on phone and desktop, light and dark: the toast says "Two years ago today", fits the screen, no page
  errors. Not checked: on Steve's real library (the toast shows weekly, so it appears on the first Desk open after
  the deploy only if a note shares today's date). Assessment of the run-1 shots (theme U) **still not done**: the
  next run starts there. `docs/IMPROVEMENT-LOOP.md` said `drawer-rules.ts` "weights by age"; it never did (fixed in §7).

- **2026-11-10, run 3 (unattended).** Ground: `main` at `d272047`, CI green. Did E4 (class A): `npm run budget`
  (`scripts/bundle-budget.mjs`, rule in `src/lib/bundleBudget.ts` with tests, numbers in `bundle-budget.json`) runs
  in CI after the build and fails if the main chunk grows more than 5% over its recorded size, raw or gzip. Checked
  it fails when the budget is lowered, then restored. Verified: lint clean, 265 tests, build green. Assessment (the
  run-1 shots, theme U) **still not done**: this run had no browser pass either, so the next run starts there.
  Seen in passing: Vitest still says `isolate: false` would save ~2.8 s (O7).

- **2026-11-10, run 2 (unattended).** Ground: `main` at `436f12c`, CI green. Did E3 (class A): lint now covers
  `convex/` and `scripts/`; one warning fixed (`endsWith`, same behaviour). Verified: lint clean, 261 tests,
  build green. Assessment (reading the run-1 shots, theme U) not done: this run had no browser pass, so **the
  next run still starts there**. Pushed to the session branch `ccr-8f1e003b-tnfzh4`, not `main` (see report).

- **2026-11-10, run 1 (fixture mode, with Steve).** Built E1 and most of E2: `fixtures/` (the made-up library and
  the generator that runs Margin's real queries over it), `src/fixtures/backend.tsx` (the stand-in client),
  `npm run fixtures`, `scripts/fixture-shots.mjs`. Checked: 116 shots (29 screens, two widths, two themes), no
  page errors but the blocked Google script, nothing wider than its screen; Desk, book page and Shelves read by
  eye; lint, tests (261) and build green; no fixture code in `dist/`. Recorded Steve's answers in §5 and changed
  §1 to §3 to match (push to `main`, four-hourly, motion never reduced). Found U9. Not checked: the `empty` and
  `slow` variants beyond loading, and most shots weren't read by eye, so **the next run's assessment is to read
  them, theme U first**, and file what it sees.
- **2026-11-10, run 0 (the audit).** Read every doc, the Hardcover sync, the server library and entries
  code, the offline layer, the shell and the Desk; grepped the rest. `lint`, `test` (260 pass) and `build` green
  at `5e210e8`. Wrote this file. Changed no code. Not looked at closely yet, so start assessments here: the buddy
  and guide (`convex/buddy*.ts`, `guide*.ts`), Explore's layout cost on a phone, Shelves at 2,000 books, the Kobo
  and Play Books imports, `app.css` (1,144 lines) for dead rules. 

## 7. Done and dropped

Move items here with the date and the commit or the reason. Keep the id so old log entries still make sense.

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
