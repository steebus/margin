---
name: Margin
description: A reading life as a convention catalog you mark up by hand.
colors:
  paper: "#d8d6cf"
  ink: "#121212"
  biro: "#2346c8"
  rule: "#e03a8c"
  soft: "rgb(18 18 18 / 0.08)"
  night-paper: "#1b1b19"
  night-ink: "#e6e3da"
  night-biro: "#93a9ff"
  night-rule: "#f0589f"
  night-soft: "rgb(230 227 218 / 0.1)"
typography:
  display:
    fontFamily: "League Gothic, Arial Narrow, sans-serif"
    fontSize: "clamp(3rem, 15vw, 5rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.015em"
  headline:
    fontFamily: "League Gothic, Arial Narrow, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.015em"
  label:
    fontFamily: "League Gothic, Arial Narrow, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0.02em"
  label-small:
    fontFamily: "League Gothic, Arial Narrow, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.02em"
  book-title:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "clamp(1.75rem, 7.5vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "clamp(1.5rem, 7.8vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "lnum"
  body:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "onum"
  book-voice:
    fontFamily: "Source Serif 4 Variable, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.4
  buddy-voice:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  reader-voice:
    fontFamily: "Kalam, Comic Sans MS, cursive"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  none: "0px"
  sheet: "3px"
spacing:
  hair: "4px"
  cell: "6px"
  step: "8px"
  gap: "10px"
  row: "12px"
  box: "14px"
  page: "16px"
  page-wide: "32px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sheet}"
    padding: "6px 16px"
    height: "48px"
  button-solid:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.sheet}"
    padding: "6px 16px"
    height: "48px"
  segment-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    height: "48px"
  tab:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label-small}"
    height: "60px"
  tab-current:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  box:
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "{spacing.box}"
  catalog-cell:
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.cell}"
  reply-field:
    backgroundColor: "transparent"
    textColor: "{colors.biro}"
    typography: "{typography.reader-voice}"
    rounded: "{rounded.sheet}"
    padding: "8px 12px"
    height: "48px"
---

# Design System: Margin

## Overview

**Creative North Star: "The Marked-Up Fair Catalog"**

Margin is a fan convention catalog that belongs to one reader: flat newsprint, one black ink, ruled cells, and a blue biro that only the reader holds. It refuses the cover-card tracker and the cream bookish page. Structure is visible, density is high, and every surface is built from ruled boxes rather than floating cards.

Who is speaking is legible from type alone: the book sets in serif, the buddy types in Courier, the reader writes in a hand, and the catalog itself prints in condensed gothic. Motion is physical and short, never blocks input, and every movement has a reduced-motion path (the note appears whole, marks land drawn, route changes crossfade in 120ms).

Night is the same catalog printed in reverse. It follows the system setting until the reader uses the toggle at the top right of every screen, and that choice is then saved.

**Key Characteristics:**
- Flat newsprint and one ink, with no gradients, grain or tinted surfaces.
- Ruled 2px cells as the visible structure.
- Three voices in three faces, plus gothic for the catalog's own print.
- Biro marks that carry status meaning.
- A note that types itself, as the signature moment.

## Colors

One ink on one paper, with two accents that each have a single job. The CSS custom properties share the token names (`--paper`, `--ink`, `--biro`, `--rule`, `--soft`); night tokens reassign the same properties under `prefers-color-scheme: dark`.

### Primary
- **Catalog Ink** (ink): All text, rules, borders, icons, solid buttons, and the current tab or pressed segment. Pressed states invert to paper-coloured text on ink.

### Secondary
- **Reader's Biro** (biro): The reader's words and marks. 5.19:1 on paper, 7.69:1 on night paper.

### Tertiary
- **Divider Magenta** (rule): 4px divider rules, including those beside the masthead and year heads. 2.80:1 on paper, which is another reason it never carries text.

### Neutral
- **Newsprint** (paper): The single ground. Sheets, toasts and stamps use it too, to knock out what's beneath them.
- **Ink Wash** (soft): The hover tint, on devices that hover.
- **Night stock** (night-paper, night-ink, night-biro, night-rule, night-soft): The same roles in reverse. Covers repaint for night by inking the light parts of the image.

### Named Rules
**The Magenta Divider Rule.** Magenta is for divider rules only.

**The Reader's Pen Rule.** Blue biro is for the reader's words and marks only, so links inherit ink.

