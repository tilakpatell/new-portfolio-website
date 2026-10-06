# Handoff: the universe map’s visual upgrade

The design is `docs/superpowers/specs/2026-10-06-universe-visual-upgrade-design.md`; the plan is `docs/superpowers/plans/2026-10-06-universe-visual-upgrade.md`. The implementing session keeps the status table below current, one row per checkpoint, in the PR that merges it.

## Lane

- **Branch per checkpoint**: `claude/universe-visuals-<n>` from `origin/main`, PR to `main`, CI green, a merge commit. Never merge red, never force-push, never merge a PR outside this lane.
- **Files this lane owns**: `src/components/universe/post.js`, `planets.js`, `belt.js`, `livery.js` (its `teach` hook only), `scene.js` (the lights, the DEV hook, the flares and the per-frame calls the plan names), `universes.js` (`air` only), `landings/sky.js`, the new `lighting.js`, `poses.js`, `engines.js`, and `src/lib/three/{atmosphere,noise,noiseGlsl,flare,exposure,rock,explosions}.js`, `scripts/universe-check.mjs`, `scripts/planets/rickmorty.mjs`, `scripts/planets/caribbean.mjs`, `scripts/build-invincible-planet.mjs`, `scripts/build-cybertron-planet.mjs`, `lab/universe/baseline/`.
- **Other lanes, don’t cross**: `galaxy/surface/**` (the planets overhaul, two lanes), the world-runtime migration of the universe map (`HANDOFF-world-runtime.md`; keep `scene.js`’s `create(canvas, ctx)` shape), the ship-customisation files’ interfaces. `galaxy/bodies.js` and `galaxy/bodyShaders.js` are touched only by Task 3.1’s move of the atmosphere shell, which keeps their behaviour and tests.
- **Shared files, small edits only**: `docs/architecture.md` (one paragraph under the universe map’s entry once checkpoint 3 is in), `README.md` (nothing unless a screenshot in `docs/readme/` is retaken), `docs/autopilot/backlog.md` (tick the anisotropy item in checkpoint 5).

## Status

| # | Checkpoint | PR | Status | Evidence |
|---|---|---|---|---|
| 0 | Poses and a baseline | #302 (poses, check script); this PR (baseline) | done | `lab/universe/baseline/{high,mid,low}.json` and 30 shots, taken on `main` at e4fcc10e after the scale changes: high calls 49–150, triangles 0.14–1.32 M; mid calls 49–148, triangles 0.14–1.14 M; low calls 49–146, triangles 0.14–1.14 M |
| 1 | The render, finished | | not started | |
| 2 | One light | | not started | |
| 3 | Air, clouds, seas, ground | | not started | |
| 4 | The styles in the light | | not started | |
| 5 | The hero ship | | not started | |
| 6 | Rock | | not started | |
| 7 | What burns | | not started | |
| 8 | The sky on foot | | not started | |

Scorecard (the spec’s “Where things stand” table is the before): fill in the after per category as checkpoints land, one line of evidence each.

## Where the code differs from the plan

