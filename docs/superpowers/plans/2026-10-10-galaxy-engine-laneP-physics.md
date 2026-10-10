# The galaxy's engine, lane P: the physics. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** On a world built from the game's level, the ground, every placed thing and every bolt are Rapier's: the terrain a heightfield per cell, the instances the game's own Havok hulls and trimeshes, the walker a kinematic character that climbs the game's stairs and slides on its ice, the bolts ray casts that hit what you see; all of it added and removed with lane L's cells, under the floating origin, and the walker's feel unchanged.

**Architecture:** New files in `src/lib/physics/` (pure, no three, no DOM, tested against the real engine in Node as `world.test.js` is): `level.js` makes a cell's fixed bodies from the pack's shapes, `terrain.js` the cell's heightfield from the `image` layer, `character.js` wraps Rapier's character controller, `shots.js` casts rays and shapes. `surface/walker.js` gains a `ground` adapter so a level world stands on the character and every other world on `heightAt` and `createSolids` as today.

**Tech Stack:** `@dimforge/rapier3d-compat@0.21.0` through `src/lib/physics/world.js` only (its header; the import stays dynamic and there); `src/lib/physics/{heightfield,vehicle,props}.js`; lane L's pack (`level.json`, `cells/*.bin`, `physics` per mesh) and `src/lib/level/collision.js`; `src/lib/land/layers.js` (`image`); Vitest; `scripts/galaxy-check.mjs surface hoth`; `scripts/surface-shot.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-galaxy-engine-design.md` ("The physics"); `docs/stack/physics-rapier.md` (the rules); `docs/superpowers/plans/2026-10-10-bf2017-phaseL-levels.md` (the pack, Task 4: collision).

## Global Constraints

