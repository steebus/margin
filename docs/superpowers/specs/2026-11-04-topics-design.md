# Topics, topic timelines, the explore picture and the buddy's links: design

Agreed with Steve on 2026-11-04. Replaces PLAN Phase 6 and parts of SPEC §3.6 (see "What changes in the spec").

## Why

Steve reads over years. His opinions change, or rest on something he read long ago. He wants the **topic** to be the
thing he opens, with his reading history on it laid out so he can digest and review it: which books touched it, what he
noted, and when. Taking feminism as the example: every book that touched it, non-fiction about it first, but also novels
that had something to say about it, and notes where he tagged or mentioned it.

## Goals

- Topics appear on their own, from what Hardcover already says about Steve's books. No queue to confirm.
- Steve can hide any topic he doesn't want. A hidden topic stays hidden through every later sync.
- Each topic has a page that is a **timeline**: the books he read on it and the notes he tagged with it or that mention
  it, in date order.
- Notes can be tagged. Typing a tag suggests the tags he's used before. Tags sync both ways with Hardcover's journal
  tags.
- A browsable picture of the library (`/explore`): topics and books as dots, both a whole-library view and a local view
  around one topic or book (like Obsidian's graph and local graph).
- The buddy brings up links on its own: when the talk touches a topic, it can point at an older book or note under the
  same topic.

## Non-goals

- "Ask your library" (Steve: it can wait).
- A written summary of how his thinking moved. The timeline is the record; he reads it himself.
- LLM-suggested topics, topic embeddings and merging near-duplicates by embedding. The source is Hardcover.
- A topic→topic hierarchy (broader/narrower) and book→book links.
- Changing a book's Hardcover tags. Book topics are read from Hardcover, never written to it.

## Anti-goals

- A confirm/reject queue Steve has to work through before topics are useful.
- A hidden topic coming back.
- Organising labels ("Theme", "Chapter summary") showing up as topics.
- Spoilers: the buddy pointing at a part of the current book he hasn't reached, or summarising a book he hasn't read.
- A graph that stutters on his phone with the whole library in it (about 650 books).
- Any test, or test script, writing to the real Hardcover API.

## What Hardcover gives (checked 2026-11-04, read-only, on Steve's account)

- **Book tags.** `books.cached_tags` has categories `Genre`, `Tag`, `Mood` and `Content Warning`, each a list of
  `{ tag, tagSlug, count, category, spoilerRatio }`. Margin currently keeps only the first five `Genre` names
  (`convex/lib/hardcover.ts`, `subjects`). `Tag` holds reader-applied labels, which is where something like "Feminism"
  shows up, along with noise like "Plot driven" and "Weak Character Development". `count` is how many readers applied it.
- **Journal tags.** `reading_journals.taggings { tag { tag } }` exists and Steve uses it: "Theme" on 5 notes, "Chapter
  summary" on 4, "why choose" on 1 (all his tagged journals, paged through). Writing tags to a journal is unverified:
  the builder must find the mutation shape (the API refuses introspection) without writing to Steve's real account.

## How it works

### Topics

- A topic is per user: a name, a slug, and whether Steve hid it. It comes from either:
  - **Hardcover's book tags:** `Genre` and `Tag` categories become topics. *(My call: `Mood` and `Content Warning` are
    left out; they describe feel, not subject.)* A book joins a topic with the reason "genre" or "tagged on Hardcover".
  - **Steve's note tags:** any note tag that isn't a reserved label is a topic. The book the note is on joins that topic
    with the reason "your note, p. N".
- **Noise.** Hardcover's `Tag` list has noise. *(My call, builder may tune: keep a `Tag` only when its `count` is at least
  2 or it matches a name that's already a topic, and keep at most 8 per book.)* Hiding handles the rest.
- **Names.** Topics with the same name, ignoring case and punctuation, are one topic ("Feminism", "feminism").
- **Hiding.** Steve can hide a topic from its page. *(My call.)* Hiding always wins: tagging a note with a hidden
  topic's name, here or on Hardcover, keeps the tag but doesn't unhide the topic. The tag field marks such a suggestion
  "hidden". It drops out of the picture, the buddy's view and every list. A list
  of hidden topics in Settings lets him bring one back.
- **Thin topics.** *(My call.)* A topic with one book stays off the picture's whole-library view until a second book
  joins it. Its page still exists.
- **Backfill.** The existing library needs `cached_tags` for every book. The hourly reconcile already reads books from
  Hardcover. The builder should fill in the full tag lists through the same path (no LLM, no cost), then keep them
  current.

### Reserved labels

Margin has a fixed set of note tags that organise notes and are never topics: **Theme**, **Chapter summary**, **why
choose**. ("why choose" is how Steve used to record where a book came from. Margin keeps that as the book's source; the
one existing note keeps the label, and nothing is moved.) Reserved labels filter the notes wall and sync to Hardcover like
any tag. The set lives in one place in `src/lib/` or `convex/lib/`, so adding one later is a one-line change.

### Tagging notes

