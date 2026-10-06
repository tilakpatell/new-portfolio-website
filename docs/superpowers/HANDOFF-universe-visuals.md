# Handoff: the universe map’s visual upgrade

The design is `docs/superpowers/specs/2026-10-06-universe-visual-upgrade-design.md`; the plan is `docs/superpowers/plans/2026-10-06-universe-visual-upgrade.md`. Nothing of it is built yet: this hand-off is the starting line, and the implementing session keeps the status table below current, one row per checkpoint, in the PR that merges it.

## Lane

- **Branch per checkpoint**: `claude/universe-visuals-<n>` from `origin/main`, PR to `main`, CI green, a merge commit. Never merge red, never force-push, never merge a PR outside this lane.
- **Files this lane owns**: `src/components/universe/post.js`, `planets.js`, `belt.js`, `livery.js` (its `teach` hook only), `scene.js` (the lights, the DEV hook, the flares and the per-frame calls the plan names), `universes.js` (`air` only), `landings/sky.js`, the new `lighting.js`, `poses.js`, `engines.js`, and `src/lib/three/{atmosphere,noise,noiseGlsl,flare,exposure,rock,explosions}.js`, `scripts/universe-check.mjs`, `scripts/planets/rickmorty.mjs`, `scripts/planets/caribbean.mjs`, `scripts/build-invincible-planet.mjs`, `scripts/build-cybertron-planet.mjs`, `lab/universe/baseline/`.
- **Other lanes, don’t cross**: `galaxy/surface/**` (the planets overhaul, two lanes), the world-runtime migration of the universe map (`HANDOFF-world-runtime.md`; keep `scene.js`’s `create(canvas, ctx)` shape), the ship-customisation files’ interfaces. `galaxy/bodies.js` and `galaxy/bodyShaders.js` are touched only by Task 3.1’s move of the atmosphere shell, which keeps their behaviour and tests.
- **Shared files, small edits only**: `docs/architecture.md` (one paragraph under the universe map’s entry once checkpoint 3 is in), `README.md` (nothing unless a screenshot in `docs/readme/` is retaken), `docs/autopilot/backlog.md` (tick the anisotropy item in checkpoint 5).

## Status

| # | Checkpoint | PR | Status | Evidence |
|---|---|---|---|---|
| 0 | Poses and a baseline | | not started | |
| 1 | The render, finished | | not started | |
| 2 | One light | | not started | |
| 3 | Air, clouds, seas, ground | | not started | |
| 4 | The styles in the light | | not started | |
| 5 | The hero ship | | not started | |
| 6 | Rock | | not started | |
| 7 | What burns | | not started | |
| 8 | The sky on foot | | not started | |

Scorecard (the spec’s “Where things stand” table is the before): fill in the after per category as checkpoints land, one line of evidence each.

## Checking it

- `npx vite`, then `/universe` (`?quality=high|mid|low|ultra` pins the tier). `await window.__universe().pose('falcon-sun')` (checkpoint 0) places the camera; `window.__universeDebug` has `post`, `scene`, `renderer`, `camera`.
- `node scripts/universe-check.mjs --quality all` (checkpoint 0) writes `lab/universe/<tier>/<pose>.webp` and `<tier>.json`; compare with `lab/universe/baseline/`. The container’s Chromium draws in software at a few frames a second, so compare its frame times only against each other and get the owner’s numbers for the PR where they matter.
- `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe,/galaxy/hoth,/galaxy/tatooine/surface` after anything in `post.js`.
- `scripts/preview/planets.html?id=middleearth&dist=1.4` (through the dev server) shows one planet as the map lights it; `node scripts/landing-check.mjs` lands on every planet and screenshots it (checkpoint 8).
- The canvas inspector: `node .claude/skills/threejs-qa-release/scripts/inspect-threejs-canvas.mjs <shot.webp>` for `colorEntropyBits`, `edgeDensity`, `luminance.contrast`.

## Gotchas

- `vitest --root /` hangs; throwaway tests go inside `src/`.
- Every new `onBeforeCompile` needs a `customProgramCacheKey`, composed after the hook already on the material (`airGlow`’s pattern in `planets.js`), and must be in the warm-up’s root (`scene.js`’s `warm`) or it compiles mid-flight and stalls a frame.
- `post.js` is shared by the galaxy and its surfaces. A uniform added to `FINAL` needs a default that leaves their picture as it was.
- `lab/` is ignored by git; only `lab/universe/baseline/` is committed (checkpoint 0 adds the `.gitignore` exception).
- Screenshots with grain on will differ run to run; the check script turns the grain off through the DEV hook and keeps the dither.
- `MESHY_API_KEY` and `SKETCHFAB_API_TOKEN` are not needed for this lane; nothing is fetched.
