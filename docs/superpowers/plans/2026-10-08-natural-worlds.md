# Natural worlds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seeded, endless planet surface at `/universe/expanse/:seed` with real relief, rivers that run downhill into lakes and the sea, Bruno Simon's grass, trees, tracks and water look, and a rigid-body car on Rapier that drives it, streamed in 64 m cells on the runtime's chunk services.

**Architecture:** Two pure libraries (`src/lib/land/`: heights, water levels, masks and props per cell from a seed; `src/lib/physics/`: Rapier wrapped as data, his vehicle controller and numbers), a set of `src/lib/three/` look pieces (land map and material, water surface, tracks, puffs, leaves, wind lines, the chase view with its optimal area), and one world module (`src/components/expanse/surface/`) that streams cells through `rt.chunks`, `rt.workers` and `rt.origin` and drives the car on them.

**Tech Stack:** three.js 0.186 (WebGLRenderer, GLSL rewrites), `@dimforge/rapier3d-compat` (new), React 19, Vite, Vitest in Node, Playwright-core + Chromium for the probe.

**Spec:** `docs/superpowers/specs/2026-10-08-natural-worlds-design.md`. Read with it: `docs/research/2026-10-08-folio-2025-physics-terrain-streaming.md` (his numbers, quoted per task below by section), `docs/superpowers/HANDOFF-world-runtime.md` (what `rt` gives a module), and for Phase 3 the infinite-worlds plan's Phase 3 (`src/runtime/chunkGrid.js`, `workers.js`, `origin.js`, `src/components/minecraft/stream.js`).

## Phases and sessions

| Phase | PR branch | Starts from | Blocked by |
|---|---|---|---|
| 1: `lib/land`, `lib/physics` | `claude/natural-worlds-p1` | `main` | nothing |
| 2: `lib/three` look pieces | `claude/natural-worlds-p2` | `main` after 1 | 1 |
| 3: the Expanse surface world | `claude/natural-worlds-p3` | `main` after 2 and PR #600 (else from `origin/claude/infinite-worlds-p3`, merging `main` later) | 1, 2, #600 |

One session may do all three in order, merging each before the next; or one session per phase.

## Global Constraints

- One new runtime dependency in the whole plan: `@dimforge/rapier3d-compat` (pin the version `npm view` gives; `0.21.x` at writing). Imported only by `src/lib/physics/world.js`, dynamically, inside `createPhysics`.
- `src/lib/land/*.js` and `src/lib/physics/*.js` import no three.js and no DOM; `lib/land` imports nothing but `src/lib/seeded.js` and its own files.
- Constants, verbatim: `CELL = 64`, `REGION = 1024`, `STEP = 8`, `MAX_DEPTH = 3`, `ORIGIN_CELL = 50000` (from `src/runtime/origin.js`), physics radius `1`, mesh steps `1 | 2`, visual radius by tier `ultra 7, high 6, mid 4, low 3`, `WORLD_MB['/universe/expanse'] = 2`.
- Every module is `shading: 'glsl'`; shader changes are pure rewrites tested on stub shaders (`grass.test.js`'s pattern). No `ShaderMaterial` where a Lambert with a rewrite will do.
- The galaxy's `terrain.test.js` and every existing test stay green and are not loosened; `galaxy/surface/terrain.js` behaves exactly as before after its layers move.
- Each phase is its own PR to `main`, merge commit, after `npx eslint .`, `npx vitest run`, `npx vite build` pass; Phase 3 also runs the smoke and the probe (see Task 3.7). Never merge red, never force-push, never rebase a branch someone else has.
- Comments in the codebase's voice (a prose header per file saying why and listing signatures; British spelling); no model names in code, docs or commits; commits end with the harness's attribution lines.
- Nothing a visitor can do today changes: no authored world, the universe map, the galaxy or Albuquerque is touched except the one import move in `galaxy/surface/terrain.js`.

## Review Focus

1. A cell on a region boundary whose river was traced by two regions: both must give byte-identical `heights` and `water` (Task 1.3's determinism test runs the cell at `cx = 15` and `cx = 16` from each side's region list).
2. The car crossing a cell edge where one side is at mesh step 1 and the other at step 2: the physics heightfield is always the step-1 heights, so the wheels never drop into a visual crack (Task 2.1's skirt and Task 3.3's "heightfield from kept heights" test).
3. A floating-origin shift while the car is airborne and props are awake: every body, the camera, the tracks' focus and the leaves move by the same shift in one frame; nothing on screen jumps (Task 1.6's velocity test; Task 3.4's shift test with a fake `rt.origin` event).
4. The tab hidden for a minute: `step(60)` runs `maxSubsteps` only, the car does not launch, the accumulator is reset (Task 1.4).
5. A world whose seed gives no river in the first region (`perRegion = 0` or every trace ends in the sea at once): the HUD's compass has nothing to point at and says so; the water surface mesh is empty, not NaN-filled (Task 1.3's "no rivers" cell test; Task 2.3's empty-cell test).

---

## Phase 1: the data and the engine (PR 1)

### Task 1.1: `src/lib/land/layers.js` and `spec.js`

**Files:** Create `src/lib/land/layers.js`, `layers.test.js`, `spec.js`, `spec.test.js`. Modify `src/components/galaxy/surface/terrain.js` (its `LAYERS` object deleted; `import { LAYERS } from '../../../lib/land/layers.js'`), nothing else in it.

**Interfaces (produces):**
- `LAYERS`: the galaxy's object, byte for byte (`swell, hills, dunes, mesas, ridges, mountains, channels, island, level` as it has them), its `fbm/noise2/ridged/smoothstep` imported from `src/components/galaxy/surface/noise.js` (a pure module; `lib/land` may import it: add it to the "imports nothing but" list in the file header).
- `fieldAt(spec, x, z) → number`: the sum of `spec.relief` layers with `spec.seed` as each layer's seed base (`seed + i`).
- `landSpec(seed, type = 'temperate') → LandSpec` with the spec's fields: `{ seed (a 32-bit hash of the input, `hashSeed` from `src/components/minecraft/rules/noise.js` or `seeded.js`'s), type, sea, relief, rivers: { perRegion, width, depth, meander }, palette: { dirt, grass, sand, rock, shallow, deep, shadow } (linear [r, g, b]), kit: { perCell, kinds }, gravity, wind: { angle, strength }, sun: { elevation, azimuth, colour } }`. Types `temperate | desert | ice | ocean | volcanic`, a table; `temperate` is `sea 0`, `relief [swell 600 m × 18, hills 140 m × 9, ridges 900 m × 25 at 0.25 weight]`, `rivers { perRegion: 2, width: 6, depth: 2, meander: 0.35 }`, `kit { perCell: 24, kinds: ['tree', 'rock', 'crate'] }`, `gravity -9.81`, `wind { angle: 0.6π, strength: 0.4 }`.

- [ ] Tests: `layers.test.js` asserts `LAYERS` has the galaxy's nine keys and that `galaxy/surface/terrain.test.js` still passes after the move; `spec.test.js` asserts each type yields `perRegion` in `0..3`, a palette of seven linear colours in `0..1`, and `landSpec('seven')` equals `landSpec('seven')` and differs from `landSpec('eight')` in `seed`.
- [ ] Run (fail), implement, run (pass), `npx vitest run src/components/galaxy/surface/terrain.test.js` (pass). Commit `feat(land): the layers shared, and a planet's land from a seed`.

