# The Middle-earth Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The map hub at `#/middle-earth` paints its sheet in the first frame and opens with a flight down the road, sits on a desk with a candle that lights it at night, wakes each place as you look at it, inks the road as far as you have got, and wears a small face with a first step, marks you can read, a ribbon and a journal, on desktop and phone.

**Architecture:** Pure rules in tested files (`hub/hubState.js`, `hub/attention.js`, `hub/labels.js`, `mapFlight.js`, `record.js`); the scene grows by hooks in `MapBackdrop3D.js` that call new drawing files (`mapRoom.js`, `mapTerrain.js`, `mapWeather.js`, `mapWake.js`, `mapRoad.js`), each exporting `build*(…) → { update, dispose }`; `MapHub.jsx` keeps the pointer, key and frame logic and composes a `hub/` folder of React pieces styled by `middleearth-hub.css`. `MapBackdrop.jsx` holds two canvases: the flat sheet first, the WebGL faded in over it.

**Tech Stack:** React 19, three 0.186.1 (classic `WebGLRenderer`), Vitest 5, playwright-core 1.56 with the container’s Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, `sharp`.

**Spec:** `docs/superpowers/specs/2026-10-09-middle-earth-landing-design.md`. The before shots: `docs/superpowers/shots/2026-10-09-me-hub-before-*.webp`.

## Global Constraints

- No new dependency; nothing downloaded that is not today; `WORLD_MB['/middle-earth']` stays 1.
- A file stays under 800 lines. `mapDiorama.js` (791) and `MapBackdrop3D.js` (329) take hooks only; new drawing lives in new files.
- `src/components/middleearth/look.js` is unchanged; new materials are `MeshStandardMaterial` with `flatShading: true` or `MeshBasicMaterial`; no `loadPbr`, no `MeshToonMaterial`.
- The backdrop API keeps every name and signature it has (`setView`, `project`, `unproject`, `travel`, `panBy`, `zoomBy`, `holding`, `resetView`, `lookAtFrodo`, `tap`, `say`, `walkToSheet`, `drive`, `on`, `headOf`, `travellers`, `step`, `frodoSheet`, `place`, `walking`, `render`, `resize`, `dispose`, `renderer`, `ready`, `lost`); chapters get the same `spot` and `zoom`.
- `lib/device`: `budget().tier` decides every tier branch; `prefersReducedMotion()` from `lib/hooks` every motion branch. Say in a comment what each tier gets.
- House UI: every z-index a token (`--z-sheet` for the card’s sheet and the journal); spacing on the 4 px grid; text over 3D on glass at 0.78 or more; controls 44 px on a coarse pointer, 36 px otherwise; `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm`, `.kbd`, `CloseButton` (from `src/components/ui.jsx`) and `src/components/icons.js` for drawings; dim by colour, never text under 0.55 alpha.
- Copy: British spelling, curly quotes (’ “ ”), sentence case, no Oxford comma, no exclamation marks; comments say why, in the file’s voice.
- Tests beside their files, under a second, no canvas, no network. `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` green before every commit that touches `src/`.
- Commit messages: one plain sentence, the body saying why and the numbers; end with the attribution lines the harness gives. No model names in code, docs or commits.
- Don’t reformat lines you aren’t moving; don’t rename for taste.
- Every relative import under `src` that could resolve to two files names its extension (`src/imports.test.js`).

## Review Focus

1. **A chapter opened straight from a link** (`#/middle-earth/moria` with no hub first): the backdrop is given `spot` at once; the flat canvas, the flight and the wake must not run; the room must draw behind the chapter as the table did. Task 3’s and Task 4’s shots of `/middle-earth/shire` (the chapter as before, the room behind it).
2. **The opening ended early by a scroll** while the flight is mid-air: the camera eases to the hub from where it is, and `want` is the hub’s. Task 3’s `flightAt` test for a time past the end, and its manual check.
3. **A visitor with seals in a chapter the road does not reach in order** (a seal in Mordor, none in Bree): the inked road reaches Mordor (the furthest with a seal), the first step says “Carry on · Bree”. Task 1’s and Task 7’s tests.
4. **A phone in landscape** (844 × 390): the card is a bottom sheet, the ribbon one row, the head on glass still shows the first step. Task 8’s phone shots in both orientations.
5. **WebGL lost mid-hub** (`webglcontextlost`): `onLost` sets `on` false and the flat canvas is still underneath showing the sheet, with the UI live. Task 3’s `MapBackdrop.jsx` keeps the flat canvas mounted while the WebGL one is up.

---

## Lab (dev only, git-ignored)

`lab/` is git-ignored but for `lab/universe`. Task 0 writes `lab/me/shots.mjs` and `lab/me/measure.mjs`; every later task that changes what is seen runs both and writes its numbers into `docs/superpowers/HANDOFF-middle-earth-landing.md`. If `lab/me/` is gone when a task starts, recreate it from Task 0.

### Task 0: The lab scripts and the baseline

**Files:**
- Create: `lab/me/shots.mjs` (exists from the design session; keep it), `lab/me/measure.mjs`, `docs/superpowers/HANDOFF-middle-earth-landing.md`
- Modify: `src/components/middleearth/MapBackdrop3D.js` (one line: `info: () => ({ ...renderer.info.render })` on the returned API, beside `renderer`)
- Read first: `lab/me/shots.mjs` (how the dev server and Chromium are started and the hub forced to WebGL with `tp-map3d`), `scripts/autopilot-check.mjs` lines 96 to 140 (the viewport sizes and the screenshot), `scripts/lib/noise.mjs` (`freePort`)

