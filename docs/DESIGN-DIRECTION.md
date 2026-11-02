# Margin: design direction (v1)

This is the brief that impeccable works from. Phase 0 installs impeccable's
skills into this repo and runs its context setup, which turns this brief into
`PRODUCT.md` and `DESIGN.md`. After that, its critique, typeset, animate,
delight and polish passes run against every surface.

**Margin has its own identity.** It takes nothing from Didactic's palette,
type or tokens.

## The idea: a reader's desk

Paper, a typewriter, a pencil, shelves, ribbon bookmarks, paper tags, index
cards and library cards. It should be tactile, playful and generous with
motion, like objects on a desk being picked up, slid and stamped.

## The look: Fair catalog (approved)

Steve chose this from impeccable's direction round, replacing the neobrutalist
exploration. Your reading life as a fan convention catalog you mark up by hand:
flat newsprint, one black ink, magenta rules as dividers, and blue biro for the
reader's own words and marks. **Where this section conflicts with anything
below, this section wins.** `DESIGN.md` records the built system. The mockups
are references, treated as 80% targets for now (Steve, 2026-11-02).

- **Biro marks carry meaning:** a circle is reading, a tick is finished, a strike
  is abandoned.
- **Thumbnails are ink drawings of each book's subject,** generated with Gemini and
  printed straight onto the page. Until one exists, a pen cross-hatch of the real
  cover stands in, then a printed title stamp. See SPEC §3.11.
- **Cell size is the reader's choice:** small, medium or large on Shelves.
- **The drawer is its own page,** not on the Desk. A toast offers it about once a
  week.
- **Titles use the world's faces.** Large titles use the book serif at display
  weight; section heads use the condensed gothic.
- **Progress leads with a percentage,** alongside the ribbon or bar. Audiobooks have
  no pages, so a page count can only ever be secondary.
- **The typed note writes from the top line down,** with each new line kicking the
  sheet upward, not the bottom-anchored feed under Motion below. A bottom-anchored
  line would start hidden behind the phone's tab bar.

The earlier sections below describe the original paper-desk brief. Their motion
and Android rules still apply; their palette and typefaces are superseded.

## Three voices, three typefaces

The core of the system: you can tell who is speaking by the type alone.

| Voice | Who | Direction (impeccable chooses the faces; Steve has no favourites) |
|---|---|---|
| **The book** | excerpts, titles, the author's words | a literary book serif with real italics and old-style figures |
| **The buddy** | prompts, guide glosses, anything the tutor "says" | a typewriter face, inked unevenly (per-glyph opacity and baseline jitter) |
| **The reader** | notes, reflections, summaries | a pencil or fountain-pen hand, legible at small sizes |
| UI chrome | labels, controls, data | a quiet sans or mono for labels, never decorative |

Palette: start from paper stock, typewriter ribbon ink (black, with a red
second ribbon used for emphasis), pencil graphite, a highlighter, and the
cloth colours of book spines. Two themes:
- **Daylight**: paper on a desk
- **The desk at night**: a lamp-lit wooden board with warm paper; the ground
  goes dark, but the sheets stay paper

The theme follows the system setting by default, with a manual override.

## Motion: liberal, physical, never in the way

Motion is a first-class part of the design. Every object moves the way the
real one would. Built on Motion (springs, gestures, layout) and View
Transitions (routes).

| Moment | Motion |
|---|---|
| **Buddy note** | Types out one character at a time, with a strike and a tiny bounce. At line end there's a carriage return and the sheet feeds up, scrolling into view as it is written. Optional clack and ding (off by default). A tap finishes the typing instantly. |
| **Route changes** | Pages turn or slide like sheets. Shared-element transitions: spine → pulls out of the shelf → turns face-on → becomes the book page header. |
| **Shelves** | Spines lean when you scroll fast and settle on a spring. Adding a book slides it into its slot and nudges its neighbours. |
| **Ribbon bookmark** | Drapes and sways. Logging progress drags the ribbon down the page edge. |
| **Highlighting** | The mustard swipe follows your finger with a slightly uneven edge, then dries (desaturates a touch). |
| **Notes** | Handwriting reveals stroke by stroke (a clip-path sweep) when an entry first lands. |
| **Library card** | Each event is stamped: a thunk, a slight rotation, ink spread. |
| **Tags** | Swing on their string when added and flutter when filtered. |
| **The drawer** | It slides open, a card rises, and Shuffle flicks the card away as the next one arrives. |
| **Review queue** | An index-card stack: swipe to accept or reject, flick to skip. |
| **Camera page** | The shutter flashes, the photo crossfades into a blank sheet, and the transcript is typed onto it. |
| **Explore graph** | Nodes settle on the force layout with spring physics. Focusing a topic pulls its books in like iron filings. |
| **Empty states** | Something small and alive, like a pencil rolling to a stop. |

Rules:
- Animate only transform and opacity on mid-range Android. 60fps budget.
- Motion never blocks input: everything is interruptible and skippable.
- `prefers-reduced-motion` turns every movement into a crossfade or an
  instant change. It is designed, not just disabled.
- Durations are short for feedback (≤150ms) and longer only for the signature
  moments.

## Rules for the surface
- No fine repeating texture on a ground: it moirés at most zooms. Paper is a
  flat colour. Any texture comes from large objects (a card's edge, a coffee
  ring, a torn edge), never from a grain.
- The hand script is for the reader's own words, never for controls.
- No word may be wider than its column (`overflow-wrap: anywhere`).

## Native feel on Android
- Installed PWA, standalone display, themed status bar
- Bottom tab bar: Desk · Shelves · Capture · Explore
- Sheet-style modals as routes, with a drag to dismiss and Back to close
- Safe-area insets, 48dp targets, `navigator.vibrate` haptics on stamp,
  highlight and save
- No hover-only affordances; pull-to-refresh where it means something

## Home: the Desk
1. **Current book** (a swipeable stack if you're reading several): cover,
   ribbon progress, and the actions Log progress · Excerpt · Camera · Note ·
   Talk
2. **Latest note**: the buddy's pending prompt, typed out, or your most recent
   entry
3. **The drawer**: a random note or excerpt from your whole history
