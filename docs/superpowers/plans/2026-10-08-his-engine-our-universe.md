# His engine, our universe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Expanse gone whole, its stream, worker job, driver and land scene lifted into the runtime and the libraries as `rt.land`, and the existing worlds taking what it proved: a walker on Rapier for the galaxy’s worlds and the landings, the galaxy’s land streamed in cells and solid round the player, the universe map’s places built as the ship comes near, and Albuquerque’s car on his car.

**Architecture:** One lane deletes and lifts (lane 0). Four lanes then adopt, each behind a seam a world already has (`world.move` in the walkers, `stream: true` on a site, `nearGrid.js`’s items on the map, `stepCar`’s interface in Albuquerque), so a world that has not opted in plays pixel for pixel as before. Everything new is pure first, tested in Node, drawn second.

**Tech Stack:** three.js 0.186 (WebGLRenderer, GLSL), `@dimforge/rapier3d-compat` 0.21.0 (no new dependency), React 19, Vite, Vitest in Node, Playwright-core and Chromium for the probes.

**Spec:** `docs/superpowers/specs/2026-10-08-his-engine-our-universe-design.md`. Read with it: `docs/superpowers/HANDOFF-world-runtime.md` (what `rt` gives a module), `src/lib/physics/world.js`’s header, `src/runtime/chunkGrid.js`, and for lane 2 `src/components/galaxy/surface/scene.js` as it stands after #656, #669 and #566.

## Lanes and sessions