**Interfaces:**
- Produces: `node lab/me/measure.mjs [--dark] [--phone]` printing one JSON line `{ calls, triangles, uiShare, pool }`: `calls` and `triangles` from `window.__ME__.map.info()` after 8 s on the hub with the opening skipped; `uiShare` the area of the union of the bounding boxes of every element matching `.me-hub-head, .me-pin-label, .me-mark-label, .me-ribbon, .me-route, .me-hub-links, .me-credit, .me-hint` (whichever exist), clipped to the viewport, over the viewport’s area (compute the union by rasterising the boxes onto a 4 px grid in page script); `pool` in `--dark` only: the mean Rec. 709 luminance (0…1) of a 300 × 200 px patch of the WebGL canvas centred on `window.__ME__.map.project(60, 40).{x,y}` (the sheet’s north-west corner, where the candle will stand), read with `preserveDrawingBuffer` forced by an `addInitScript` that wraps `HTMLCanvasElement.prototype.getContext` to add `preserveDrawingBuffer: true` to any `webgl`/`webgl2` call.

- [ ] **Step 1:** Add `info()` to the backdrop API in `MapBackdrop3D.js` (one line, a comment: “the lab’s counts”).
- [ ] **Step 2:** Write `lab/me/measure.mjs` as above; run `node lab/me/measure.mjs`, `--dark`, `--phone`, `--phone --dark`. Expected: four JSON lines; `calls` and `triangles` positive.
- [ ] **Step 3:** Run `node lab/me/shots.mjs lab/me/before` once more if `lab/me/before` is missing (the committed copies are under `docs/superpowers/shots/`).
- [ ] **Step 4:** Write `docs/superpowers/HANDOFF-middle-earth-landing.md`: the lane’s purpose in two lines, a link to the spec and this plan, a table “Baseline” with the four measure lines, and an empty table “After each task” with columns task · calls · triangles · uiShare desktop · uiShare phone · pool dark.
- [ ] **Step 5:** `npm run lint && npm test` → green. Commit: `git commit -m "The Middle-earth hub’s lab: its counts and its UI’s share measured, and the baseline written down"`.

---

## Wave 1: the pure rules

### Task 1: The hub’s state: the first step and the furthest stop

**Files:**
- Create: `src/components/middleearth/hub/hubState.js`, `src/components/middleearth/hub/hubState.test.js`
- Modify: `src/components/middleearth/record.js`, `src/components/middleearth/record.test.js`
- Read first: `record.js` (`chapterRecord`, `roadRecord`, `HIDDEN_SEALS`), `chapters.js` (`CHAPTERS`, `stopOf`), `hidden.js` (`HIDDEN`), `road.js` (`STOPS`)

**Interfaces:**
- Produces, in `record.js`: `roadInked(unlocked = []) → number` (the index in `STOPS` of the furthest chapter in road order with at least one of its seals in `unlocked`, by `stopOf`; 0 with none) and `hiddenHints(unlocked = []) → string[]` (the ids of `HIDDEN` places whose `found` seal is not in `unlocked`, only when every chapter in `CHAPTERS` has at least one seal in `unlocked`; else `[]`).
- Produces, in `hub/hubState.js`: `firstStep(unlocked = []) → { kind: 'begin' | 'carry' | 'again', id, label }`: `begin` with `id: 'shire'` and `label: 'Begin at the Shire'` when no chapter has any seal; `carry` with the id of the first chapter in road order whose `chapterRecord(c, { unlocked }).won` is false and `label: 'Carry on · <name>'`; `again` with `id: 'shire'` and `label: 'The road again'` when every chapter is won. `nextUnfinished(unlocked) → id | null` (the `carry` id, or null when all won), used by the ribbon.

- [ ] **Step 1: Write the failing tests.** In `record.test.js`: `roadInked([])` is 0; `roadInked(['breegate'])` is `stopOf('bree')`; `roadInked(['breegate', 'eagles'])` is `stopOf('mordor')` (the Review Focus case 3); `hiddenHints(['breegate'])` is `[]`; with one seal from every chapter and none of `HIDDEN_SEALS`’ `found`, it is every `HIDDEN` id in order; with `'orthanc'` added, Orthanc is out. In `hub/hubState.test.js`: `firstStep([])` is `{ kind: 'begin', id: 'shire', label: 'Begin at the Shire' }`; `firstStep(['eagles'])` is `carry` to `shire` (the Shire is not won); `firstStep(CHAPTERS[0].seals)` is `carry` to `bree` with label `'Carry on · Bree'`; `firstStep(CHAPTERS.flatMap((c) => c.seals))` is `again`; `nextUnfinished` agrees.
- [ ] **Step 2:** `npx vitest run src/components/middleearth/record.test.js src/components/middleearth/hub` → FAIL (not exported / module not found).
- [ ] **Step 3:** Implement the four functions. `hubState.js` imports from `../record` and `../chapters`; header comment says what the first step is for.
- [ ] **Step 4:** Same run → PASS. `npm run lint`.
- [ ] **Step 5:** Commit: `git commit -m "The hub knows the first step to offer, how far the road is inked, and when the hidden places may hint"`.

### Task 2: Attention, labels and the flight

