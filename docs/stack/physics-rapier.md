# Rapier

**Version** `@dimforge/rapier3d-compat@0.21.0` (pinned, no caret) · **Page owner** `src/lib/physics/` · **Decision** none recorded; the reasons are in `docs/superpowers/specs/2026-10-08-natural-worlds-design.md` (“Rapier, not cannon-es”)

## What it is, and why it is here

A rigid-body physics engine written in Rust and run as WebAssembly: bodies, colliders, a heightfield, a ray-cast vehicle controller, sleeping and contact events. The site uses it for the worlds you drive or land in, following Bruno Simon’s folio-2025 (`src/lib/physics/world.js`’s header). The natural-worlds design chose it over cannon-es because a heightfield world that streams colliders in and out wants Rapier’s heightfield, sleeping and solver, and his vehicle numbers port verbatim.

## Where it is used

The census row is in [README.md](README.md): Rapier is imported by one file, `src/lib/physics/world.js`, and only dynamically, the first time `createPhysics` or `preload` is called.

The rest of the site reaches it through `src/lib/physics/`:

- `src/components/universe/landings/physics.js` and `src/components/universe/landings/bodies.js`: landings on the universe map.
- `src/components/universe/footScene.js`: walking on a landed planet.
- `src/components/galaxy/surface/surfacePhysics.js`, `playerBody.js`, `hostileBodies.js`: a galaxy world’s surface as one physics world (its ground, its solids, its floors), with the player and every hostile on the character controller, their sight through its rays and their hurtboxes on their bodies (the design: `docs/superpowers/specs/2026-10-09-rapier-body-ai-brain-design.md`; the decision: `docs/decisions/2026-10-09-rapier-as-the-body.md`). `solids.js`, `aimShot.js`, `blaster.js` and `boltPlay.js` cast the bolts and the aim through it.

## How the site uses it

- **Bodies are data.** `createPhysics(opts)` gives `add(desc)`, `remove(body)` and `step(dt)`; a body is a description (`type`, `position`, `colliders`, `group`, `onHit`), never a hand-built Rapier object (`world.js`’s header lists the full shape).
- **A fixed step**, times the time scale, with an accumulator and at most `maxSubsteps` a call, so a car drives the same on a slow screen and a fast one and a tab coming back doesn’t launch it.
- **A floating origin.** `onOrigin(shift)` moves every body (and a round planet’s centre) in one call, velocities kept, for an endless land.
- **Three collision groups**, his verbatim: `floor` meets everything, `object` meets everything and bumpers, `bumper` meets objects only.
- **The pieces beside it**: `src/lib/physics/vehicle.js` (his car on Rapier’s ray-cast vehicle controller), `src/lib/physics/heightfield.js` (land as a floor), `src/lib/physics/props.js`, `src/lib/physics/pusher.js` and `src/lib/physics/catch.js`.
- **A figure is a character** (`src/lib/physics/character.js`): a kinematic capsule on Rapier’s `KinematicCharacterController`, moved once a substep by an intent (a velocity, a facing, a jump) from the world’s `onSubstep` hook, with its own gravity, a knock a hit adds (a kinematic body takes no impulse: the knock is a velocity the controller carries along walls), autostep, snap-to-ground, slopes, and a push on dynamic bodies. `prev` is its pose before the last substep, for drawing by `alpha`.
- **The eyes are queries** (`src/lib/physics/queries.js`): `ray`, `sweep`, `overlap`, `floorAt`, `project`, as plain numbers, against the world after its last step, on a per-frame budget (`budget.js`): a refused call answers `undefined`, so a caller keeps its last answer and never sees through a wall. Groups are `groups.js`’s: the three of his, and `character`, `hurtbox`, `zone`, with two query-only groups (`projectile`, `sight`); `filterOf(...names)` builds a query’s filter.
- **Hurtboxes by region** (`src/lib/physics/hurtbox.js`): sensor capsules on a figure’s one body, one a region (head, chest, each upper arm, forearm, thigh, shin), placed from its bones each frame (`src/lib/three/combat/hitboxRig.js`); found by a query that names `hurtbox`, never by contact; their region is the hit’s `tag`. A `Body` gains `attach(desc)` and `detach(collider)` for them; a collider desc gains `sensor` and `tag`, a body desc `onEnter` and `onLeave` (collision events), and `zones.js` is a sensor volume over them.
- **Colliders from names.** A model made with its physics (nodes named `physical`, their children `cuboid`, `ball`, `cylinder`, `capsule`, `hull` or `trimesh`, sized by their scale) gives its bodies through `src/lib/three/colliders.js`’s `collidersOf(model)`, its rules pure in `src/lib/physics/fromModel.js`; `scripts/gen3d/web.mjs` keeps the nodes through the web cut, the planet landings read them before a hand-written body, and `docs/assets/colliders.md` is the page a modeller reads.
- **It never throws at a world**: bad numbers put a body back where it began, a throwing `onHit` goes to `onError`, a failed load (offline) is not cached so the next call tries again.