- **Checkpoint 0 is in two parts.** The owner asked for a scale change (the home system much larger than the ships) while checkpoint 0 was under way. That change moves the sun, the stations and the belt, so a baseline taken before it would be stale at once. The poses and the check script merge first; the scale change merges next with its own before and after (taken with this script); the committed baseline in `lab/universe/baseline/` is taken on `main` after that, before checkpoint 1.
- **A tenth pose, `station`**: parked at the Home station as the autopilot parks. It is the scale change’s before and after, and stays in the set.
- **What a pose is.** `poseFor(name)` returns `{ at, heading, eye, look }` (the ship held level at `at`, the camera at `eye` looking at `look`) plus `planet`, `view: 'map'` or `foot`, rather than `yaw`, `pitch` and `dist` behind the ship: the falcon-sun and maw framings need an eye that isn’t straight behind. A planet pose still puts the ship `dist` reaches out on the planet’s sun side (the plan’s test, as written). `middleearth-limb` is turned 0.5 rad off the sun line so a limb can show a terminator once the light comes from the sun (checkpoint 2).
- **The hold.** `pose(name)` sets `state.held` (DEV only): the ship isn’t stepped, the Maw doesn’t pull, the director stays quiet, hunters and meteors are cleared, the map is turned to the ship’s heading so the key light falls the same way each time. A landing pose resolves once the crew are out. `window.__universe().frames(n)` resolves after n drawn frames.
- **The check script runs on the dev server**, not `vite preview`: the poses are a DEV hook, which a production build leaves out. Each pose gets a fresh page (a landing can’t be flown back from in a script). The page’s bar, panel and HUD are hidden before each shot, so the shot and its metrics are the map alone. Calls and triangles are counted over one whole frame (`info.autoReset` off for it).
- **The canvas inspector** measures a live page and doesn’t export its pixel metrics, so `universe-check.mjs` has the same sums (`colorEntropyBits`, `edgeDensity`, `luminance.contrast`) on each shot.
- **`.gitignore`**: `lab/*`, then `!lab/universe/`, `lab/universe/*`, `!lab/universe/baseline/` (git can’t re-include a file whose parent directory is ignored, so the plan’s single exception line wouldn’t work).
- **The scale changes (#304, #309, #312, #321) came before the baseline.** The owner asked for the home system, the worlds, deep space, the home sun, the Citadel and Dickansh’s phone to be scaled into one order of sizes (`src/components/universe/scale.js`, pinned by `scale.test.js`). The baseline is taken on `main` after all of them.
- **Checkpoint 1:**
  - *Grain defaults off* in `post.js` (`uGrain` 0); only the universe map asks for it (`post.grain(grainFor(...))` each frame), so the galaxy and its surfaces, which draw through the same post, keep their picture. The dither is on for all three (it only hides banding).
  - *The dither reads the noise at `gl_FragCoord`* rather than `vUv × uNoiseScale`: one texel a pixel at whatever size the pass is drawn. The tile is 64 on `high` and 32 elsewhere (made at load: about 70 ms for 64, a few for 32).
  - *The bloom was already sized to the page*, not a fixed 256 (the spec read an older `post.js`); `bloomSize` caps its first level at 640 on the long side, a quarter the pixels on a 2560 screen, and a quarter of the frame on `small`.
  - *The aberration is a uniform, not a `#define`*: setting it to 0 at pace step 3 costs nothing, where switching a define would recompile the pass mid-flight. Two extra reads a pixel while it’s on.
  - *The flare is the home sun’s only*; the galaxy’s suns and the second star (Task 2.1’s) are for checkpoint 2, which brings `lighting.js`. The galaxy has no `lib/three/pace` of its own, so `post.setLevel` isn’t called there.
- **The Twins go round each other** (the owner’s ask, in checkpoint 1’s PR): `deep.js`’s `binaryAt(w, t)` and `moveBinaries(t)`; the place is the point they go round, and their solids move with them each frame on the scene’s clock.
- **Checkpoint 2:**
  - *The Twins’ two suns are lit from where they are now*: their `STARS` entries share the solids’ `at` arrays, which `moveBinaries` moves, so the key and the fill turn as they go round each other.
  - *The flares go to the key and the fill*, where the fill is a star (the plan’s “two heaviest”): two flares, each as strong as its star’s light is where you are (`key.strength / 2.35`), so a far star is a glint and not a glare, and one exposure from both. The cool fill that comes from no star has no flare.
  - *The reflections’ glow* (`post.js`’s `spaceEnvironment`, now with `{ light, colour }`) is made again only when the key star changes, at the key’s direction and in half its colour (a PMREM is a few ms: never every frame). In the home system it stays where the map always had it.
  - *Day sides without `focusPose`*: a world picked on the map is turned to by `dayYaw`, and `focusPose` looks along the map’s yaw, so it needed no change; `parkAt` scores the day side for the fandoms’ worlds and `startAt` prefers it, and a jump parks through `parkAt` (pinned in `nav.test.js`).
  - *The galaxy’s flares are not in*: `galaxy/scene.js` has its own sun sprites and no `pace`, and belongs to the galaxy’s lane (`HANDOFF-galaxy-upgrade.md`); `createFlare` is in `lib/three` for it.
- **Checkpoint 3:**
  - *The shell is shared, not copied*: `galaxy/bodyShaders.js` re-exports `ATMO`, `SHELL_VERT`, `SHELL_FRAG` and `NOISE` from `lib/three`, and `galaxy/bodies.js` makes its shells with `createAtmosphere`, passing its body’s uniforms so the ground and the air read one sun. Two options the galaxy didn’t need: `inner` (where the ground starts: a faceted sphere’s inscribed radius, so no ring of air shows through the facets) and `uStrength` (the hover).
  - *The ground’s rim goes when the air shows*, rather than a ground-side haze term: the shell already marches the haze in front of the limb, and the two together doubled it. On `low` and at the pace’s step 3 the halo and the rim come back together (`setAir`).
  - *Cloud shadows find the cloud layer by its texture* (`styleFor` names it; `buildPlanet` looks for the mesh wearing it), so each builder keeps its own cloud mesh. Their shadow is read where the clouds have turned to over the ground, each frame.
  - *The ground’s detail is a 256 noise tile made in code*, not a texture file, faded in from three radii to 1.3, worked out for the nearest two planets only (the rest are given 1e9).
  - *The high sets*: the Caribbean and Invincible get 2048 relief (`-hq`); Cybertron’s relief was already 2048 as its standard file, with a 1024 `-sm`, so its map entry is renamed from `transformers-normal-sm` to `transformers-normal` and gets the 2048 on high and up.

## Checking it

- `npx vite`, then `/universe` (`?quality=high|mid|low|ultra` pins the tier). `await window.__universe().pose('falcon-sun')` (checkpoint 0) places the camera; `window.__universeDebug` has `post`, `scene`, `renderer`, `camera`.
- `node scripts/universe-check.mjs --quality all` (checkpoint 0) writes `lab/universe/<tier>/<pose>.webp` and `<tier>.json`; compare with `lab/universe/baseline/`. It starts its own dev server (or `--url`), and takes about a minute a pose in the container (the landing about four). The container’s Chromium draws in software at a few frames a second, so compare its frame times only against each other and get the owner’s numbers for the PR where they matter.
- `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe,/galaxy/hoth,/galaxy/tatooine/surface` after anything in `post.js`.
- `scripts/preview/planets.html?id=middleearth&dist=1.4` (through the dev server) shows one planet as the map lights it; `node scripts/landing-check.mjs` lands on every planet and screenshots it (checkpoint 8).
- The canvas inspector’s metrics (`colorEntropyBits`, `edgeDensity`, `luminance.contrast`) are in each pose’s entry in the check script’s JSON; the inspector itself (`.claude/skills/threejs-qa-release/scripts/inspect-threejs-canvas.mjs --url …`) measures a live page.

## Gotchas

- `vitest --root /` hangs; throwaway tests go inside `src/`.
- Every new `onBeforeCompile` needs a `customProgramCacheKey`, composed after the hook already on the material (`airGlow`’s pattern in `planets.js`), and must be in the warm-up’s root (`scene.js`’s `warm`) or it compiles mid-flight and stalls a frame.
- `post.js` is shared by the galaxy and its surfaces. A uniform added to `FINAL` needs a default that leaves their picture as it was.
- `lab/` is ignored by git; only `lab/universe/baseline/` is committed (checkpoint 0 adds the `.gitignore` exception).
- Screenshots with grain on will differ run to run; the check script turns the grain off through the DEV hook and keeps the dither.
- `MESHY_API_KEY` and `SKETCHFAB_API_TOKEN` are not needed for this lane; nothing is fetched.
