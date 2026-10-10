# Battlefront 2017 physics, lane P3: vehicles. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. **Start when lane P0 and lane V (a vehicle model on `main`) have merged.**

**Goal:** A vehicle on a galaxy surface is a body from its blueprint: the game’s mass and centre of mass, its convex shapes as the thing that stops at walls and climbs ramps, its feet as what kills under them, its crashed parts as the debris it leaves; the rides keep their feel and gain the game’s walls.

**Architecture:** A rulebook `vehicles.json` from the 159 `VehicleBlueprint`s (the rigid bodies, the vehicle entity’s thresholds, the parts, the physics asset, the crashed-part blueprints). `lib/physics/vehicleBody.js` makes a hover, a walker, a flyer or a stationary body on `world.js` from a row and lane P0’s shapes; `debris.js` spawns crashed parts. `rides.js` reads the row where it has one.

**Tech Stack:** Node 22, Vitest against the engine, `src/lib/physics/{world,havok,pusher,catch}.js`, lane P0’s pack reader for the vehicle assets’ shapes, lane V’s models.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-physics-design.md` (§4, §6, §7, §8; “Departures” 2).

## Global Constraints

- Phase 0’s, P0’s and P1’s Global Constraints. The records: `data/Gameplay/Vehicles/<Ground|Air>/<Name>/Vehicle_*.json.gz` and the crashed-part `ObjectBlueprint`s beside them; the shapes `web/physics/Gameplay/Vehicles/**.glb`.
- **Files this lane owns**: the builder `vehicleRow`, `vehicleRulebook` in `scripts/lib/bf2017-physics-rules.mjs`, `src/data/bf2017/physics/vehicles.json`, `src/lib/physics/vehicleBody.js` (+ test), `src/lib/physics/debris.js` (+ test), `src/components/galaxy/surface/rides.js` (reads the row for `radius`, `mass`, `kill`; keeps its hand feel numbers, marked), fixtures (cuts of `Vehicle_Ground_74Z`, `Ground_Vehicle_AT-ST`, `TieFighterFirstOrder_BodyCrashed_01`). It does not touch `walker.js`’s `ride()`, lane V’s models, or #812’s rules.
- The handling numbers (top speed, acceleration, turn) are `rides.js`’s as `source: "hand"` unless the blueprint’s abilities give them (look in the `_Abilities` layer’s `VehicleWeaponPlayerAbilityAsset`/`BasicPlayerAbilityAsset` chain for a speed; record what you find in `NOTES.md`).
- A moving body is never a trimesh: the convex root only; the mesh root is kept for bolts (`bolt.js`’s segment against its triangles in the body’s frame).
- Files under 800 lines; British spelling and curly quotes; commits one plain sentence with the attribution lines; merge commits; the gates before the PR.

## Review Focus

1. **A hover at speed into a wall**: the kinematic-velocity body is moved by `ride()`’s velocity and the engine stops it; `ride()`’s own push-out must not fight it (the surface passes an empty `solids` list to `ride()` when the body exists); the test drives a hover at 30 m/s at a wall and asserts it stops within its radius with no tunnelling.
2. **The walker’s foot sensor**: a foot collider is a sensor that reports `onEnter` with the figure’s tag; the kill fires only when the foot’s vertical speed exceeds `kill.speed` (0.1 m/s in the data: a planted foot kills nothing); the test moves a foot down at 0.05 and 1.0 m/s onto a character.
3. **Debris that sleeps**: crashed parts spawned as dynamic hulls with the part’s mass settle through `catch.js` and sleep; a field of ten parts costs nothing after they rest; the test steps 5 s and asserts all asleep.
4. **Mass for a kinematic**: Rapier ignores a kinematic body’s mass, but `character.js`’s shove reads `mass` from the body’s description to push props; the vehicle row’s mass must reach the description; test by pushing a crate with a 1000 kg hover and a 100 kg one.

---

### Task 1: The vehicle rulebook

- [ ] Fixtures cut; `vehicleRow(asset) → { id, kind, mass, centreOfMass, friction, damping, parts: [{ name, mass }], kill: { speed, topHitHeight }, lowAltitude, fleeRadius, physics, crashed: [...], _source }`; `vehicleRulebook(root)`; tests on the three fixtures (the AT-ST root mass 1000, `kill.speed` 0.1, `kind 'walker'`; the 74-Z `kind 'hover'`; the crashed TIE body names its physics asset); build `vehicles.json` (expect under 120 KB, sequel names refused and counted). Commit `The vehicles’ bodies as a rulebook`.

### Task 2: `vehicleBody.js`

- [ ] `createVehicleBody(physics, row, shapes, { kind }) → { body, drive(state) (a hover: sets the kinematic velocity from `ride()`’s state), pose(out), feet: [...] (a walker: sensors per foot bone, `attach` to the animated bones each frame), remove() }`; tests per Review Focus 1, 2 and 4 against the engine with the 74-Z’s and the AT-ST’s fixture shapes. Commit `A vehicle is a body from its blueprint: its hull, its mass, its feet`.

### Task 3: Debris

- [ ] `spawnDebris(physics, rows, shapes, pose, { velocity, spin }) → bodies[]`, asleep after `catch.js`’s rest; test per Review Focus 3. Commit `A vehicle that dies leaves the game’s crashed parts`.

### Task 4: The rides on the surface

- [ ] `rides.js` reads `vehicles.json` for `radius`, `mass`, `kill` by the ride’s `bf2017` id (`speederbike` → `Vehicle_Ground_74Z`, `landspeeder` → `Vehicle_Ground_X34`); `scene.js`’s ride branch makes the body when the world has an engine and passes `ride()` an empty solids list; `physics-check.mjs` gains a ride step (mount, drive at the hangar wall, stop). Evidence into `docs/superpowers/evidence/bf2017-physics/p3/`. Commit `The rides stop at the game’s walls`.

### Task 5: The PR and the hand-off

- [ ] The gates; the lane’s section in `docs/superpowers/HANDOFF-bf2017-physics.md` (Done; Left: the walkers on lane 1’s clips, #812’s lane 4 taking `vehicleBody`); merge `origin/main`, push, PR `Vehicles as the game’s bodies: hulls, mass, feet and debris`. Merge per the slot.