The build also uses biro for the focus outline, text selection and caret. Those sit outside the rule as stated, so this records a divergence and doesn't extend the rule.

## Typography

**Display Font:** League Gothic (with Arial Narrow)
**Body Font:** Source Serif 4 Variable (with Georgia)
**Label/Mono Font:** Courier Prime for the buddy (with Courier New); Kalam for the reader (with Comic Sans MS)

**Character:** A heavy condensed gothic prints the catalog's structure in uppercase, against a literary serif and two human voices. Each face has one job, and no voice borrows another's face.

### Hierarchy
- **Display** (400, clamp(3rem, 15vw, 5rem), 1): Page titles such as Shelves and The drawer. The Desk masthead uses this style at 2.75rem, and 4rem on wide screens.
- **Headline** (400, 1.75rem, 1): Section heads. Year heads and the library card caption are 1.5rem.
- **Book title** (600, clamp(1.75rem, 7.5vw, 2.75rem), 1.08): A book's own title on its page. Smaller listings use the same serif at 600 (1 to 1.25rem).
- **Figure** (600, clamp(1.5rem, 7.8vw, 2.75rem), 1): Progress percentages in lining figures, 3.5rem on wide screens and up to 4.5rem on the book page. Progress leads with a percentage because audiobooks have no pages.
- **Body** (400, 1.0625rem, 1.45): Interface prose in old-style figures. Metadata is 0.9375rem, and catalog codes are 0.75rem.
- **Book voice** (400, 1.25rem, 1.4): Excerpts. 1.125rem in entries and toasts, 1.5rem on a drawer card.
- **Buddy voice** (400, 1.0625rem, 1.5): The buddy's notes, inked unevenly glyph by glyph.
- **Reader voice** (400, 1.25rem, 1.35): The reader's notes, always in biro.
- **Label** (400, 1.25rem, 0.02em, uppercase): Buttons. Tabs, actions and segments are 1.0625 to 1.125rem; catalog cell titles are 0.9375rem.

### Named Rules
**The Three Voices Rule.** The book, the buddy and the reader never share a face. If the speaker changes, the face changes.

**The Dry Controls Rule.** Handwriting never appears on controls. The reply field's typed value is the reader's own words and sets in the hand; its placeholder and button don't.

## Layout

The page is one column at a 16px margin, up to 1240px wide, with focused pages (book, buddy, drawer) capped at 720px. Mobile keeps a fixed four-cell tab bar at the thumb. At 900px the tab bar moves to the top, the page margin grows to 32px, and the Desk splits 7fr to 5fr with the buddy's note in the right column.

Spacing is tight and observed rather than tokenised in CSS: 4px within a group, 6px inside catalog cells, 10px between controls, 14px inside boxes, 16px between page blocks. Adjacent cells share one rule, using negative margins in the catalog and a left or top border in grouped controls.

Catalog cell size is the reader's choice (68, 88 or 116px minimum, scaled 1.6 times at 900px), and it persists. The target minimum for controls is 48px.

## Elevation & Depth

The system is flat. Depth comes from paper knocking out what's beneath it and from rings, never from cast shadows. Only the mobile tab bar, toast, sticky selection bar, stamp and typewriter skip button overlap content, and each has a solid paper fill.

### Shadow Vocabulary
- **Pressed ring** (`box-shadow: inset 0 0 0 2px var(--ink)`; 3px on catalog cells): The selected book.
- **Toast double rule** (`box-shadow: 0 0 0 4px var(--paper), 0 0 0 6px var(--ink)`): Separates the toast from the page it overlaps.
- **Mark halo** (`filter: drop-shadow(0 0 1.5px var(--paper))`): Keeps a biro mark legible over a dark thumbnail.

### Named Rules
**The Flat Print Rule.** Nothing casts an offset or ambient shadow. A surface that must sit above another gets a paper fill and a rule.

## Shapes

Corners are nearly square. Boxes, buttons and fields have a 3px radius; catalog cells and tables are fully square. Rules are 2px (tags 1.5px), and the logged stamp uses a 3px double border. The only organic forms are biro strokes, always one pen width (2.25px) however far the mark stretches.

## Components

