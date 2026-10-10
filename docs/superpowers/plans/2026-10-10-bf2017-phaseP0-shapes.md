# Battlefront 2017 physics, lane P0: the shapes. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** The game’s Havok shapes become the galaxy’s collision on a level-pack world: read from the physics GLBs, packed once per mesh into the level pack, streamed in and out as fixed Rapier colliders with lane L’s cells, the terrain a heightfield from the same heights the ground is drawn from, and derived into the walker’s boxes for devices that load no engine. Hoth first.

**Architecture:** A build script (`scripts/bf2017-physics.mjs`) reads each mesh’s `_Physics_Win32` GLB (quantised, meshopt) through `@gltf-transform`, undoes the node scale and translation, and writes `physics/<mesh>.bin` plus `physics/cells/<cx>_<cz>.bin` and a `physics` section in `level.json`. A pure library (`src/lib/physics/havok.js`) turns a bin into `world.js` collider descriptions and into walker solids. A lane-owned `levelPhysics.js` adds and removes a cell’s bodies as lane L’s stream adds and removes its draws, under a per-cell budget, with a heightfield per 64 m from the `image` ground layer.

**Tech Stack:** Node 22, `@gltf-transform/{core,extensions}`, `meshoptimizer` (the decoder), `@dimforge/rapier3d-compat` 0.21.0 through `src/lib/physics/world.js` and `heightfield.js`, Vitest (the engine runs in Node), `scripts/galaxy-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-physics-design.md` (§“The physics GLB, read”, §1, §6, §7, §8).

## Global Constraints

- Phase 0’s Global Constraints (keys from the environment; `lab/assets/bf2017/` for fetched files; the sequel list; the credit text; the gates). Fetch a bucket file with `node scripts/bf2017-fetch.mjs --raw <path>` when lane L’s flag is on `main`, else with `curl` and the env keys as `HANDOFF-bf2017.md` shows (`SUPABASE_URL`, `SUPA_KEY` or `BF2017_KEY`); the physics files are `web/physics/<name>.glb` and `web/physics.jsonl`.
- **Files this lane owns**: `scripts/bf2017-physics.mjs`, `scripts/lib/bf2017-physics.mjs` (+ test), `scripts/fixtures/bf2017/physics/`, `src/lib/physics/havok.js` (+ test), `src/components/galaxy/surface/level/levelPhysics.js` (+ test), the Rapier half of `src/lib/level/collision.js` (`createLevelCollision`), one branch in `scene.js`’s `createLevel` call site. It does not touch `walker.js`, `world.js` (but one guard, task 2), lane L’s `levelPack.js`, `levelScene.js`, `levelStream.js` beyond the two calls (`addCell`/`removeCell` mirrored to `levelPhysics`), nor any site file.
- **Lane L is running at the same time** on `claude/bf2017-l-hoth`. Its task 4 writes `collision.js`’s `solidsOf` for the walker; this lane writes `havok.js`’s `solidsOf` and `createLevelCollision`. If lane L’s PR is on `main` when you reach task 4, build on its file; if not, create `collision.js` with both halves and tell the hand-off, and lane L merges onto it. Never two `solidsOf`.
- The pack’s physics section is the spec’s §1 shape, keys sorted, every number metres, the site’s frame (the pack’s `origin` and `yaw` already applied by lane L to the instances; the shapes stay in the mesh’s frame).
- `src/lib/physics/` stays pure (no three.js, no DOM), tested against the real engine; Rapier imported only in `world.js`; a moving body never a trimesh; a hull at most 64 points.
- Files under 800 lines; British spelling and curly quotes in prose; commits one plain sentence with the session’s attribution lines; merge commits, never force-push. Before the PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Review Focus

1. **Quantisation undone**: a physics GLB’s node carries a scale of about 3e-5 and a translation; a reader that takes `POSITION` raw gives shapes a few millimetres wide. Task 1’s test reads the snow-pile fixture and asserts its hull’s bounds match `physics.jsonl`’s `min`/`max` within 1 cm.
2. **Mirrored instances**: a negative x scale turns a hull inside out and a trimesh’s winding; Rapier’s hull does not care, its trimesh does (one-sided contacts off by default, but the normal flips). `instanceBody` flips the winding and the test asserts a ray from above a mirrored floor hits it with an upward normal.
3. **Shared trimeshes**: the same mesh placed 300 times (Hoth’s corridor pieces) must not build 300 `TriMesh` shapes; `cellBodies` reuses one collider description per mesh and `world.js` passes the same typed arrays, and `stats()` counts unique shapes beside colliders.
4. **A cell removed mid-step**: `removeCell` during `onSubstep` must defer as `world.js` defers a body removed from `onHit`; the test removes a cell from inside a substep hook and asserts no throw and no body left.
5. **The heightfield’s holes**: a 0 pixel in the near map is a hole; `setTerrain` reads the far map there (the `image` layer does) and never writes a 0 m floor under a tunnel mouth; the test samples the fixture’s hole.

