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
| 1 | the Phase 1 session | `claude/natural-worlds-p1` | this PR: `src/lib/land`, `src/lib/physics`, `scripts/land-preview.mjs`; previews in `docs/superpowers/previews/` |

Phase 1's findings the next phases rely on: Rapier's heightfield is our row-major heights transposed (rows along z) and splits each quad `(ix + 1, iz)–(ix, iz + 1)`, so `cellMesh` and `heightAt` split that way too; `@dimforge/rapier3d-compat@0.21.0` loads in Node and bundles in Vite as a dynamic import; the car holds near `5.5` m/s with `overflowGain 25`; rivers fill and spill lakes (`rivers.js`'s header).