## What the site does not use, and why

- **The bundler-plugin build** (`@dimforge/rapier3d`): the `-compat` build inlines its wasm, so Vite needs no plugin and the engine loads in Node for the tests.
- **Rapier’s debug renderer**: `src/lib/physics/` has no three.js and no DOM; a world draws its bodies from `position()` and `quaternion()`.
- **A static import**: nothing imports Rapier at module scope, so no page but the one driving downloads it.

## Rules

- Import Rapier only in `src/lib/physics/world.js`, dynamically (its header; nothing measures this, `node scripts/stack-census.mjs` shows the count).
- `src/lib/physics/` stays pure: no three.js, no DOM, tested against the real engine in Node (`src/lib/physics/world.test.js` and the tests beside each file; `docs/health/RULES.md`, “Logic apart from drawing”).
- A world that loads Rapier counts it in its download size (`WORLD_MB` in `src/components/worlds/worlds.js`, the autopilot’s standing rules). Every galaxy surface loads it now, phones included (its figures walk on it); the walker is the fallback only when the engine fails to load.
- A character moves only in `onSubstep` (its `move`); nothing writes a figure’s pose between substeps. A brain outputs an intent, never a transform.
- A moving body is never a trimesh (it falls through the ground); use a hull (`world.js`’s header).

## Upgrading

The version is pinned without a caret, unlike the site’s other packages; the commit that added it gives no reason, so keep it exact until one is recorded.

```
npm install @dimforge/rapier3d-compat@<version> --save-exact
npx vitest run src/lib/physics
npm run build
node scripts/health.mjs --check --skip build
```

Then land on a planet on the universe map and kick a barrel by hand: the tests hold the numbers to tolerances, not the feel. Last upgrade: not recorded; record the next one here, with what it broke.

## Gotchas

- **Step before you ask.** Rays and shape queries only see what has been added or moved once a step has run (`world.js`’s header).
- **The first step is slow.** Rapier’s first step costs many times what the rest do; `preload()` loads and warms the engine while the ship comes down (`world.js`’s header).
- **The controller catches on a heightfield’s edges** at its default normal nudge (1e-4): a run along a tile’s triangles stalled a frame about once a second. `character.js` sets 0.01, measured over 900 substeps across five headings with no catch.
- **The controller never resolves a penetration it starts in.** A figure placed inside a solid (a spawn on a slope’s wrong side) stays there; `character.js` pushes it out along each overlapping solid’s contact normal (`intersectionsWithShape` and `contactCollider`) before its first move.
- **A shape cast with no motion answers null**, not a resting overlap; `queries.js`’s `sweep` asks `intersectionsWithShape` for a motion under a millimetre.
- **A floor-only filter admits objects and characters**: they wear his “all” bit, which the pinned values keep. Name `object` too and expect both.
- **Rapier wakes what it finds touching.** A field of props placed asleep on the ground would all wake on landing; `world.js` keeps a body placed asleep asleep through its first step.