**Files:**
- Create: `src/components/middleearth/hub/attention.js` + `.test.js`, `src/components/middleearth/hub/labels.js` + `.test.js`, `src/components/middleearth/mapFlight.js` + `.test.js`
- Read first: `chapters.js` (ids and `at`), `road.js` (`STOPS`), `MapBackdrop3D.js` lines 96 to 120 (`setView`: the hub framing `[452, 322]` and zoom `3.05`, the chapter zoom `1.45`)

**Interfaces:**
- `hub/attention.js`: `createAttention(ids) → { values: Record<id, number>, step(dt, { hover = null, near = null, flying = null, instant = false }) → values }`. Each id eases toward its target: 1 for `hover` or `flying`, 0.6 for `near` (when not hovered or flying), else 0; up at 1/0.4 per second, down at 1/0.8 per second, clamped; `instant` sets the target at once (reduced motion).
- `hub/labels.js`: `cullLabels(points, min = 72) → Set<id>`: `points` is `[{ id, x, y, on }]` in road order; returns the ids whose label shows: a point with `on` false is out; a point is in when no earlier *shown* point is within `min` px (Euclidean).
- `mapFlight.js`: `FLIGHT` (the keyframes `[{ t, at: [x, y], zoom }]`: `t` 0 at Hobbiton `[186, 196]` zoom 1.1; 1.0 Bree; 1.8 Rivendell; 2.6 Moria; 3.3 Lothlórien; 4.0 Amon Hen; 4.7 Mount Doom at zoom 1.3; 5.5 `[452, 322]` zoom 3.05, the hub), `FLIGHT_MS = 5500`, `TITLE = { inMs: 1500, outMs: 4500 }`, `flightAt(ms) → { at: [x, y], zoom, done }`: linear in `t` between keys with a smoothstep ease on each leg, `done` true at or past the last key (then the last key’s values).

- [ ] **Step 1: Write the failing tests.** `attention.test.js`: a hovered id reaches 1 within 0.4 s of `step(0.1, …)` calls and not before 0.3 s; a released one falls to 0 within 0.8 s; `near` tops at 0.6; `instant` jumps; unknown ids in the input are ignored. `labels.test.js`: two points 50 px apart in road order show the first only; 80 px apart both; a point with `on: false` never shows and never hides another; the empty list gives an empty set. `mapFlight.test.js`: `flightAt(0).at` is `[186, 196]`; the `at` at each key’s `t` is that key’s; the x of `at` is non-decreasing over the first 4.7 s sampled every 100 ms (the road runs east); `flightAt(6000)` is the hub framing with `done` true; `FLIGHT_MS` equals the last key’s `t × 1000`.
- [ ] **Step 2:** `npx vitest run src/components/middleearth/hub src/components/middleearth/mapFlight.test.js` → FAIL.
- [ ] **Step 3:** Implement the three files; each header says why (attention: the places answer the pointer; labels: a crowded zoom shows dots; flight: the opening is the films’ beginning).
- [ ] **Step 4:** Same run → PASS. `npm run lint`.
- [ ] **Step 5:** Commit: `git commit -m "Pure rules for the hub: each place’s attention, which names show at a zoom, and the opening’s flight down the road"`.

---

## Wave 2: the scene

### Task 3: The sheet first, and the flight

**Files:**
- Modify: `src/components/middleearth/MapBackdrop.jsx`, `src/components/middleearth/MapBackdrop3D.js`, `src/components/middleearth/mapPaint.js` (`paintMap(width)` already takes a width; nothing to add unless the edge mask is wanted here: it is Task 4’s), `src/styles/lazy/middleearth.css` (`.me-atlas` rules)
- Read first: `MapBackdrop.jsx` whole (249 lines: `createFlat`, the effect, the opening’s timer), `MapBackdrop3D.js` `setView` and `render`, `opening.js`, `mapFlight.js` (Task 2)

**Interfaces:**
- Consumes: `flightAt`, `FLIGHT_MS`, `TITLE` from `./mapFlight`.
- Produces: `.me-atlas` holds two canvases: `<canvas data-layer="flat">` under `<canvas data-layer="gl">`. `createFlat` paints `paintMap(1024)` at mount on every device with a document (not awaited on the font: `mapFont()` is raced with the paint; the flat redraws once the font is in). `MapBackdrop3D`’s API gains `flight(ms | null)`: while a number, `render` takes `flightAt(ms)` as the goal over `want` (same ease constant as a hurry, 3.5); `null` returns it to `want`. The 3D canvas gets `data-on` only after its first `render` returned true; CSS fades it in over 0.7 s; the flat canvas stays mounted and keeps rendering until `data-on` (then stops, `first = false`), and resumes if `onLost` fires (Review Focus 5).