---

### Task 1: The reader and the pack

**Files:**
- Create: `scripts/lib/bf2017-physics.mjs`, `scripts/lib/bf2017-physics.test.mjs`, `scripts/bf2017-physics.mjs`
- Create fixtures: `scripts/fixtures/bf2017/physics/Arctic_CorridorSnowPile_01_Physics_Win32.glb` (one hull, 2.1 KB), one two-root compound under 20 KB (pick from `Objects/Props` with a `root0_StaticCompoundShape` and a `root1_CompressedMeshShape`; the decal plane `_Decals/DecalPlane256_01` is 3.7 KB and has both, but its mesh root is visual-only (`userData 0xFFFF0000`), which is itself a good case), one capsule-bearing asset under 20 KB; their `physics.jsonl` lines in `physics.jsonl`; a `level.json` + two cell bins from lane L’s fixture (`scripts/fixtures/bf2017/web/maps/fixture_01/` if on `main`, else a four-instance pack of your own: two of the snow pile, one mirrored, one of the compound)

**Interfaces:**
- Produces:
  - `readPhysicsGlb(buffer, record) → { shapes: [{ kind: 'hull' | 'mesh' | 'capsule' | 'sphere', root, part, instance, material, points: Float32Array, indices?: Uint32Array, radius?, a?, b? }], dropped: [{ node, why }] }` (pure; the node scale and translation applied; a capsule’s ends and radius from the record’s `roots[].min/max` and `maxConvexRadius` when the leaf is `capsule`; a mesh root’s leaves tagged `0xFFFF0000` dropped as visual-only).
  - `reduceHull(points, max = 64) → Float32Array` (farthest-point sampling; the test asserts the box volume within 2% on the fixture).
  - `packShapes(shapes) → ArrayBuffer` and `readShapes(buffer) → shapes` (round trip; the bin’s header `{ magic 'BFPH', version 1, count }`).
  - `cellIndex(pack, cells, physicsByMesh) → { "cx,cz": { instances: [{ mesh, index }], colliders, triangles } }`.
  - CLI `node scripts/bf2017-physics.mjs <pack dir> [--cell 128] [--dry]`: reads the pack’s `level.json`, fetches each mesh’s physics GLB and record (through the fetch, cached under `lab/assets/bf2017/physics/`), writes `physics/<mesh>.bin`, `physics/cells/*.bin` and the `physics` section into `level.json`, prints a table (meshes with shapes, hulls, mesh triangles, capsules, dropped, bytes, the heaviest ten cells) and writes it into the pack’s `README.md`.

- [ ] **Step 1: Failing tests**: the snow pile reads one hull whose bounds match its record within 1 cm; the compound reads its convex root and drops its visual mesh root with a reason; a capsule reads `a`, `b`, `radius`; `reduceHull` of 200 points gives 64 within 2% of the box volume; `packShapes`/`readShapes` round-trip; `cellIndex` puts the four instances in their cells with the right counts.
- [ ] **Step 2: Run** `npx vitest run scripts/lib/bf2017-physics.test.mjs` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Try it** on Hoth’s pack if lane L’s is on `main` (or the `--dry` run over the map’s mesh list with the fetch): expect about 600 meshes, most under 2 KB of shapes, the hangar interiors as mesh kinds, under 6 MB in all. Put the table in the PR.
- [ ] **Step 6: Commit** `The game’s shapes read from its physics files and packed beside the level`.

### Task 2: `havok.js`, the shapes as bodies and as solids

**Files:**
- Create: `src/lib/physics/havok.js`, `src/lib/physics/havok.test.js`
- Modify: `src/lib/physics/world.js` (one guard: a `hull` collider of more than 64 points throws a plain message before anything is added; its header gains the line)

**Interfaces:**
- Produces:
  - `collidersOf(shapes, { statics = true, materials }) → collider[]` in `world.js`’s form: `hull` → `{ shape: 'hull', args: points }`, `mesh` → `{ shape: 'trimesh', args: [points, indices] }` (statics only), `capsule` → `{ shape: 'capsule', args: [halfHeight, radius], position, rotation }`, `sphere` → `{ shape: 'ball', args: [radius], position }`; each with `tag: material` and the material’s `friction`/`restitution` when `materials` has it.
  - `instanceBody(colliders, { position, quaternion, scale }) → desc` (fixed; a negative determinant flips hull points along the mirrored axis and reverses trimesh winding; a non-uniform scale scales points).
  - `cellBodies(pack, cellKey, cellBin, instances, shapesByMesh) → desc[]` (one body per placed instance that has shapes; descriptions share each mesh’s typed arrays).
  - `budgetCell(descs, { colliders, triangles }) → { kept, dropped: [{ mesh, hulls, triangles }] }` (lightest hulls first by their box volume; trimeshes never dropped before every hull is).
  - `solidsOf(shapes, { position, quaternion, scale }) → [{ type: 'box', x, z, hw, hd, yaw, top } | { type: 'circle', x, z, r, top }]` for `walker.js`’s `createSolids` (a hull’s footprint on the ground plane as its oriented box; a capsule standing up as a circle; `top` the shape’s height so a low one can be stood on).