| Lane | PR branch | Starts from | Blocked by |
|---|---|---|---|
| 0: the Expanse retired, its halves lifted, `rt.land` | `claude/remove-expanse` (#705, taken on) | that branch, `main` merged in | nothing; merges after #701 or deletes its two Expanse files |
| 1: the walker on Rapier (galaxy, landings, the seam in three walkers) | `claude/his-engine-walker` | `main` after 0 and #566 | 0, #566 |
| 2: the galaxy’s land as cells | `claude/his-engine-galaxy-land` | `main` after 0, 1, #656, #669 | 0, 1, #656, #669 |
| 3: the map’s places as cells | `claude/his-engine-map-places` | `main` after 0 and #656 | 0, #656 |
| 4: Albuquerque’s car on his car | `claude/his-engine-abq-car` | `main` after 0 | 0 (and #700’s closed branch for its three library files) |

Lanes 1, 3 and 4 run at once after 0; lane 2 after 1.

## Global Constraints

- No new dependency. Rapier stays imported only by `src/lib/physics/world.js`, dynamically.
- `src/lib` and `src/runtime` import no React and no DOM; `src/lib/physics` and `src/lib/land` import no three.js. Every new rule has its Node test before its drawing half.
- Constants verbatim: `CELL = 64`, `N = 65`, `ORIGIN_CELL = 50000`, physics ring `1`, mesh steps `1 | 2`, the cells column by tier `low 3, mid 4, high 6, ultra 7`, the walker `radius 0.38, step 0.55, slope 0.6, snap 0.3`, the galaxy’s `WALK` and the landings’ `FOOT` unchanged, `nearGrid.js`’s `GRID = { size: 1500, near: 1500, far: 2400, ahead: 3000, max: 2 }` unless lane 3’s test says otherwise, the Aztek’s own top speed and acceleration read from `albuquerque/world/rules.js` before it changes.
- Nothing a visitor can do is lost: every key, save key (`tp-mc`, `tp-pilot`, `tp-gcw`, Albuquerque’s), achievement, sound and dev hook works after as before, except the Expanse’s own.
- A world without the lane’s flag draws the same pixels: before shots on `main`, after shots on the branch, side by side in the pull request.
- A file stays under 800 lines; the measure’s `big-files` budget (`docs/health/budgets.json`) does not rise. A touched file over the ceiling is split by what it does, per `docs/health/RULES.md`’s recipe, keeping export names.
- British spelling, curly quotes, plain sentences; comments say why, in the file’s voice; a prose header per file with its signatures. No model names in code, docs or commits; commits end with the harness’s attribution lines.
- Before a pull request: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --routes <the lane’s routes>`; the lane’s own check named in its last task. Merge `origin/main` in before opening and before merging; never force-push, never rebase anyone’s branch.

## Review Focus

1. A pose of eleven numbers from a pilot still on an older build (out in a sector): `readPose` must return null, not a ship at the map’s edge or a thrown error (lane 0, Task 0.6’s test).
2. A walker at a cell edge where the land is loaded on one side only: `move` must not drop them through; `heightAt` is `NaN` there and the walker holds (lane 1, Task 1.2; lane 2, Task 2.4’s test).
3. A site with `stream: true` opened on `low` (radius 3) and the player running flat out: cells must arrive ahead within the catch slab’s time, and the slab must be under the player whenever their cell is not solid (lane 2, Task 2.4).
4. The map at a place whose `realAt` exceeds the grid’s `far`: it must be a mesh, not a star and a mesh, and never neither (lane 3, Task 3.2’s test over every place).
5. Albuquerque’s traffic meeting the Aztek as a rigid body: a kinematic car that drives into the Aztek must shove it and not pass through, and the Aztek must not be flung at the story’s speeds (lane 4, Task 4.3’s test).

---

## Lane 0: the Expanse retired, its halves lifted, `rt.land` (PR 0, branch `claude/remove-expanse`)

Start: `git checkout claude/remove-expanse && git merge origin/main`. Resolve toward `main` everywhere but the deletions. #701 adds `src/components/expanse/surface/look.js` and edits `buggy.js`: if it is merged first, delete both here; if not, say in its thread that this lane deletes the folder.

### Task 0.1: lift the stream

**Files:**
- Create: `src/runtime/landStream.js`, `src/runtime/landStream.test.js` (from `origin/main:src/components/expanse/surface/stream.js` and its test: `git show origin/main:src/components/expanse/surface/stream.js > src/runtime/landStream.js`, likewise the test)
- Modify: the import of `chunkGrid` to `./chunkGrid.js`; the header’s first sentence (“A world’s land streamed in round a focus”); `createStream` renamed `createLandStream`.

**Interfaces (produces):** `createLandStream({ workers, seed, kind, radius, physicsRadius = 1, sink, inFlight = 6, perFrame = 2 }) → { update(x, z, heading), reseed(seed, kind), cell(cx, cz), cells(), stats(), dispose() }` with `sink: { build(key, cell, mesh, step), remesh(key, mesh, step), unbuild(key), solid(key, cell), unsolid(key) }`; `WORKER = 'land'`, `CELL = 64`. Unchanged but the name.

- [ ] **Step 1:** Copy both files from `origin/main`’s history as above; rename; fix the one import.
- [ ] **Step 2: Run** `npx vitest run src/runtime/landStream.test.js`. Expected: PASS, the same tests as the Expanse’s.
- [ ] **Step 3: Commit** `The land stream moves to the runtime, as it was`.

### Task 0.2: lift the worker’s job and the driver’s rules

**Files:**
- Create: `src/lib/land/job.js`, `src/lib/land/job.test.js` (from `origin/main:src/components/expanse/surface/job.js`; a test is new: none existed), `src/lib/land/worker.js` (from `surface/worker.js`), `src/lib/physics/driver.js`, `src/lib/physics/driver.test.js` (from `surface/rules.js` and `rules.test.js`).
- Modify: imports to `./cell.js`, `./spec.js`; `driver.js`’s header says “a driver on any land” and its test’s imports.

**Interfaces (produces):** `landJob(msg) → { reply, transfer } | null` as its header lists; `spawnIn(cell)`, `createDriver()`, `stepDriver(state, vehicleState, input, dt, { position, waterAt })`, `screenAngle(bearing)`, `DROWN = 4`, `RESPAWN_BACK = 3`.

- [ ] **Step 1: Write the failing test** `src/lib/land/job.test.js`: `landJob({ type: 'cell', key: 'k', seed: 7, kind: 'temperate', cx: 0, cz: 0, step: 1 })` returns a reply whose `heights.length === 65 * 65`, whose `mesh.indices.length` equals `cellMesh(makeCell(landSpec(7), 0, 0).heights).indices.length`, and whose `transfer` holds six buffers; `landJob({ type: 'remesh', key: 'k', cx: 0, cz: 0, heights, step: 2 })` returns a mesh with a quarter the quads; `landJob({ type: 'cancel' })` is null.
- [ ] **Step 2: Run** `npx vitest run src/lib/land/job.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3:** Copy the files; fix imports and headers.
- [ ] **Step 4: Run** `npx vitest run src/lib/land src/lib/physics/driver.test.js`. Expected: PASS.
- [ ] **Step 5: Commit** `The land worker’s job and the driver’s rules move to the libraries`.

### Task 0.3: lift the land scene

**Files:**
- Create: `src/lib/three/landScene.js` (from `origin/main:src/components/expanse/surface/scene.js`), `src/lib/three/landScene.test.js` (new).
- Modify: every `../../../lib/three/<x>.js` import to `./<x>.js`; the buggy removed (`createBuggy`, `scene.buggy`, the chassis follow in `follow` becomes a `target: { x, y, z }`); the header rewritten for a world’s land, not the Expanse’s.

**Interfaces (produces):** `createLandScene({ renderer, spec, tier, radius, small }) → { scene, camera, view, map, water, grass, puffs, tracks, land, build(key, cell, mesh, step), remesh(key, mesh, step), unbuild(key, cell), crates, rocks, setOrigin([x, y, z]), shift([sx, sy, sz]), setFloor(fn), follow(target, speed, dt, motion), draw(), resize(w, h), lowerQuality(level), dispose() }`. The `crates` and `rocks` slot pools stay (lane 2 replaces them with the kit’s pools; a slot pool is what the stream’s `sink` writes into meanwhile).

- [ ] **Step 1: Write the failing test** `landScene.test.js` on `gpuFake.fixture.js`’s `fakeRenderer()`: `createLandScene({ renderer, spec: landSpec(7), tier: 'high', radius: 3 })` has a `land` group with no children; after `build('0,0', cell, cellMesh(cell.heights), 1)` it has one; `shift([64, 0, 0])` moves the group’s position by `−64` on x; `unbuild('0,0', cell)` empties it and disposes the mesh’s geometry (`geometry.dispose` spied).
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3:** Copy, rename, strip the buggy, fix imports.
- [ ] **Step 4: Run** `npx vitest run src/lib/three/landScene.test.js`. Expected: PASS.
- [ ] **Step 5: Commit** `The land scene moves to lib/three, without the buggy`.

### Task 0.4: `rt.land`

**Files:**
- Create: `src/runtime/land.js`, `src/runtime/land.test.js`.
- Modify: `src/runtime/runtime.js` (`rt.land = createLand({ workers, origin })` beside `rt.workers`; its header’s `rt:` line), `src/runtime/index.js` if it lists services, `docs/superpowers/HANDOFF-world-runtime.md` (one line: `rt.land`).

**Interfaces (produces):** `createLand({ workers, origin }) → { open(opts) → Land }`; `open({ spec | field, seed, kind, radius, physicsRadius = 1, physics = null, sink = null, makeWorker })` where `makeWorker` defaults to `() => new Worker(new URL('../lib/land/worker.js', import.meta.url), { type: 'module' })` and a `field(x, z) → height` makes cells on the main thread (`makeCell` with `spec = { ...landSpec(seed, kind), field }` is not JSON: with `field`, `open` samples `heights` itself at 1 m, `water` all `NaN`, `mask` zero, `props` none, no mesh, no worker); `Land = { update(x, z, heading), heightAt(x, z) → number | NaN, waterAt(x, z) → { level, kind } | null, cell(cx, cz), cells(), solid(cx, cz) → boolean, stats(), dispose() }`. With `physics`, `solid` and `unsolid` are what the Expanse module did (`addHeightfield` at the cell’s local origin, `addProps` of its props, removed on `unsolid`), the catch slab `addCatch(physics)` enabled while the focus’s cell is not solid and placed at `heightAt − 0.5` from the nearest loaded cell, and an origin shift (`origin.on`) calls `physics.onOrigin(shift)` and moves the kept props’ positions. `sink` is called after the physics ring, with the same five functions as `landStream`’s.

- [ ] **Step 1: Write the failing tests** `land.test.js` with a fake pool that answers `request('land', msg)` synchronously from `landJob`, and a fake physics recording `add`/`remove`: (a) `open({ spec: landSpec(7), radius: 2, physics })` then `update(32, 32, [1, 0])`: nine cells built, one solid (`solid(0, 0)` true, `solid(1, 0)` false); (b) `heightAt(32, 32)` equals `heightAt(cell, 32, 32)` from `lib/land/cell.js`, and `heightAt(10000, 10000)` is `NaN`; (c) moving to `(96, 32)` makes `1,0` solid and `-1,0` not, with `physics.remove` called once for the heightfield and the props; (d) with `field: (x, z) => 2` and `physics`: no worker is asked, `heightAt(5, 5)` is `2`, the ring’s heightfields are added; (e) a fake origin event `{ shift: [64, 0, 0] }` calls `physics.onOrigin([64, 0, 0])` once; (f) `dispose()` removes every body and `stats().built` is 0.
- [ ] **Step 2: Run** `npx vitest run src/runtime/land.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `createLand` in `src/runtime/land.js` from the Expanse module’s wiring (`origin/main:src/components/expanse/surface/module.js` lines 86 to 200 and 240 to 285), without the vehicle, the HUD and the scene.
- [ ] **Step 4: Run** `npx vitest run src/runtime`. Expected: PASS.
- [ ] **Step 5: Commit** `rt.land: a world’s land streamed and made solid round a focus`.

### Task 0.5: the sectors and the pockets go

**Files:**
- Delete: `src/components/expanse/` (what #705 left: `gen/`, `scene/`, `pocket.js`, their tests), `docs/superpowers/previews/expanse-7-standing.webp`.
- Modify: `src/components/universe/layout.js` (lines 22, 54 to 73: no grid import, no `inExpanse`, no `expanseSector`; `sectorById(id) → SECTORS[id] ?? null`), `src/components/universe/scene.js` (lines 197, 198, 698 to 710, 5009, 5513, 5842: no Expanse), `src/components/universe/ship.js` (`OPEN_SPACE = { ...SPACE }`; lines 481 and 540 to 548 read the edge as a wall), `src/components/universe/nav.js:178` (comment), `src/components/universe/farStars.js:21` (comment), `src/pages/Universe.jsx` (lines 38, 77 to 83, 541, 542, 563: no pocket), `src/components/worlds/registry.js` (`KINDS = ['minecraft']`, `KIND_NAMES` likewise, `worldUrl` of another kind `/worlds`, `list()` leaves other kinds out, `fileId` refuses them), `src/components/worlds/MyWorlds.test.jsx:43,117,125` (the pocket rows become minecraft rows or a “not listed” case), `src/components/universe/online/rosterWhere.js` (lines 7 to 14, 25, 35 to 50: no Expanse), `rosterWhere.test.js`, `src/components/universe/online/protocol.js` (next task).
- Test: `src/components/universe/layout.test.js` (a point past the main edge is `main`’s), `ship.js`’s test (the ship turned back at the edge under `OPEN_SPACE`), `registry.test.js`.

- [ ] **Step 1: Write the failing tests**: `sectorOf(40000, 0, 0) === 'main'` and `sectorById('E:1,0') === null`; `step` under `OPEN_SPACE` from `x = DEEP.edge − 1` heading out ends inside the edge; `list()` on a store holding `{ kind: 'planet' }` and `{ kind: 'pocket' }` rows returns neither; `worldUrl({ kind: 'pocket', seed: 'a' }) === '/worlds'`; `fileId({ world: { kind: 'planet', seed: 7 } }) === null`.
- [ ] **Step 2: Run** `npx vitest run src/components/universe/layout.test.js src/components/worlds`. Expected: FAIL.
- [ ] **Step 3:** Delete and edit as listed. `npx eslint .` finds every dangling import.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `The Expanse’s sectors and pockets go; the map has its edge back`.

### Task 0.6: the wire, the probe, the docs

**Files:**
- Modify: `src/components/universe/online/protocol.js` (`writePose` lines 192 to 198: no sector, ten numbers; `readPose` lines 208 to 215: `data[10]` ignored, x and z clamped to `FAR`), `protocol.test.js`, `scripts/perf-probe.mjs` (`expanseDrive` gone, done by #705), `docs/architecture.md` (the Expanse paragraph becomes one on `rt.land`, `landStream`, `landScene`, `driver.js`: where each lives and that the Expanse was the study they came from), `docs/stack/physics-rapier.md` (“Where it is used”: the landings and `rt.land`; “Upgrading”: drive Albuquerque by hand once lane 4 is in, until then kick a barrel on a landing), `docs/README.md` (nothing new), `docs/superpowers/HANDOFF-infinite-worlds.md`, `HANDOFF-natural-worlds.md`, `HANDOFF-kit-worlds.md`, `HANDOFF-one-feel.md`, `HANDOFF-webgpu-acceleration.md` (one line each under their status or findings: what the spec’s “What this does to the lanes in flight” says), `docs/superpowers/specs/2026-10-08-ground-factions-design.md:70` (the example’s path).

- [ ] **Step 1: Write the failing tests** in `protocol.test.js`: `writePose({ x: 50000, y: 0, z: 0, heading: 0 })` has length 10 and its x reads back clamped to `FAR`; `readPose([1, 2, 3, 0, 0, 0, 0, 0, 0, 100, 'E:1,0'])` returns a pose at `(1, 2, 3)` (an eleventh value is ignored); `readPose([100000, 0, 0, 0, 0, 0, 0, 0, 0, 100, 'E:1,0'])` returns null.
- [ ] **Step 2: Run** `npx vitest run src/components/universe/online/protocol.test.js`. Expected: FAIL.
- [ ] **Step 3:** Edit `protocol.js`; write the docs.
- [ ] **Step 4: Run** `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build && node scripts/autopilot-check.mjs --only smoke --routes /universe,/worlds && node scripts/online-check.mjs`. Expected: all green; `health` within budget.
- [ ] **Step 5: Commit** `A pose is ten numbers again; the docs say where the Expanse’s pieces live`. Open the pull request (#705 re-titled: “The Expanse retired whole; its stream, job, driver and land scene lifted; `rt.land`”).

---

## Lane 1: the walker on Rapier (PR 1, branch `claude/his-engine-walker`)

### Task 1.1: `lib/physics/walker.js`

**Files:**
- Create: `src/lib/physics/walker.js`, `src/lib/physics/walker.test.js`.

**Interfaces (produces):** `addWalker(physics, { radius = 0.38, half = 0.55, position = [0, 0, 0], step = 0.55, slope = 0.6, snap = 0.3, up = null }) → { body, move(delta: [dx, dy, dz], dt) → { position: [x, y, z], grounded: boolean, slid: boolean }, teleport([x, y, z]), position(out?), remove() }`. `move` runs Rapier’s `KinematicCharacterController` (`computeColliderMovement` with the body’s collider, autostep `{ maxHeight: step, minWidth: radius, includeDynamicBodies: false }`, `setMaxSlopeClimbAngle(Math.atan(slope))`, `enableSnapToGround(snap)`, `setApplyImpulsesToDynamicBodies(true)`) and sets the body’s next kinematic translation; `up` is a fixed `[x, y, z]` or a function of the position (a sphere’s radial: `physics`’s `gravity.centre` when it has one), applied through `setUp` before each move.

- [ ] **Step 1: Write the failing tests** against the real engine (`createPhysics` in `beforeAll`, a flat heightfield of 65 × 65 at 0, as `heightfield.test.js` makes one): (a) a walker at `(0, 1, 0)` moved `[0, −1, 0]` for 30 steps rests at `y ≈ half + radius` within `0.02`, `grounded` true; (b) a fixed cuboid step of height `0.5` ahead: 60 moves of `[0.05, 0, 0]` end on top (`y` up by `0.5`), one of height `0.7` ends in front (`x` stopped before it); (c) a heightfield slope of 30°: moving uphill climbs, 40°: `slid` true and `x` unchanged; (d) walking off a 1 m drop with `snap 0.3`: `grounded` stays true on a 0.2 m drop and goes false on 1 m until it lands; (e) a sleeping dynamic crate of mass 0.02 ahead: after walking into it its `linvel` is not zero; (f) `physics` made with `gravity: { centre: [0, 0, 0] }` and a fixed ball of radius 50: a walker at `(0, 51, 0)` with `up` the radial, moved along `+x` 200 times, keeps `|position| ≈ 51` within `0.1` and `grounded` true (the open assumption: if the controller will not take a changing `up`, mark the test `skip` with the reason and say so in the hand-off).
- [ ] **Step 2: Run** `npx vitest run src/lib/physics/walker.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `addWalker` in `src/lib/physics/walker.js`.
- [ ] **Step 4: Run** it. Expected: PASS (or (f) skipped with its reason).
- [ ] **Step 5: Commit** `A walker as a body: Rapier’s character controller, his light props shoved`.

### Task 1.2: `solidsToBodies` and the seam in the galaxy’s walker

**Files:**
- Create: `src/components/galaxy/surface/solidsToBodies.js`, `solidsToBodies.test.js`.
- Modify: `src/components/galaxy/surface/walker.js` (`walk`, lines 180 to 300: the ground and solids step goes through `world.move` when it exists; `ride` likewise at lines 344 to 400), `walker.test.js`.

**Interfaces (produces):** `solidsToBodies(solids) → [desc]` for `physics.add`: a circle `{ x, z, r, top, base }` a fixed cylinder `args: [(top ?? 3) − (base ?? 0)) / 2, r]` at `y = base + half`; a box a fixed cuboid `[hw, (top ?? 3 − base) / 2, hd]` rotated by yaw about y. `world.move(from: { x, y, z }, delta: [dx, dy, dz], dt) → { to: [x, y, z], grounded, slid } | null`: when `world.move` is a function, `walk` uses it in place of `pushOut` + `groundAt` + `solidTop` for the player’s own step (floors over the land are still `walk`’s own: a floor is checked before `move`); `null` from it (the ground not loaded) holds the walker where it is this frame. When absent, nothing changes.

- [ ] **Step 1: Write the failing tests**: `solidsToBodies` on a `createSolids()` with one circle `(1, 2, r 0.5, top 2)` and one box `(5, 5, 1, 2, yaw π/4)` returns two fixed descs with those shapes and places; `walk` with a `world.move` stub that returns `{ to: [from.x + delta[0], 0, from.z + delta[2]], grounded: true }` moves the walker and never calls `world.solids.near` (spied); with `move` returning null the walker’s `x, z` are unchanged and `out.bumped` false; without `move` every existing `walker.test.js` case passes as before.
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/surface/walker.test.js src/components/galaxy/surface/solidsToBodies.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**: the seam in `walk` and `ride`; `solidsToBodies`.
- [ ] **Step 4: Run** the two. Expected: PASS.
- [ ] **Step 5: Commit** `The galaxy’s walker takes a world’s move: its ground and solids from a body when the site has one`.

### Task 1.3: Yavin on the walker

**Files:**
- Create: `src/components/galaxy/surface/bodies.js`, `bodies.test.js`.
- Modify: `src/components/galaxy/surface/scene.js` (the `world` object, line 326: `move` when `site.physics`; the player’s walker made in `bodies.js`; `createPhysics` with `preload()` behind the dive; the figures that walk get `addPusher`), `src/components/galaxy/surface/sites/yavin.js` (`physics: true`), `src/components/galaxy/surface/sites/sites.test.js` (a site’s `physics` is a boolean or absent).

**Interfaces (produces):** `createSiteBodies({ physics, world, solids, heightAt, n = 65 }) → { move(from, delta, dt), ground: Body (one heightfield of the site’s `±640` grid sampled at 1 m per 64 m cell: 20 × 20 heightfields, made once, until lane 2 streams them), people(list, dt), dispose() }`. `physics` is created in `scene.js` only when `site.physics`, in parallel with the models, on the dive.

- [ ] **Step 1: Write the failing test** `bodies.test.js` against the engine with a flat `heightAt`: `move({ x: 0, y: 2, z: 0 }, [0, −2, 0], 1/60)` lands within 30 calls; a tree circle from `solids` stops a walk into it.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement**; wire `scene.js`; flag Yavin.
- [ ] **Step 4: Run** `npm test && node scripts/galaxy-check.mjs && node scripts/autopilot-check.mjs --routes /galaxy/yavin/surface,/galaxy/hoth/surface --shots his-engine-walker` (before shots taken on `main` first). Expected: Hoth identical; Yavin the same picture, the figure standing where it stood.
- [ ] **Step 5: Commit** `Yavin’s walker is a body: the trees, the temple and the ground from Rapier`.

### Task 1.4: the landings’ player on the walker

**Files:**
- Modify: `src/components/universe/foot.js` (`walk`, line 211: an `obstacles` that is a function `move` is used in place of the obstacle loop; `FOOT` unchanged), `foot.test.js`, `src/components/universe/footScene.js` (lines 2659 to 2791: `obstacles()` becomes `mover()` when the landing’s physics has a walker; the walker made from `createLandingPhysics`’s world with `up` the radial), `src/components/universe/landings/physics.js` (`walker(position) → { move }` added to what it returns, built on `lib/physics/walker.js` with `gravity.centre`), `physics.test.js`.

- [ ] **Step 1: Write the failing tests**: `landings/physics.js`’s `walker` on its ball keeps a figure on the surface over 200 steps of `move` along the ground (the (f) test of Task 1.1 through this API); `foot.js`’s `walk` with a `move` function moves `w.n` to the returned position’s unit vector and never reads the obstacle list.
- [ ] **Step 2: Run** `npx vitest run src/components/universe/foot.test.js src/components/universe/landings/physics.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement**; if Task 1.1’s (f) was skipped, stop here: `foot.js` keeps its walk and the hand-off says why.
- [ ] **Step 4: Run** `npm test && node scripts/landing-check.mjs && node scripts/standing-check.mjs`. Expected: green.
- [ ] **Step 5: Commit** `On a landing you are a body too: the same walker on the sphere`.

### Task 1.5: the towns’ walker takes the seam; the roster line

**Files:**
- Modify: `src/components/middleearth/towns/walker.js` (`makeWalker`, line 97: a `move` in its options used in place of `pushOut`; default absent), `walker.test.js`; `src/components/worlds/looks.js` (from #701 once merged, else a note in the hand-off): `LOOK.physics: 'rapier' | 'own' | 'none'` with `why.physics` for the last two, validated by `looks.test.js`; the Yavin site’s `look.js` says `rapier`; the walker’s module header lists which worlds use it.
- Docs: `docs/architecture.md` (one sentence under the galaxy surfaces and one under the landings), `docs/stack/physics-rapier.md` (the walker under “The pieces beside it”).

- [ ] **Step 1: Write the failing test** in `towns/walker.test.js`: a `move` stub is called with the step and its answer is where the walker ends; without one the existing cases pass.
- [ ] **Step 2: Run** it. Expected: FAIL. **Step 3: Implement.** **Step 4: Run** `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`. Expected: green.
- [ ] **Step 5: Commit** `The towns’ walker takes a move too; look.js says a world’s physics`. Open the pull request with the before and after shots and `galaxy-check`’s numbers.

---

## Lane 2: the galaxy’s land as cells (PR 2, branch `claude/his-engine-galaxy-land`)

### Task 2.1: `lib/land/shape.js` and a site as a land spec

**Files:**
- Create: `src/lib/land/shape.js`, `shape.test.js`, `src/components/galaxy/surface/landSpec.js`, `landSpec.test.js`.
- Modify: `src/components/galaxy/surface/terrain.js` (`levelled` and `dug` imported from `lib/land/shape.js`, their bodies deleted; `fineRelief` registered as a layer in `lib/land/layers.js` as `'fine'` with `metres` and `height` pairs), `src/lib/land/cell.js` (`makeCell`: after the rivers, `spec.flats` through `levelled` and `spec.pits` through `dug`), `cell.test.js`, `terrain.test.js`.

**Interfaces (produces):** `levelled(raw, flats)` and `dug(height, pits)` as they are; `siteLandSpec(site, { relief }) → spec` (JSON: `relief` the site’s `ground.layers` plus the fine layer, `base`, `seed`, `sea: −Infinity` unless `site.water` says a level, `rivers: { perRegion: 0 }` unless `ground.rivers`, `flats: ground.flats`, `pits: ground.pits`, `palette` from `ground`’s look, `kit: { perCell: 0 }` (the site’s own scatter stays), `gravity: 9.81`).

- [ ] **Step 1: Write the failing tests**: `shape.test.js` is `terrain.test.js`’s `levelled` and `dug` cases moved; `landSpec.test.js`: for every site in `LANDABLE`, `heightAt` over the cells from `makeCell(siteLandSpec(site, { relief }), cx, cz)` equals `makeHeight(site.ground, { relief })(x, z)` within `1e-3` at 200 seeded points inside `±640` (the cells `−10..9`); a spec round-trips `JSON.parse(JSON.stringify(spec))` unchanged.
- [ ] **Step 2: Run** `npx vitest run src/lib/land src/components/galaxy/surface/landSpec.test.js src/components/galaxy/surface/terrain.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** the same. Expected: PASS; `terrain.test.js` unchanged but the moved cases.
- [ ] **Step 5: Commit** `A galaxy site is a land spec: its layers, flats and pits make the same ground as cells`.

### Task 2.2: the cells column and the stream flag

**Files:**
- Modify: `src/lib/budgets.js` (`COLUMNS` gains `cells`; rows `low 3, mid 4, high 6, ultra 7`; the header’s table), `budgets.test.js`; `src/components/galaxy/surface/sites/index.js` (a site may say `stream: true`), `sites.test.js`; `src/components/galaxy/surface/sites/yavin.js` (`stream: true`).

- [ ] **Step 1: Write the failing test**: `budget('high').cells === 6`, `budget('low').cells === 3`; a site’s `stream` is absent or a boolean.
- [ ] **Step 2: Run.** FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/lib/budgets.test.js src/components/galaxy/surface/sites`. PASS.
- [ ] **Step 5: Commit** `The cells a world streams, by level`.

### Task 2.3: the surface’s land through `rt.land`

**Files:**
- Create: `src/components/galaxy/surface/land.js`, `land.test.js`.
- Modify: `src/components/galaxy/surface/scene.js` (where the terrain mesh is built, line 275 and its use: when `site.stream`, `createSurfaceLand` in its place; the `world.heightAt` and `normalAt` from it; the far skirt kept), `src/components/galaxy/surface/module.js` (`fromScene` stays; the scene is handed `rt`), the galaxy’s `pack.js` (the land worker’s chunk).

**Interfaces (produces):** `createSurfaceLand({ rt, site, tier, physics, scene, house, wind }) → { land: Land (rt.land’s), group, heightAt(x, z), normalAt(x, z), update(x, z, heading), shift, dispose() }`: `rt.land.open({ spec: siteLandSpec(site), radius: budget(tier).cells, physicsRadius: 1, physics, sink })` with a `sink` that builds the cell mesh into `lib/three/landScene.js`’s `build` (the scene here uses `createLandScene`’s `land` group and `map` only: the site keeps its own sky, light, water and grass until it asks for his), the mesh’s material the site’s own ground material (`ground.js`) over the land map’s colour where the site has no detail texture. `heightAt` outside any loaded cell falls back to `makeHeight` (the function is cheap and the walker never waits).

- [ ] **Step 1: Write the failing test** `land.test.js` with a fake `rt` (a fake pool answering from `landJob`, a fake origin) and `gpuFake`: after `update(0, 0, [1, 0])` at `high` the group holds `(2 × 6 + 1)²` meshes at most and the four round the origin at step 1; `heightAt(10, 10)` equals the spec’s cell height; a cell past the radius is freed on moving `7 × 64` along x.
- [ ] **Step 2: Run** it. FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/components/galaxy/surface/land.test.js`. PASS.
- [ ] **Step 5: Commit** `A streamed site’s land comes in cells round you, the same hills`.

### Task 2.4: the ground solid round the player, the catch slab, the walker on it

**Files:**
- Modify: `src/components/galaxy/surface/bodies.js` (lane 1’s: with `site.stream`, no 20 × 20 heightfields: `move` reads `land.heightAt` and the ring’s heightfields come from `rt.land`’s physics; `move` returns null while `land.solid(cx, cz)` is false for the player’s cell), `bodies.test.js`, `scene.js` (the ground war’s `standable` and `groundAt` callers at lines 403, 417, 455, 514, 543 read `world.heightAt`, unchanged in shape).

- [ ] **Step 1: Write the failing tests**: with a fake land whose `solid` is false for `0,0`, `move` returns null and the walker holds; once `solid` is true it moves; the catch slab (`rt.land`’s) is enabled only while `solid` is false (spied through the fake physics).
- [ ] **Step 2: Run.** FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/components/galaxy/surface`. PASS.
- [ ] **Step 5: Commit** `The ground is solid one cell round you and the slab holds you until it is`.

### Task 2.5: the scatter through the pools, by cell, and the sleep discipline

**Files:**
- Modify: `src/components/galaxy/surface/placer.js` (the `scatter` rows, line 485: on a streamed site a row is placed per cell from the cell’s seed into the kit pool under `cellKey` (`createPool`’s `set(key, items)`), freed on `unbuild`; the same spots as today pinned by a test on one row), `placer.test.js`, `land.js` (`sink.build` calls the placer’s `placeCell(key, cell)`; `unbuild` its `freeCell(key)`), `scene.js` (`physics.sleepOutside(player, area.radius)` each metre the player moves: `optimalArea` from the surface camera’s own numbers, once a resize).

- [ ] **Step 1: Write the failing tests**: `placeCell` on a scatter row over cell `0,0` gives the same `(x, z, yaw, scale)` set as the whole-patch scatter filtered to that cell (sorted); `sleepOutside` is called with the area’s radius after the player moves 1 m and not before.
- [ ] **Step 2: Run.** FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/components/galaxy/surface/placer.test.js src/components/galaxy/surface/land.test.js`. PASS.
- [ ] **Step 5: Commit** `A streamed site’s scatter comes with its cell, through the pools, and sleeps outside the view`.

### Task 2.6: the probe, the checks, the docs

**Files:**
- Modify: `scripts/perf-probe.mjs` (a `yavinWalk` journey: `/galaxy/yavin/surface`, wait for `__RUNTIME__.status === 'on'`, walk 300 m along `+x` and back by synthetic keys, marks per phase), `scripts/galaxy-check.mjs` (its Yavin row unchanged), `docs/architecture.md` (the galaxy surfaces paragraph: a streamed site), `docs/superpowers/HANDOFF-kit-worlds.md` (Phase 3’s consumer is this lane’s `land.js`).

- [ ] **Step 1: Run** before: on `main`, `node scripts/autopilot-check.mjs --skip lint,test --routes /galaxy/yavin/surface,/galaxy/tatooine/surface --shots his-engine-galaxy-land --before`.
- [ ] **Step 2: Run** after, on the branch: the same without `--before`; `node scripts/galaxy-check.mjs`; `node scripts/perf-probe.mjs yavinWalk`. Expected: Tatooine identical; Yavin the same picture; after the veil no frame over 100 ms and p99 under 33 ms; triangles and calls within `high`’s row.
- [ ] **Step 3: Run** `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build && node scripts/pack-check.mjs`. Expected: green.
- [ ] **Step 4: Commit** `yavinWalk: the probe walks a streamed site`. Open the pull request with the shots and the numbers.

---

## Lane 3: the map’s places as cells (PR 3, branch `claude/his-engine-map-places`)

### Task 3.1: a place’s real content as near-grid items

**Files:**
- Create: `src/components/universe/placeItems.js`, `placeItems.test.js`.
- Modify: `src/components/universe/nearGrid.js` (#656’s: an item may carry `near` of its own, used in place of `GRID.near` for showing and hiding; `heavy` items keep `max`), `nearGrid.test.js`, `src/components/universe/scene.js` (the planets’ meshes, moons, halos, landing stand-ins and local traffic built in `placeItems` on demand rather than at start; `farStars`’s `realAt` the item’s `near`), `src/components/universe/planets.js` (a `build(place) → { roots, show, dispose }` beside what builds them at start).

**Interfaces (produces):** `placeItems({ places, build }) → items` for `createNearGrid`, each `{ id, at, near: realAt(place), heavy: false, build }`; `realAt` imported from `farStars.js`.

- [ ] **Step 1: Write the failing tests**: `placeItems` over `PLACES` gives one item a place with `near === realAt(place)`; `nearGrid` with an item of `near: 6000` shows it at 5,900 from the camera and hides it at 6,100 while `GRID.near` stays 1,500 for the rest; for every place, at distance `realAt(place) − 1` the item is shown and the far star’s `blend` is under 1, at `realAt(place) + 1` the item is hidden and the star full: never both full, never neither (the crossfade band of `farStars.blend`).
- [ ] **Step 2: Run.** FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/components/universe/nearGrid.test.js src/components/universe/placeItems.test.js src/components/universe/farStars.test.js`. PASS.
- [ ] **Step 5: Commit** `A place is built as you come near it and let go behind you; the far star stays`.

### Task 3.2: the director, the hunters and the war keep their places

**Files:**
- Modify: `src/components/universe/director.js`, `hunters.js`, `front.js` (any read of a place’s mesh (`place.mesh`, `group`) goes through `placeItems.at(id)` which answers a position whether or not it is built), their tests, `scripts/universe-check.mjs` (three poses added to its baseline: at home, at a place’s `realAt`, far out).

- [ ] **Step 1: Write the failing tests**: an event at an unbuilt place resolves its position; a hunter spawned at a place 20,000 away has a position.
- [ ] **Step 2: Run.** FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && node scripts/universe-check.mjs && node scripts/universe-war-check.mjs && node scripts/autopilot-check.mjs --routes /universe --shots his-engine-map-places` (before on `main` first). Expected: the home system identical; `universe-check` within its baseline; `renderer.info` at home no higher than before.
- [ ] **Step 5: Commit** `The map’s rules read a place’s position whether it is built or not`. Open the pull request.

---

## Lane 4: Albuquerque’s car on his car (PR 4, branch `claude/his-engine-abq-car`)

### Task 4.1: the feel’s library halves from #700

**Files:**
- Create: `src/lib/vehicleFeel.js`, `vehicleFeel.test.js`, `src/lib/three/vehicleBody.js`, `vehicleBody.test.js`, `src/lib/physics/carTuning.js`, `carTuning.test.js`: `git checkout origin/claude/one-feel-car -- <each path>`; `src/lib/physics/vehicle.js`’s one-line `spec` return from that branch too.

- [ ] **Step 1: Run** `npx vitest run src/lib/vehicleFeel.test.js src/lib/three/vehicleBody.test.js src/lib/physics`. Expected: PASS.
- [ ] **Step 2: Commit** `The car’s visible half and its tuning, from the closed car lane, without the buggy`.

### Task 4.2: the Aztek on `lib/physics/vehicle.js`

**Files:**
- Create: `src/components/albuquerque/world/car.js`, `car.test.js`.
- Modify: `src/components/albuquerque/world/rules.js` (`stepCar`, line 384: its interface kept, `{ car, bump, slip, surface }`; its body calls `car.js` when the world handed it a `drive`, else the bicycle model: the bicycle stays for the tests of the rules that read `car.speed` and for `reduced`), `rules.test.js`, `AbqWorld.jsx` (line 416: the physics made on mount, `rt.land.open({ field: groundHeight, radius: 2, physicsRadius: 1, physics })`, the kerbs and buildings from `COLLIDERS` through `solidsToBodies`-shaped descs (its boxes are `{ x, z, w, d, h }`: a local `abqSolids(colliders) → descs`), the Aztek `addVehicle(physics, AZTEK)` with `AZTEK = { ...CAR, engineForce, topSpeed, topSpeedBoost }` set so full throttle on the flat reaches today’s top speed within 0.5 m/s, the feel over it, the traffic’s cars kinematic pushers (`addPusher` with a cuboid: a `shape` option added to `pusher.js`)).

**Interfaces (produces):** `createCar({ physics, land, spec = AZTEK }) → { drive(input, dt) → { car: { x, z, yaw, speed, slide, yawRate }, bump, slip }, moveTo, feel, dispose() }`; `stepCar(car, input, dt, movers, drive?)`.

- [ ] **Step 1: Write the failing tests** against the engine: on `field: () => 0`, full throttle for 3 s reaches `AZTEK.topSpeed` within `0.5`; the brake stops it within 2 s; a kinematic pusher cuboid driven into the resting Aztek at 5 m/s moves it and leaves it under 8 m/s (Review Focus 5); `stepCar` with a `drive` returns its numbers in the old shape and `rules.test.js`’s existing cases pass without one.
- [ ] **Step 2: Run** `npx vitest run src/components/albuquerque/world`. FAIL. **Step 3: Implement.** **Step 4: Run.** PASS.
- [ ] **Step 5: Commit** `The Aztek is his car: four wheels on the town’s ground, the kerbs and the buildings solid`.

### Task 4.3: the respawn, the probe, the docs

**Files:**
- Modify: `AbqWorld.jsx` (`lib/physics/driver.js`’s `createDriver` and `stepDriver` for R and for stuck, the `waterAt` always null; the Aztek’s look through `vehicleBody.js`), `scripts/perf-probe.mjs` (`abqDrive`: `/albuquerque`, drive 400 m along the main road and back), `docs/architecture.md` (Albuquerque’s paragraph), `docs/stack/physics-rapier.md` (“Where it is used”, “Upgrading”: drive Albuquerque by hand), `src/components/albuquerque/look.js` if #701 is in (`physics: 'rapier'`), `docs/superpowers/HANDOFF-one-feel.md` (1C’s row: done here).

- [ ] **Step 1: Run** before on `main`: `node scripts/autopilot-check.mjs --skip lint,test --routes /albuquerque --shots his-engine-abq-car --before`.
- [ ] **Step 2: Implement**; then on the branch the same without `--before`, `node scripts/perf-probe.mjs abqDrive`, `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build`. Expected: the town the same picture, the car on it; worst frame quoted; health within budget.
- [ ] **Step 3: Commit** `R brings the Aztek back where it last stood; abqDrive drives it for the probe`. Open the pull request with the shots, the numbers and, by hand in dev, a note of how it drives against `main`.

---

## Self-review notes

- Spec coverage: decision 1 is Tasks 0.5 and 0.6; decision 2 is 0.1 to 0.4; decision 3 is lane 1; decision 4 is lane 2; decision 5 is lane 3; decision 6 is lane 4; decision 7’s `look.js` line is Task 1.5; “What this does to the lanes in flight” is Task 0.6’s hand-off lines and Task 2.6’s; the roster’s dashes need no task.
- Names used across lanes: `rt.land.open` (0.4) is read by 2.3 and 4.2 as written; `Land.solid(cx, cz)` (0.4) by 2.4; `addWalker`’s `move(delta, dt)` (1.1) by 1.3, 1.4 and 2.4 through `world.move(from, delta, dt)` (1.2); `siteLandSpec` (2.1) by 2.3; `realAt` is `farStars.js`’s existing export; `createLandScene` (0.3) by 2.3; `AZTEK` (4.2) by 4.3.
- Open where the plan leaves a choice on purpose: the land map’s colour under a site’s own ground material (2.3: the implementer picks the simplest blend that keeps Yavin’s picture); the `abqSolids` shape (4.2: the town’s boxes are axis-aligned, so cuboids suffice).