- [ ] **Step 1:** `MapBackdrop.jsx`: mount the flat canvas and paint it at once (the no-chip path becomes the always path); on a chip, load `MapBackdrop3D` as today into the second canvas; `setView` and `resize` go to both while both live; `project`/`unproject` and the rest come from the WebGL API once it is on, the flat one before.
- [ ] **Step 2:** The opening: when `opening` and the WebGL is on, the component drives `api.flight(performance.now() − t0)` each frame from the loop and ends the opening at `FLIGHT_MS` (not `HOLD`); the title card’s CSS animation takes `--me-title-in: 1.5s` and `--me-title-out: 4.5s` from `TITLE` as inline custom properties; the skip handlers call `api.flight(null)` then end. Under `prefersReducedMotion()`: no flight, the hold is 1500 ms. If the WebGL is not up within 1800 ms the opening ends as today.
- [ ] **Step 3:** Verify by hand: `node lab/me/shots.mjs lab/me/t3` and `Read` `01-opening.webp` (the sheet is there at 2.5 s, the camera low over the Shire with the title card), `02-hub.webp` (as before), `08-chapter-shire.webp` (the chapter unchanged: Review Focus 1). Add a shot at 500 ms to `shots.mjs` (`00-first-paint`, `wait: 500`): the flat sheet shows.
- [ ] **Step 4:** `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build` → green. `node scripts/autopilot-check.mjs --only smoke --routes /middle-earth,/middle-earth/moria` → green.
- [ ] **Step 5:** Commit: `git commit -m "The map paints its sheet in the first frame and opens with a flight down the road, the WebGL fading in over the paper"`.

### Task 4: The room: the desk, the sheet’s edge, the candle, the night

**Files:**
- Create: `src/components/middleearth/mapRoom.js`
- Modify: `src/components/middleearth/MapBackdrop3D.js` (replace `table` and `shade` with `buildRoom`; the lights’ night numbers; the candle light pinned), `src/components/middleearth/mapPaint.js` (`paintEdge(width) → canvas`: an alpha mask, white inside a torn fbm edge 6 to 14 sheet units in from the border, black outside, foxing spots near the edge), `docs/superpowers/HANDOFF-middle-earth-landing.md` (the row)
- Read first: `MapBackdrop3D.js` whole, `mapDiorama.js` lines 39 to 80 (`mat`, `put`, `instanced`: copy the helpers’ shape, don’t import them), `lib/paint.js` (`makeCanvas`, `paintPixels`, `fbm`, `makeNoise`), `kit.js`’s `FIRE` ramp and `createParticles` (for the flame, or two crossed planes with an additive `MeshBasicMaterial`: the plan picks the planes, cheaper)

**Interfaces:**
- Produces: `buildRoom(scene, { W, H, tier }) → { candle: THREE.Object3D (the flame’s base, where the light sits), update(dt, t, { night, m }), dispose() }`. The desk is a plane `W + 60` by `H + 60` at `y = −0.3` with a 512² canvas texture of dark planks (noise, `RepeatWrapping`, `SRGBColorSpace`); the props are merged by material into at most 6 meshes; the candle’s flame is two crossed 0.6 × 1.2 planes (additive, `depthWrite` false) scaled by `0.7 + night × 0.3` and jittered by `t`. The sheet (in `MapBackdrop3D`) takes `alphaMap: paintEdge(1024)` as a `CanvasTexture`, `alphaTest: 0.5`, and its `PlaneGeometry` corners are raised by 0.15. The candle `PointLight` is moved to `room.candle.position` once (no longer per frame); `night.ambient` intensity becomes `0.5` at full night (`ambient.intensity = (0.85 − 0.35 × cur.n) × (1 − 0.45 × cur.m)`), the candle `decay` 1.6, its intensity `(900 + 1400 × cur.n) × flick` (not scaled by `z²`, since it no longer follows the camera); tune the two candle numbers until `node lab/me/measure.mjs --dark` gives `pool ≥ 0.18`, and write the final numbers and the measured pool in the file’s comment.

- [ ] **Step 1:** `mapPaint.js`: add `paintEdge`. `mapRoom.js`: build the desk, the edge (the sheet’s material options are returned as `sheetOptions: { alphaMap, alphaTest }` for `MapBackdrop3D` to spread in), the weights, the inkwell and quill, the pipe, the book, the candle and its flame; `update` flickers the flame and fades it with `night`.
- [ ] **Step 2:** `MapBackdrop3D.js`: `const room = buildRoom(scene, { W, H, tier: budget().tier })`; remove `table` and `shade`; `candle.position.copy(room.candle.position)` once; the lighting numbers above; `room.update(dt, t, { night: cur.n, m: cur.m })` in `render`; `room.dispose()` in `dispose`. The sheet’s corners: after `new THREE.PlaneGeometry(W, H, 1, 1)`, raise its four vertices’ y by 0.15 (rotate first as today, then displace y).
- [ ] **Step 3:** `node lab/me/measure.mjs --dark` until `pool ≥ 0.18`; `node lab/me/measure.mjs` for calls and triangles (at most baseline + 8 calls); `node lab/me/shots.mjs lab/me/t4` and `Read` `02-hub.webp`, `04-hub-dark.webp`, `08-chapter-shire.webp` (the room behind the chapter: no desk edge in the chapter’s close view is fine; no black void).
- [ ] **Step 4:** The gates (lint, test, build, health, smoke on `/middle-earth`). Write the row in the handoff.
- [ ] **Step 5:** Commit: `git commit -m "The map lies on a desk with its weights, inkwell, pipe and book, a torn edge to the sheet, and a candle that lights it at night"` with the pool and counts in the body.

### Task 5: The terrain and the weather

**Files:**
- Create: `src/components/middleearth/mapTerrain.js`, `src/components/middleearth/mapWeather.js`
- Modify: `src/components/middleearth/MapBackdrop3D.js` (the sheet’s geometry from `buildTerrain`; `weather.update`), `src/components/middleearth/mapPaint.js` (`paintRelief` zeroes within 15 units of every `STOPS` entry and every `CHAPTERS.at`: add the exclusion to `hill`’s loop; the normal map keeps the same relief, so the places no longer get a bump either, which is right), the handoff row
- Read first: `mapPaint.js`’s `paintRelief`, `mapData.js` (`SHEET`, `RANGES`), `MapBackdrop3D.js`’s sheet and `SCALE`

