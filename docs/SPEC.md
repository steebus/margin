# Margin: spec (draft 0)

> A reading buddy that asks, not tells. It keeps track of what you're reading,
> holds your notes and the lines you underlined, and talks with you about the
> book while you read it. It has read about the book; you are the one reading it.

Open decisions are marked **⚑ Qn**. They match the numbered questions in the
planning session.

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

- v1: Steve, then a handful of invited readers. **⚑ Q1** (single user vs multi-user)
- Platforms: one React web app, installed as a PWA on phones and run in the
  browser on desktop. Native wrapper only if iOS gaps force it. **⚑ Q2**

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
  rated 5?" **⚑ Q14**
- **Book facts:** format (print/ebook/audio), owned/borrowed/library, edition
  page count, rating (half stars?) **⚑ Q15**, dates started and finished,
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
   prompt available whenever the reader asks. **⚑ Q5**
3. **Delivery.** When a progress update crosses a milestone, a *buddy note* is
   queued and typed out the next time the reader opens the book. It is
   optional to answer, and the reader can snooze it or pass on it. **⚑ Q6**
   (push notifications?)
4. **The conversation.** A thread per read. The conversation model gets:
   - the guide, filtered to entries at or before the current position
   - the reader's entries for this book
   - a short *reader profile*: what they tend to notice, which registers they
     answer and which they skip, their topics across their reading
   It asks one question at a time and responds to what the reader actually
   said. It may name an accepted reading, but frames it as one reading among
   others.
5. **Correction.** The reader can tell the buddy "that hasn't happened yet" or
   "that's wrong for my edition". The correction is stored as an override for
   that read, and the buddy moves the milestone.
6. **Unknown books.** When `knownness` is low, the buddy says so and works
   from the reader's own excerpts and notes instead of inventing content.
   **⚑ Q7**

**Models.** Research runs on the most capable model, the conversation on a
mid-tier model, and routing and classification on the smallest. All prompts
are cached; the per-user budget is **⚑ Q17**.

### 3.4 Capture
- **Camera (PWA).** Photograph a page, Claude vision transcribes it (paragraphs,
  page number, running head to infer the chapter), and the transcribed text is
  *typed onto the page* (the signature animation). Drag across it to highlight,
  save it as an excerpt, and add a handwritten-style note. The photo is kept
  as a thumbnail. Choosing **⚑ Q9** decides whether you highlight the
  transcribed text or the photo itself.
- **Quick share.** Share text or a screenshot from Kindle, Play Books, a
  browser, anywhere:
  - Android: Web Share Target in the PWA manifest. The service worker takes
    the POST and opens `/capture`.
  - iOS: Safari does not support Web Share Target. An iOS Shortcut can post to
    a Convex HTTP endpoint with a personal token instead, or a Capacitor
    wrapper adds a real share extension later. **⚑ Q2**
  - **Filing.** First parse the share heuristically (Kindle and Play Books
    shares carry the title, author and location). Then the small model picks
    which currently-read book it belongs to and whether it is an excerpt or a
    note, with a confidence score. Above the confidence threshold it files
    automatically with an undo toast; below it, it asks with a single tap.

### 3.5 Imports and sync

| Source | What | How | Direction |
|---|---|---|---|
| **Hardcover** | library, statuses, ratings, dates, progress, lists, reading journal (quotes/notes) | GraphQL API, personal API token pasted once and encrypted at rest | **two-way**: status, progress, rating and dates push to Hardcover; journal entries per **⚑ Q11** |
| **Google Play Books** | library (shelves), highlights + notes | Books API `mylibrary` for shelves; notes from the "Play Books Notes" Drive docs (the reader enables this in Play Books settings), picked through Google Picker so we only ask for `drive.file` | in |
| **Kindle** | highlights + notes | upload `My Clippings.txt` (from the device) or the Kindle app's notebook export (HTML/CSV). Later, maybe a bookmarklet for `read.amazon.com/notebook`. **⚑ Q12** | in |
| **Kobo** | library, % read, time read, highlights + notes | upload `KoboReader.sqlite` from the e-reader over USB, parsed in the browser with sql.js | in |
| **Goodreads / StoryGraph** | library history | CSV export upload | in |

- **Matching.** ISBN first, then a Hardcover/Open Library search, then a fuzzy
  title+author match. Anything matched with low confidence goes into a
  **review queue** (a stack of index cards to swipe through) instead of being
  guessed.
- **Dedupe.** Entries are keyed on (work, normalised text hash, position), so
  re-importing is always safe.
- **Hardcover conflicts:** per field, the newest timestamp wins. Margin is the
  source of truth for entries.
- **Backfill** brings in the history only. No buddy notes are generated for
  books that are already finished.

### 3.6 Knowledge graph and explore
- **Topics** have a *facet*: `theme` (feminism, grief), `form` (ergodic,
  epistolary), `technique` (grammar as meaning, unreliable narration),
  `genre`, `movement/period`, `setting`, `person/idea`. **⚑ Q13**
- **Edges:** book→topic (weight, provenance `guide|reader|note-derived`,
  evidence entry ids), entry→topic, book→book (same author, cites, influenced
  by, recommended by, read because of), topic→topic (broader/narrower,
  related).
- Topics are **suggested by the LLM and owned by the reader**: confirm, rename,
  merge or reject. Embeddings live in Convex vector search so similar topics
  get merged instead of piling up as duplicates.
- **Explore:**
  - a topic page showing your books on it, your notes tagged with it, and how
    your thinking on it moved over time
  - a force graph of books and topics
  - "you keep coming back to…"
  - connective prompts that feed back into the buddy

### 3.7 Data and visualisation
Books, pages and time read by month or year; status flow (TBR → read
conversion, TBR age); sources (where your best books came from); topics over
time; ratings distribution; format mix; time-to-finish; re-reads; note density
per book. Author facts (nationality, gender, translated-from) are optional and
reader-confirmed, never inferred silently. **⚑ Q16**

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
       └─ HTTP actions: iOS Shortcut capture endpoint, OAuth callbacks
Auth: Convex Auth with Google sign-in (basic scopes); Books/Drive access is a
      separate, incremental "Connect Google" consent that stores its own refresh token
Hosting: Vercel (static SPA) + Convex cloud
```

- **Why Vite rather than Next.js.** Convex is the backend, so Next's server
  layer would go unused. A PWA with a custom service worker is also simpler
  without a framework's router fighting it. **⚑ Q3**
- **Offline.** You can read your library and write entries offline. The writes
  sit in an IndexedDB outbox and replay through mutations when the connection
  returns. Convex isn't offline-first, so this is our code. **⚑ Q8**

## 5. Data model (Convex, sketch)

```ts
works        { title, authors[], year, isbns[], hardcoverId?, olid?, gbooksId?, cover, pages?, subjects[] }
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
- **Privacy.** Notes and excerpts are sent to Anthropic to generate
  conversation and topics. Disclosed up front; a per-book "keep private" flag
  keeps that book's entries out of LLM calls.
- **Cost.** Guides are generated once per work. Prompts are cached. The small
  model does routing. There's a monthly cap per user. **⚑ Q17**
- **Accessibility.** WCAG AA contrast; every animation has a
  `prefers-reduced-motion` path; the handwriting font is never used for UI
  controls.
- **Performance.** First load on mid-range Android under 2.5s LCP;
  the shelf view handles a 2,000-book library (virtualised).
- **Export:** full JSON plus a Markdown file per book.
