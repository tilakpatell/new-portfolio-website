# Universe scale and new wonders implementation plan (PR 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bigger universe map with four new wonders (a pulsar, a binary star, a rogue planet, a wreck field round a white dwarf) and a rim of ice at its edge.

**Architecture:** The numbers change in `layout.js` and `deep.js` (pure, tested); `deepspace.js` draws each new kind beside the kinds it already draws; `belt.js`'s rocks are reused for the rim; the nav map, the crews and the scene's crash kinds learn the new ids.

**Tech Stack:** three 0.186, Vitest 5. Lint `npx eslint .`, test `npx vitest run src/components/universe`, build `npx vite build`.

**Spec:** `docs/superpowers/specs/2026-10-05-universe-expansion-design.md`, sub-project 2.

## Global Constraints

- `layout.js`: `FIRST` 2000, `STEP` 330, `HEIGHT` 560. `deep.js`: `DEEP.edge` 9000, `DEEP.ceiling` 1400.
- Every wonder keeps `deep.test.js`'s clearances: past `DEEP.open + 40`, inside `DEEP.edge − 20`, clear of every other wonder by `reachOf(a) + reachOf(b) + 30` and of every planet by `reachOf(w) + REACH[id] + 60`.
- The autopilot flies to every goal within 120 s (`nav.test.js`, `ship.test.js`).
- No downloads; everything built in code.

## Review Focus

1. A pilot already parked at a wonder whose coordinates moved: `startAt`'s spots and `parkFor` come from the data, so nothing is stale; test: `ship.test.js` 'flies out from the home system to every wonder' still passes.
2. The rim's rocks at 8000 to 8600 and the edge at 9000: a ship turned back at the edge is never inside a rock; the rim is not solid and sits 400 under the edge; `layout.test.js` checks `RIM.outer < DEEP.edge − 300`.
3. A binary's two solids: hitting either is a crash into 'twins' (`startCrash` reads `wonderById(e.id.split('-')[0])`); `deep.test.js` checks both solids' ids start with `twins-`.
4. The pulsar's solid reach is ten radii (`solid(w.id, w.at, w.r * 10)`): nothing bounces off the star itself; `nav.test.js` parks outside it (`parkFor` uses `reach`).
5. The chart: the nav map's label set `UNDER` may need the new ids so names don't overlap; checked by `scripts/navmap-check.mjs`'s overlap test, extended for `lantern`/`graveyard`.

---

### Task 1: The numbers, and the four wonders as data

**Files:**
- Modify: `src/components/universe/layout.js` (`FIRST`, `STEP`, `HEIGHT`, export `RIM`), `src/components/universe/deep.js` (`DEEP`, `WONDERS`, `reachOf`, `DEEP_SOLIDS`), `src/components/universe/supernova.js` (`SUPERNOVA_SITES`)
- Tests: `layout.test.js`, `deep.test.js`, `supernova.test.js`

