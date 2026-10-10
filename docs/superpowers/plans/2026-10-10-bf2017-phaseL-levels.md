# Battlefront 2017 pipeline, lane L: the worlds on the game's levels. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Each Star Wars world the game has is the game's own level: its layout from the map's 24,000 placed instances, its ground from the game's heightmap, its collision from the game's shapes, cell-streamed round the visitor inside every budget row at every tier, Hoth first, one world per PR.

**Architecture:** A build script turns a map, its terrain and its physics into a level pack (`level.json`, one `.bin` per 128 m cell, one GLB per mesh cut, shared KTX2 textures, two heightmaps); the pack is served by hash through `src/lib/assetBase.js`. A lane-owned `surface/level/` draws it: pure `levelPack.js` decides which cells and cuts a position wants per tier and what to drop to fit the row; `levelScene.js` draws one `InstancedMesh` per draw; `levelStream.js` fetches far-first and aborts on leave. The ground is a new `image` layer in `lib/land/layers.js` so `terrain.js`, `ground.js` and the flight read the same heights.

**Tech Stack:** Node 22, `@gltf-transform/{core,extensions,functions}`, `meshoptimizer`, `sharp` (16-bit PNG in and out), `scripts/ktx2.mjs` (gains `--drop-mips`), phase 0's `scripts/lib/bf2017-*`, three.js (`InstancedMesh`, `PMREMGenerator`), Vitest, Playwright through `scripts/galaxy-check.mjs`, `scripts/surface-shot.mjs`, `scripts/hoth-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-levels-lighting-sabers-design.md` ("How a level draws"); the map format `web/maps/README.md` in the bucket (`node scripts/bf2017-fetch.mjs --raw maps/README.md`); the terrain record shape in `web/terrain.jsonl`; `docs/superpowers/evidence/bf2017-assets/inventory.md` ("Update, 2026-10-10 00:20").

## Global Constraints