- On a note (the entry page, and when writing one), a tag field. Typing suggests matching tags Steve has used before,
  reserved labels and topics alike. Enter or a tap adds it; a tag can be removed.
- Tags are stored on the entry. SPEC §5 already has `entries.topicIds[]`; the builder may store tag names or topic ids,
  as long as reserved labels and topics share one input.
- **Sync:** Hardcover journal tags come in on the existing journal pull, and Margin's tag changes go out through the
  outbox, like every other write (SPEC §3.5). Last write wins, as elsewhere.
- **Writing tags to Hardcover** *(my call)*. The mutation that sets a journal's tags is unverified, and no test or
  script may write to Steve's account to find it. Note edits today go out as delete-then-insert
  (`entries.updateEntry` → `enqueueJournalDelete` + `enqueueEntry`). The builder sends tags with the journal on that
  same path, which the outbox already handles, unless Hardcover's public docs or examples show an update mutation that
  takes tags. Verification is Steve tagging one real note and checking it on Hardcover. If Hardcover drops the tags,
  outbound tags wait and inbound still works.

### Topic page (`/topics/$topicSlug`)

The page *is* the timeline, newest first, broken by year (Steve chose this over "books, then timeline").

- Heading: the topic name. Under it: how many books and notes, the years they span, a link to all the books as a plain
  list, and Hide.
- Each **book** he has read, is reading or put down sits on the timeline at the date he read it (finished, or started
  if still reading; one with no date sits at the end in an "Undated" group). *(My call.)* Books still to read aren't on
  the timeline; they're in a short "On your TBR" group at the foot, and in the all-books list. It shows its cover at 2:3, title, and its reason ("genre", "tagged on
  Hardcover", "your note, p. 212").
- Each **note or excerpt** that is tagged with the topic, **or whose text mentions it** (Steve's call), sits at its own
  date. A mention is the topic's name as a whole word or phrase, ignoring case. *(Builder may also match a simple plural.)*
  A mentioning note's book joins the topic too, with the reason "your note mentions it, p. N". Notes on a hidden topic
  never show. Each note item, shows in Margin's existing note styles (excerpts with
  the highlighter wash, notes in the reader's hand), linking to the note.
- `/topics` lists the visible topics, most books first. It already exists as a placeholder route, as does
  `/topics/$topicSlug`.
- Book pages show the book's topics as links.

### The picture (`/explore`)

- **Whole library:** topics as big dots, books as small dots, a line from each book to each of its visible topics. Drag
  to pan, pinch or scroll to zoom. Tap a dot for its local view.
- **Local view:** one topic or book in the middle, its neighbours a step out (a topic's books, a book's topics), and a
  second step if it stays legible. From here, open the topic's page or the book's page.
- Focus and depth are in the URL (`/explore?focus=topic:feminism&depth=2`), so the back button and links work.
- Drawn in Margin's look (ink on paper, the magenta rule for topics, grey for books), in both themes.
- **Performance:** smooth on Steve's phone with the whole library, the PLAN's "done when". The builder picks the graph
  library or writes the force layout; whatever it is, it must be measured on a throttled CPU.
- **Getting there (Steve's call):** Explore takes the Drawer's tab. The Drawer moves to a button on the Notes page that
  opens it as a modal. Topic pages and book pages also link into the picture, focused on themselves. *(My call: `/topics`,
  the list, is reached from a link on Explore.)* Anything that links to `/drawer` today, such as the drawer toast that
  opens an exact note, must still land in the right place.

### The buddy

- A new tool, alongside `search_entries`: given a topic or a few words, it returns Steve's visible topics that match and,
  for each, the other books he has read and his notes on them, with dates.
- The system prompt names the current book's topics, and tells the buddy to bring up a link **on its own** when the talk
  touches one and there's an older book or note under it worth recalling. Naming the book it came from, as now.
- *(My call.)* At most one unprompted link per reply, and only when there's real material. It's an echo, not a
  bibliography.
- Books still to read can be linked as "on your TBR", never summarised.
- Spoilers: the existing rules hold. Notes on the current book past where Steve is aren't offered as links; other books
  only count once he's read or is reading them; hidden topics never appear.

## What changes in the spec

SPEC §3.6 says topics are suggested by an LLM, confirmed by the reader and merged by embedding, and that there's no
Explore screen. This design replaces that: topics come from Hardcover's tags and Steve's note tags, appear without
confirming, can be hidden, and `/explore` comes back. The builder updates SPEC §3.6 and PLAN Phase 6 to match.

## Done when

- Opening Feminism (or whichever topic Steve picks) shows his books and notes on it as a timeline he finds useful.
- Tagging a note in Margin shows the tag on Hardcover, and a tag added on Hardcover shows up in Margin.
- `/explore` renders the whole library smoothly on Steve's phone.
- The tab bar reads Desk, Shelves, Notes, Explore, Capture, and the Drawer opens from Notes.
- The buddy brings up an older book or note on its own, in a real conversation, without a spoiler.

## Left to the builder

The data model (tables or fields), the graph library or layout code, the exact tag filter thresholds, styling within
Margin's design direction, and how the buddy's tool queries.
