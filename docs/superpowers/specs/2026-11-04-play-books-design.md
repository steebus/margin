# Play Books import and the review stack: design

Agreed with Steve on 2026-11-04. Replaces PLAN Phase 5 item 4, and builds item 2 (`/review`).

## Why

Margin should hold everything Steve has read. Play Books has years of his books, highlights and notes: about 25 or
more "Notes from …" docs in Drive going back to 2017, some with around 100 annotations. Unlike Kobo there's a real API
for the library (the Books API) and the notes are ordinary Google Docs, so this runs in his browser when he presses a
button. Books Margin can't place with confidence wait in `/review`, to be sorted whenever he likes.

## Goals

- One button in Settings reads the Play Books library and the notes docs Steve picks, and brings them in.
- Highlights become excerpts at their page, with Steve's note attached, and go to Hardcover like every entry.
- Books on the shelves move forward only. Books Margin is sure of are added. The rest wait in `/review`.
- Running it again adds nothing new.

## Non-goals

- A daily or automatic pull (Steve: pressing a button is fine). Nothing about Google is stored on Margin's server.
- Writing anything to Google.
- Bookmarks.

## Anti-goals

- A guessed status or a guessed book. If Margin can't tell, the book waits for Steve.
- A finished book marked less read, or progress going down.
- Duplicate entries from running it twice, or from the doc listing each annotation twice.
- Real notes in the public repo: fixtures are made up, in the docs' shape.

## What Google gives (checked 2026-11-04, read-only, in Steve's Drive)

- **Notes docs** live in Drive's "Play Books Notes" folder, one Google Doc per book, named `Notes from "<title>"`.
  Exported as HTML (`files/{id}/export?mimeType=text/html`), each annotation is a table row of three cells:
  1. a colour swatch image;
  2. paragraphs: the highlighted words (a span with a `background-color`), then the reader's note (a span coloured
     `#424242`), then the date (`#757575`, like "March 26, 2026"). Either of the first two can be missing; a row with only
     a date is a bookmark. Class names change per doc, so the colours are read from the doc's own `<style>`;
  3. the page number, linking to `play.google.com/books/reader?id=<volumeId>&pg=GBS.PA<n>…`, which gives the book's
     Google volume id.
  Some books hide the highlighted words: the first paragraph reads "Highlighted text cannot be displayed" (all 18 in
  *Small Things Like These*, 2 of 4 in *The Library at Mount Char*). The note, page and date still come. A doc can list
  each annotation twice (an "Annotations by colour" section and "All your annotations"), so rows are de-duplicated.
- **Library**: the Books API's `mylibrary/bookshelves` and each shelf's `volumes` (paged, 40 at a time). Shelves by id:
  2 To read, 3 Reading now, 4 Have read; others (Purchased, My eBooks, Favourites…) don't say how far Steve got. Not yet
  seen for his account, so what the shelves hold is a guess until the first run.

## How it works

### Connecting, each time

Settings → Play Books → "Read Play Books". The page loads Google's sign-in (Google Identity Services token client) and
asks for `books` and `drive.file`. The token lives in the page only and is gone when it closes. Margin's server hands the
page the OAuth client id (`AUTH_GOOGLE_ID`) and the Picker key (`GOOGLE_API_KEY`) from a query: both are public by
nature in a browser. *(Builder's call: a query rather than a Vite env var, so Vercel needs nothing new.)*

Steve's setup, once: in Google Cloud, add `https://margin-three-smoky.vercel.app` (and `http://localhost:5173`) to the
OAuth client's Authorized JavaScript origins, and restrict the key to the Picker and Books APIs and those referrers.

### Reading

1. **Library.** Every shelf's volumes: Google volume id, title, authors, ISBN, and a status from the shelf: Have read →
   read, Reading now → reading, To read → TBR, any other shelf → unknown. A book on several takes the furthest along.
2. **Notes.** The Google Picker opens on Drive's docs, searched for "Notes from"; Steve selects the ones to bring in
   (all of them, the first time). Each is exported and parsed (pure, in `convex/lib/`): book title, volume id, and
   rows of `{ page, highlight?, note?, date }`, with hidden highlights and bookmarks recognised. A notes doc whose book
   isn't on any shelf joins the library list as unknown status.
3. **Plan**, per book, matched by Google volume id first (a notes doc and its shelf entry), then to Margin's shelves by
   title and author (`sameBook`, as for Audible and Kobo):
   - **On the shelves:** move forward only (read, undated; reading only from TBR or paused). Its notes are saved.
   - **Not on the shelves, known status, and Hardcover's top hit is clearly the book** (by ISBN search where there's
     an ISBN, else title and author): added through `addBooks` as ebook, undated if read. Its notes are saved.
   - **Anything else** (unknown status, or no clear Hardcover match): a card in `/review`, holding its notes.
4. The screen shows the plan before writing: counts, the books to mark read or move on, the books to add, and how many
   will wait in review. "Make these changes", then a report.

### Saving notes

- A highlight is an excerpt at its page, origin `playbooks`, created at the annotation's date. A note with it is saved
  under it. A note whose highlight was hidden is a plain note at that page. Bookmarks are skipped.
- Keyed so a re-run finds them: `playbooks:<volumeId>:<page>:<normalised words>` (the highlight's words, or the
  note's when hidden), and the attached note `…:note`.
- The same saving code serves Kobo: one shared helper for imported entries (insert if the key is new, enqueue for
  Hardcover).

### The review stack (`/review`)

- A table of waiting books per reader: source (`playbooks` for now), title, author, ISBN, volume id, what status the
  source said (if any), the notes to save, and a state (waiting, added, left out). Re-running the import doesn't
  repeat a card: one per source and volume id, and a waiting card's notes are refreshed.
- `/review` shows one card at a time, an index card in the design's character: title, author, "N notes from Play
  Books", and the choices:
  - **Status**: Read · Reading · To read (preselected if the source said).
  - **Which book**: Hardcover's top few results (searched when the card opens), or search again with other words.
  - **Add** puts it on the shelves (and Hardcover) and saves its notes. **Leave out** never asks again.
  A swipe stack can come later; buttons work on the phone now. *(Builder's call.)*
- The nav doesn't get a tab for it. Settings shows "N books waiting in review" with a link, and so does the import's
  report.

### When it fails

- Google sign-in closed or refused: nothing happens, the screen says so.
- A doc that doesn't parse (no rows found where rows were expected): it's listed as skipped with its name; the rest
  carry on. Nothing is half-written for that book.
- A failure partway: what's saved stays saved; running it again carries on, since nothing repeats.

## Constraints

- Convex production only; tests stub `fetch` and never call Google or Hardcover.
- Fixtures are small made-up docs in the export's shape.
- Hardcover search is gentle (300 ms between calls, as the Audible import does).
- `/review` follows the design direction and works one-handed on the phone.

## Left to the builder

- File names and the exact shape of the review card.
- How the Picker is configured to show the notes docs (folder view or search).
- Whether to run the Hardcover lookups before or after showing the plan.

## Plan changes

PLAN Phase 5: Play Books becomes this; the review queue (item 2) is built here, for Play Books first.