- [ ] **Step 1: Failing tests** (against the engine, `createPhysics` in Node): the snow pile at the origin stops a ray from above at its top within 2 cm; a mirrored floor fixture gives an upward normal; two instances of one mesh share one shape (count `world.colliders.len()` and the unique shapes in `stats`); `budgetCell` with a limit of one collider keeps the trimesh and drops the hull; `solidsOf` of a 2 × 1 m hull turned 30° gives a box with that yaw; the 65-point hull throws.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `npx vitest run src/lib/physics` green.
- [ ] **Step 5: Commit** `A packed shape is a body in the physics world, or a box for the walker`.

### Task 3: The stream, and the heightfield

**Files:**
- Create: `src/components/galaxy/surface/level/levelPhysics.js`, `levelPhysics.test.js`
- Modify: `src/components/galaxy/surface/level/levelStream.js` (lane L’s: `onCell`/`onCellGone` also call `levelPhysics.addCell`/`removeCell` when present; if lane L is not on `main`, write the two lines in the hand-off for lane L to take)

**Interfaces:**
- Produces: `createLevelPhysics({ physics, pack, loadBin, budget = { colliders: 400, triangles: 60000 }, cellSize = 128 }) → { addCell(key, drawBin), removeCell(key), setTerrain(layer) (the `image` layer: a heightfield per 64 m over the near map’s cover, `heightfield.js`’s `addHeightfield`, a hole read from the far map), stats() → { cells, bodies, colliders, uniqueShapes, triangles, dropped, stepMs }, dispose() }`. A cell’s shapes bins are fetched through `loadBin` (lane L’s fetch with the pool) once per mesh and cached; a cell arriving after `dispose()` adds nothing; a cell removed from inside a substep is removed after it.

- [ ] **Step 1: Failing tests** with a fake `loadBin` and the engine: a cell added gives bodies and `stats().cells` 1; removed, 0; over budget, the dropped list names the lightest hull; `setTerrain` on a 9 × 9 fixture gives a floor a ray finds at the known height and reads the far height at the hole; a cell after `dispose()` adds nothing; a removal from a substep hook leaves nothing and throws nothing.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A cell’s shapes come and go with its draws; the ground is a heightfield of the same heights`.

### Task 4: `collision.js` and the call site

**Files:**
- Modify or create: `src/lib/level/collision.js` (+ test): `createLevelCollision({ pack, physics, loadBin, tier }) → { solids: [...] (walker form, from `solidsOf` over the far list’s instances when there is no engine), floors, physics: levelPhysics | null }`; lane L’s `solidsOf(pack, cells)` becomes a call into `havok.js`’s per-instance `solidsOf`
- Modify: `src/components/galaxy/surface/scene.js` (where lane L makes `createLevel`: `const physics = !small && tier !== 'low' && pack.physics ? await createPhysics({ gravity: -15.5 }) : null;` passed to `createLevelCollision`; `physics.step(dt)` in the frame before the walk; `physics.dispose()` in dispose; `__surfaceScene.physics()` returning `stats()` under `?debug`), `scripts/galaxy-check.mjs` (prints the physics stats row when `__surfaceScene.physics` exists)

- [ ] **Step 1: Failing tests**: without an engine the far list’s instances become walker boxes (a point inside a hull’s footprint is pushed out by `pushOut`); with one, `physics` is the stream and `solids` is empty.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `npm test` green.
- [ ] **Step 5: See it**: dev server, `?debug#/galaxy/hoth/surface` (lane L’s Hoth on `main`; else the fixture world under a dev route is enough for the PR and the hand-off says so): `__surfaceScene.physics()` shows cells and colliders rising as you walk; `node scripts/galaxy-check.mjs surface hoth` under `BUDGET=1` at mid, high and ultra with the physics row; the step under 2 ms on the container. Evidence into `docs/superpowers/evidence/bf2017-physics/p0/`.
- [ ] **Step 6: Commit** `The level’s collision: the engine’s bodies where it loads, the walker’s boxes where it doesn’t`.

### Task 5: The PR and the hand-off

- [ ] The gates; `public/github.json` and `CREDITS.md` restored as their scripts write them; the lane’s section in `docs/superpowers/HANDOFF-bf2017-physics.md` (Done, Left, the numbers, what lane L must take if its PR landed second); merge `origin/main`, push, PR `The game’s shapes are the galaxy’s collision: packed with the level, streamed by cell, boxes for the walker`. Merge per the slot (`docs/superpowers/…merging rules`: a PR, a merge commit on `origin/main`).
