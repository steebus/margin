# Margin: spec (v1)

> A reading buddy that asks, not tells. It keeps track of what you're reading,
> holds your notes and the lines you underlined, and talks with you about the
> book while you read it. It has read about the book; you are the one reading it.

v1 includes Steve's answers from every round of questions. Nothing is open.
Build order is in `PLAN.md`.

---

## 1. Principles

1. **The reader's reading wins.** A book's generally accepted themes are offered
   as *readings others have taken*, never as the answer. When the reader
   follows their own thread (prose rhythm instead of politics, a minor
   character instead of the protagonist), the buddy follows it too.
2. **Never ahead of the reader.** Nothing past the reader's current position
   reaches the conversation model or the screen. This is enforced by filtering
   the data before the model sees it, not by asking the model to be careful.
3. **Capture first, file later.** Getting a line or a thought into the app
   should take one gesture. Sorting it can wait, and the LLM can help.
4. **Your history is yours.** Imports bring years of reading in, and an export
   takes it all back out (JSON + Markdown).
5. **Delight, but never in the way.** The typewriter, paper and shelves are
   there to make the app a pleasure to use. Reduced motion, speed and clarity
   always come first.

## 2. Users and scope

- v1 is for Steve alone, but the data model is multi-user from the start:
  every row carries a `userId`, and guides are cached per *work* so other
  readers can share them later.
- Platforms: one React web app. On the phone it runs as a PWA installed on
  **Android** (Chrome); on desktop it runs in the browser. No native wrapper
  is planned.

## 3. Features

### 3.1 Library
- **Statuses:** TBR · Reading · Paused · Read · DNF. Re-reads are separate
  *reads* of the same book, each with its own dates, progress, notes and
  conversation.
- **Shelves:** user-made lists (e.g. "Booker 2026", "Lent to Sam"), separate
  from status. A book can be on many shelves.
- **Tags:** free-form, colour-coded, drawn as paper tags.
- **Source:** how you found it and why you want to read it.
  `{kind: person|podcast|article|bookshop|library|social|algorithm|citation|other, who/where, url, why (free text), date}`.
  This field is meant to be queried later, e.g. "which sources gave me books I
  rated 5?"
- **People.** Anyone who recommends a book becomes a first-class `person`,
  with their own page, so you can see whose recommendations land with you.
- **Book facts:** format (print/ebook/audio), owned/borrowed/library, edition
  page count, rating in half stars (0.5–5), dates started and finished,
  progress (percent, page or chapter).
- **Metadata** is looked up in Hardcover first, then Open Library, then Google
  Books (cover, authors, year, pages, subjects, ISBNs).
- **Filter/sort** on any of these fields plus topics. Filters can be saved as
  shelves ("smart shelves").

### 3.2 Notes, excerpts, summaries
These are one kind of record, an **entry**, with a `kind`:

| kind | is | rendered as |
|---|---|---|
| excerpt | the book's words | set in the book's serif, washed with a highlighter |
| note | the reader's words | set in the reader's handwriting, in the margin |
| summary | the reader's words, about a chapter or section | an index card |
| reflection | a reply to the buddy | handwriting, under the buddy's typed prompt |

- Every entry records where in the book it is: page, chapter, percent, and the
  Kindle location or EPUB position when one is available.
- A note can be attached to an excerpt, which is how a marginal note sits next
  to the line it is about.
- An entry also records where it came from (manual, camera, share, Kindle,
  Kobo, Play Books, Hardcover), so re-imports can skip what is already there.
- The editor is markdown-lite, with no rich-text toolbar.

### 3.3 The buddy ("have a conversation with the text")

**A guide per book.** This is generated once per *work* and cached, so every
reader of that book shares it (if multi-user).

1. **Research.** A durable Convex workflow calls Claude with web search for
   interviews, criticism, reading-group guides and summaries. The result is a
   *guide*:
   - `structure`: parts and chapters, each with an approximate percent
   - `themes`: each with a short gloss, the readings it is "commonly read as",
     and a confidence level
   - `moments`: key events or turns, each with a position (percent and/or
     chapter), a spoiler level and a confidence level
   - `questions`: a bank of prompts keyed to positions, in five registers:
     *noticing* (what struck you?), *craft* (why tell it this way?),
     *personal* (has this happened to you?), *predictive* (what do you think
     happens?), *connective* (this echoes something you read before)
   - `sources` and `knownness` (how well the model actually knows this book)