**Interfaces:**
- `RIM = { inner: 8000, outer: 8600, height: 60 }` in `layout.js`.
- New `WONDERS` entries:
  - `{ id: 'lantern', kind: 'pulsar', name: 'The Lantern', at: [-6200, 300, 2600], r: 12, color: '#bfe0ff' }`
  - `{ id: 'twins', kind: 'binary', name: 'The Twins', at: [6100, -220, -1500], r: 60, color: '#ffd27a', pair: { r: 42, color: '#f4f6ff', apart: 230 } }` (the second sun `apart` units along +x from the first; both solids: `twins-1`, `twins-2`)
  - `{ id: 'wanderer', kind: 'rogue', name: 'The Wanderer', at: [-900, -700, -6600], r: 55, colors: ['#1a2238', '#3a4a70', '#7fd8c8'], ring: true }`
  - `{ id: 'graveyard', kind: 'graveyard', name: 'The Graveyard', at: [-6400, 160, -1600], r: 14, color: '#dfe8ff', field: 190 }` (the dwarf's radius `r`; hulls to `field`)
- `reachOf`: pulsar `w.r * 10`; binary `w.pair.apart + w.pair.r`; rogue with ring `w.r * 2.3` (as any ring); graveyard `w.field`.
- `DEEP_SOLIDS`: pulsar solid at `w.r * 10`; binary two solids (`twins-1` at `w.at`, r `w.r`; `twins-2` at `w.at + [apart, 0, 0]`, r `pair.r`); rogue and graveyard as plain (the dwarf only).
- `SUPERNOVA_SITES`: seven, spread for the bigger map, each 750+ clear of every place and 1500+ from each other (the test).

- [ ] **Step 1: Tests.** `layout.test.js`: `RIM.outer < DEEP.edge − 300` and `RIM.inner > MAP_RADIUS + 200`. `deep.test.js`: ids of the new four in `WONDERS`; `DEEP_SOLIDS` has `twins-1` and `twins-2`, `lantern` with `r` 120, no solid for the Graveyard's hulls; `nearestStar` still `['sun', 'ember', 'halcyon']` (a pulsar and the binary are not flare stars: keep `STARS` to kind `star`). Run → FAIL.
- [ ] **Step 2: Implement; run `npx vitest run src/components/universe`** → every clearance and autopilot test passes (adjust coordinates if one fails; keep the four in their quadrants).
- [ ] **Step 3: Commit** `A bigger map: the numbers, and four new wonders as data`

### Task 2: Drawn

**Files:**
- Modify: `src/components/universe/deepspace.js` (`pulsar(w)`, `binary(w)`, `rogue(w)`, `graveyard(w)`, `SUBTITLE`, `lift`, the dispatch), `src/components/universe/belt.js` (`createBelt({ small, band = BELT, seed = 1977, tones = TONES, spin = 0.006 })`), `src/components/universe/scene.js` (a second belt on `RIM`, paler tones, slower)
- Export from `supernova.js`: `PULSAR_FRAG`, `BILLBOARD_VERT`.

**Interfaces:** `createBelt` keeps its signature's first argument; the new options default to today's values.

- [ ] **Step 1: `pulsar(w)`**: a tiny hot `sun`-style sphere (`STAR_FRAG`, white-blue) plus a `facingQuad(w.r * 30, PULSAR_FRAG, { uT: uTime, uK: { value: 1 } })`; `ticks` spin nothing (the shader turns the beams).
- [ ] **Step 2: `binary(w)`**: two `sun`-style spheres (the second at `[apart, 0, 0]`, `pair.r`, `pair.color`), each with its `GLOW_FRAG` quad, and between them a stretched additive sprite (the glow texture, `w.color`, scaled `apart × w.r * 0.8`) for the bridge of gas; a tick swings the bridge's opacity `0.5 + 0.3 sin(t * 0.4)`.
- [ ] **Step 3: `rogue(w)`**: `world('ROCK', { base: colors[0], accent: colors[1], rim: colors[2], rimStrength: 1.1, tex: rockTex, light: homeW })` sphere; an aurora: a `RingGeometry(w.r * 1.02, w.r * 1.2)` at each pole with an additive shader (`AURORA_FRAG`: `snoise` curtains in `colors[2]`, fading outward); a faint ring (`ring(...)` with a pale ice texture, opacity 0.35).
- [ ] **Step 4: `graveyard(w)`**: a small `sun`-style dwarf (`w.color`, reach 6); one `InstancedMesh` of a merged hull geometry (six shapes: a box hull, a cylinder hull, a box with a cone nose, a wing slab, a ring section, a broken girder; `parts()` from `kit.js`, 60 instances, `MeshStandardMaterial({ color: '#3a3d45', roughness: 0.95, metalness: 0.35 })`) scattered in a disc of radius `w.field`, each tumbling (`ticks`: per-instance slow rotation, 1 matrix update a frame for 60 instances is fine).
- [ ] **Step 5: `SUBTITLE`** entries (`lantern: 'pulsar'`, `twins: 'binary star'`, `wanderer: 'rogue planet'`, `graveyard: 'white dwarf · wreck field'`), `lift` (pulsar `w.r * 12`, binary `w.r * 2.2`, graveyard `w.field * 0.6`), the dispatch.
- [ ] **Step 6: The rim**: `belt.js` takes `band`, `seed`, `tones`, `spin`; `scene.js` adds `createBelt({ small, band: RIM, seed: 2049, tones: ['#c9d8e8', '#9fb4c8', '#dfe8f2', '#8ea0b4'], spin: 0.0015 })` beside the home belt, its `update` in the frame beside it.
- [ ] **Step 7: Lint, build, commit** `Four new wonders, drawn, and a rim of ice at the edge`

### Task 3: Everyone learns the new ids

**Files:**
- Modify: `nav.js` (`WONDER_KIND`, `WONDER_ABOUT`), `crews.js` (`wonders` lines for the four, every crew), `scene.js` (`startCrash`'s kind: `pulsar`/`binary`/`graveyard` → `'star'`, `rogue` → `'giant'`), `Guide.jsx` (the Deep space tip), `NavMap.jsx` (`UNDER` if the names overlap), `README.md` (the map's wonders line)

- [ ] **Step 1: Tests.** `crews.test.js` already loops `WONDERS` → FAIL until the lines exist. `nav.test.js` already requires `about` for every destination → FAIL until `WONDER_ABOUT` has the four.
- [ ] **Step 2: Implement.** Crash kinds: the `kind` expression in `startCrash` becomes `wonder.kind === 'star' || wonder.kind === 'pulsar' || wonder.kind === 'binary' || wonder.kind === 'graveyard' ? 'star' : wonder.kind.endsWith('giant') || wonder.kind === 'rogue' ? 'giant' : …`; `colour: kind === 'giant' ? (wonder.colors?.[0] ?? null) : null`.
- [ ] **Step 3: Verify** `npx eslint . && npx vitest run && npx vite build`; headless: `scripts/navmap-check.mjs desktop` (labels), and a flight to `lantern` by `travel('lantern','super')` lands parked outside its reach.
- [ ] **Step 4: Commit** `The new wonders on the nav map, in the crews' mouths and in the guide`; push; PR 3; merge.
