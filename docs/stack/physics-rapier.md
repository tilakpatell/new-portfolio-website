# Rapier

**Version** `@dimforge/rapier3d-compat@0.21.0` (pinned, no caret) · **Page owner** `src/lib/physics/` · **Decision** none recorded; the reasons are in `docs/superpowers/specs/2026-10-08-natural-worlds-design.md` (“Rapier, not cannon-es”)

## What it is, and why it is here

A rigid-body physics engine written in Rust and run as WebAssembly: bodies, colliders, a heightfield, a ray-cast vehicle controller, sleeping and contact events. The site uses it for the worlds you drive or land in, following Bruno Simon’s folio-2025 (`src/lib/physics/world.js`’s header). The natural-worlds design chose it over cannon-es because a heightfield world that streams colliders in and out wants Rapier’s heightfield, sleeping and solver, and his vehicle numbers port verbatim.

## Where it is used

The census row is in [README.md](README.md): Rapier is imported by one file, `src/lib/physics/world.js`, and only dynamically, the first time `createPhysics` or `preload` is called.

The rest of the site reaches it through `src/lib/physics/`:

- `src/components/universe/landings/physics.js` and `src/components/universe/landings/bodies.js`: landings on the universe map.
- `src/components/universe/footScene.js`: walking on a landed planet.

## How the site uses it

- **Bodies are data.** `createPhysics(opts)` gives `add(desc)`, `remove(body)` and `step(dt)`; a body is a description (`type`, `position`, `colliders`, `group`, `onHit`), never a hand-built Rapier object (`world.js`’s header lists the full shape).
- **A fixed step**, times the time scale, with an accumulator and at most `maxSubsteps` a call, so a car drives the same on a slow screen and a fast one and a tab coming back doesn’t launch it.
- **A floating origin.** `onOrigin(shift)` moves every body (and a round planet’s centre) in one call, velocities kept, for an endless land.
- **Three collision groups**, his verbatim: `floor` meets everything, `object` meets everything and bumpers, `bumper` meets objects only.
- **The pieces beside it**: `src/lib/physics/vehicle.js` (his car on Rapier’s ray-cast vehicle controller), `src/lib/physics/heightfield.js` (land as a floor), `src/lib/physics/props.js`, `src/lib/physics/pusher.js` and `src/lib/physics/catch.js`.
- **Colliders from names.** A model made with its physics (nodes named `physical`, their children `cuboid`, `ball`, `cylinder`, `capsule`, `hull` or `trimesh`, sized by their scale) gives its bodies through `src/lib/three/colliders.js`’s `collidersOf(model)`, its rules pure in `src/lib/physics/fromModel.js`; `scripts/gen3d/web.mjs` keeps the nodes through the web cut, the planet landings read them before a hand-written body, and `docs/assets/colliders.md` is the page a modeller reads.
- **It never throws at a world**: bad numbers put a body back where it began, a throwing `onHit` goes to `onError`, a failed load (offline) is not cached so the next call tries again.

## What the site does not use, and why

- **The bundler-plugin build** (`@dimforge/rapier3d`): the `-compat` build inlines its wasm, so Vite needs no plugin and the engine loads in Node for the tests.
- **Rapier’s debug renderer**: `src/lib/physics/` has no three.js and no DOM; a world draws its bodies from `position()` and `quaternion()`.
- **A static import**: nothing imports Rapier at module scope, so no page but the one driving downloads it.

## Rules

- Import Rapier only in `src/lib/physics/world.js`, dynamically (its header; nothing measures this, `node scripts/stack-census.mjs` shows the count).
- `src/lib/physics/` stays pure: no three.js, no DOM, tested against the real engine in Node (`src/lib/physics/world.test.js` and the tests beside each file; `docs/health/RULES.md`, “Logic apart from drawing”).
- A world that loads Rapier counts it in its download size (`WORLD_MB` in `src/components/worlds/worlds.js`, the autopilot’s standing rules).
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
- **Rapier wakes what it finds touching.** A field of props placed asleep on the ground would all wake on landing; `world.js` keeps a body placed asleep asleep through its first step.