**Interfaces:**
- `mapTerrain.js`: `buildTerrain({ W, H, tier, relief: canvas }) → { geometry: THREE.PlaneGeometry (rotated −π/2 about x, subdivided by tier: high 160 × 112, mid 80 × 56, low 1 × 1, corners raised 0.15 as Task 4 did, each vertex’s y plus `heightAt(x, y) × 0.6`), heightAt(sx, sy) → 0…1 }` where `heightAt` samples the relief canvas’s red channel (bilinear not needed; nearest) at sheet coordinates. Task 4’s corner lift moves here.
- `mapWeather.js`: `buildWeather(scene, { W, H, tier, reduced }) → { update(dt, t, { night, m }), dispose() }`: `clouds` (a plane `W × H` at `y = 0.02`, `MeshBasicMaterial` colour `0x2a1a0e`, `transparent`, `depthWrite` false, `alphaMap` a 256² fbm canvas with `RepeatWrapping`, `opacity = 0.22 × (1 − night)`, `alphaMap.offset.x += 0.25 / W × dt` unless `reduced` or tier `low`; not built on `low`), `pall` (a plane over the sheet’s `[600…800] × [340…520]` at `y = 0.04`, colour `0x120806`, a 256² radial-falloff fbm alpha, `opacity = 0.35 + 0.35 × m`, `rotation.z += 0.02 × dt` unless reduced), `mist` (over `[540…590] × [325…360]` at `y = 0.03`, colour `0xcfd6c8`, `opacity = 0.18 + 0.08 × sin(t × 0.7)`).

- [ ] **Step 1:** `paintRelief`’s exclusion (import `STOPS` and `CHAPTERS` into `mapPaint.js`; it already imports `STOPS`). `mapTerrain.js` as above. `MapBackdrop3D.js`: `const terrain = buildTerrain({ W, H, tier, relief: paintRelief(1024) })` (the same canvas feeds `normalCanvas` as today), the sheet mesh takes `terrain.geometry`; `receiveShadow` stays.
- [ ] **Step 2:** `mapWeather.js`; `MapBackdrop3D.js` builds it after the room and calls `weather.update(dt, t, { night: cur.n, m: cur.m })`, disposes it.
- [ ] **Step 3:** Verify: `node lab/me/measure.mjs` (triangles at most baseline + 60,000; calls at most baseline + 8 with Task 4’s), `?quality=low` through `shots.mjs` (add `low: true` option that sets `tp-quality` to `low`: no clouds, the plane 1 × 1), `Read` `02-hub.webp` (the ranges shaded on their east, the cloud shade drifting between two shots 2 s apart: add `02b-hub-later` with `wait: 9000`), `03-hub-hover-moria.webp` (pins still on their places: the exclusion worked).
- [ ] **Step 4:** The gates and the handoff row.
- [ ] **Step 5:** Commit: `git commit -m "The ranges stand up off the sheet and catch the light, cloud shadows drift over it by day, a pall hangs over Mordor and mist over the marshes"`.

### Task 6: The places wake

**Files:**
- Create: `src/components/middleearth/mapWake.js`
- Modify: `src/components/middleearth/MapBackdrop3D.js` (`attention(values)` on the API; `wake.update`), `src/components/middleearth/mapDiorama.js` (**hooks only, under 800 lines**: the returned handle gains `wakeHandles: { bombs, wisps, motes, falls, moriaGlow, eye, beam, partyTree: the Party Tree’s mesh, riv: the Rivendell group, ponyWindow: the Pony’s window mesh }` and `pointer: { x, z }` settable; the Eye’s `look` reads `pointer` when `S.wake.mordor > 0`: `look = lerp(sin look, atan2 to pointer, wake)`), `MapHub.jsx` (steps `createAttention` in `place()` with `{ hover, near, flying }` and calls `api.current.attention?.(values)`; `instant` under reduced motion), the handoff row
- Read first: `mapDiorama.js`’s `update` (lines 619 to 750) and the per-place blocks (121 to 475), `kit.js`’s `createParticles` and `emit(x, y, z, vx, vy, vz, life, s0, s1, gain)`, `hub/attention.js`