- **Files this lane owns**: `src/lib/physics/{level,terrain,character,shots}.js` (+ tests), `src/lib/level/collision.js` (`rapierShapes`: shared with lane L; whoever is first writes it, the other reads it; tell L by the hand-off), `src/components/galaxy/surface/walker.js` (the `ground` adapter: additive; `WALK` untouched), `surface/rides.js` (the chassis numbers for level worlds: additive), `surface/scene.js` (one call site: `createLevelPhysics(...)` beside lane L's `createLevel`; `update` in the frame; `dispose`), `docs/stack/physics-rapier.md` ("Where it is used").
- **A moving body is never a trimesh** (`world.js`'s rule; Rapier issue #1027 is the panic that rule avoids). Placed instances are fixed bodies; the only dynamic bodies are the crates (`knocks.js`), the vehicle and the thrown things, all hulls or primitives.
- **Rapier is imported in `world.js` only**, dynamically; nothing here imports it. `preload()` is called when the ship starts down to a level world.
- **The walker's numbers do not change**: `WALK.walk` 3.3, `run` 7.4, `jump` 5.4, `step` 0.55, `steep` 0.6, `radius` 0.38, `wade` 0.85 are the character's parameters; the tests run the same input script on both grounds and the paths are compared (spec A4).
- Files under 800 lines; tests beside; the gates.

## Review Focus

1. **Cells in and out**: a body added for a cell is removed when the cell drops, and the count of bodies in the world equals the sum of the live cells' instances plus the constants; a cell dropped mid-step is removed after the step (`world.js` already defers removes). Test with three cells cycled 50 times: no leak, no NaN.
2. **The floating origin**: `onOrigin` moves the level bodies and the heightfields with everything else; a walker 3 km out stands at the same height after a shift. Test with a shift of 2,048 m.
3. **Stairs and ice**: the character on a 0.5 m step climbs, on a 0.6 m step stops; on a slope of 35° walks, 45° slides; snap to ground keeps it down on a 20° descent at run speed. Test on built geometry.
4. **A hull from a Havok record** matches the mesh: a ray down onto each of ten Hoth props hits within 5 cm of the mesh's own height (`rapierShapes` versus the GLB's vertices).
5. **A bolt through a doorway**: `castRay` from inside the hangar through the door misses the walls and hits the snow at the expected distance (a built doorway in the test).

---

### Task 1: A cell's bodies, and the shapes from the pack

**Files:**
- Create: `src/lib/physics/level.js` (+ test), `src/lib/level/collision.js` (`rapierShapes(pack, mesh) → [{ shape: 'hull' | 'trimesh', args, position, rotation }]`, if lane L has not; + test), `scripts/fixtures/level/mini.level.json` and `mini.cells/0_0.bin` (three meshes, twelve instances, under 8 KB)

**Interfaces:**
- `levelBodies(pack, cellKey, instances, shapesOf) → desc[]` (pure: one fixed body per instance, `group: 'floor'`, colliders from `shapesOf(mesh)`, the instance's position, quaternion and scale applied).
- `createLevelPhysics(physics, pack, { shapesOf }) → { onCell(key, instances | null), bodies(), dispose }`.

- [ ] **Step 1: Failing tests**: twelve instances give twelve fixed bodies with the right colliders; `onCell(key, null)` removes them; cycling leaks nothing; a scaled instance scales its hull. **Step 2–4.**
- [ ] **Step 5: Commit** `A level's placed things as Rapier's fixed hulls and trimeshes, added and removed with their cell`.

### Task 2: The terrain as heightfields

**Files:**
- Create: `src/lib/physics/terrain.js` (+ test)

**Interfaces:**
- `cellHeightfield(layer, cx, cz, { cell = 128, step = 1 }) → desc` (pure: samples `layers.js`'s `heightAt` on the cell's grid, transposed and centred as `heightfield.js` does).
- `createLevelTerrain(physics, layer) → { onCell(key, on), dispose }`.

- [ ] **Step 1: Failing tests**: 200 rays down onto a built slope match `heightAt` within 2 cm (as `heightfield.test.js` proves its own); a cell's field is removed with the cell. **Step 2–4.**
- [ ] **Step 5: Commit** `The game's ground as a Rapier heightfield per cell`.

### Task 3: The character

**Files:**
- Create: `src/lib/physics/character.js` (+ test)
- Modify: `src/components/galaxy/surface/walker.js` (a `ground` adapter: `{ kind: 'solids' }` as today or `{ kind: 'character', character }`; `stepWalk` asks the adapter for the new position and `grounded`), `walker.test.js` (the same script on both grounds)

**Interfaces:**
- `createCharacter(physics, { radius = 0.38, height = 1.7, step = 0.55, slope = 0.6, snap = 0.3, mass = 80 }) → { move([dx, dy, dz], dt) → { pos, grounded, slid, hit }, teleport(pos), dispose }` (Rapier's `KinematicCharacterController` with `enableAutostep(step, 0.2, true)`, `setMaxSlopeClimbAngle(atan(slope))`, `enableSnapToGround(snap)`, `setApplyImpulsesToDynamicBodies(true)` so the crates shove).

- [ ] **Step 1: Failing tests**: review focus 3; the same twelve-second input script on `solids` and on `character` over the same built room ends within 0.3 m. **Step 2–4.**
- [ ] **Step 5: Commit** `The walker stands on Rapier's character on a level world; its feel is the test's`.

### Task 4: Shots, rides, and the surface

**Files:**
- Create: `src/lib/physics/shots.js` (+ test): `castRay(physics, from, dir, max, { group }) → { point, normal, body, t } | null`; `castShape(...)` for a thrown thing.
- Modify: `surface/rides.js` (level worlds' speeder and tauntaun through `vehicle.js`'s controller: the chassis table beside the existing ride rules; additive), `surface/scene.js` (the one call site; `preload()` when `site.level`), `surface/blaster.js` or where bolts test lines today (the ray through `shots.js` when `site.level`, else as today)

- [ ] **Step 1: Failing tests**: review focus 5; a ray against a heightfield; a speeder on the heightfield holds its height. **Step 2–4.**
- [ ] **Step 5: On Hoth** (lane L's branch read, not checked out; if its pack is not on `main` yet, the mini fixture world under `?site=` the check script takes): `scripts/galaxy-check.mjs surface hoth`, `surface-shot.mjs` before and after; the walker's path up the hangar ramp and across the trench in the evidence folder `docs/superpowers/evidence/galaxy-engine/P/`.
- [ ] **Step 6: Commit** `Bolts and rides on the level's bodies; Hoth's walker on the game's shapes`.

### Task 5: Docs and the PR

- [ ] `docs/stack/physics-rapier.md` ("Where it is used", "Rules": the level bodies, the character); the hand-off's row; the gates; merge `origin/main` (lane L may have changed `scene.js`: keep both sides); push; PR `The galaxy's engine, lane P: the level's ground, shapes, walker and bolts on Rapier` with the tests' numbers, A4 and A5 answered, the shots.
