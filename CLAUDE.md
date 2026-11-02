# Margin

Read `docs/SPEC.md`, `docs/PLAN.md`, `docs/DESIGN-DIRECTION.md` and `PRODUCT.md`.

- Check work with `npm run build`, `npm run lint` and `npm test`.
- `src/routeTree.gen.ts` is generated from `src/routes/`. Don't edit it by hand.
- `src/sample.ts` is demonstration data, and Phase 1 replaces it.
- `.app` uses `overflow-x: clip`, so `scrollWidth` never reports overflow. Measure
  element rects against the viewport instead.
- Don't give two files in `src/` names that differ only by case: `./Foo` resolves
  to the wrong one on Windows.
- `public/art-demo/` and `demoArt` in `src/sample.ts` are hand-stored Gemini test scenes.
  Delete them when the art pipeline lands (SPEC §3.11). `SAMPLE_POST` in `src/Share.tsx` is
  fake too, and nothing on the share screen is saved yet (SPEC §3.4.1).
- `GEMINI_API_KEY` lives in the gitignored `.env`. Never print it.
- Offscreen cells only load when the browser renders frames. In automated checks
  scroll with the real wheel and force frames, or lazy covers look broken.