**Interfaces:**
- `mapWake.js`: `buildWake(scene, { handles, P (sheet → scene coords), tier, reduced }) → { update(dt, t, values, pointer), dispose() }`. Per place, with `k = values[id]`; nothing drawn or emitted at `k = 0`:
  - `shire`: every `1.2 / k` s emit 24 `bombs` from above the Party Tree (`P(186 + 22, 196 + 6)`, y 2.6) at speed 2…4, life 0.8, size 0.1→0.03; the three door lights’ material `color` lerped toward `hot(0xffd76a, 2)` by k (the diorama exposes them in `handles.doorLights`).
  - `bree`: a rain sheet: an `InstancedMesh` of 80 thin planes (0.02 × 0.25, `MeshBasicMaterial` `0x9fb4c8`, opacity 0.5) over the Pony, falling at 4 units/s, recycled from y 3 to 0, `count = round(80 × k)`; `handles.ponyWindow` colour toward `hot(0xffd28a, 1.6)`.
  - `weathertop`: five riders: one `InstancedMesh` (a merged cone 0.12 × 0.5 and sphere 0.08) placed round the ruin’s ring at radius 0.45, y 1.35, `visible = k > 0.05`, scale k; a `MeshBasicMaterial` disc `0x7a1a10` under the ring, opacity `0.5 × k`.
  - `rivendell`: `handles.falls` materials’ opacity `0.8 + 0.2 × k`, colour toward `hot(0xdff2ff, 1.3 + 0.8 × k)`.
  - `moria`: `handles.moriaGlow.material.opacity` floor `0.35 + 0.65 × k` (the diorama’s own sine runs under it), colour `hot(0x9fc4ff, 2 + 2 × k)`.
  - `lorien`: emit `motes` at `9 × (1 + k)` a second (the diorama’s own `9`; the wake adds `9 × k` more at the same place), the mallorn’s crown colour toward `0xffe27a`.
  - `amon-hen`: two boats (merged box hulls 0.3 × 0.08 × 0.12, `0x6b4a2b`) drifting south on the Anduin at `P(488, 356)` ± 1 at 0.3 units/s, looping, `visible = k > 0.05`.
  - `dead-marshes`: emit `wisps` at `5 × 2 × k` more a second at the marshes.
  - `cirith-ungol`: a green glow disc (`0x3fbf6a`, additive, opacity `0.35 × k`) at Minas Morgul `P(584, 440)` and 8 torches (an `InstancedMesh` of tiny `hot(0xffa040, 2)` spheres) up a line from `P(590, 438)` to `P(600, 426)`, scale k.
  - `mordor`: `pointer` handed to the diorama (`handles.pointer`), `values.mordor` to it as `S.wake.mordor`; the pall deepens through `m` already (the hub passes `mordor` hover).
  - Each place’s extra geometry: at most 2 draw calls; built lazily on first `k > 0`, kept after.
- `MapBackdrop3D` API: `attention(values)` stores them; `render` calls `wake.update(dt, t, values, pointerOnSheet)` where `pointerOnSheet` is the last `unproject` of the pointer the hub sent through a new `api.pointer(x, y)` (screen px; the hub calls it from `onMove` on a mouse).

- [ ] **Step 1:** `mapDiorama.js` hooks: expose the handles listed (add fields to the returned object; `doorLights` collected in the Hobbiton block, `ponyWindow` in Bree’s), `pointer` and `S.wake`, and the Eye’s look blend. Keep the file under 800 lines (it is 791: the hooks must be terse; if it cannot fit, move the Nazgûl block (lines 404 to 428) into `mapWake.js` as `buildNazgul` and call it from the diorama; say so in the commit).
- [ ] **Step 2:** `mapWake.js` as above. `MapBackdrop3D.js`: `attention`, `pointer`, the wake built with `P` and `handles` from `world`, updated and disposed.
- [ ] **Step 3:** `MapHub.jsx`: `const att = useMemo(() => createAttention(CHAPTERS.map((c) => c.id)), [])`; in `place()` after the pins: `a.attention?.(att.step(dtSinceLastPlace, { hover, near: nearRef.current, flying: leaving ? flyingId : null, instant: reduced }))` (the hub gets `flying` as a prop: `MiddleEarth.jsx` passes `flying`); `onMove` on a mouse calls `a.pointer?.(e.clientX, e.clientY)`.
- [ ] **Step 4:** Verify: `shots.mjs` `03-hub-hover-moria.webp` (the gate flares), add `03b-hover-mordor` (the Eye turned toward the pointer, the pall deeper) and `03c-hover-shire` at `wait` + 1.5 s (a firework); `measure.mjs` at rest (no hover): calls and triangles unchanged from Task 5’s.
- [ ] **Step 5:** The gates, the handoff row. Commit: `git commit -m "Each place on the map wakes as you look at it: fireworks over Hobbiton, rain on Bree, riders on Weathertop, the Eye turning to the pointer"`.

### Task 7: The road inked, and the hints

**Files:**
- Create: `src/components/middleearth/mapRoad.js`
- Modify: `src/components/middleearth/MapBackdrop3D.js` (`inked(stop)`, `hints(ids)` on the API), `src/components/middleearth/MapBackdrop.jsx` (`createFlat` gains `setRoad(stop)` drawing the thread over the sheet; props `inked` and `hints` passed through to whichever API is live), `src/pages/MiddleEarth.jsx` (passes `inked={roadInked(unlocked)}` and `hints={hiddenHints(unlocked)}` to `MapBackdrop`, reading `unlocked` from `useAchievements`), the handoff row
- Read first: `road.js` (`STOPS`), `hidden.js` (`HIDDEN`), `mapDiorama.js` lines 80 to 94 (`ROAD`: the stops in scene units), `record.js` (Task 1)

**Interfaces:**
- `mapRoad.js`: `buildRoad(scene, { P, tier }) → { setInked(stop), setHints(ids), update(dt, t), dispose() }`. The thread: a `BufferGeometry` ribbon along `STOPS` (each leg split into 12 quads, width 0.18, at `y = 0.03`), vertex colour `hot(0xc0321a, 1.2)`, `MeshBasicMaterial` `vertexColors`, `transparent`, opacity 0.9; `setInked(stop)` sets `geometry.drawRange` to the quads up to `stop` and moves a glowing tip (a 0.22 sphere, `hot(0xff6a1a, 2.5)`) to that stop; a `stop` of 0 hides both. The hints: for each id in `setHints`, a 0.9 × 0.9 plane at `HIDDEN`’s `at` offset `[+14, −10]`, `y = 0.03`, with a 64² canvas “?” in `INK` (`#4a3520`) in Cinzel 48 px, opacity 0.6; `setHints([])` hides them. `update` pulses the tip (`scale = 1 + 0.15 × sin(t × 3)`).
- `createFlat.setRoad(stop)`: after `drawImage(sheet)`, strokes the road through `STOPS[0…stop]` in `rgba(192, 50, 26, 0.9)` at width 3.2 (sheet units × scale) with a 7-radius dot at the end.
- `MapBackdrop` props: `inked = 0`, `hints = []`; forwarded on change.

