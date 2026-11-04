# Kobo pull: design

Agreed with Steve on 2026-11-04. Replaces Phase 5's `KoboReader.sqlite` import, which isn't built.

## Why

Margin should hold everything Steve has ever read, and his Kobo highlights and notes are cloud-synced. He doesn't
want to copy a database file off the e-reader. Kobo's own web reader loads annotations from an undocumented JSON
endpoint, and on 2026-11-04 that endpoint and the library page both answered a plain Node script holding only his
session cookie. So Margin's server can pull them, from a button or on a schedule.

## Goals

- One tap in Margin pulls the whole Kobo library: books, status and progress, highlights and notes.
- A daily pull does the same without being asked.
- Every Kobo book ends up on Margin's shelves, and through Margin on Hardcover.
- Every highlight and note ends up as an entry in Margin, and on Hardcover as a journal entry (Steve wants them all
  there).
- Pulling again changes nothing that's already in.

## Non-goals

- The `KoboReader.sqlite` import. Steve's notes are cloud-synced, so it's dropped.
- Sending anything to Kobo. Kobo is read-only, always.
- Reading positions, bookmarks or the books' files.

## Anti-goals

- Marking a book less read than it is: a finished book never goes back to reading, and progress never goes down.
- Guessing a book. A match Margin isn't sure of waits for Steve rather than landing on the wrong book.
- Duplicate entries, on Margin or on Hardcover, from pulling twice.
- The cookie leaking: it's never returned by a query, logged, put in a URL or committed.
- Pretending to be a browser. Requests go as `margin/1.0`, the same as the Instagram reader.

## What Kobo gives (checked 2026-11-04, read-only)

- **Library:** `https://www.kobo.com/au/en/library/books?pageNumber=N`, server-rendered HTML, two pages for Steve's
  29 books. Each book is an `li.item-wrapper.book`. Its text lines start with the title and the author (several
  authors come as one line, `"Naoki Higashida, David Mitchell +1"`), and the last line is the status: `FINISHED`,
  `NN% READ` or `UNREAD`. Some items' last lines are menu text (`Move to Archive`) instead, so the status has to be
  found, not assumed to be last. The book's id is the UUID in its `readnow.kobo.com/{uuid}` "Read Now" link. 7 of the
  29 have no such link, so they have no id and no annotations can be fetched for them. Why isn't known.
- **Annotations:** `GET https://readingservices.kobo.com/api/v3/content/{uuid}/annotations` returns
  `{ annotations: [...], nextPageOffsetToken }`. The token was null for every book, the largest having 61, but follow
  it anyway. Each annotation has `id`, `type` (`highlight` or `note`), `highlightedText`, `noteText`,
  `highlightColor`, `clientLastModifiedUtc` and `location.span` with `chapterTitle` and `percentageOfBook` (0–1).
  A `note` is a highlight with the reader's note on it: both texts are there.
- **Auth:** the `Cookie` header from a signed-in browser, about 6 KB. How long it lasts is unknown. Kobo refuses
  requests from other sites' pages (CORS), so this can only run on a server.
- **Not yet known:** whether Kobo answers requests from Convex's servers rather than a home connection. Check this
  first once it's deployed, before building the rest.

## How it works

### Connecting