### Task 1.2: `src/lib/land/rivers.js`

**Files:** Create `src/lib/land/rivers.js`, `rivers.test.js`.

**Interfaces (produces):**
- `REGION = 1024`, `STEP = 8`.
- `regionRivers(spec, rx, rz) → River[]`, `River = { points: Float32Array (stride 5: x, z, level, width, depth), lake: { x, z, r, level, depth } | null, length }`. Sources: `spec.rivers.perRegion` points by seeded Poisson disc (`seeded.js`) at least `200` m apart and `64` m inside the region, each moved to the highest of 9 samples within `32` m. Trace: steepest descent on `fieldAt` (8 samples round, radius `STEP`), direction `0.6 × previous + 0.4 × steepest`, plus `spec.rivers.meander × noise2(along / 90)` turned 90° (the `noise2` of `galaxy/surface/noise.js`). Stop when `fieldAt ≤ spec.sea` (the last point at the sea), when the drop over the last `6` steps is under `0.2` and no lower ground lies within `128` m to cut through to (a lake: `r = 20 + 40 × hash`, `level = min(h + 1, rim − 0.05)`, `depth = spec.rivers.depth`, which spills over its rim's lowest point into the next reach, up to `8` lakes, a reach whose lake would overlap an earlier one dropped; with the plan's first numbers, 3 steps and no spill, rivers ended in ponds after `100`–`300` m), or at `4000` m; every reach stays within its region and the next round it, less `96` m, so the 3 × 3 regions round a cell hold every river that reaches it. `level` at each point is `fieldAt` there, forced non-increasing (`min` with the previous). `width = spec.rivers.width × (0.6 + 0.4 × min(1, length / 1500))`, depth likewise.
- `riversNear(spec, cx, cz) → River[]`: the rivers of the 3 × 3 regions round the cell, cached per `(spec.seed, rx, rz)` in a `Map` of at most `32` regions.
- `nearestRiverPoint(rivers, x, z) → { d, level, width, depth, tangent } | null` (the nearest point within `2 × width` of any river, by a segment-distance scan; `tangent` the unit direction along the river there) and `lakeAt(rivers, x, z) → lake | null`.