- Phase 0's Global Constraints (keys from the environment, `lab/assets/bf2017/` for fetched files, the sequel list, the credit text, the gates).
- **Files this lane owns**: `scripts/bf2017-level.mjs`, `scripts/lib/bf2017-level.mjs` (+ test), `scripts/lib/level-cells.mjs` (+ test), `src/lib/land/layers.js` (the `image` layer only, + test), `src/components/galaxy/surface/level/*` (+ tests), `public/models/galaxy/bf2017/levels/<world>/`, `sites/<file>.js` for the world being shipped (its `level`, `ground`, props and zones; not its `life`), `scripts/assets-upload.mjs` (`REMOTE` gains `models/galaxy/bf2017`). It does not touch `actors.js`, `placer.js`, `crew*.js`, `walrus*.js`, lane G's `gameLight.js` or `scene.js` beyond one call site (`createLevel(...)` where `createPlacer` is made, and its `update`/`dispose`).
- **The pack's shape** is the design's `level.json`; keys sorted; `cell` 128; `arena` the half-size the `--arena` flag gives (default 1024 m: the site's walkable `HALF` is 640 and the ring beyond it is seen, not walked); every number metres, +y up, the site's frame (the map's point `--spot` becomes `0, 0`, its ground height becomes `y = 0`).
- **Cuts** from the chain by phase 0's `cutsFor`: `far` the last LOD with ≤ 700 triangles (else the last), `lod1` ≤ 2,500, `plain` ≤ 12,000, `ultra` LOD0 only with `--ultra`. Textures: the bucket's KTX2 as they are, mips dropped to 512 / 1024 / 1024 / 2048 by tier (low / mid / high / ultra); never re-encoded; shared per game material.
- **Bands** from `src/lib/budgets.js`'s row: `plain` within `near`, `lod1` to `mid`, the `far` list beyond; low and mid tiers take `lod1` within `near`. **Load order**: `level.json`, `terrain/near.png`, the `far` list and its meshes (walkable under 4 MB on high), then near cells nearest first, then the ring. Every fetch through `assetBase.js` with lane S's pool when it is on `main` (else `fetch` with one `AbortController` per world).
- **Rows do not move.** `fitTo(row)` drops the lightest draws per cell until the near set is within 70% of the row's triangles and calls and the far list within 20%; the PR's table says, per tier, what was dropped. `galaxy-check.mjs surface <world>` under `BUDGET=1` at low, mid, high and ultra is the gate; `renderer.info.memory.textures` under 256 MB desktop and 128 MB phone, written in the evidence.
- **The site's world stays**: `life`, missions, zones, weather, the walkable square. The landing spot is `--spot`, chosen inside the playable arena at a place the site's missions already use (Hoth: the hangar mouth).
- Files under 800 lines, pure logic tested beside it, no network in tests; the gates: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Review Focus

1. **The map's sub-levels**: `Lobby`, `EOR`, `Cinematics`, `Outro_*`, `HeroArena`, `FantasyBattle`, `GameModes_Automation`, `HvsVIntro`, `LobbySplitScreen`, `TeamDeathmatch*` are not the arena; a pack that includes them draws the lobby's set dressing in the middle of Echo Base. `--subs` defaults to the main sub (the level's own name) plus `Content`; the test feeds a two-sub fixture and asserts the lobby's instances are left out.
2. **Mirrored instances** (negative x scale): an `InstancedMesh` with a negative-determinant matrix draws inside out unless the material is `DoubleSide` or the mesh is flipped; the pack marks a draw `mirrored` and `levelScene.js` gives those their own draw with `FrontSide` swapped (test on a fixture with one mirrored instance: the normal's winding).
3. **Quaternion packing**: Int16 / 32767, xyzw; a sign slip rotates every tree. `levelPack.js`'s `readInstances` is tested against three known transforms written by the fixture.
4. **The far list on the first frame**: the world must be walkable (the HUD's gate lifts) before any near cell has arrived; `levelStream.js`'s test resolves the far fetch and asserts `ready()` is true with zero near cells, and that a near cell arriving after `dispose()` adds nothing.
5. **Heights in two maps**: `near` at 1 m a pixel covers the arena; `far` at 2 m covers 8 km; the seam must match within 0.5 m where both cover (the `image` layer's test samples a point inside both and asserts the difference); the `holePixels` of a record are NaN in the PNG's lowest value and must read as the far map's height, not zero.

---

### Task 1: The `image` ground layer

**Files:**
- Modify: `src/lib/land/layers.js` (+ `layers.test.js`); `src/components/galaxy/surface/terrain.js` (reads the layer through `LAYERS` as any other)

**Interfaces:**
- Produces: `LAYERS.image = { height(x, z, layer) }` where `layer = { near: { data: Float32Array | Uint16Array, w, h, minX, minZ, metresPerPixel, scale, offset }, far: { … } }`: bilinear in `near` where it covers, else `far`, else 0; a hole (the record's lowest value) falls through to the next map. `imageLayerFrom(record, nearPixels, farPixels)` builds one from the terrain record and decoded pixels. `decodeHeights(png16: Uint16Array, scale, offset) → Float32Array` (pure).

- [ ] **Step 1: Failing tests**: a 3 × 3 near map over a 5 × 5 far map; a point inside both reads the near value; a point outside near reads far; a hole in near reads far; bilinear between two texels is the mean; `decodeHeights` of `[0, 65535]` with `scale 1024` gives `[offset, offset + 1024]`.
- [ ] **Step 2: Run** `npx vitest run src/lib/land/layers.test.js` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `npm test` green (the galaxy's existing worlds have no `image` layer and read as before: `sites.test.js` unchanged).
- [ ] **Step 5: Commit** `The ground can be an image: a heightmap layer beside the site's own`.

### Task 2: The pack builder

**Files:**
- Create: `scripts/bf2017-level.mjs`, `scripts/lib/bf2017-level.mjs`, `scripts/lib/bf2017-level.test.mjs`, `scripts/lib/level-cells.mjs`, `level-cells.test.mjs`, `scripts/fixtures/bf2017/web/maps/fixture_01/fixture_01.json` + `.bin` (two subs, three meshes, one mirrored instance, under 4 KB), `scripts/fixtures/bf2017/web/terrain/fixture_01/` (a 9 × 9 16-bit PNG record)
- Modify: `scripts/bf2017-fetch.mjs` (`--raw <bucket path>` fetches one object; `--all 'maps/levels/mp/hoth_01/*'`), `scripts/ktx2.mjs` (`--drop-mips <n>`: rewrites a KTX2 keeping levels from `n`), `scripts/assets-upload.mjs` (`REMOTE`)

**Interfaces:**
- Produces:
  - `readMap(json, bin) → { instances: { position: Float32Array, quaternion: Int16Array, scale: Float32Array, count }, groups, meshes, subworlds, terrain, sky, vehicleSpawns }` (pure).
  - `arenaOf(map, { subs }) → instance index list` (the subs' groups only).
  - `rebase(instances, origin, yaw) → instances` in the site's frame.
  - `cellsOf(instances, meshes, { cell = 128 }) → Map<'cx,cz', { draws: [{ mesh, indices, mirrored }], bounds }>`; `weightOf(draw, mesh) → number`; `fitTo(cells, row, { share = 0.7 }) → { kept, dropped: [{ mesh, count, tris }] }`.
  - `packCell(cell, instances) → { bin: ArrayBuffer, draws: [{ mesh, offset, count, mirrored }] }`.
  - CLI `node scripts/bf2017-level.mjs <map name> --world <id> --spot <x> <z> [--subs a,b] [--arena 1024] [--ultra] [--dry]`: fetches the map, its terrain, every mesh at the cuts and every texture the GLBs reference (through the fetch's pool), writes the pack, prints a table (cells, instances kept and dropped per tier, meshes, GLB and texture bytes per tier, the far list's bytes), writes the credit rows (`catalog-write.mjs`, one `level-<world>` credit) and `public/models/galaxy/bf2017/levels/<world>/README.md` with the table.

- [ ] **Step 1: Failing tests** on the fixture: `readMap` counts; `arenaOf` leaves the lobby out; `rebase` puts the spot at the origin and the ground at 0; `cellsOf` puts the three instances in the right cells and marks the mirrored one; `fitTo` on a row of 10 triangles drops the lightest draw first; `packCell` round-trips through `readMap`'s reader; the image layer built from the fixture's record reads the known height at the spot.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Try it** (keys in the environment): `node scripts/bf2017-level.mjs levels/mp/hoth_01 --world hoth --spot <the hangar mouth: read the map's `vehicleSpawns` for the tauntaun pens near 217, 341, -1466 and pick the hangar's door from the hangar system pieces' bounds> --dry`, then for real. Put the table in the PR. Expect: about 600 meshes, 24,000 instances, the near set at high under 2.1M triangles and 490 calls, the far list under 4 MB.
- [ ] **Step 6: Commit** `A level pack from the game's map, terrain and shapes: cells, cuts, shared textures, the ground as an image`.

### Task 3: The level in the scene

**Files:**
- Create: `src/components/galaxy/surface/level/levelPack.js` (+ test), `levelScene.js` (+ test with a fake renderer), `levelStream.js` (+ test with a fake fetch), `index.js`
- Modify: `src/components/galaxy/surface/scene.js` (one call site: `createLevel({ scene, site, tier, assetBase, signal })` beside `createPlacer`; `level.update(camera)` in the frame; `level.dispose()` in dispose), `src/components/galaxy/surface/sites/ice.js` (`hoth.level = 'hoth'`, `hoth.ground = { layers: [{ type: 'image', pack: 'hoth' }], flats: [...] }`, the built props and `echoLayout` removed for Hoth), `src/components/galaxy/surface/walker.js` (solids from the pack's collision bounds and floors: additive, through the existing solids list)

**Interfaces:**
- Produces:
  - `levelPack.js`: `bandsFor(row) → { near, mid, horizon }`; `wanted(pack, position, tier) → { near: keys[], mid: keys[], farList: boolean }`; `cutFor(draw, band, tier) → 'plain' | 'lod1' | 'far' | 'ultra'`; `fitTo` reused from the script's module (moved to `src/lib` if the script and the scene both need it: `src/lib/level/fit.js`, pure).
  - `levelScene.js`: `createLevelScene({ scene, pack, loadGltf, tier }) → { addCell(key, bin), removeCell(key), setFar(bin), update(camera), stats() → { tris, calls, cells }, dispose() }`: one `InstancedMesh` per draw, shared materials, bounds per cell, frustum culled, near band casts shadows, `mirrored` draws with their own side.
  - `levelStream.js`: `createLevelStream({ pack, fetch, wanted, onCell, onFar, signal }) → { update(position, tier), ready(), progress(), dispose() }`: far first, then near nearest first, then mid; a cell more than two away is dropped; every fetch aborted at dispose.

- [ ] **Step 1: Failing tests**: `wanted` at the origin on high gives the 3 × 3 near keys and the 7 × 7 mid ring; on low the near set is `lod1`; `createLevelScene` with the fixture's pack adds one `InstancedMesh` per draw with the right counts and the mirrored draw's side; `createLevelStream` with a fake fetch resolves the far list first (`ready()` true, no near cell), a near cell after `dispose()` adds nothing, a cell left three cells behind is removed.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** and wire Hoth. **Step 4: Run** → PASS; `npm test` green.
- [ ] **Step 5: See it**: dev server, `#/galaxy/hoth/surface`; the hangar is the game's, the ridges are the game's, the ground is the heightmap with the site's pad flat; `__surfaceDo('teleport', …)` across the arena shows cells arriving and going; `node scripts/hoth-check.mjs` green (nothing built where the game has a piece); `node scripts/galaxy-check.mjs surface hoth` under `BUDGET=1` at every tier; `anim-check` on Hoth's people; before/after `surface-shot.mjs` sheets into `docs/superpowers/evidence/bf2017-levels/hoth/`.
- [ ] **Step 6: Commit** `Hoth is the game's Hoth: the level pack drawn by cell, the ground its heightmap`.

### Task 4: Collision and the flight

**Files:**
- Modify: `src/components/galaxy/surface/walker.js` (floors and solids from the pack: additive), `src/lib/land/flight/planetSpec.js` (Hoth's spec gains the `image` layer so `/fly/hoth` shows the same ground; `TERRAIN_VERSION` bumped: `supabase/README.md`'s rule), `scripts/supabase-seed.mjs` run and `seed.sql` regenerated
- Create: `src/lib/level/collision.js` (+ test): `solidsOf(pack, cells) → [{ box | triangles }]` from the meshes' collision bounds and floor triangles; `rapierShapes(pack, mesh)` from the Havok record when the Rapier lane's `lib/physics/fromModel.js` is on `main` (else the trimesh)

- [ ] **Step 1: Failing tests**: a floor piece's triangles become a walkable floor (`walker.test.js`'s pattern: a point over it stands on it); a wall piece is a solid you stop at; the flight's cell reads the image layer at a known point.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /fly/hoth,/galaxy/hoth/surface`.
- [ ] **Step 5: Commit** `You walk on the game's floors and stop at its walls; the ship flies over the same ground`.

### Task 5: The PR, the hand-off, the next world

- [ ] The gates; the regenerated files restored (`public/github.json`, `CREDITS.md` as the credits script writes it); the lane's section in `docs/superpowers/HANDOFF-bf2017.md` (Done: Hoth; Left: the next world in the design's order, what `fitTo` dropped, the Rapier shapes when #781 lands; Checking it: the commands above); `assets-upload.mjs --dry` output in the PR (the pack's bytes); merge `origin/main`, push, PR `Hoth on the game's level: Echo Base and the ridges as the game placed them, cell-streamed`. MERGE per the slot, then Endor on a fresh branch from `main`, the same five tasks, one PR per world.
