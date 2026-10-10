# Universe Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The universe map and its hero ships read as clean as Bruno Simon's folio: the ship big and the highest-contrast thing on screen, a sky with a black floor and a few hundred stars rather than thousands, one palette, and a lens that drops the fine detail at the edges, measured at the fixed poses before and after.

**Architecture:** Three lanes on three branches at once, each owning its files (the spec's "The shape"). Lane A rebuilds the hero maps at the frequency the camera sees and gives the hull a graphic light ratio. Lane B gives the galaxy sky a `dim` for the map, a palette module, screen-size detail fades on rock, and deletes the dead star field. Lane C reframes the chase camera, adds a toe and a radial defocus to the final pass. Each lane's evidence is `scripts/universe-check.mjs` at its poses and the audit's pixel measure.

**Tech Stack:** three 0.186.1 (classic `WebGLRenderer`, GLSL), `@gltf-transform/core` + `functions` + `extensions`, `sharp`, `meshoptimizer`, Vitest 5, playwright-core 1.56 with the container's Chromium.

**Spec:** `docs/superpowers/specs/2026-10-08-universe-polish-design.md`. **Audit:** `docs/research/2026-10-08-universe-polish-audit.md`.

## Global Constraints

- A lane edits only the files the spec gives it. Shared files, one line each: `docs/architecture.md` (the universe map's entry), `docs/superpowers/HANDOFF-universe-polish.md` (your lane's row).
- No gameplay change: every key, save key, achievement, sound, dev hook (`window.__universe()`, `window.__RUNTIME__`) as before; every pose still resolves.
- No new dependency; no runtime asset service; rebuilt maps are committed.
- Draw calls and triangles at every pose at or under `lab/universe/baseline/high.json`; the sky's and the belt's lower.
- Hero GLBs' *maps* under 1.5 MB together after lane A (they were 1.79 MB: the 2.7 MB and 1.9 MB the audit gave are the files, of which 2.77 MB is meshopt-quantised geometry that the kept triangle counts keep). Both keep their triangle counts (60,050 and 133,795).
- `galaxy/sky.js`'s defaults are unchanged: `dim` 1, stars past 4,200 at 0.7. Only the universe map passes otherwise. `galaxy/sky.test.js` pins the defaults.
- Colours: `universe/palette.js` once it is on `main`; until then the hex the spec or the code gives, with a comment `// PALETTE.<name>`.
- British spelling, curly quotes, plain sentences; comments say why. No model identifiers in code, docs or commit messages. Commits end with the attribution lines the harness gives.
- Before each pull request: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --routes /universe`; and the universe check at the lane's poses before and after (`--quality high --frames 3`; it draws in software here and a pose takes a minute or more: run it in the background). Merge with a merge commit, CI green, never a rebase or a force-push. Don't edit files an open pull request changes (`git fetch --all --prune` and read the open PRs' file lists first).
- **The check's shots are blank on `main` at 04284f4a** (every pose: "the canvas is blank (1 one colour)" while the counts are right: 109 calls, 1.34 M triangles). The universe map moved onto the world runtime after the check was written; the runtime's canvas, or the frame the shot is taken on, no longer matches what the script screenshots. Lane C's Task C0 fixes the script first and merges it small; lanes A and B take their "before" shots after that merge (their first hour is the code; the shots come after).

## Review Focus

1. **A ship with a paint job.** The rim and the fill scale are added after the paint reads its texel; a hangar paint must look the same as today but for the light. Lane A's `livery.test.js`.
2. **The galaxy page's sky.** `/galaxy` draws exactly as today: `dim` 1, grain on, stars past 4,200 at 0.7. Lane B's `sky.test.js` pins the defaults; its PR shows a galaxy pose's counts unchanged.
3. **The cockpit and the map views.** Only the chase moves; `cockpitView` and `mapPose` are byte-for-byte as they were. Lane C's `flight.test.js` and a `git diff` the PR body quotes.
4. **A faint thing the toe must not kill.** The Milky Way's band, a planet's night-side city lights and a sign's colour sit above 0.08 after the toe; the toe takes only what is under 0.02 whole and feathers to 0.08. Lane C's `post.test.js` and the `middleearth-limb` shot.
5. **A rock up close.** A belt rock flown through at 200 px must still show its pits; the fade is by screen size, not distance, so a big rock far off and a small one near both read right. Lane B's `rock.test.js`.

---

## Lane A: the hero ship (`claude/universe-polish-a`)

### Task A1: The maps at the frequency the camera sees

**Files:**
- Create: `scripts/ship-maps.mjs`, `scripts/ship-maps.test.mjs`, `scripts/ship-maps/fixtures/line.png` (a 64 × 64 PNG with a two-texel dark line on a mid grey, made by the test's setup with `sharp` if missing)
- Rewrite: `public/models/sketchfab/falcon-hd.glb`, `public/models/sketchfab/xwing-hd.glb`
- Read first: `scripts/ktx2.mjs` and `scripts/sketchfab-batch.mjs` (how this repo already reads and writes GLBs with gltf-transform and meshopt); `src/lib/three/gltf.js`'s `SHIP_PROFILE`; `public/models/sketchfab/credits.json` or `src/data/modelCredits.json` (the files' credits, which stay)

**Interfaces:**
- Produces: `downscale(buffer, { size, sharpen: { radius, amount } | null }) → Promise<Buffer>` (sharp: Lanczos 3 resize, then unsharp when asked); `localContrast(buffer) → Promise<number>` (the standard deviation of a 5 × 5 high-pass of the luminance, 0..1); `rewrite(path, { albedo: 512, normal: 512, mr: 256, quality: 82, check: false }) → { before: [{ name, w, h, kB, contrast }], after: [...], bytes: { before, after } }`; CLI `node scripts/ship-maps.mjs [--check] <glb>...`.

- [ ] **Step 1: Write the failing tests** `ship-maps.test.mjs`: `downscale` of the fixture to 32 with the sharpen keeps the line's contrast within 20 % of the original's (measure `localContrast` before and after); without the sharpen it loses more than 20 % (so the sharpen is doing something); `rewrite` with `check: true` leaves the file's bytes untouched (hash before and after) and reports both textures of a tiny GLB the test builds with gltf-transform (two 64² textures).
- [ ] **Step 2:** `npx vitest run scripts/ship-maps.test.mjs` → FAIL.
- [ ] **Step 3: Implement.** gltf-transform `NodeIO` with `ALL_EXTENSIONS` and the meshopt decoder/encoder (as `ktx2.mjs` registers them); for each texture, classify by slot (`baseColorTexture` → albedo, `normalTexture` → normal, `metallicRoughnessTexture`/`occlusionTexture` → mr, else albedo), `downscale`, re-encode WebP at `quality`, set it back; write with meshopt kept. Header comment: why (the audit's "5 to 6 texels a pixel").
- [ ] **Step 4:** PASS. Run on both GLBs: `node scripts/ship-maps.mjs public/models/sketchfab/falcon-hd.glb public/models/sketchfab/xwing-hd.glb`; read the table; the maps under 1.5 MB together (the files are 3.2 MB: their geometry is 2.77 MB). Open `/universe` in the dev server (`npm run dev`, the smoke check) and look at the Falcon at `falcon-sun` through the check once C0 is merged.
- [ ] **Step 5:** Commit: `git commit -m "The hero ships' maps at the size the camera sees them: 512 with the panel lines kept, under 1.5 MB together"`.

### Task A2: A graphic light ratio

**Files:**
- Modify: `src/lib/three/gltf.js` (`SHIP_PROFILE.light = { key: 1, fill: 0.25, rim: 0.5 }`, roughness clamp top 0.72 → 0.6), `src/components/universe/livery.js` (the hook), `src/components/universe/livery.test.js`
- Read first: `livery.js` whole (136 lines), `lighting.js`'s `lightAt` (the key's and fill's colours), `scene.js` where `rim({ colour, dir })` is called each frame (grep `.rim(`; that call stays as it is: the hook does the complement)

**Interfaces:**
- Produces: `livery.rim({ colour, dir, key })` accepts an optional `key` colour (linear `[r, g, b]`); the hook's uniforms `uRimColour` (the complement mix), `uRimStrength` (0.5), `uFillScale` (0.25). `complement(key) → [r, g, b]`: `1 − key` normalised to the key's luminance, pure and exported.

- [ ] **Step 1: Write the failing tests**: `complement([1, 0.6, 0.3])` is bluish with the same luminance within 5 %; `rim({ colour, dir, key })` sets `uRimColour` to `mix(colour, complement(key), 0.5)`; without `key` it is `colour` (today's behaviour); `uRimStrength` 0.5; `uFillScale` 0.25; a material with `userData.noPaint` is untouched.
- [ ] **Step 2:** FAIL. **Step 3: Implement**: in the hook's GLSL, after the paint, scale the fill light's contribution: three's `#include <lights_fragment_begin>` sums every directional light; the fill is the second `DirectionalLight` the scene makes (read `scene.js` to confirm its index), so the cleanest cut is a `uFillScale` multiplied into `directLight.color` inside the light loop for `UNROLLED_LOOP_INDEX == 1` (an `onBeforeCompile` string replace on `lights_fragment_begin`, the way `planets.js`'s `keyHook` already does it: copy its pattern). Rim strength 0.5 from the profile. (The fill is found by its direction, the rim's, not by its index in the loop: three sorts shadow-casting lights first, and another hook may expand the loop; a macro over `getDirectionalLightInfo` after `lights_pars_begin` scales it.)
- [ ] **Step 4:** PASS; `npm run lint`. The scene's `rim` call gains `key: l.key.colour` (one line in `scene.js`: coordinate with lane C, which owns `scene.js`: ask in your PR body for lane C to add the line if their PR is open; else add it, the one line, and say so).
- [ ] **Step 5:** Commit: `git commit -m "The hull's light is graphic: key 1, fill a quarter, a half-strength rim in the key's complement"`.

### Task A3: Engines under the ship

**Files:**
- Modify: `src/components/universe/engines.js`, `engines.test.js`; and `trail.js` (the hero's long plume is a trail, not an `engines.js` glow: an optional `cap` it takes from `engines.js`'s `capPlume`, the galaxy's trails untouched) with `scene.js`'s one `createTrail` call for the hero
- Read first: `engines.js` whole; `trail.js`; `shipModels.js`'s `ENGINES`, `LENGTH`

**Interfaces:**
- Produces: `ENGINE_CAP = { length: 0.6, luminance: 0.8 }` exported; `plumeLength(throttle, boost, length) → number ≤ length × 0.6`; the plume's peak colour scaled so its luminance ≤ 0.8 × a lit hull's (take 1.0 as the hull's lit luminance in HDR units; the engine's hot centre today passes the bloom threshold 1.7: it no longer does; the bloom still catches the shots and the suns).

- [ ] **Step 1:** Tests: `plumeLength(1, 1, LENGTH)` ≤ 0.6 × LENGTH; `plumeLength(1, 0, …)` < `plumeLength(1, 1, …)`; the peak luminance of the plume's colour ≤ 0.8.
- [ ] **Step 2:** FAIL; implement; PASS. Look at `galaxy-hero.webp`'s pose in the dev server: the plumes shorter than the ship.
- [ ] **Step 3:** Commit: `git commit -m "The engines sit under the ship: the plume no longer than 0.6 of it, no brighter than its lit side"`.

### Task A4: Evidence and the pull request

- [ ] **Step 1:** After C0 is on `main` (`git merge origin/main`), `node scripts/universe-check.mjs --quality high --poses falcon-sun,maw --frames 3 --out lab/universe/polish-a` on `main`'s build (stash or a worktree) and on the branch; the audit's measure (`docs/research/2026-10-08-universe-polish-audit.md` describes it; write it as `scripts/pixel-measure.mjs` if lane C has not landed it yet, else use theirs) on both `falcon-sun` shots with the ship's crop.
- [ ] **Step 2:** The PR body: the maps' table (A1), the crop's standard deviation and crop-to-ring before and after, the counts against the baseline, the two shots side by side. Title: "The hero ship, clean: maps at the size the camera sees, a graphic light, engines under it". Merge on green.

---

## Lane B: the sky and the space between (`claude/universe-polish-b`)

### Task B1: The palette, and the dead sky out (its own small pull request, first)

**Files:**
- Create: `src/components/universe/palette.js`, `palette.test.js`
- Delete: `src/components/universe/skyShader.js`, `starField.js`, `starCatalog.js`, their tests, `public/textures/universe/stars.bin`, `scripts/bake-universe-stars.mjs`
- Modify: `docs/architecture.md` (the sentence on the Hipparcos field, under the universe map), any credit line for the ESO panorama or Hipparcos in `CREDITS.md` or `src/data/` that nothing uses now (grep `Hipparcos`, `ESO`; keep a credit whose picture is still used by `galaxy/sky.js` or `planets.js`'s `sky-glow`: check before deleting)
- Read first: `engines.js`, `sun.js`, `gunfx.js`, `deepspace.js`, `landmarks.js`, `belt.js` for today's hex values

**Interfaces:**
- Produces: `PALETTE = { sky, nebula, star, sun, bone, grey, engine, shot, ink }` each `{ hex: '#…', linear: [r, g, b] }`; `tint(name, k) → [r, g, b]` (linear, `k` of the way to white); `distinct(a, b) → number` (OKLab distance, pure).

- [ ] **Step 1: Tests**: nine names; each `linear` is the hex's sRGB-to-linear within 1e-3; every pair `distinct` ≥ 0.15; `sky` has the lowest luminance; `tint('sky', 1)` is white.
- [ ] **Step 2:** FAIL; implement with today's values read from the code (name each source in a comment); PASS.
- [ ] **Step 3:** Delete the dead files; `grep -rn "skyShader\|starField\|starCatalog\|stars.bin\|bake-universe-stars" src scripts docs README.md` finds nothing left but this plan and the audit. `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green.
- [ ] **Step 4:** Commit: `git commit -m "The universe's palette, and the sky it no longer draws taken out"`. Open the PR ("The universe's nine colours, and 395 lines of sky nothing drew"), merge on green, `git fetch origin main`, continue on the same branch merged with `main`.

### Task B2: The floor

**Files:**
- Modify: `src/components/galaxy/sky.js` (`createSky({ …, dim = 1, starsPast = STARS_PAST })`), `src/components/galaxy/sky.test.js` (create if there is none), `src/components/universe/scene.js:626` (one line: `dim: 0.4, starsPast: 0.25`: this is lane C's file; it is one line at one call, and both lanes know it: say so in both PR bodies), `landmarks.js` and `deepspace.js` (the nebulae's colour to `PALETTE.nebula` and 0.7 of today's brightness)
- Read first: `galaxy/sky.js` lines 38–52 and 344–420 (the constants, `bakeSize`, `starCount`, the stars' brightness law in the geometry's colour attribute), `landmarks.js`'s nebula atlas paint, `deepspace.js`'s `nebula()` at line 723

**Interfaces:**
- Produces: `createSky(opts)` with `dim` (a uniform `uDim` the bake's fragment multiplies the band, core and nebulae by; the cubed grain term inside `if (uDim >= 1.0 && level is ultra)`), `starsPast` (the brightness of stars past 4,200), and `starLaw(i, n, { past }) → brightness` exported and pure (today's law as a function, then steepened: the exponent such that the brightest fifth of the first 4,200 carry 70 % of their summed brightness; find it numerically in the test and write the constant).

- [ ] **Step 1: Tests**: defaults give `uDim` 1 and the galaxy's law unchanged (pin today's `starLaw` values at i = 0, 1000, 4199, 4200, 11999 for `past` 0.7); `dim: 0.4` sets `uDim` 0.4; with the steepened law the top fifth's share is 0.70 ± 0.02; `starsPast: 0.25` scales the stars past 4,200.
- [ ] **Step 2:** FAIL; implement; PASS. The universe's call passes `dim: 0.4, starsPast: 0.25`; the galaxy's `galaxy/scene.js` call is untouched.
- [ ] **Step 3:** The nebulae: `PALETTE.nebula` into `landmarks.js`'s atlas paint and `deepspace.js`'s puffs at 0.7 of their brightness. `landmarks.test.js` and `deep.test.js` green.
- [ ] **Step 4:** Commit: `git commit -m "A floor under the sky: the band dimmed for the map, the faint stars fainter, the nebulae on the palette"`.

### Task B3: Frequency on what is small

**Files:**
- Modify: `src/lib/three/rock.js` (`uScreenPx`; the pitted detail's weight `smoothstep(10, 40, uScreenPx)`), `rock.test.js`, `src/components/universe/belt.js` (sets `uScreenPx` per instanced draw each frame from the camera's distance to the band's nearest point and the shape's radius: `px = 2 × r × size.h / (2 × d × tan(FOV / 2))`; the three tones from `tint('grey', k)`), `belt.test.js`, `farStars.js` (spikes only above 14 px)
- Read first: `rock.js` whole, `belt.js`'s `update(t)` and its materials

**Interfaces:**
- Produces: `rock.js` exports `detailWeight(px) → 0..1`; `belt.js` exports `screenPx(r, d, h, fov) → number`.

- [ ] **Step 1:** Tests: `detailWeight(8)` 0, `detailWeight(40)` 1, monotone; `screenPx(1, 10, 720, 34)` ≈ 235; the belt's materials carry `uScreenPx`; `farStars`' spike weight 0 under 14 px.
- [ ] **Step 2:** FAIL; implement; PASS. `node scripts/rocks-check.mjs` if it still applies (read its header).
- [ ] **Step 3:** Commit: `git commit -m "What is small is flat: rock detail by its size on screen, far stars' spikes only when they are big enough"`.

### Task B4: Evidence and the pull request

- [ ] **Step 1:** After C0 is on `main`: the check at `overview,maw,middleearth-limb` before (`main`) and after; the pixel measure on each (bright points, share under 0.02, `edgeDensity`, `colorEntropyBits`).
- [ ] **Step 2:** The PR body: the table against the spec's targets (points under 800; 15 % under 0.02 at `maw`; edges halved on the sky; entropy one bit down), the counts against the baseline (the sky's and the belt's lower), a galaxy pose's counts unchanged (`node scripts/galaxy-check.mjs` or the galaxy's own shot), the shots side by side. Title: "The sky, clean: a floor, fewer stars, one palette, flat rock when it is small". Merge on green.

---

## Lane C: the lens and the frame (`claude/universe-polish-c`)

### Task C0: The check takes a picture again (its own small pull request, first)

**Files:**
- Modify: `scripts/universe-check.mjs` (how and when it screenshots)
- Read first: `scripts/universe-check.mjs` whole; `src/runtime/runtime.js` (the frame, `data-fresh`, `gfx.snapshot`), `src/runtime/runtime.css`, `src/pages/Universe.jsx` and `UniverseMap.jsx` (how the map mounts on the runtime now); `scripts/autopilot-check.mjs`'s smoke step (which does get a drawn canvas on `/universe`: copy how it waits and what it screenshots)

- [ ] **Step 1:** Reproduce: `node scripts/universe-check.mjs --quality high --poses falcon-sun --frames 3 --out lab/universe/c0` → "the canvas is blank (1 one colour)" with 109 calls. So the scene draws and the shot misses it: the likely causes, in order: the script screenshots a canvas that is no longer the one the runtime draws on (the runtime moves one canvas between hosts; the script may hold an old element or query the wrong one), the shot is taken while `data-fresh` keeps the canvas at opacity 0 (`runtime.css`), or the WebGL buffer is cleared before the shot (`preserveDrawingBuffer` false and the shot taken outside the frame: `gfx.snapshot` exists for exactly this; `page.screenshot` of the element inside a `requestAnimationFrame` after `__universe().frames(2)` is the other way).
- [ ] **Step 2:** Fix the one cause found (say which in the commit); the pose draws a picture: `entropy`, `edges`, `contrast` non-zero. Add a guard that fails loudly when the canvas the script found is not `document.querySelector('[data-gl] canvas')` or the runtime's `rt.gfx.canvas` (`window.__RUNTIME__.gfx.canvas`).
- [ ] **Step 3:** Commit: `git commit -m "universe-check takes its picture from the runtime's canvas again"`. PR ("The universe check's shots were blank since the map moved onto the runtime"), merge on green; tell lanes A and B in their PRs' threads (or the handoff's row) that it is in.

### Task C1: The hero in the frame

**Files:**
- Modify: `src/components/universe/flight.js` (`export const CHASE = { ahead: 0.15, up: 0.1, dist: 1.1, speed: 0.6, streak: 0.5 }`, `shipWidthOf({ length, fov, dist, aspect }) → 0..1`), `flight.test.js`, `src/components/universe/scene.js:1277-1288` (`chaseView` reads `CHASE`), a DEV hook `__universe().shipPx() → { w, h }` beside the existing `pose` and `frames` hooks
- Read first: `scene.js`'s `chaseView` (lines 1277–1288), `cockpitView` and `mapPose` (which do not change), the `__universe` DEV object (grep `__universe`)

- [ ] **Step 1: Tests**: `shipWidthOf({ length: 0.26, fov: 34, dist: chaseDepth(chaseDist({})), aspect: 16 / 9 })` between 0.20 and 0.25, at rest and at cruise; at the boost (`chaseDist({ speed: boost, boost })`) ≥ 0.14; `cameraFrom` unchanged (its existing tests). (The ship sits `ahead` nearer the camera than the target, not further: `chaseDepth(dist) = dist − ahead·cos(tilt) + up·sin(tilt)`.)
- [ ] **Step 2:** FAIL; implement; PASS. In the dev server at `falcon-sun`: `__universe().shipPx().w / 1280` within the range. `git diff` shows `cockpitView` and `mapPose` untouched (quote it in the PR).
- [ ] **Step 3:** Commit: `git commit -m "The ship fills a fifth of the frame: the chase camera closer and a little higher, its numbers in one place"`.

### Task C2: A toe

**Files:**
- Modify: `src/components/universe/post.js` (the final pass: `uToe` `vec2(0.02, 0.08)`, applied to the linear luminance before the shoulder; `uContrast` default 0.18), `post.test.js`
- Read first: `post.js` lines 95–210 (the uniforms and the final pass's fragment), the tone shoulder's comment at the top

**Interfaces:**
- Produces: `toe(l, lo, hi) → number` as a JS twin of the GLSL (pure, exported, tested): 0 at and under `lo`, `l` at and over `hi`, smooth between; `post.setToe(lo, hi)`.

- [ ] **Step 1: Tests**: `toe(0.02)` 0; `toe(0.08)` 0.08 within 1 %; `toe(0.5)` 0.5; monotone; the galaxy's default toe is `[0, 0]` (off: the galaxy's picture unchanged) and the universe map sets `[0.02, 0.08]`.
- [ ] **Step 2:** FAIL; implement (GLSL: `float t = smoothstep(uToe.x, uToe.y, lum); lin *= t;` on the colour scaled by its luminance's factor so hue holds); PASS. `uContrast` 0.18 only where the universe map sets it (`scene.js` sets the grade: read `post.js`'s `grade` setter; the galaxy's stays 0.07).
- [ ] **Step 3:** Commit: `git commit -m "A toe under the picture: black between the stars, the faint things kept"`.

### Task C3: A soft edge

**Files:**
- Modify: `src/components/universe/post.js` (`uDefocus` 0..1, five reads at ±1.5 px mixed by `smoothstep(0.55, 1.0, r)`; `setLevel` turns it to 0 at step 3; off on `low`), `post.test.js`

- [ ] **Step 1:** Tests: the mix is 0 at the centre and 1 at a corner (a JS twin `edgeWeight(uv, aspect)`); `post.lite()` keeps it; `setLevel(3)` sets `uDefocus` 0; the galaxy's default 0, the universe sets 1 on `mid` and above.
- [ ] **Step 2:** FAIL; implement; PASS. Frame time at `overview` with `--frames 3` within 5 % of before (five reads at the edges only: the centre reads once through the same branchless mix; say the cost).
- [ ] **Step 3:** Commit: `git commit -m "A soft edge to the frame: the fine detail falls off toward the corners, the ship stays sharp"`.

### Task C4: The measure, the evidence, the pull request, and the README's pictures

**Files:**
- Create: `scripts/pixel-measure.mjs` (the audit's measure as a script: `node scripts/pixel-measure.mjs <image>[@x0,y0,x1,y1]...` → median, p10, p90, share under 0.02 and 0.05, bright points, and the crop's mean, standard deviation and ring mean), `scripts/pixel-measure.test.mjs` (on a 16 × 16 fixture the test paints with `sharp`)
- Modify (last, after A and B merge): `docs/readme/hero.webp`, `docs/readme/universe.webp` (retaken at the same framing with `scripts/autopilot-check.mjs`'s shot or the check's `falcon-sun` and `overview`), `docs/superpowers/HANDOFF-universe-polish.md` (create, with the three lanes' rows), `docs/architecture.md` (one sentence)

- [ ] **Step 1:** The measure script and its test; PASS. (Lanes A and B use it if it is on `main` when they reach their evidence step.)
- [ ] **Step 2:** The check at `falcon-sun,overview,belt` before and after; `shipPx` at each; the measure on each shot; the counts against the baseline.
- [ ] **Step 3:** The PR body: the ship's width in pixels before and after, the share under 0.02, the counts, the shots. Title: "The lens and the frame: the ship a fifth of the picture, a toe, a soft edge". Merge on green.
- [ ] **Step 4:** Once A and B are on `main`: retake `hero.webp` and `universe.webp`, the handoff's status table with every lane's numbers against the spec's targets, one small PR ("The README's universe, as it is now").

---

## Self-review (done when this plan was written)

Spec coverage: lane A's maps (A1), light ratio (A2), engines (A3); lane B's palette and dead code (B1), floor (B2), frequency (B3); lane C's check fix (C0), framing (C1), toe (C2), soft edge (C3), measure and README (C4); every lane's evidence (A4, B4, C4). Names used across lanes: `PALETTE`, `tint`, `CHASE`, `shipWidthOf`, `shipPx`, `dim`, `starsPast`, `starLaw`, `detailWeight`, `screenPx`, `toe`, `edgeWeight`, `scripts/pixel-measure.mjs`. The one shared line (`scene.js:626`'s `createSky` call) is named in B2 and in the Global Constraints. Review Focus items each name their task.