- [ ] **Step 1:** `mapRoad.js`; the API and the flat path; the page passes the two props.
- [ ] **Step 2:** Verify with a seeded browser: add to `shots.mjs` an option `seals: ['breegate', 'eagles']` written to `localStorage` under the achievements key (read it from `src/components/Achievements.jsx`: the key the provider uses) and a shot `09-inked`: the thread reaches Mount Doom (Review Focus 3). A second option with every chapter’s first seal: `10-hints`: three “?” glyphs by Isengard, Minas Tirith and Edoras.
- [ ] **Step 3:** The gates, the handoff row. Commit: `git commit -m "The road inks itself as far as you have got, with a glowing tip, and the places off the road hint once every chapter has a seal"`.

---

## Wave 3: the face

### Task 8: The hub’s face: the head, the marks, the card, the ribbon, the links

**Files:**
- Create: `src/components/middleearth/hub/Head.jsx`, `hub/Marks.jsx`, `hub/Card.jsx`, `hub/Ribbon.jsx`, `src/styles/lazy/middleearth-hub.css`
- Modify: `src/components/middleearth/MapHub.jsx` (the composer: keeps `place()`, the pointer handlers, the wheel, the keys, `useTravellers`, the bubble and the prompt; renders the new pieces; drops the pins’ and route’s JSX), `src/styles/lazy/middleearth.css` (move every `.me-hub*`, `.me-pin*`, `.me-route*`, `.me-hint`, `.me-record*`, `.me-travellers`, `.me-prompt`, `.me-bubble` rule into the new file; chapters’ rules stay), `src/pages/MiddleEarth.jsx` (`MapHub` gets `flying` and `unlocked` is read inside the hub as today), the handoff row
- Read first: `MapHub.jsx` whole, `src/index.css` lines 40 to 120 (tokens), `src/components/ui.jsx` (`CloseButton`), `src/components/icons.js`, `src/components/worlds/WorldSwitcher.jsx` (how a world page lays out a row of `.btn-ghost btn-sm`), `hub/hubState.js`, `hub/labels.js`, `record.js`

**Interfaces:**
- `Head.jsx`: `<Head step={firstStep(unlocked)} onGo touch roam />`: eyebrow, `h1#me-title` “Where will you go?” at `--fs-display-3`, the lead, the first step as `.btn.btn-primary` (`onGo(step.id)`), the hint line (`.me-hint`, `--fs-xs`, `--me-ink-soft`); the block `.me-hub-head` on glass (`background: color-mix(in srgb, var(--me-veil) 86%, transparent)`, `backdrop-filter: blur(6px)`, `border-radius: var(--r-card)`, padding 16 / 20 px), `max-width: 26rem`, top-left under the nav (`top: calc(var(--nav-h) + 16px)`); hidden on `data-roam` as today.
- `Marks.jsx`: `<Marks chapters unlocked api hover onHover onGo near showing (Set) pinsRef />`: one `button.me-mark` a chapter (44 × 44 hit, the dot 16 px, the seal when won), `span.me-mark-label` beside it on glass (name in Cinzel at `--fs-xs`, the seals as 5 × 5 px dots under it, `data-shown` from `showing`); `MapHub.place()` computes `showing = cullLabels(points)` each frame from `api.project` and writes `data-shown` on the labels through refs (no React state per frame).
- `Card.jsx`: `<Card chapter record onEnter onClose anchor={{ x, y }} touch />`: `aside.me-card` (`role="dialog"`, `aria-label` the chapter’s name) on glass at 0.9 with the title, blurb, seals row, side star, kitchen stars and best, and `button.btn.btn-primary` “Enter {name}” with `<kbd class="kbd">⏎</kbd>` on a fine pointer; positioned at the anchor, flipped left when `x > innerWidth − 320`, up when `y > innerHeight − 260`; on a coarse pointer `data-sheet` fixed to the bottom at `--z-sheet` with a `CloseButton`. One card at a time: the hub keeps `cardId` state set from hover (mouse, after 120 ms), focus, `near` (when nothing hovered), or a tap on a mark (touch); Enter enters it; Esc closes it (before the journal).
- `Ribbon.jsx`: `<Ribbon chapters unlocked next inked onGo onHover />`: `nav.me-ribbon` (`aria-label="The road"`) fixed along the bottom (`bottom: 56px` above the links and the credit), a `ol` of ten `button.me-stop` (44 px hit, the dot 12 px) on an inked line (`::before` 2 px dashed `--me-wax`) filled to `inked` (a solid line segment via a `--inked` custom property as a percentage), `data-next` on `next` (pulse: `me-pin-pulse` reused unless reduced motion), the name as `.me-stop-name` shown on hover/focus and when `data-next`; `aria-label` “Bree: won” or “Bree: 2 of 5 seals”.
- The links row: in `MapHub.jsx`, `div.me-hub-links` fixed bottom-right (`bottom: 12px`), the four buttons as today (`Find Frodo`, the travellers, `The road so far`, `Back to the site`); on a coarse pointer each shows its icon (`icons.js`: pick the nearest meaning; if none fits, the text stays) with the text as `aria-label` and a `title`.
- The credit: `ModelCredits` with `className="me-credit"` fixed bottom-left at `--fs-xs`, one line, `text-overflow: ellipsis`.
- Phone (`max-width: 639px`): the head `max-width: calc(100% − 32px)`, the title `--fs-title`, the lead hidden, the first step full width; the marks’ labels only for `showing`; the ribbon’s names only for `data-next`; the links as icons; the card a sheet.

