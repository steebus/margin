# Margin

A reading buddy. Keep your library, your notes and the lines you underlined,
and have a conversation with the book while you read it.

- `docs/SPEC.md`: what Margin is and how it works
- `docs/PLAN.md`: the build plan, phase by phase, with done-when checks
- `docs/DESIGN-DIRECTION.md`: what it looks like and how it moves
- `docs/IMPROVEMENT-LOOP.md`: what to make better next, and how an unattended run does it

Status: live and installable, with Google sign-in and a two-way Hardcover sync. Shelves, Desk, book page, progress,
excerpts and notes, the buddy, topics and Explore, the drawer, and the cover-art pipeline are built and run on real data.
`docs/IMPROVEMENT-LOOP.md` lists what's next.

```
npm install
npm run dev
npm run build     # typecheck, then production build
npm run lint
npm test
```
