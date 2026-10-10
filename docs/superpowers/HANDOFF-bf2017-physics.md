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

Your task 4’s `src/lib/level/collision.js` is split: you keep `solidsOf(pack, cells)` for the walker and the one call site in `scene.js`; lane P0 writes `createLevelCollision` (the engine’s side) and `havok.js`’s per-instance `solidsOf` that yours calls, plus the pack’s `physics` section and `physics/*.bin` through `scripts/bf2017-physics.mjs` (call it from `bf2017-level.mjs` after the meshes, or leave it to P0 to call on your pack). Your `levelStream.js`’s `onCell`/`onCellGone` get two mirrored calls into `levelPhysics` when it exists. Whoever merges second takes the other’s file.

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
| P0 | | `claude/bf2017-p0-shapes` | | |
| P1 | | `claude/bf2017-p1-body` | | |
| P2 | a desktop session (the export read locally) | `claude/bf2017-p2-bolts` | PR_NUMBER | |
| P3 | | `claude/bf2017-p3-vehicles` | | |
| P4 | | `claude/bf2017-p4-surfaces` | | |

Each lane adds its Done and Left here when it merges: the pack’s physics bytes per world, what the budget dropped per cell, the jump row’s source, which material indices were named by hand and from which effect, what the handling layer did not hold.

### Lane P2: bolts, blasts, hit zones, ragdolls (2026-10-10)

**Done.**
- `scripts/lib/bf2017-physics-rules.mjs` (created here, P1 not yet on `main`: P1 merges its soldier builder in beside these and keeps the file’s `loadAsset`/`deref`/`checkSources`, or swaps all of them for lane 0’s `bf2017-ebx.mjs`): `projectileRow`, `projectileRulebook`, `boneSetRow`, `ragdollRow`, `shareBodies`, `physicsRulebooks`, `refused`; its tests are `bf2017-physics-rules.bolts.test.mjs` so P1’s `bf2017-physics-rules.test.mjs` does not collide. `scripts/bf2017-bolts-data.mjs --root <export>/web` writes the three files.
- `src/data/bf2017/physics/projectiles.json` (333 rows: the 114 blueprints less 14 refused, and 233 bolts, which are `WSBulletEntityData` containers, not blueprints; 397 KB, imported by no page), `bones.json` (10 sets, 112 KB; the surface fetches it as its own 3.9 KB-gzip chunk the first time a figure on the game’s skeleton is in the way), `ragdoll.json` (48 rows, 144 KB: 39 heroes share the human’s bodies through `bodiesOf`); `NOTES.md` says what the records hold and do not (grenades have no `RigidBodyData`; two components give one body to two bones).
- `src/lib/combat/ballistics.js`: `flight` (the exact solution of `dv/dt = g − k·v`, so a flight lands within millimetres at 1/30 and 1/120; with no gravity and no drag the same positions as `bolt.js` to 1e-9), `launch`, `arc`. `bolt.js` takes an optional `ballistic` row (its own tests untouched and green).
- `src/lib/physics/blast.js`: `applyBlast` (falloff from `inner` to `radius`, the line of sight on the world’s ray, the shockwave’s kick to ragdolls) and `segmentRay(physics)`, a segment ray in `bolt.js`’s solids form over any `world.js` world.
- `src/lib/physics/boneCapsules.js` (`capsulesOf`, `regionsOf`, `figureCapsules`, `isGameSkeleton`, `regionOf`) and `hurtbox.js` back from #781’s branch as it was (its engine tests need P1’s `character.js`; the test here uses a stand-in body until then).
- `src/lib/three/ragdoll2017.js`: `rig2017` over `ragdollPhysics.js` (which gained an optional `table`, Meshy’s by default), the impulse allowance (`maxImpulse` spent and restored over `impulseLifetime`), `ragdollOf`, `floorCollide`.
- The surface: `blaster.js` flies against `world.physicsRay` when a world has one (P0’s level world sets it; `segmentRay` is one) and takes a `ballistic` row for your bolts; `boltPlay.js` hits a figure on the game’s skeleton by the game’s capsules and names the bone and the reaction on the hit.

**Left.**
- P0: set `world.physicsRay` (a budgeted `queries.ray` in `bolt.js`’s solids form) on a level world; `blaster.js` picks it up.
- Lane 1: its figures through `boltPlay.js` (automatic once `fig.bones` carries `Head`, `Spine`, `Spine1`/`Neck`) and `rig2017` where the surface makes a ragdoll today (`ground/groundFigures.js`: `rig2017(bones, ragdollOf(book, 'stormtroopershared'), …)` for a figure on the game’s skeleton, `rigRagdoll` otherwise; a blast’s `kicked` list wants `rag.kick`).
- No surface page passes a row yet: the rifle’s (`blasterprojectile_blasterrifle_a295`: gravity 0, drag 0, ttl 3) would fly exactly as today, so the first row that shows is a thrown grenade, which wants a throw (the game’s grenade `InitialSpeed` is a placeholder 350; the throw is the weapon’s) and a body (the world’s mass: the record has none).
- The Battlefront game (#812’s lane 5): `flight` for its sim’s projectiles, `applyBlast` for grenades, `capsulesOf` for hits, `rig2017` for the dead.

