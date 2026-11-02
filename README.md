# Margin

A reading buddy. Keep your library, your notes and the lines you underlined,
and have a conversation with the book while you read it.

- `docs/SPEC.md`: what Margin is and how it works
- `docs/PLAN.md`: the build plan, phase by phase, with done-when checks
- `docs/DESIGN-DIRECTION.md`: what it looks like and how it moves

Status: Phase 1 in progress. Live and installable, with Google sign-in and the Hardcover import. Shelves, Desk,
Book page, progress logging, excerpts and notes run on real data; the buddy and the art pipeline are still to come.

```
npm install
npm run dev
npm run build     # typecheck, then production build
npm run lint
npm test
```