### Buttons
- **Shape:** Slightly softened rectangle (3px), 2px ink rule, at least 48px tall.
- **Primary:** Solid ink with paper-coloured gothic label, for the one forward action.
- **Secondary:** Transparent with an ink label.
- **Hover / Focus:** Hover applies the ink wash, or 0.85 opacity on solid buttons. Pressing moves the button down 1px. Disabled is 0.45 opacity. Focus is a 3px biro outline at 2px offset.

### Segments
- **Style:** A ruled row of equal gothic buttons sharing one border, used for filters, view and cell size.
- **State:** The pressed segment inverts to solid ink.

### Ruled Actions
Five ruled cells on the Desk, each with a 26px icon over a gothic label. The expanded action inverts to solid ink.

### Cards / Containers
- **Corner Style:** 3px.
- **Background:** Transparent on paper, or solid paper when overlapping.
- **Shadow Strategy:** None; see Elevation & Depth.
- **Border:** 2px ink rule. A citation of the reader's own note takes a 2px biro rule.
- **Internal Padding:** 14px.

### Inputs / Fields
- **Style:** 2px ink rule, transparent fill, 3px radius, 48px minimum. Typed text is reader voice in biro; the placeholder is Courier at 0.7 opacity.
- **Focus:** The shared 3px outline at 2px offset.

### Navigation
Four equal gothic cells with icons, separated by rules. The current tab inverts to solid ink. It is fixed at the bottom on mobile (60px, safe-area aware) and static at the top from 900px (52px, icon beside label).

### Catalog Cell
A square ruled cell holding the title, catalog code and cover. Small cells drop the title and code. Tapping selects, and a sticky bar offers details and Open. Year heads group cells, each followed by a magenta rule.

### Covers
Every cover prints in one ink on bare paper, drawn to a canvas 1:1 with device pixels. A printed title stamp shows until the art lands, or if there's none.

**Thumbnails:** generated engraved illustrations, with blank paper above for the title, printed onto the page with blend modes (`multiply` by day; `invert` and `screen` by night), falling back to a pen cross-hatch of the real cover, then a printed title stamp. See `docs/SPEC.md` §3.11. `public/art-demo/` holds hand-stored test scenes until the pipeline exists.

### Biro Marks
Biro marks carry meaning: a circle is reading, a tick is finished, a strike is abandoned. Each stroke draws itself in 520ms. A hand-drawn arrow also leads the reader's turns in a buddy thread, as a pointer rather than a status.

### Typewriter Note
The buddy's note types one character at a time from the top line down, with uneven ink, a strike on each glyph, longer beats after punctuation, and a carriage that creeps left. Height is reserved, so nothing shifts. It starts only once its first line clears the tab bar, and a tap or the keyboard's Finish typing button completes it.

**The Tiny Bounce Rule.** The typewriter sheet's kick uses an overshoot easing (`cubic-bezier(0.34, 1.5, 0.64, 1)`, 200ms) as a deliberate exception, because the brief asks for a tiny bounce. The same curve drives the carriage on that sheet. Don't borrow it for anything else.

### Stamps and Physical Moments
Logging progress stamps a rotated, double-ruled label over the reading cells, with a 15ms vibration where supported. The drawer's card rises and flicks away on Shuffle. The toast rises about once a week and clears itself after 9 seconds. These run on Motion springs that are lightly underdamped, so they settle with a small natural overshoot. Library card dates sit a few degrees off true, and a reader's turn tilts -0.8deg.

## Do's and Don'ts

### Do:
- **Do** tell the speaker by face: serif for the book, Courier for the buddy, Kalam in biro for the reader.
- **Do** build new surfaces from ruled 2px cells on flat paper, with shared rules between neighbours.
- **Do** let links inherit ink, underlined with a 3px offset.
- **Do** invert to solid ink for pressed, current and expanded states.
- **Do** lead progress with a percentage, with any page count secondary.
- **Do** design a reduced-motion path for every movement, and keep motion interruptible.

### Don't:
- **Don't** use magenta for anything but a divider rule.
- **Don't** use biro for links, buttons, headings or decoration.
- **Don't** set any control's label or placeholder in handwriting.
- **Don't** use a biro circle, tick or strike for anything other than reading, finished or abandoned.
- **Don't** print a cover in more than one ink.
- **Don't** treat night as a separate theme: same layout, same roles, printed in reverse.
- **Don't** put a fine repeating texture on a ground, since it moirés. Dither on a cover is ink on an object, not a ground texture.
- **Don't** add an offset or ambient shadow.
