# Margin: design direction (draft 0)

This is the brief that impeccable works from. Phase 0 installs impeccable's
skills into this repo and runs its context setup, which turns this brief into
`PRODUCT.md` and `DESIGN.md`. After that, its critique, typeset, animate and
polish passes run against every surface.

## The idea: a reader's desk

Paper, a typewriter, a pencil, shelves, bookmarks and tags. The palette and
the marginalia come from Didactic: warm newsprint paper, warm near-black ink, a
mustard highlighter wash, the reader's words in a hand script, and asterisks
starred in the gutter. Margin is warmer and more playful than Didactic.

## Three voices, three typefaces

The core of the system: you can tell who is speaking by the type alone.

| Voice | Who | Face (candidates) |
|---|---|---|
| **The book** | excerpts, titles, the author's words | a book serif: Newsreader / EB Garamond / Fraunces (shared with Didactic) |
| **The buddy** | prompts, guide glosses, system copy that "speaks" | typewriter: Courier Prime / Cutive Mono, inked unevenly |
| **The reader** | notes, reflections, summaries | hand: Caveat (as in Didactic) or a looser pencil script |
| UI chrome | labels, controls, data | a quiet grotesk (Archivo, as in Didactic) |

**⚑ Q18**: keep the family resemblance to Didactic, or give Margin its own faces?

## Signature moments

1. **The typewriter.** A buddy note types out one character at a time, with a
   small baseline jitter and uneven ink density. At line end there is a
   carriage return and the sheet feeds up, so the page scrolls up into view as
   it is written. A tap finishes the typing at once. Sound is optional and off
   by default. With reduced motion, the text fades in.
2. **The camera page.** OCR'd text is typed onto a fresh sheet, then
   highlighted with a mustard swipe that follows the finger.
3. **Shelves.** The library is drawn as spines. A spine's height comes from
   the page count, its thickness from the edition, and its colour from the
   cover. A ribbon bookmark hangs from every book in progress. You can toggle
   to grid or table for real filtering.
4. **Library card.** Each book's history (TBR'd, started, paused, finished,
   re-read) is shown as date stamps on a pocket library card.
5. **Paper tags.** Tags are hole-punched labels with string. Topics are index
   cards.
6. **The review queue.** Low-confidence import matches come as a stack of
   index cards to swipe through.

## Rules carried over from Didactic (learned the hard way)
- No fine repeating texture on a ground: it moirés at most zooms. Paper is a
  flat colour. Any texture comes from large objects (a card's edge, a coffee
  ring), never from a grain.
- The hand script is for the reader's own words, never for controls.
- No word may be wider than its column (`overflow-wrap: anywhere`).
- Dark mode is "the desk at night" (a warm board with lamplight), not an
  inverted page.

## Native feel on phones
Bottom tab bar (Desk · Shelves · Capture · Explore); sheet-style modals with a
drag to dismiss; view transitions between shelf → book → entry; safe-area
insets; 44px targets; haptics where the platform allows; no hover-only
affordances.
