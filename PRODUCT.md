# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React 19 + TypeScript + TanStack Router + Motion; Convex and Convex Auth (Google) for the backend; Vercel hosting; vite-plugin-pwa. See `docs/SPEC.md` §4.

## Users

Steve, alone, in v1. He reads several books at once, on paper and on devices, and wants to catch a line or a thought mid-read with one hand on an Android phone, then think about it later on the phone or at a desktop browser. The data model is multi-user from the start.

## Product Purpose

Margin keeps a reader's library, notes and underlined lines, and has a conversation with the book while they read it. Success is a reading life that is captured without effort and a buddy worth answering.

## Positioning

A reading buddy that asks, not tells. It has read about the book; you are the one reading it. Nothing past the reader's current position ever reaches the conversation model or the screen, because spoilers are filtered from the data before the model sees it.

## Operating Context

Short sessions, often one-handed, between or during reading. Capture happens from the Android share sheet (text from another app, including a photo of a page turned to text there) or a typed note. The buddy's notes wait until the book is next opened; push only fires for absence or delay. Installed as a standalone PWA on Android; used in a browser on desktop.

## Capabilities and Constraints

Library with statuses, shelves, tags, sources and people; entries (excerpt, note, summary, reflection) with positions; a per-book guide and Socratic buddy with long-term memory; typed and shared capture; Hardcover two-way sync; Kobo and Play Books imports; topic graph; stats; the drawer of random past entries. Every object has a URL; filters live in the URL; sheets are routes. Full detail in `docs/SPEC.md`.

## Brand Commitments

- The name is Margin. It has its own identity and takes nothing from Didactic's palette, type or tokens.
- You can tell who is speaking by the type alone: the book, the buddy and the reader are three separate voices.
- The buddy's note types out character by character. This is the brand's signature moment.
- Handwriting is for the reader's own words, never for controls.
- Motion is liberal and physical but never blocks input.

## Evidence on Hand

No real library data yet. Sample books and entries on any surface are demonstration data and must be replaced by real data as Phase 1 lands.

## Product Principles

1. The reader's reading wins: accepted themes are offered as readings others have taken, never as the answer.
2. Never ahead of the reader.
3. Capture first, file later: one gesture to catch a line.
4. Your history is yours: imports bring it in, export takes it out.
5. Delight, but never in the way: speed and clarity come first.

## Accessibility & Inclusion

WCAG AA contrast. Every animation has a designed `prefers-reduced-motion` path and none blocks input. 48dp touch targets. No hover-only affordances.
