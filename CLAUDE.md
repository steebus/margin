# Margin

Read `docs/SPEC.md`, `docs/PLAN.md`, `docs/DESIGN-DIRECTION.md` and `PRODUCT.md`.

- Check work with `npm run build`, `npm run lint` and `npm test`.
- `src/routeTree.gen.ts` is generated from `src/routes/`. Don't edit it by hand.
- `src/sample/` is demonstration data, and Phase 1 replaces it.
- UI goes in `src/components/<object>/`, tested logic in `src/lib/`, design tokens in
  `src/styles/tokens.css`.
- Mockups are references, treated as 80% targets for now: match their character, don't
  measure against them.
- Work lands on `main`, which is what CI checks and Vercel deploys. The repo is public.
- `.app` uses `overflow-x: clip`, so `scrollWidth` never reports overflow. Measure
  element rects against the viewport instead.
- Don't give two files in `src/` names that differ only by case: `./Foo` resolves
  to the wrong one on Windows.
- `public/art-demo/` and `demoArt` in `src/sample/sample.ts` are hand-stored Gemini test scenes.
  Delete them when the art pipeline lands (SPEC §3.11). `SAMPLE_POST` in `src/components/share/Share.tsx` is
  fake too, and nothing on the share screen is saved yet (SPEC §3.4.1).
- `GEMINI_API_KEY` lives in the gitignored `.env`. Never print it.
- Offscreen cells only load when the browser renders frames. In automated checks
  scroll with the real wheel and force frames, or lazy covers look broken.