2. **Milestones.** Book-specific moments where the guide is confident,
   otherwise generic checkpoints (10/25/50/75/90/done), with one chapter-end
   prompt available whenever the reader asks.
3. **Delivery.** When a progress update crosses a milestone, a *buddy note* is
   queued and typed out the next time the reader opens the book. It is
   optional to answer, and the reader can snooze it or pass on it. Progress
   comes from manual logging and Hardcover sync.
   - **Push notifications** (Web Push in the installed Android PWA) go out
     *only* for absence or delay:
     - a book marked Reading has had no progress for N days (default 7)
     - a buddy note has gone unanswered for N days (default 3)
     - there is a review-queue backlog
     Cron-driven, with one push a day at most and quiet hours.
4. **The conversation.** A thread per read. **Persona: a knowledgeable
   Socratic tutor.** It asks one question at a time, pushes gently on vague
   answers, and is well read. It may name an accepted reading or a critic, but
   frames it as one reading among others and hands the question back. It
   knows all of the reader's books, themes and notes, and uses them (see
   §3.8).
5. **Re-reads remember.** A second read gets its own thread, but the buddy
   can see the earlier reads' book memory and entries, and draws on them
   ("last time, at this point, you thought…"). The spoiler rule does not apply
   to a book the reader has already finished once.
6. **Correction.** The reader can tell the buddy "that hasn't happened yet" or
   "that's wrong for my edition". The correction is stored as an override for
   that read, and the buddy moves the milestone.
7. **Unknown books.** When `knownness` is low, the workflow researches the
   book on the web first. If the book is still thinly known, the buddy says
   so and leans on the reader's own excerpts and notes instead of inventing
   content.

