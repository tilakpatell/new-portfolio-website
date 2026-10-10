# Handoff: natural worlds (three phases, one pull request each)

Real ground, rivers that run, Bruno Simon's grass, trees, tracks and water, and a rigid-body car on Rapier, as a seeded planet surface at `/universe/expanse/:seed`. Read these first, in this order:

1. `docs/superpowers/specs/2026-10-08-natural-worlds-design.md` (what and why; the decisions; what it is not)
2. `docs/superpowers/plans/2026-10-08-natural-worlds.md` (your phase's tasks: files, interfaces, tests)
3. `docs/research/2026-10-08-folio-2025-physics-terrain-streaming.md` (his code, with every number: the plan quotes its sections)
4. `docs/superpowers/HANDOFF-world-runtime.md` (what `rt` gives a module) and, for Phase 3, `src/runtime/chunkGrid.js`, `workers.js`, `origin.js` and `src/components/minecraft/stream.js` from PR #600's branch `claude/infinite-worlds-p3` (on `main` once that PR merges)

## Which phase is yours

| Phase | Branch | Starts from | Blocked by |
|---|---|---|---|
| 1: `src/lib/land`, `src/lib/physics` | `claude/natural-worlds-p1` | `main` (this design's docs are on `claude/natural-worlds-design`; merge that branch in, or cherry-pick its one commit) | nothing |
| 2: the `src/lib/three` pieces | `claude/natural-worlds-p2` | `main` after 1 | 1 |
| 3: the Expanse surface world | `claude/natural-worlds-p3` | `main` after 2 and PR #600; if #600 is still open, branch from `origin/claude/infinite-worlds-p3` and merge `main` later | 1, 2, #600 |

One session can take all three in order, merging each before starting the next; stop and write the status table below when your context is heavy, and the next session picks up the next phase.

## The rules (don't break)

- **Pure first.** `src/lib/land/*.js` and `src/lib/physics/*.js` import no three.js and no DOM; they run in Node and in the worker. The engine is tested for real (`createPhysics` in `beforeAll`), not mocked, in `src/lib/physics/*.test.js`.
- **One new dependency**, `@dimforge/rapier3d-compat`, imported only by `src/lib/physics/world.js`, dynamically. If it will not load in Node or Vite, stop and say so in the PR before working round it.
- **His numbers are the start, not the law.** Every constant in `CAR` and in the water, grass and view shaders is his, quoted in the research note. Change one only when a test or a screenshot says to, and say which in the PR.
- **The galaxy does not change.** `galaxy/surface/terrain.js` imports `LAYERS` from `src/lib/land/layers.js` and its tests pass unchanged. No other authored world, nor the universe map, nor Albuquerque, is touched.
- **The constants are the infinite-worlds ones where they meet:** `CELL = 64`, `ORIGIN_CELL = 50000`, hysteresis `1`. New ones are in the plan's Global Constraints.
- **Nothing a visitor can do is lost.** Existing tests stay green and are not loosened.
- **One phase per PR, merged on its own.** PR to `main`, CI green, merge commit. Never merge red, never force-push, never rebase someone else's branch.
- **Before the PR:** `npx eslint .`, `npx vitest run`, `npx vite build`; Phase 1 adds three `node scripts/land-preview.mjs <seed>` PNGs to the PR; Phase 3 also runs `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe/expanse/7` and `node scripts/perf-probe.mjs expanseDrive`, quoting the worst frame.
- Keep output terse. Commits end with the harness's attribution lines; no model names in code, docs or commits.

## What done looks like, per phase

- **1**: `npx vitest run src/lib/land src/lib/physics` green; `node scripts/land-preview.mjs 7` shows rivers that meander, widen and reach the sea or end in a lake; a car dropped on a flat heightfield in a test rests on four wheels and drives at his top speed.
- **2**: every piece builds in Node against stub shaders; `grass.js` takes `tracks`; nothing on the site changes.
- **3**: `/universe/expanse/7` loads behind the gate, the car stands on a hill, `W` drives it, cells arrive ahead without a frame over 100 ms after the first, the grass flattens under the wheels, a river's shallows show the bands and the blur, driving into it slows the car and `R` brings it back; `/worlds` lists the planet.

## When something in the plan is wrong

Follow the spec over the plan, the code over both. Fix the plan's line in your PR and say so in the PR body in one sentence.

## Status

| Phase | Session | Branch | Merged |
|---|---|---|---|
| design | the architecting session | `claude/natural-worlds-design` | (carried by Phase 1's PR) |
| 1 | the Phase 1 session | `claude/natural-worlds-p1` | #622: `src/lib/land`, `src/lib/physics`, `scripts/land-preview.mjs`; previews in `docs/superpowers/previews/` |
| 2 | the same session | `claude/natural-worlds-p2` | #638: `landmap`, `land`, `tracks`, `river`, `puffs`, `leaves`, `windLines`, `view` in `src/lib/three`; `grass.js` takes `ground.glsl` and `tracks` |
| 3 | the same session | `claude/natural-worlds-p3` | this PR: `src/components/expanse/surface/`, `/universe/expanse/:seed`, the guide's page, the gate (`worlds.js`'s `SEEDED`), `perf-probe`'s `expanseDrive` |

Phase 1's findings the next phases rely on: Rapier's heightfield is our row-major heights transposed (rows along z) and splits each quad `(ix + 1, iz)–(ix, iz + 1)`, so `cellMesh` and `heightAt` split that way too; `@dimforge/rapier3d-compat@0.21.0` loads in Node and bundles in Vite as a dynamic import; the car holds near `5.5` m/s with `overflowGain 25`; rivers fill and spill lakes (`rivers.js`'s header).

Phase 2's notes for Phase 3: every new shader compiled and drew in headless Chromium (software WebGL: 15 programs, no error) from a scratch page that built them all at once; nothing on the site uses them yet. `createLeaves` takes `floorAt(x, z) → { y, water }` from the world's cells, not the land map. Each piece that follows the view has a `shift(sx, sz)` for the floating origin (tracks' `track().shift`, leaves, wind lines, view); the land map has `offset(x, z)`. The tracks' up-the-picture is −z: check it the first time the grass flattens under a wheel.

Phase 3's notes for Phase 4: the runtime has no `rt.chunks`; the stream makes its own grid (as Minecraft's). `vehicle.js` on `main` rights itself when upside down, so the driver's rules only respawn (R, four seconds under water, stuck). The module registers the planet in the visitor's worlds itself (`registry.add`, kind `planet`). The world is tested against the real engine and the real cells (`module.test.js`: it stands, drives and survives an origin shift). Touch's Jump, Boost and Back press the keys they stand for (synthetic key events the runtime's input takes).