- [ ] Tests: `level` is non-increasing along every river for seeds 1..20 of `temperate`; a river that ends above the sea has a `lake`; one that ends at the sea has its last `level` within `0.5` of `spec.sea`; `regionRivers(spec, 3, -2)` twice gives identical `points`; `riversNear` for `cx = 15` and `cx = 16` both contain the river that crosses `x = 1024` (same `points` reference content); `nearestRiverPoint` on a point `1` m beside a straight test river returns `d ≈ 1` and the river's tangent; a spec with `perRegion 0` gives `[]`.
- [ ] Run (fail), implement, run (pass). Commit `feat(land): rivers traced downhill, into lakes and the sea`.

### Task 1.3: `src/lib/land/cell.js` and `scripts/land-preview.mjs`

**Files:** Create `src/lib/land/cell.js`, `cell.test.js`, `scripts/land-preview.mjs`.

**Interfaces (produces):**
- `CELL = 64`, `N = 65`, `MASK = 128`, `MAX_DEPTH = 3`.
- `makeCell(spec, cx, cz) → { heights: Float32Array(N²), water: Float32Array(N²) (NaN where dry), mask: Uint8Array(MASK² × 4), props: [{ kind, x, y, z, yaw, scale }] }` exactly as the spec's §1 "cell.js" says (the carve, the bank, the lake bowl, the sea; G off where water, where slope > `0.55`, within `1.5` m of water, below the sea, in the beach band `sea .. sea + 1.5`; B `clamp((water − height) / MAX_DEPTH)`; A the flow angle). Row-major, `heights[iz × N + ix]` at `x = cx × CELL + ix`.
- `cellMesh(heights, { step = 1 }) → { positions: Float32Array, normals: Float32Array, indices: Uint32Array }` in the cell's frame (0..64), a `2` m skirt down each edge, normals by central differences.
- `heightAt(cell, lx, lz) → number`, `waterAt(cell, lx, lz) → number | NaN` (bilinear on the mesh's triangles: the diagonal from `(ix + 1, iz)` to `(ix, iz + 1)`, the one Rapier's heightfield uses, as Task 1.5's rays proved).
- `scripts/land-preview.mjs <seed> [type] [cx cz ...]`: renders a cell's mask (and a 3 × 3 of cells when no cx/cz) to `scripts/.cache/land-<seed>-<cx>-<cz>.png` with `sharp` (a devDependency already), B as blue, G as green, height as a grey underlay. For the PR's screenshots.

- [ ] Tests: adjacent cells share edge heights exactly (`makeCell(s, 0, 0)` column 64 equals `makeCell(s, 1, 0)` column 0); `mask` G is 0 wherever `water` is not NaN at the nearest vertex; B is 0 where water is NaN and `> 0` where water is above the height; a `temperate` cell on a traced river (find one from `riversNear`) has `water` not NaN at the river's point; `heightAt` returns the vertex at vertices and the plane between; `cellMesh` indices are `(64/step)² × 6 + 4 × (64/step) × 6`; `makeCell` twice is byte-identical; `makeCell` under `40` ms (median of 5); the spec with `perRegion 0` gives a cell whose `water` is all NaN above the sea and no props of kind `tree` under it.
- [ ] Run (fail), implement, run (pass). `node scripts/land-preview.mjs 7` and look at the PNG: rivers meander and widen toward the sea; fix constants in `rivers.js` if they do not (say so in the PR). Commit `feat(land): a cell's heights, water, mask and props`.

### Task 1.4: `src/lib/physics/world.js`

**Files:** `npm install @dimforge/rapier3d-compat@<version>`; create `src/lib/physics/world.js`, `world.test.js`.

**Interfaces (produces):** the spec's §2 `createPhysics({ gravity = -9.81, timeScale = 1, maxSubsteps = 4 }) → Promise<Physics>` and `Physics = { RAPIER, world, step(dt) → number, add(desc) → Body, remove(body), onOrigin(shift), sleepOutside(centre, radius), dispose() }`, `Body = { body, colliders, initial, reset(), get sleeping, position(out), quaternion(out), onHit }`. `add(desc)` with the defaults of the research note §1 (density `0.1`, friction `0.2`, restitution `0.15`, damping `0.1/0.1`, `hitThreshold 15`, groups `floor | object | bumper` as `(memberships << 16) | filter` with `all = 1, object = 2, bumper = 4`). `step` is a fixed `1/60 × timeScale` accumulator; a `dt` over `maxSubsteps × 1/60` is clamped and the remainder dropped. Contact force events drained after each substep, `onHit(force / (m1 + m2), at)`.

- [ ] Tests (`await RAPIER.init()` through `createPhysics` once in `beforeAll`): a dynamic ball over a fixed cuboid comes to rest within `2` s of steps (`|vy| < 0.01`); `step(60)` returns `4`; `onOrigin([50000, 0, 0])` moves the ball's `position().x` by `−50000` and leaves `linvel` unchanged; a body in `bumper` falls through a `floor` cuboid and lands on an `object` one; `reset()` on a moved ball puts it back at `initial` asleep if it began asleep; `sleepOutside` sleeps an awake body `100` m away and not one `10` m away; `onHit` fires for a ball dropped from `5` m onto a floor with `hitThreshold 0` and not with `hitThreshold 1e6`.
- [ ] Run (fail), implement, run (pass). Commit `feat(physics): Rapier, stepped fixed, bodies as data`.

### Task 1.5: `src/lib/physics/heightfield.js`, `props.js`, `catch.js`

**Files:** Create the three and their tests.

**Interfaces (produces):**
- `addHeightfield(physics, { heights, n = 65, size = 64, x, z, friction = 0.2, restitution = 0.15 }) → Body` (group `floor`; the body at `(x + size/2, 0, z + size/2)`; Rapier's heightfield takes `nrows, ncols, heights` column-major: the task's first job is the test below, and the reorder it proves).
- `addProps(physics, list, kinds) → { bodies, sync(write), wake(i), reset(), remove() }`, `kinds` a table keyed by `kind`: `crate { dynamic, cuboid [0.5, 0.5, 0.5], mass 0.02, hitThreshold 0 }`, `barrel { dynamic, cylinder [0.6, 0.4], mass 0.1 }`, `rock { fixed, ball [scale], friction 0.7 }`, `tree { fixed, cylinder [2.5, 0.15], friction 0.7 }` (the note §5's numbers); every dynamic one `sleeping: true`.
- `addCatch(physics) → { follow(x, z, y), enable(on) }`: a kinematic cuboid `[6, 0.5, 6]` placed at `(x, y − 0.5, z)` each call.

- [ ] Tests: 200 rays straight down at random `(x, z)` over a heightfield made from `makeCell(landSpec('seven'), 0, 0).heights` hit within `1e-3` of `cell.heightAt` (this is the row-order proof; it fails until the order is right); a crate dropped on the heightfield rests and `sync` writes it once awake and not when asleep; a `tree` body does not move when a crate hits it; `follow` moves the slab and a ball rests on it.
- [ ] Run (fail), implement, run (pass). Commit `feat(physics): heightfields per cell, props, the catch slab`.

### Task 1.6: `src/lib/physics/vehicle.js`

**Files:** Create `src/lib/physics/vehicle.js`, `vehicle.test.js`.

**Interfaces (produces):** `CAR` (the note §2 verbatim: chassis cuboids `[1.3, 0.4, 0.85] at (0, −0.1, 0) mass 2.5 centreOfMass (0, −0.5, 0)`, `[0.5, 0.15, 0.65] at (0, 0.4, 0)`, bumper `[1.5, 0.5, 0.9] at (0.1, −0.2, 0)`; friction `0.4`, `canSleep false`; wheels offset `(0.9, 0, 0.75)`, radius `0.4`, `frictionSlip 0.9`, `maxSuspensionForce 150`, `maxSuspensionTravel 2`, `sideFrictionStiffness 3`, `suspensionCompression 10`, `suspensionRelaxation 2.7`, `suspensionStiffness 25`; `suspensions { low: [0.88, 20], mid: [1.23, 30], high: [1.63, 40] }`; `steering 0.5`, `engineForce 300`, `boost 2`, `topSpeed 5`, `topSpeedBoost 40`, `brake 35`, `idleBrake 0.06`, `reverseBrake 0.4`, `unflip { after: 3, force: 5 }`). `addVehicle(physics, spec = CAR) → Vehicle = { chassis: Body, controller, drive({ throttle, steer, brake, boost }, dt), measure() → state, state: { speed, forwardSpeed, goingForward, wheels: [{ contact, point: [x, y, z], suspension }], upsideDown, stuck, flipped }, suspension(i, name), unflip(), moveTo(x, y, z, yaw), remove() }`. `drive` is his pre-physics (`engineForce / (1 + overflowGain × overflow)` with our `overflowGain 25`, his `1` letting the car pass `11` m/s in 3 s on a fixed step; force and brake as his impulse per simulated second, `× 1/60`; idle brake, must-stop-to-reverse) with the controller's `updateVehicle(1/60)` called by `physics.step`'s substep hook (world.js exposes `onSubstep(fn)`; add it there in this task). `measure` is his post-physics; `stuck` after `3` s under `0.5` m of travel while throttling; `upsideDown` by `up · (0, −1, 0) × 0.5 + 0.5 > 0.3`.

- [ ] Tests on a flat heightfield (`heights` all 0): dropped from `y = 3`, after 120 steps all four `wheels[i].contact` and `|chassis y − rest| < 0.05` where `rest` is read at step 120 and stable to `1e-3` over the next 60; full throttle 3 s reaches `speed` in `4..6`; brake from there stops under `0.1` within 2 s; `throttle −1` while going forward over `0.5` m/s does not reverse until stopped; placed upside down, `unflip()` leaves `upsideDown` false within 90 steps; `suspension(i, 'high')` for all four held for a tap (`6` steps, `0.1` s; one step lifts it only `0.24` m) raises the chassis by over `0.3` m within 30 steps; `moveTo` zeroes velocity.
- [ ] Run (fail), implement, run (pass). Commit `feat(physics): his car, his numbers`.
- [ ] Phase 1 done: `npx eslint .`, `npx vitest run`, `npx vite build`; PR "Natural worlds, Phase 1: the land as data, Rapier and the car" with three `land-preview` PNGs; merge.

## Phase 2: the look (PR 2)

### Task 2.1: `src/lib/three/landmap.js` and `land.js`

**Files:** Create `landmap.js`, `landmap.test.js`, `land.js`, `land.test.js`. Modify `src/lib/three/grass.js` only to accept a `ground.glsl` that defines `groundHeight/groundColour/groundGrass` from the land map (it took `ground.uniforms` but baked in `GROUND_GLSL`; `grassShader(shader, { ground })` now takes the GLSL, the ground map's by default).

**Interfaces (produces):**
- `createLandMap({ radius, palette }) → { masks: DataArrayTexture, waters: DataArrayTexture, uniforms, glsl: LAND_GLSL, set(cx, cz, cell), drop(cx, cz), centre(cx, cz), slotOf(cx, cz), ground: { glsl, uniforms } (what createGrass takes), dispose() }`. Slots `(2r + 1)²`; `centre` moves the window (slots are `((cx − c.x) mod (2r+1), …)`, so a shift re-keys nothing).
- `LAND_GLSL`: `vec4 landMask(vec2 xz)`, `float landWater(vec2 xz)` (NaN-free: `-1e9` where none), `float landHeight(vec2 xz)` (from the heights layer: add a third array of 65² half-floats), `vec3 landColour(vec4 mask, float slope, float h)` (the height for the beach band; gradient `dirt → shallow → deep` over `1 − B` at stops `0.1, 0.3, 0.9`, grass by `G`, sand in the beach band, rock over slope `0.55`), and `groundHeight/groundColour/groundGrass` aliases for the grass.
- `createLandMaterial({ map, tracks = null }) → MeshLambertMaterial` with `landShader(shader, { tracks }) → { vertexShader, fragmentShader, swapped }` (pure): colour from `landColour(landMask(xz), slope)`, `G × (1 − tracksAt(xz).r)` when `tracks`.

- [ ] Tests: `set` then `slotOf` round-trips for 9 cells and `drop` frees a slot; `centre` by `+1` keeps the 8 still-in-range cells' slots; `landShader` on a stub Lambert swaps `#include <color_fragment>` and contains `landColour(`; with `tracks` it contains `tracksAt(`; without, not; `createGrass({ ground: map.ground })` builds (a smoke in Node with the stub shader).
- [ ] Run (fail), implement, run (pass). Commit `feat(three): the land as the GPU sees it, and its material`.

### Task 2.2: `src/lib/three/tracks.js`, grass takes it

**Files:** Create `tracks.js`, `tracks.test.js`. Modify `src/lib/three/grass.js` (`createGrass({ …, tracks })`: `grassShader(shader, { tracks })` multiplies `groundGrass` by `1 − tracksAt(xz).r`), `grass.test.js` (one case).

**Interfaces (produces):** `createTracks({ size = 40, texels = 512, count = 128 }) → { target: WebGLRenderTarget, uniforms: { uTracks, uTracksCentre, uTracksSize }, glsl: TRACKS_GLSL ('vec4 tracksAt(vec2 xz)'), track(width, channel: 'r' | 'g') → { push(x, z, touching) }, render(renderer, focus), dispose() }`. `push` records only after `1/30` s and `0.2` m (his), into a `count × 1` float `DataTexture`; `trackShader(shader) → …` extrudes the ribbon (`trackLayout(points, width) → positions` pure, for the test). `render` draws all tracks additive from a top-down ortho camera over `size` m round `focus` into `target`.

- [ ] Tests: `push` twice within `0.1` m records once; `trackLayout` of a straight 3-point track gives a ribbon of width `w`; `TRACKS_GLSL` compiles in the stub (string contains `uTracksCentre`); `grassShader` with `tracks` contains `tracksAt(`.
- [ ] Run (fail), implement, run (pass). Commit `feat(three): wheel tracks as a top-down target the ground and grass read`.

### Task 2.3: `src/lib/three/river.js`

**Files:** Create `river.js`, `river.test.js`.

**Interfaces (produces):** `createWaterSurface({ map, wind, tier }) → { group, material, set(cx, cz, cell), drop(cx, cz), update(dt), setOpaque(texture | null), dispose() }`: a `PlaneGeometry(64, 64, 64, 64)` per slot with its vertices' y set from `cell.water` (`waterMesh(cell) → { positions, indices } | null` pure: triangles with any NaN corner dropped; `null` when all dry), `renderOrder 1`, `depthWrite false`, `transparent`. `waterShader(shader, { blur }) → …` (pure): the note §2's mask in GLSL (`shore = step(0.17, B)`, the ripple bands with `uWindTime`, scrolled along `A`'s angle; `alpha = max(shore, ripples)`), colour white under the house's light, and with `blur` the shallows (`alpha < 0.5`) sampling `uOpaque` (the frame) with 9 taps of radius `0.01`. `waterlineShader(shader) → …`: his `0.013` band to white about `uWaterLevel`. `tier` `high | ultra` → `blur: true`.

- [ ] Tests: `waterMesh` of a cell from `makeCell` on a river has indices and none spanning NaN; of a dry cell returns `null`; `waterShader` contains `step(0.17` and, with `blur`, `uOpaque`; `waterlineShader` contains `0.013`.
- [ ] Run (fail), implement, run (pass). Commit `feat(three): his water: the shallows' bands and blur, the waterline`.

### Task 2.4: `src/lib/three/puffs.js`, `leaves.js`, `windLines.js`

**Files:** Create the three and their tests.

**Interfaces (produces):**
- `puffGeometry({ cards = 80, size = 0.8, seed }) → BufferGeometry` (pure: cards in a unit sphere at radius `1 − r³`, normals `lerp(card, sphere, 0.85)` via `foliage.js`'s `spherifyNormals` with `keep 0.15`); `createPuffs({ species: { a, b, bark }, count, wind, facing }) → { crowns: InstancedMesh, trunks: InstancedMesh, take() → slot, set(i, x, y, z, scale, yaw), free(i), update(dt), dispose() }`; `puffShader(shader, { wind }) → …` (the cut-out from a `64²` canvas blob, UV rotated by `length(windOffset(xz)) × 2.2`, `mix(a, b, smoothstep(0, 1, dot(n, l)))`, `alphaTest 0.1`), cards oriented to `facing` at `set`.
- `createLeaves({ count, wind, floorAt }) → { mesh: InstancedMesh, update(dt, focus, car: { x, z, vx, vz }) }` (`floorAt(x, z) → { y, water }` from the world's cells: the land map's heights live on the GPU, so the CPU leaves read the cells instead) with `stepLeaves(state, dt, params) → void` pure over typed arrays (the note §4's forces; wrap round `focus` within `area`).
- `createWindLines({ wind, count = 4 }) → { group, update(dt, focus) }` with `windLineCurve(seed) → points` pure (4 handles over `10` m, `±0.5` zigzag, 30 divisions).

- [ ] Tests: `puffGeometry` has `80 × 6` vertices with unit-ish normals and `|normal − sphere| < 0.3`; `set/free` reuse a slot; `stepLeaves` keeps every leaf inside the wrap box after 600 steps and above `water` where set; a leaf `1` m from a moving car gains speed; `windLineCurve` spans `10 ± 1` m.
- [ ] Run (fail), implement, run (pass). Commit `feat(three): his trees, falling leaves and wind lines`.

### Task 2.5: `src/lib/three/view.js`

**Files:** Create `view.js`, `view.test.js`.

**Interfaces (produces):** `createChaseView({ camera, small = false, tier }) → { update(dt, target: { x, y, z }, speed), area: { centre: [x, z], radius, near, far }, resize(w, h), shake(k), focus }` and the pure `optimalArea({ fov, aspect, phi, theta, radius }) → { base: [x, z], radius, near, far }` (the four screen corners on `y = 0` at the orbit's furthest, the note Part 3 §2), `chaseRadius(speed, { tier })` (`15` standing, `+9` for aspect under `1`, `× (1 + 0.4 × smoothstep(5, 40, speed))` on `high`/`ultra`: his zoom-out at speed, the area worked out at his furthest orbit, `30 × 1.4`). Camera FOV `25`, `phi 0.31π` (`0.27π` small), `theta π/4`, the focus a magnet `0.25` on the target, position eased `dt × 10`, roll a damped spring (`v = −x × 100 × dt; s += v; x += s × dt; s *= 1 − 4 dt`).

- [ ] Tests: `optimalArea` at aspect `16/9` gives `radius` in `25..40` and `near < far`; `chaseRadius(0)` is `15` and `chaseRadius(40)` over `chaseRadius(0)` on `high` (the spec's zoom-out with speed) and equal on `low`; after 5 s of `update` toward a still target the camera is within `0.01` of its orbit point; `shake(1)` decays to under `0.01` in 3 s.
- [ ] Run (fail), implement, run (pass). Commit `feat(three): his chase view and the area it sees`.
- [ ] Phase 2 done: lint, tests, build; PR "Natural worlds, Phase 2: the look, in pieces"; merge.

## Phase 3: the world (PR 3)

### Task 3.1: route, page, gate, registry

**Files:** Create `src/pages/Expanse.jsx`, `src/components/expanse/surface/ExpanseHud.jsx`, `surface.css`. Modify `src/App.jsx` (lazy `Expanse`, `<Route path="/universe/expanse/:seed" element={<Expanse />} />` before the `/universe/:id?` route), `src/components/worlds/worlds.js` (`WORLD_MB['/universe/expanse'] = 2`), `src/components/worlds/registry.js` (no change needed if `worldUrl` already yields the route: assert it in `registry.test.js`).

- [ ] The page: `useWorld(module, { props: { seed, type: query.type ?? 'temperate' } })`, `WorldHost`, the HUD from `src/runtime/hud/` (`Hud`, `Prompt`, `Stick`, `TouchButton`, `Exit`) showing speed, the compass heading to the nearest water (from the `'water'` event, or "no water near"), and `R` to respawn; the registry row added on mount (`createRegistry` … `add({ kind: 'planet', seed, name })`).
- [ ] Test `pages/Expanse.test.jsx` (as `MyWorlds.test.jsx` renders): the route renders the host and the HUD. Commit `feat(expanse): the route and the page`.

### Task 3.2: `worker.js` and `stream.js`

**Files:** Create `src/components/expanse/surface/worker.js`, `stream.js`, `stream.test.js`.

**Interfaces (produces):**
- Worker messages: `{ type: 'cell', key, seed, kind, cx, cz, step }` → `{ key, cx, cz, heights, water, mask, props, mesh: { positions, normals, indices } }` (all buffers transferred); `{ type: 'remesh', key, heights, step }` → `{ key, mesh }`; `{ type: 'cancel', key }`.
- `createStream({ workers, seed, kind, radius, physicsRadius = 1, sink }) → { update(x, z, heading), reseed(seed, kind), cell(cx, cz), stats(), dispose() }` (the runtime has no `rt.chunks`: the stream makes its own grid from `runtime/chunkGrid.js`, as Minecraft's does; the worker's job is pure in `job.js`, `worker.js` only wires it), `sink = { build(key, cell, mesh, step), remesh(key, mesh), unbuild(key), solid(key, cell) (add the heightfield and the prop bodies), unsolid(key) }`. The grid from `rt.chunks` (`createChunkGrid({ size: 64, radius, inFlight: 6, hysteresis: 1 })`), the worker named `'land'`, step `1` within `2` cells of the car's cell else `2`, a cell crossing that ring re-meshed from its kept `heights`; `solid` for cells within `physicsRadius` (Chebyshev) of the car's cell and `unsolid` when they leave it, each `update`; at most `2` builds a frame.

- [ ] Tests with a fake pool that answers synchronously from `makeCell` and `cellMesh`, a fake sink recording calls: at `(40, 0, −20)` with radius `4` the built keys equal the grid's wanted set; the 9 cells round the car are `solid` and a 10th is not; moving the car one cell east makes exactly 3 cells `unsolid` and 3 `solid`; a cell entering the step-1 ring is `remesh`ed once; a late answer after `dispose` builds nothing; a cell answered for an older generation (seed changed) is dropped.
- [ ] Run (fail), implement, run (pass). Commit `feat(expanse): cells streamed through the runtime's grid and pool`.

### Task 3.3: `rules.js` and `buggy.js`

**Files:** Create `rules.js`, `rules.test.js`, `buggy.js`.

**Interfaces (produces):**
- `spawnIn(cell) → { x, y, z, yaw, slope }` (the highest dry vertex with slope under `0.15` that stands `6` m from every prop with a body (a tree, a rock, a crate) and `6` m inside the cell's edges, where a neighbour's props stand unseen; else the highest gentle one however near; else the highest dry); `createDriver() → state` and `stepDriver(state, vehicle.state, input, dt, { waterAt }) → { respawn: boolean, unflip: boolean, drag: number (1 under the surface, else 0), moment: 'sea' | 'lake' | 'river' | null }` (the spec §4's rules: `R` or 4 s under water or the vehicle's 3 s stuck → `respawn`; upside down is the vehicle's own unflip since `main`'s hardened `vehicle.js` rights itself, so the rules leave it be; the last dry standing point kept every `0.5` s, `3` s back).
- `createBuggy({ palette }) → { group, wheels: Mesh[4], update(vehicleState, steer, dt) }` in code (a body box `2.6 × 0.8 × 1.7`, a cab, four cylinders `r 0.4`), wheel `y = min(base − suspension, −0.5)` eased `25 dt`, spin `forwardSpeed / 0.4 × dt`, visual steer eased `16 dt`.

- [ ] Tests: `spawnIn` on a flat cell returns slope 0; `stepDriver` with 4 s under water sets `respawn`; stuck sets `respawn`; the standing point returned by `respawn` is one from at least 3 s before. Commit `feat(expanse): the driver's rules and the buggy's look`.

### Task 3.4: `module.js` and `scene.js`

**Files:** Create `module.js`, `module.test.js`, `scene.js`.

**Interfaces (consumes):** everything above; `rt` per `HANDOFF-world-runtime.md`; `rt.chunks`/`rt.workers`/`rt.origin` per PR #600.

- [ ] `module.js`: `{ id: 'expanse-surface', shading: 'glsl', mb: 2, label: 'A planet of the Expanse, driven', async create(rt, { seed, type }) }`: `landSpec`; `Promise.all([createPhysics({ gravity: spec.gravity }), rt.workers.define('land', () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }))])`; the scene (`createScene({ rt, spec, tier })` from `scene.js`: land map, material, water, grass with `tracks`, puffs, leaves, wind lines, tracks, view, sun with the shadow camera on the area, the two-colour sky dome feeding the house's fog, `house.adopt`); the stream with a sink that wires meshes to the scene and bodies to physics (`addHeightfield`, `addProps`), `addCatch` enabled while the car's cell has no heightfield; the car at `spawnIn` of the first built cell; `rt.input.bind(['throttle', 'brake', 'steer', 'boost', 'jump', 'respawn'], { axes: { steer: ['a', 'd', 'ArrowLeft', 'ArrowRight'], throttle: ['s', 'w', 'ArrowDown', 'ArrowUp'] } })` (check `input.js`'s axes shape and copy Earth's); `step(dt, input)`: `stepDriver` → `vehicle.drive` → `physics.step(dt)` → `vehicle.measure` → `buggy.update`, tracks pushed per wheel, leaves, wind, view; `anchor()` returns the chassis's world position; on `rt.events.on('origin')` call `physics.onOrigin`, shift the scene group, the view's focus, the tracks' focus; `draw(frame)`: on `high`/`ultra` the opaque pass into a half-size target then `setOpaque`, else nothing special; `tracks.render`; `rt.gfx.renderer.render`; `lowerQuality(level)`: `setOpaque(null)`, then shadows off, then puff count halved; `dispose` in reverse.
- [ ] `module.test.js` with a fake `rt` (Earth's `fakeRt` plus `chunks`, a `workers` whose `define` is recorded and whose `request` answers from `makeCell`, an `origin` with `on`) and a stubbed `createPhysics` (the real one is slow to init; stub `step` and `addVehicle`): `validateModule` passes; `mb === WORLD_MB['/universe/expanse']`; `create` asks the grid for the right cells at the spawn; `step` with throttle moves the chassis stub forward; an `'origin'` event with shift `[50000, 0, 0]` calls `onOrigin` and moves the scene group by `−50000`; `dispose` frees every slot. Run (fail), implement, run (pass). Commit `feat(expanse): a planet you drive`.

### Task 3.5: the probe journey and docs

**Files:** Modify `scripts/perf-probe.mjs` (journey `expanseDrive`: `/universe/expanse/7`, hold throttle 8 s along +x, turn, 8 s back), `docs/architecture.md` (a paragraph under "The world runtime" for the Expanse surface and `src/lib/land`, `src/lib/physics`), `docs/superpowers/HANDOFF-natural-worlds.md` (the status table), the infinite-worlds plan's Phase 5 (one line: Tasks 5.2 and 5.3 are superseded by this plan's Phase 3; 5.1 maps planet types to `landSpec`'s types).

- [ ] `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe/expanse/7` passes; `node scripts/perf-probe.mjs expanseDrive`: quote the worst frame and p99 in the PR.
- [ ] Phase 3 done: lint, tests, build; PR "Natural worlds, Phase 3: the Expanse surface, driven"; merge.

## Self-review notes

- Spec coverage: §1 → 1.1–1.3; §2 → 1.4–1.6; §3 → 2.1–2.5 (the shadow camera and the sky are in 3.4's scene, where the renderer is); §4 → 3.1–3.4; §5's budget → 3.2's two builds a frame and 3.5's probe; the galaxy's import move → 1.1.
- Names used across tasks: `makeCell`, `cellMesh`, `heightAt`, `waterAt` (1.3) in 1.5, 2.1, 2.3, 3.2; `createPhysics/addHeightfield/addProps/addCatch/addVehicle` (1.4–1.6) in 3.4; `createLandMap`'s `set/drop/centre/ground` (2.1) in 2.3, 3.4; `createTracks`'s `track/render/glsl` (2.2) in 2.1, 3.3, 3.4; `createStream`'s `sink` (3.2) in 3.4.
- Not in any task on purpose: a figure, on foot, a gen3d car, weather, the landing from orbit (the spec's "What this is not" and Phase 4).