- [ ] **Step 1:** Create the CSS file by moving the hub rules out of `middleearth.css` (unchanged text where moved, new rules added below), then the four components, then recompose `MapHub.jsx`; delete `RoadSoFar` from it only in Task 9 (leave it rendering as today under the links until then).
- [ ] **Step 2:** Verify: `node lab/me/measure.mjs` and `--phone`: `uiShare` ≤ 0.22 desktop, ≤ 0.32 phone; `shots.mjs` all, plus `05b-phone-landscape` (844 × 390) and `03d-card-bree` (hover Bree 1 s): `Read` them against the spec’s face section; the Tab order by a keyboard walk in the dev server (`page.keyboard.press('Tab')` ten times in a lab script, logging `document.activeElement.textContent`).
- [ ] **Step 3:** `npm run lint`, `npm test` (`src/styles/tokens.test.js` passes: every z-index a token; `src/lib/words.test.js` passes: no retired word), build, health, smoke on `/middle-earth` and `--phone`.
- [ ] **Step 4:** The handoff row. Commit: `git commit -m "The hub’s face: a small head with the first step, marks you can read, a card a place, the road as a ribbon, the links in one row, on desktop and phone"` with the two `uiShare` numbers in the body.

### Task 9: The journal

**Files:**
- Create: `src/components/middleearth/hub/Journal.jsx`
- Modify: `src/components/middleearth/MapHub.jsx` (remove `RoadSoFar`; render `Journal` when `record`), `src/styles/lazy/middleearth-hub.css`, the handoff row
- Read first: `MapHub.jsx`’s `RoadSoFar` (the content to keep), `record.js`’s `roadRecord`, `road.js` (`STOPS` text by `stopOf`), `src/components/ui.jsx` (`CloseButton`)

**Interfaces:**
- `<Journal road onGo onClose credits />`: `aside#me-record.me-journal` (`role="dialog"`, `aria-label="The road so far"`), fixed right, `width: min(22rem, 100%)`, top under the nav to the bottom, `--z-sheet`, on glass at 0.9, `overflow-y: auto`, slides in (`translate` 100% → 0 over `--t-slow`, none under reduced motion); the head with the eyebrow and `CloseButton`; the four totals as `dl.me-journal-totals` rows; `ol.me-journal-list` of chapters: the name (a button, `onGo`), the seals dots, side star, kitchen stars and best as today, and under each `p.me-journal-line` with `STOPS[stopOf(c.id)].text`; `ul.me-journal-hidden` as today; the foot with the credit line. Esc closes (after the card). On a phone it is the full width and the links row hides while open.

- [ ] **Step 1:** Build it; move the record rules in the CSS to `.me-journal*` names; remove `RoadSoFar`.
- [ ] **Step 2:** Verify: `shots.mjs` `11-journal` (click “The road so far”, 600 ms) desktop and phone.
- [ ] **Step 3:** The gates. Commit: `git commit -m "The road so far is a journal: a drawer from the right with the totals, each chapter’s line from the road, and the credit"`.

---

## Wave 4: the words and the proof

### Task 10: The docs, the guide, the tour, the log’s pictures

**Files:**
- Modify: `docs/architecture.md` (the Middle-earth entry: one sentence naming `hub/`, `mapRoom.js`, `mapTerrain.js`, `mapWeather.js`, `mapWake.js`, `mapRoad.js`, `mapFlight.js` and the two canvases), `src/components/guide/pages.js` (`'/middle-earth'`’s tips: the first step, the marks and their card, the ribbon, the journal, the places that wake), `src/components/tour/briefs.js` (`'/middle-earth'`’s `map` brief: the same in two sentences), `docs/superpowers/HANDOFF-middle-earth-landing.md` (the final table, what is left), `docs/superpowers/handoff-middle-earth.md` (one line pointing at the new handoff)
- Read first: the two guide entries and their neighbours for voice; `docs/architecture.md` line 22 to 24

- [ ] **Step 1:** The words.
- [ ] **Step 2:** The proof: `node lab/me/shots.mjs lab/me/after` and copy the eight matching shots to `docs/superpowers/shots/2026-10-09-me-hub-after-*.webp`; `node scripts/autopilot-check.mjs --routes /middle-earth,/middle-earth/shire --shots 0006` and `--phone` (the ship’s log’s pictures; if `scripts/autopilot-log.mjs --next` says another id, use that); `node lab/me/measure.mjs` all four lines into the handoff’s final table beside the baseline.
- [ ] **Step 3:** The gates. Commit: `git commit -m "The Middle-earth landing’s words: the architecture, the guide and the tour say what the hub does, and the after shots beside the before"`.