**Built so far (2026-11-02), waiting on `ANTHROPIC_API_KEY`.** The conversation (Claude Sonnet 5.5, streaming, server-side refusal
fallback), the spoiler rule (`visibleTo`, stated in the prompt from the read's own progress), the reader's notes and finished
books as context, and the cost meter. Not built: the guide, milestones, memory, push, corrections. Until a guide exists, the rule
is only an instruction to the model, not a cut in the data, so it needs the eval set before it can be trusted.

**Models.** Research runs on the most capable model, the conversation on a
mid-tier model, and routing and classification on the smallest. All prompts
are cached. There's no hard budget; a cost meter is shown in Settings, with an alert when monthly spend passes **$20** (agreed).

### 3.4 Capture
- **Camera (PWA).** Photograph a page with the phone's own camera. Gemini's small vision model transcribes it
  (paragraphs, page number, chapter if a header names one), and the text is *typed onto the page* for a few seconds
  (the signature animation). Tap the first and last word to mark a passage, correct it if needed, save it as an excerpt,
  and add a handwritten-style note, which is attached to it. **The photo is never stored.**
  Gemini's filter refuses some published text (`RECITATION`: tested on 2026-11-02 with the opening of *1984*), and it needs
  credit and a connection. Whenever it can't help, the device reads the photo itself with Tesseract (`src/lib/ocr.ts`), which
  downloads about 10 MB once. It's the reader's own photo of their own book, kept as a personal note.
- **Quick share.** Share text or a screenshot from Kindle, Play Books, a
  browser, anywhere:
  - Android: Web Share Target in the PWA manifest. The service worker takes
    the POST and opens `/capture`.
  - iOS: out of scope (no Web Share Target in Safari). An HTTP capture
    endpoint with a personal token exists anyway, for scripts.
  - **Filing.** First parse the share heuristically (Kindle and Play Books
    shares carry the title, author and location). Then the small model picks
    which currently-read book it belongs to and whether it is an excerpt or a
    note, with a confidence score. Above the confidence threshold it files
    automatically with an undo toast; below it, it asks with a single tap.

### 3.4.1 Adding books by sharing
A book worth reading usually turns up somewhere else. Share it to Margin and it lands
on the TBR list with where it came from. Same mechanism as Toodoo and Didactic: Android's
share sheet (`share_target`) and a bookmarklet both open `/capture/share?url=&title=&text=`;
the bookmarklet adds `popup=1` and closes its window when done. `src/lib/share-read.ts` works out
what was shared. What's pending survives a sign-in, as Toodoo's does.

**From Goodreads: one book.** The title and author come from the shared words, then the
page's address, and are looked up on Hardcover, most-read first. The reader confirms, optionally
picks a list, and it goes on the TBR.

**From Instagram: a post or reel, usually several books.**
1. The backend reads the public embed page (`/p/CODE/embed/captioned/`), as Didactic's
   `readInstagram` does, for the caption and the account.
2. The small model lists the books the caption mentions, with a confidence for each.
3. Each candidate is checked against book search, so a mention that matches nothing isn't
   offered as if it were a book.
4. The reader sees a checklist. Confident matches start ticked, and anything already on
   their shelves is shown but can't be added twice. Adding puts them on the TBR.
5. The account becomes the source: `source: { kind: 'social', who: '@account', url, date }`,
   and a `person`, so §3.1's "whose recommendations land" works for accounts too. It can be
   edited on the checklist.

**Reading a post** asks Instagram openly, as `margin/1.0`. Margin doesn't pretend to be a browser or a crawler, so
some posts give it nothing, and that's an ordinary outcome rather than an error (one real post checked on 2026-11-02 did).

**When there's nothing to read.** A reel's books are often only spoken or shown on screen,
and private or embed-disabled posts have no caption to fetch. The screen says so plainly and
offers typing titles, or sharing a screenshot for vision to read (§3.4). On a computer, words
selected on the page travel with the bookmarklet and are read first.

**Hardcover gets it too.** A book added this way is pushed straight away, not at the next
sync (§3.5): `insert_user_book` with its status and the account in `recommended_by`, then
`insert_list_book` for a list. Lists come in with every import and hourly pull, and are changed
from a book's page. These were confirmed against Hardcover's live schema with read-only calls on
2026-11-02; no write has been tried yet. The add never waits on it. A failed push goes in an outbox and retries, and
the book's page says so. A book already on Hardcover isn't added twice. Hardcover's
responses showed a rate limit of 15, with the window not yet known, so bulk work must pace itself.

**To check when building.** Instagram's embed page isn't
an official API, Meta's terms restrict extracting from oEmbed, and it can change without notice.
This is personal, low-volume use and screenshots remain as the way round it if it breaks. Check
the bookmarklet actually runs on Instagram and Goodreads, since a page's security rules can
block one.

### 3.5 Imports and sync

| Source | What | How | Direction |
|---|---|---|---|
| **Hardcover** | library, statuses, ratings, dates, progress, lists, reading journal (quotes/notes) | GraphQL API, personal API token pasted once and encrypted at rest | **two-way**: status, progress, rating and dates; quotes and notes too, behind a per-entry toggle that defaults to *on* (with a global default in Settings) |
| **Google Play Books** | library (shelves), highlights + notes | Books API `mylibrary` for shelves; notes from the "Play Books Notes" Drive docs (the reader enables this in Play Books settings), picked through Google Picker so we only ask for `drive.file` | in |
| **Kindle** | highlights + notes | upload `My Clippings.txt` (from the device) or the Kindle app's notebook export (HTML/CSV). Files only: no scraping. | in |
| **Kobo** | library, % read, time read, highlights + notes | upload `KoboReader.sqlite` from the e-reader over USB, parsed in the browser with sql.js | in |

- **Matching.** ISBN first, then a Hardcover/Open Library search, then a fuzzy
  title+author match. Anything matched with low confidence goes into a
  **review queue** (a stack of index cards to swipe through) instead of being
  guessed.
- **Dedupe.** Entries are keyed on (work, normalised text hash, position), so
  re-importing is always safe.
- **Hardcover conflicts:** per field, the newest timestamp wins. Margin is the
  source of truth for entries.
- **How the Hardcover sync works.**
  - To Hardcover: every change to status, progress, rating, or a new or deleted note joins an outbox and is
    sent within seconds, with backoff and retries. A book's outbox row pushes its latest state, so
    changes coalesce and retrying is safe.
  - From Hardcover: there are no webhooks, so a cron asks every 2 minutes for what changed, using the reading
    journal and `user_books.updated_at`. Asking again is harmless, because applying a change twice does nothing.
  - Conflicts: a change still waiting in the outbox wins over Hardcover. Otherwise the latest arrival wins. A
    difference of 1% in progress is ignored, because pages round differently from percentages.
  - Notes match on Hardcover's journal id, then on book, words and place, so one sent from Margin never
    comes back as a second copy.
  - Not synced: a note deleted on Hardcover stays in Margin, because deletions aren't reported. A book removed
    from Hardcover stays too. Reviews come in but are edited on Hardcover.
  - Pace: about one request every 4.5 seconds, because the limit Hardcover reports is 15.
- **Backfill** brings in the history only. No buddy notes are generated for
  books that are already finished.
- **Reads and dates** sync both ways. A book can have several reads (re-reads), each with its own start and finish
  date, editable on the book page. A read removed in Margin is removed on Hardcover, but only by explicit id. Hardcover
  doesn't date its read records, so the whole library is compared hourly, read-only, to catch date changes made there.
- **Finishing a book** from either side asks one reflection question, written by the small text model from the book and
  the reader's notes, once per book. The answer is a `reflection` entry that keeps its question. On Hardcover it's a
  private note, without the question. Imports never ask.
- **Progress** is logged by page, by hours and minutes, or by percent, remembered per book. The exact place is what
  goes to Hardcover. Logging the last page marks the book finished.

### 3.6 Knowledge graph
- **Topics** have a *facet*: `theme` (feminism, grief), `form` (ergodic,
  epistolary), `technique` (grammar as meaning, unreliable narration),
  `genre`, `movement/period`, `setting`, `person/idea`. Topics are per user.
- **Edges:** book→topic (weight, provenance `guide|reader|note-derived`,
  evidence entry ids), entry→topic, book→book (same author, cites, influenced
  by, recommended by, read because of), topic→topic (broader/narrower,
  related).
- Topics are **suggested by the LLM and owned by the reader**: confirm, rename,
  merge or reject. Embeddings live in Convex vector search so similar topics
  get merged instead of piling up as duplicates.
- **Topic pages** show your books on a topic, your notes tagged with it, and how
  your thinking on it moved over time. There is no Explore screen: Steve removed it, and the drawer took its tab.

### 3.7 Data and visualisation
Books, pages and time read by month or year; status flow (TBR → read
conversion, TBR age); sources (where your best books came from); topics over
time; ratings distribution; format mix; time-to-finish; re-reads; note density
per book; author gender, nationality and translated-from, plus original
language. Author facts are pulled from Hardcover where it has them, and the
LLM fills gaps marked *unconfirmed* until the reader accepts them.

### 3.8 Buddy memory: making everything retrievable
The tutor should know the reader's whole reading life without stuffing it all
into every prompt. Three layers:

1. **Context pack** (always sent, prompt-cached): the persona, the reader
   profile, the current book's guide filtered by `guideUpTo(position)`, this
   read's *book memory*, and the latest turns of the thread.
2. **Rolling summaries** (written by the small model after each session):
   - *book memory* per read: what the reader has said, noticed and asked
   - *topic memory* per topic: how the reader's view has moved, with entry ids
   - the *reader profile*: registers answered and skipped, recurring
     interests, style
   These summaries are the agent's long-term memory, and they stay cheap
   because they're small.
3. **Tools** (Claude tool use, backed by Convex queries). The buddy pulls
   anything else on demand:
   - `search_entries(query, {bookId?, topicId?, kind?, dateRange?})`: hybrid
     search, Convex full-text index + vector index (Voyage embeddings on every
     entry, topic and guide theme), merged by reciprocal rank fusion
   - `get_book(bookId)` returns the read's facts, rating, source and book memory
   - `list_books(filter)` filters on any library field (the same filter
     grammar as the shelves URL)
   - `get_topic(topicId)` and `related_topics(topicId)` walk the graph:
     neighbours, books and entries
   - `get_guide(bookId)` returns a book's guide, spoiler-filtered for
     unfinished reads
   - `get_thread(bookId)` returns past conversation about another book
   Every tool goes through one `visibleTo(position)` rule: a finished book is
   fully visible, an unfinished one only up to the reader's position. The
   rule is tested.
   Tool results cite entry ids, and the UI renders a cited entry as a
   clickable index card in the buddy's reply.
- The same tool layer will later back an **"ask your library"** box ("what
  have I read about grief?") and could be exposed as an MCP server, so that
  Claude elsewhere can read your Margin.

### 3.9 The drawer (random note/excerpt)
- A card on the Desk, plus its own route `/drawer`, that pulls a random entry
  from the whole history. A drawer opens, a card slides out, and the next one
  shuffles.
- Weighted toward entries you haven't seen in a long time (spaced
  resurfacing), so it doesn't serve the same favourites.
- Filters: kind, topic, shelf, year.
- Actions:
  - *Talk about this*, which opens a buddy thread seeded with the entry and
    connected to related entries through the graph
  - *Add a note*
  - *Pin to Desk*
  - *Not this one again*
- Optionally sent as a daily push ("from the drawer"), off by default.

### 3.10 Home: the Desk
At the top are the books being read, each with its cover and progress: one is the
current book and the others offer *Switch to*. Tapping a book opens its page. Under them are the quick actions for the
current book, which every book's page also carries: *Log progress*, *Add excerpt*, *Camera* (phones only), *Add note*, *Talk*. Under them, the space
for the **latest note** (the buddy's pending prompt if there is one,
otherwise your most recent entry). The drawer has its own tab.

### 3.11 Cover art
Every book's thumbnail is an engraved ink illustration with one bold subject from its world, not a copy of its cover.
Three sources, best first. Each covers for the next while it loads or if it fails:

1. **Generated art** from Gemini.
2. **Cross-hatch** of the real cover, drawn in the browser from Open Library. Free.
3. **Title stamp**, printed from the book's title. Needs no image at all.

**One image per work.** Art is keyed on the work, so re-reads and any future users
share it (`workArt { workId, state: queued|ready|failed|rejected, small, large, model, prompt, createdAt }`).

**Generate at 1K, then shrink.** 1K is Gemini's cheapest tier on the suitable models
(about $0.034 an image, or $0.017 in batch). Its native 512px tier is on a different
model and costs more, so asking for less would cost more. Every book is always shown at the book ratio,
2:3, never square (Steve). Art is generated at 1:1 and seated at the bottom of a 2:3 page. Check prices before a large run.

**Post-process, in this order:** greyscale, level the paper to white and the ink to black, then frame
it: find where the ink is dense (blur and threshold, so stray strokes don't count), crop to that, scale
it up to 122% of the page width, but never so far that the top half of the ink is wider than the
page. Cut 5% off the bottom and centre on the upper subject, at the bottom of a white 2:3 page. So
only the bottom and lower sides bleed: a tree keeps its whole canopy, and the blank top stays. Then encode two
sizes as WebP at quality 60. Discard the original:
regenerating one costs under 2 cents, and keeping them would use more storage than
everything else combined.

| Rendition | Used for | Size per image, measured |
|---|---|---|
| 256px | Grid cells on most screens | 7 to 18 KB |
| 512px | Book page, large cells, high-density phones | 27 to 65 KB |

Those are measured on real generated drawings. At about 83 KB for the largest book and 62 KB on average, 2,000
books use about 124 MB, and at most about 166 MB, of Convex's included 1 GB. `srcset` picks the size. Serve with long-lived caching, because art for a work never changes; a
regeneration gets a new file. Verify the real cache headers on Convex's file URLs.

**One file, both themes.** Art is stored as a neutral drawing on white and printed onto
the page with blend modes: `multiply` by day, `invert` plus `screen` by night. No
per-theme assets.

**When it runs.**
- A book being read is generated straight away at the standard price.
- Everything else goes through the Batch API at half price, within a day. Cross-hatch
  covers the gap, which is why the fallback exists.
- New books aren't drawn automatically yet; run the bulk script.
- Costs go through the cost meter (§3.3).

**Model:** Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`), chosen by Steve after testing.

**Don't let the image model choose the subject.** In the first test (2026-11-02, 10 books,
2 models), asking for "something from the premise or opening" still gave a real spoiler: an
explorer hauling a sledge for *The Left Hand of Darkness*, which belongs to a later journey.
It also gave wrong subjects (a black cat, a treasure chest) and three near-identical houses.
So asking the image model to be careful isn't enough, which is Principle 2 again.
- A small text model picks one concrete subject first, from the book's premise and opening,
  and avoids subjects the library already overuses. When a guide exists, it picks only from
  moments before the opening milestone.
- The reader can see and edit that subject when rejecting a drawing.

**The prompt carries the style.**
- Input: the chosen subject. Never the cover image, or the title as text.
- One subject that reads at stamp size. Mostly single things, with some small scenes; ground or
  water may run off the bottom and sides.
- The top quarter is bare paper, because the title prints over it. There is no drawn sky.
- No frame or edge: the drawing thins out into loose hatch strokes, so you can't see where it ends.
- Fine engraved lines and rich solid black, with no grey wash.
- The exact prompt and style reference are in `docs/art/`. The model copies whatever the reference
  shows, including stray labels and borders, so keep that sheet clean.
- Store the prompt and model with the image, for provenance.

**The reader has the last word.** On the Book page they can draw a new one, with an optional
direction, at the standard price, or switch to the cross-hatch of the real cover. The choice is per reader and
deletes nothing. The old drawing stays until the new one is ready. A refused or failed drawing keeps whatever was
there and says why, with no retry loop.

**How it's built.** Bulk runs use `scripts/art-batch.mjs` on a local machine, because a batch's results are too large
for a server function. Single drawings use `convex/artNode.ts`. Both share `convex/lib/artPrompt.ts` and
`convex/lib/artFrame.ts`.

## 4. Architecture

```
Vite + React 19 + TS ── TanStack Router ── vite-plugin-pwa (injectManifest SW)
        │                                    ├─ share_target POST handler
        │                                    └─ offline shell + IndexedDB outbox
        ▼
Convex ── queries/mutations (library, entries, graph)
       ├─ actions: Anthropic (research, converse, OCR, route), Hardcover, Google
       ├─ Workflow component: book research, imports (resumable, step-retried)
       ├─ scheduler/crons: Hardcover sync, milestone checks
       ├─ file storage: photos, uploaded export files
       ├─ vector index: topics, entries (Voyage embeddings; Anthropic has no embedding model)
       ├─ search index + vector index: entries, topics, guide themes (hybrid retrieval, §3.8)
       ├─ crons: Web Push for absence and delay nudges (VAPID)
       └─ HTTP actions: capture endpoint (token), OAuth callbacks
Auth: Convex Auth with Google sign-in (basic scopes); Books/Drive access is a
      separate, incremental "Connect Google" consent that stores its own refresh token
Hosting: Vercel (static SPA) + Convex cloud
```

- **Why Vite rather than Next.js.** Convex is the backend, so Next's server
  layer would go unused. A PWA with a custom service worker is also simpler
  without a framework's router fighting it.
- **Animation stack:** Motion (`motion/react`) for gestures, layout and
  springs; the View Transitions API (TanStack Router supports it) for page
  changes and shared elements, e.g. spine → cover → book page. See
  DESIGN-DIRECTION.md.
- **Offline.** You can read your library and write entries and progress offline. The last copy of the library sits in
  localStorage, and is forgotten on sign-out. Writes sit in an IndexedDB outbox and replay through mutations when the
  connection returns, or on the next open. Convex isn't offline-first, so this is our code (`src/lib/outbox.ts`).

### 4.1 Routing: every object has a URL
The router is TanStack Router, file-based, with typed search params validated
by zod. Filters, sorts and views live **in the URL**, so any view can be
bookmarked, shared and reached with Back. Sheets and modals are routes too:
they open over their parent, and Back closes them.

```
/                                   Desk
/shelves                            every shelf, separated by status; ?q=&sort=&dir=&format=&rating=&genre=&view=catalog|table
/shelves/:shelfSlug                 a status shelf (reading, paused, tbr, read, stopped), a list, or a saved filter; the same, plus ?group=
/pile                               every finished book stacked by date, with notes down the side
/notes                              all notes and reflections, by book; ?q=&kind=
/books/:bookSlug                    book page (slug = title-author-shortid, e.g. house-of-leaves-danielewski-k3f9)
/books/:bookSlug/reads/:n           a specific read (re-reads)
/books/:bookSlug/entries            margin view; ?kind=&from=&to=
/books/:bookSlug/entries/:entryId   one entry (also deep-linked from buddy citations)
/books/:bookSlug/buddy              conversation thread
/books/:bookSlug/guide              the guide, spoiler-filtered
/books/:bookSlug/edit               edit sheet
/e/:entryId                         short link → redirects to canonical entry URL
/drawer                             random entry; ?kind=&topic=
/topics  /topics/:topicSlug         topic index and topic page
/people/:personSlug                 a recommender and what came from them
/stats                              ?range=year
/capture  /capture/add  /capture/camera  /capture/share   capture flows (share_target posts here)
/review                             import match queue
/imports/:jobId                     import job report
/settings  /settings/integrations/:provider
```
Slugs are stable once minted; renaming a book adds a redirect.

## 5. Data model (Convex, sketch)

```ts
works        { slug, title, authors[], year, isbns[], hardcoverId?, olid?, gbooksId?, cover, pages?, subjects[], originalLanguage? }
authors      { name, hardcoverId?, gender?, nationality?, confirmed }
people       { userId, slug, name, note? }        // recommenders
memories     { userId, scope: book|topic|profile, refId, summary, updatedAt }
pushSubs     { userId, endpoint, keys, quietHours }
reads        { userId, workId, status, startedAt?, finishedAt?, progress{percent,page?,chapter?}, format,
               ownership, rating?, source{kind,who,url,why,date}, tagIds[], shelfIds[], hardcoverUserBookId? }
progressLog  { readId, at, percent, page?, chapter?, origin }
entries      { userId, readId, kind, text, quote?, parentId?, pos{page?,chapter?,percent?,loc?,cfi?},
               origin, originKey, imageId?, topicIds[], createdAt }
guides       { workId, version, model, knownness, structure[], themes[], moments[], questions[], sources[] }
guideOverrides { readId, momentId, correctedPos | suppressed }
threads      { readId, status }      messages { threadId, role, text, milestoneId?, register?, at }
buddyQueue   { readId, milestoneId, state: pending|shown|answered|snoozed|passed }
readerProfile{ userId, summary, registerStats, updatedAt }
topics       { ownerId|null, name, facet, parentId?, embedding, status: suggested|confirmed|rejected }
bookTopics   { readId|workId, topicId, weight, provenance, evidence[] }
links        { fromWorkId, toWorkId, kind }
shelves, tags, integrations{provider, secretEnc, cursor, lastSyncAt}, importJobs, captures, matchQueue
```

## 6. Non-functional
- **Privacy.** Steve has no concerns about entries going to Anthropic. A
  per-book "keep private" flag is kept anyway, for future users.
- **Cost.** Guides are generated once per work. Prompts are cached. The small
  model does routing and summaries. There's a cost meter with a soft alert.
- **Accessibility.** WCAG AA contrast; animation is liberal, but every
  animation has a `prefers-reduced-motion` path and none blocks input; the handwriting font is never used for UI
  controls.
- **Performance.** First load on mid-range Android under 2.5s LCP;
  the shelf view handles a 2,000-book library (the browser skips offscreen cells with `content-visibility`; real virtualising if that ever falls short).
- **Export:** from Settings, full JSON, plus one Markdown file with a section per book.
