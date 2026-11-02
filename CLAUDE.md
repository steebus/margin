# Margin

Read `docs/SPEC.md`, `docs/PLAN.md`, `docs/DESIGN-DIRECTION.md` and `PRODUCT.md`.

- Check work with `npm run build`, `npm run lint` and `npm test`.
- `src/routeTree.gen.ts` is generated from `src/routes/`. Don't edit it by hand.
- Books always show at the book ratio, 2:3, never square.
- UI goes in `src/components/<object>/`, tested logic in `src/lib/`, design tokens in
  `src/styles/tokens.css`.
- Mockups are references, treated as 80% targets for now: match their character, don't
  measure against them.
- Work lands on `main`, which is what CI checks and Vercel deploys. The repo is public.
- Convex has one environment: production (`shocking-octopus-128`), set in `.env.local`. There is no
  dev deployment. Pushing to `main` deploys it; `npx convex deploy` does so directly. This is the
  real library, so run `npx convex export` before any migration that rewrites data, and don't run
  `npx convex dev`.
- `.app` uses `overflow-x: clip`, so `scrollWidth` never reports overflow. Measure
  element rects against the viewport instead.
- Don't give two files in `src/` names that differ only by case: `./Foo` resolves
  to the wrong one on Windows.
- `SAMPLE_POST` in `src/components/share/Share.tsx` is
  fake too, and nothing on the share screen is saved yet (SPEC §3.4.1).
- Margin writes to Steve's real Hardcover account through the outbox (SPEC §3.5). Tests stub `fetch`; never point
  them, or a test script, at the real API with mutations.
- Bulk art: `node --experimental-strip-types scripts/art-batch.mjs subjects|submit|status|fetch|ingest`. It costs real
  money, so state the cost first. Check `public/art/style-reference.png` is clean: the model copies stray marks.
- `GEMINI_API_KEY` lives in the gitignored `.env`. Never print it.
- Offscreen cells only load when the browser renders frames. In automated checks
  scroll with the real wheel and force frames, or lazy covers look broken.
