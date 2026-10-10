# Hand-off: the galaxy’s physics from the Battlefront II (2017) data

The design: `docs/superpowers/specs/2026-10-10-bf2017-physics-design.md`. The plans: `docs/superpowers/plans/2026-10-10-bf2017-phaseP0-shapes.md`, `-phaseP1-body.md`, `-phaseP2-bolts-ragdolls.md`, `-phaseP3-vehicles.md`, `-phaseP4-surfaces.md`. Beside it: the asset pipeline (`HANDOFF-bf2017.md`: lanes 1, L, G, K, X, S, V), the game (`HANDOFF-battlefront.md`: lanes 0 to 7), and the Rapier library’s own hand-off on the closed branch `claude/wizardly-franklin-ws9uza` (`HANDOFF-rapier-body.md` there; PR #781, closed 2026-10-10 so the galaxy surface would take its physics from the drop, which is what these lanes do).

## What was found (2026-10-10, the desktop export)

- 10,530 Havok shape sets, 114,377 shapes (102,604 convex, 10,444 trimesh, 977 capsules, 198 spheres), 9.05 M triangles, 123 MB of quantised meshopt GLB, one node per shape with its class, part, instance and material index in the node’s extras; the map’s static instances were read out of the same Havok resources, so a model’s shapes at its instance transform are the game’s collision exactly.
- `CharacterPhysicsData` (13): the soldier’s capsule r 0.3, stand 1.7 / crouch 1.15, step 0.4 / 0.3, 45° to climb and to slide, walk 5.0, sprint 7.5, back 0.8, crouch 3.0, the gains, the slide’s gravity 0.34, the ground rays.
- `SkeletonCollisionData`: capsules per bone (the head r 0.16); `WSEACharacterPhysicsComponentData`: 15 ragdoll bodies, `MaxImpulse` 1000; `ProjectileBlueprint` (114): speed, gravity, drag, life, impulse, blast radii; `VehicleBlueprint` (159): masses, thresholds, crashed parts; `MaterialGridData` (44): per-pair damage, effects by speed, sounds, decals, footprints.
- Not there: material names, cloth (an EA binary), the solver itself, audio, props’ destruction graphs (not surveyed).

## The lanes

| lane | plan | what | starts from | blocked by |
| --- | --- | --- | --- | --- |
| P0 | `-phaseP0-shapes.md` | the shapes read, packed with the level, streamed as colliders by cell, the heightfield, the walker’s boxes | `main` | nothing (a fixture pack until lane L is on `main`) |
| P1 | `-phaseP1-body.md` | the #781 library back; the soldier rulebook; the player on the controller | `main` | P0 for task 4 |
| P2 | `-phaseP2-bolts-ragdolls.md` | ballistics, blasts, bone capsules, the ragdoll | `main` | P0 for the ray; lane 1 for a figure on the game’s bones |
| P3 | `-phaseP3-vehicles.md` | vehicle bodies, feet, debris, the rides on the walls | `main` after P0 and lane V | P0, lane V |
| P4 | `-phaseP4-surfaces.md` | the material grid; effects and prints by material | `main` | P0 for task 3 |

One lane per session. P0, P1, P2 and P4 run at once (no shared file: P1 creates `scripts/lib/bf2017-physics-rules.mjs` and P2 adds named exports to it; whoever lands second merges). P3 waits.

## For lane L (PR #810’s session on `claude/bf2017-l-hoth`)

As built (PR #831 and lane P0): lane L’s `src/lib/level/collision.js` and `level/colliders.js` stay lane L’s; lane P0 adds `levelPhysics.js` beside `colliders.js` (the same `add`/`drop`), `lib/level/shapeSolids.js` (the walker’s boxes from the shapes, in `collision.js`’s `{ floors, boxes }` form) and the pack’s `physics` section through `scripts/bf2017-physics.mjs`. The joins (`level/index.js`’s `onCell`/`onDrop`, `scene.js`’s engine, `colliders.js` taking the shapes) are in P0’s Left below; whoever merges second makes them.

## For the game (PR #812’s lanes)

`loadPhysics(name)` is lane P0’s `readShapes` over the bucket’s GLB through `readPhysicsGlb` (`scripts/lib/bf2017-physics.mjs`) or, in the browser, over a pack’s `physics/<mesh>.bin`; the hulls and trimeshes are `havok.js`’s `collidersOf`. The soldier’s movement rows are `src/data/bf2017/physics/soldier.json`; the projectiles’ `projectiles.json` and `lib/combat/ballistics.js`’s `flight`; the capsules `boneCapsules.js`; the ragdoll `ragdoll2017.js`; the vehicles `vehicleBody.js`; the surfaces `materials.js`. Build on them; add a row to the Departures in the spec if one does not fit.

## Checking it

- Pure: `npx vitest run src/lib/physics src/lib/combat src/lib/three/ragdoll2017.test.js scripts/lib/bf2017-physics.test.mjs scripts/lib/bf2017-physics-rules.test.mjs scripts/lib/bf2017-materials.test.mjs src/data/bf2017/physics`.
- In a browser: `node scripts/physics-check.mjs hoth` (P1 writes it; P3 and P4 add steps), `node scripts/galaxy-check.mjs surface hoth` under `BUDGET=1` at every tier (the physics row), `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.
- The keys: `SUPABASE_URL` and `SUPA_KEY` (or `BF2017_KEY`) in the environment (the cloud sessions have them; locally `.env.local`, never committed).

## Status

| lane | session | branch | PR | merged |
| --- | --- | --- | --- | --- |
| design | the architecting session | `claude/bf2017-physics` | (this PR) | |
| P0 | the P0 session (local, Opus 5.5) | `claude/bf2017-p0-shapes` | (P0’s PR) | |
| P1 | | `claude/bf2017-p1-body` | | |
| P2 | | `claude/bf2017-p2-bolts` | | |
| P3 | | `claude/bf2017-p3-vehicles` | | |
| P4 | | `claude/bf2017-p4-surfaces` | | |

Each lane adds its Done and Left here when it merges: the pack’s physics bytes per world, what the budget dropped per cell, the jump row’s source, which material indices were named by hand and from which effect, what the handling layer did not hold.

## P0, the shapes: Done and Left

**Done.**

- `scripts/lib/bf2017-physics.mjs` reads a physics GLB (the node matrices undo the quantisation; the snow pile’s hull lands on its record’s box within 1 cm), cuts a hull to 64 points, and packs a mesh’s shapes into `physics/<mesh>.bin` (`src/lib/physics/shapesBin.js`, pure, shared by the build and the page). `scripts/bf2017-physics.mjs <pack dir>` writes the bins and `level.json`’s `physics` section ({ version, materials, meshes by the pack’s mesh index, cells }); `--map levels/mp/hoth_01 --from <web_opt>` gives the table for a map before there is a pack. Fixtures: four GLBs under 4 KB and a five-mesh pack in `scripts/fixtures/bf2017/physics/`.
- `src/lib/physics/havok.js`: `collidersOf` (the material index as each collider’s `tag`; a hull over 64 points refused), `instanceBody` (a scale put into the points, kept per mesh and scale; a mirrored trimesh’s triangles turned round, tested by a ray’s normal), `cellBodies` (instances of one mesh share its arrays), `budgetCell`, `solidsOf` (the walker’s boxes and circles).
- `src/components/galaxy/surface/level/levelPhysics.js`, beside lane L’s `colliders.js` and in its pattern: `add(key, bin)` (the cell’s own bin, lane L’s 32-byte records, read with `pack.cells[key].draws`) and `drop(key)` (removed, not switched off: a body costs memory), a mesh the tier culls (`pack.cull[tier]`) left out, `update(ms)` putting bodies in a slice a frame, `setTerrain(heightAt)` (a heightfield per 64 m under every loaded cell), `stats()`, a drop from inside a substep deferred by `world.js`, and `wantsEngine` (the one rule: not a phone, not low, a pack with shapes).
- `src/lib/level/shapeSolids.js`: the walker’s side from the shapes, in lane L’s form (`{ floors, boxes }`, plus `circles` and the draws `without` shapes): each hull of each placed piece a box turned by its yaw, a thin wide one a floor at its top. `galaxy-check.mjs` prints a physics row when `__surfaceScene.physics` exists.
- Hoth, measured (`docs/superpowers/evidence/bf2017-physics/p0/hoth.md`), on the map and on lane L’s pack from PR #831 (a scratch copy): 432 of 602 meshes have shapes, 3,539 hulls and 236,905 trimesh triangles, **5.2 MB** of bins; the near 3 × 3 round the spot at high is 1,123 bodies and 6,160 colliders, in over 29 frames at under 5 ms each, 0.47 ms a step. Echo Base’s densest cell is 6,492 pieces and 12,796 shapes: 923 ms to add and 2.1 ms a step unbudgeted; at 1,000 colliders it keeps 97% of its hulls’ volume for 21 ms and 0.15 ms a step.

**What the survey changed (the spec’s Departures 8 to 11).**

- The mesh roots’ user data `0xFFFF00NN` is an index (NN runs 00 to 42 over Hoth), not a visual-only tag: every one of Hoth’s 240 `0xFFFF0000` mesh roots sits beside a convex root over the same piece. Both are kept (statics take both); the budget drops such a trimesh first, as the instance’s detail. `readPhysicsGlb(…, { dropVisual: true })` keeps the first reading for whoever wants it.
- The budget is 400 / 30,000 on mid, **1,000 / 60,000 on high, 2,000 / 100,000 on ultra** (the design said 400 for high and ultra): the table above.
- No `physics/cells/*.bin`: a cell’s draws already name their meshes, so `levelPhysics` reads the cell’s own bin (the map’s layout) and the pack’s `physics.cells` keeps only the counts.
- The 64-point guard is in `havok.js`, not `world.js`: the universe’s hulls come from models uncut and a throw there would be a new failure for them.
- A `convex_flat` leaf (4 on Hoth: the Falcon landmark, a bacta-tank wall) is read as a trimesh; Rapier builds no hull through points in a plane.

**Left.**

- **When both are on `main`** (lane L’s PR #831 and this; whoever merges second does it):
  1. Run `node scripts/bf2017-physics.mjs public/models/galaxy/bf2017/levels/hoth --from <web_opt>` (or with the keys) to fill `level.json`’s empty `physics` and write `physics/*.bin` (it reads `meshes[].name` and `cells[key].draws`); `bf2017-level.mjs` can call it after the meshes. Then `assets-upload.mjs` as lane L does.
  2. `level/index.js`: `createLevel({ …, physics })` takes the engine (`wantsEngine({ pack, small, tier }) ? await createPhysics({ gravity: -15.5 }) : null`, made in `scene.js` beside `createLevel`); once the pack is in, `const body = physics ? createLevelPhysics({ physics, pack, loadBin: fetchBytes, tier }) : null`; the stream’s `onCell: (key, bin) => { colliders?.add(key, pack, bin); body?.add(key, bin); }` and `onDrop: (key) => { colliders?.drop(key); body?.drop(key); }`; `update()` calls `body?.update(4)`; `dispose()` `body?.dispose()`; `stats()` gains `physics: body?.stats()`. `body.setTerrain((x, z) => LAYERS.image(x, z, layer))` with the layer `levelGround` decoded, so the floor is the ground drawn.
  3. `scene.js`: `physics?.step(dt)` (timed into `body.timed(ms)`) before the walk; `__surfaceScene.physics = () => gameLevel?.stats().physics`. With an engine, the walk world takes no level boxes (the body is P1’s, and until P1 the walker still walks: keep `colliders` on until P1 puts the player on the controller).
  4. `colliders.js` without an engine: for the draws whose mesh has shapes, `shapeSolids(draws, bin, shapesByMesh)` (shapes read ahead with `shapeReader(pack, loadBin)`), and lane L’s bounds rule (`solidsOf`) only for `without`; the 15 m skip goes, since a glacier’s hulls are its own.
- The walker’s fallback has no floors from trimeshes (a hangar’s shell isn’t a box): on a phone you walk on the heightmap and stop at hulls. Steep-triangle walls from the trimeshes are a later step if a mesh-only piece matters.
- In the browser on Hoth (`galaxy-check.mjs surface hoth` under `BUDGET=1` with the physics row) waits for lane L’s pack and the scene.js lines.
- Material friction and restitution: `physics.materials` lists each index used (`{ tag }`); P4 fills them and `collidersOf` already takes `materials[i].friction`/`restitution`.