Settings gets a Kobo section. Steve pastes the cookie, which is saved server-side in a new `integrations` row
(`provider: 'kobo'`) and never sent back to the page: Settings shows only whether it's set, when it last worked and
the last error. Pasting again replaces it. A "Forget" control removes it. *(Builder's call: Convex encrypts its
database at rest, so the cookie is stored as given rather than encrypted again in the app, as the Hardcover token's
env var isn't either.)*

### Pulling

"Pull from Kobo" in Settings, and a daily cron, run the same internal action:

1. Fetch every library page until one has no books, and parse each book: Kobo id (if any), title, authors, status
   and percent.
2. For each book, match it to the reader's shelves by main title and author surname, the rule the Audible import uses
   (`planAudible` in `src/lib/audible.ts`). Move that rule somewhere both can share rather than copying it.
3. **On the shelves already:** only ever move it forward, as Audible does. `FINISHED` marks it read without making
   up a date. A higher percent logs progress. Nothing goes back. Margin's existing mutations do this and queue the
   Hardcover push.
4. **Not on the shelves:** search Hardcover. If the top result matches on main title and author surname, add it
   through the existing add path (`addBooks`), as ebook, with status from Kobo (`FINISHED` → read, undated; some
   percent → reading, with that progress; `UNREAD` → TBR) and source Kobo. That puts it on Hardcover too. If nothing
   clearly matches, it goes to `/review`.
5. For each matched or added book with a Kobo id, fetch its annotations (following the page token) and save each one
   that isn't in yet: the highlight as an excerpt, at `percentageOfBook × 100` percent, with the chapter title as the
   chapter, origin `kobo`. If it has `noteText`, that's a note saved under the excerpt (the attached-note path
   `addEntry` gained for shared text). Both go to Hardcover as journal entries through the existing outbox, at its
   usual pace (the first pull is about 92 annotations, so 7 minutes or so before Hardcover has them all).
6. Record a short report on the integration row: books seen, added, moved on, waiting in review; highlights new.

Dedupe: an annotation already imported is skipped by its Kobo `id`, so a re-pull adds nothing even if the place
computes differently. A highlight edited on Kobo after import is left as it was in Margin. *(Builder's call how to
store the id: a field on entries, or in the origin key.)*

Pace: Kobo's limits are unknown. Space requests out (start with a second or so) and stop the pull on the first
refusal rather than hammering.

### Review queue (`/review`, from Phase 5)

The first producer of weak matches. A Kobo book that couldn't be matched confidently waits here as a card showing
Kobo's title and author, Hardcover's candidates, and the choices: this one, search again, or skip (don't ask again
for this Kobo book). Choosing a book adds it and pulls its annotations. The design direction describes the card stack
(swipe to accept or reject, flick to skip). A first version can be plainer, as long as it works on the phone.
Waiting items are counted in the pull's report and on Settings.

### When it fails

- **The cookie's stopped working** (a redirect to sign in, or 401/403): the pull stops, Settings says "Kobo needs
  signing in again: paste a fresh cookie", and the daily pull skips until a new one is pasted. No push nudge for
  this.
- **Kobo's pages change shape** (no books found on page 1, or annotations missing their expected fields): the pull
  stops without writing anything for that book and records what it expected, so the next session can fix the
  parser. Nothing is half-written.
- **A refused or failed request otherwise:** recorded as the last error. The next pull tries again.

## Constraints

- Convex production only (`shocking-octopus-128`). Tests stub `fetch` and never call Kobo or Hardcover.
- The repo is public: test fixtures are small, made-up HTML and JSON in Kobo's shape, never Steve's real library
  page or cookie.
- The cookie is in Steve's gitignored `.env` as `KOBO_COOKIE` for local checks. Never print it.
- Parsing is pure and tested in `convex/lib/` (library HTML → books, annotation JSON → entries, status text →
  status and percent). Convex has no DOM, so the HTML is parsed with patterns on the item markup, kept to the few
  fields needed.
- Hardcover's push pace (one request every 4.5 s) stays as it is.

## Left to the builder

- Where exactly the shared title-and-author match lives, and its name.
- The daily cron's time (the nudge cron runs at 17:00 UTC; any quiet hour is fine).
- The Settings layout for Kobo, within the existing Settings style.
- How plain the first `/review` card is.

## Plan changes

PLAN's Phase 5 item 3 (Kobo via `KoboReader.sqlite`) becomes this. Its review queue (item 2) is built here.

## Change after building began (2026-11-04, Steve)

Kobo's library page started answering scripts with a 403 bot check ("Challenged") while the annotations endpoint
kept working. So the book list now comes from a bookmarklet Steve taps on My Books, which hands it to Margin's
`/settings/integrations/kobo` page. That page matches, adds and links books in the browser, the way the Audible import
does, and unsure matches are chosen there rather than on `/review`. The server pull and daily cron fetch annotations
only, for every read that has a Kobo id. New Kobo books need the bookmarklet run again.
