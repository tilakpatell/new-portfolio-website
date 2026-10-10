# The galaxy's engine, lane M: the galaxy map on the node renderer. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR. **Starts when lane T's twins are on `main`.**

**Goal:** `galaxy` (the map: space, the planets, the fleets, the director's events, the flight down) is a `'nodes'` world, so the flight from orbit to a surface and back is one backend kind end to end, the planets with lane K's skins and lane R's post chain (bloom, god rays off the sun, lens flare, grading) draw on WebGPU, and the picture matches today's within the parity check.

**Architecture:** The same recipe as lane T: `universe/nodes.js` and `galaxy/nodes.js` (split by topic under 800 lines) hold the TSL twins of the map's own GLSL; the shared twins from lane T are imported; the module flips last with the parity and perf tables. The universe's post chain (`universe/post.js`, 10 sites: the map's bloom, the hyperspace streaks, the reentry glow, the surface pass already moved by lane T) becomes `rt.gfx.post` data with lane R's `passesFor` and a `space` preset (bloom, god rays, lens flare, grading; no SSGI, no AO: there is no ground).

**Tech Stack:** as lane T; `src/components/universe/*`, `src/components/galaxy/*`; `scripts/galaxy-check.mjs space <worlds>`; `scripts/gpu-parity.mjs /galaxy --view orbit --view hyperspace --view trench`.

**Spec:** `docs/superpowers/specs/2026-10-10-galaxy-engine-design.md` ("The surface port (lane T) and the map port (lane M)").

## Global Constraints

- **Files this lane owns**: `src/components/universe/nodes/*.js` (+ tests), `src/components/galaxy/nodes/*.js` (+ tests), the import lines in the originals, `src/components/galaxy/module.js` (the flip), `docs/stack/webgpu-tsl.md`.
- The originals by count: `universe/post.js` 10, `planetShading.js` 9, `stations.js` 5, `rmWorlds.js` 5, `galaxy/sky.js` 5, `setpieces.js` 3, `reentry.js` 3, `infall.js` 3, `citadelSiege.js` 3, `gateway.js` 3, two each in `trail.js`, `sun.js`, `shipyard/showroomRules.js`, `universe/scene.js`, `livery.js`, `landmarks.js`, `deepspace.js`, `crash.js`, `cme.js`, `battleFx.js`, `galaxy/world.js`, `bodies.js`, and one in `hyperspace.js`, `interdictor.js`, `fx.js`, `supernova.js`, `beacons.js`, `belt.js`, and the landings (`landings/caribbean.js`, `rickmorty.js`, `sky.js`) that the map reaches. The closure is the measure; this list is the start.
- **`bodies.js` is lane K's** until its PR merges (the planet skins); its twin starts after.
- The handover (`runtime/handover.js`) between the map and the surface is tested on both backends in a flight down and back (`?spot=` and the landing-check flags in `scripts/galaxy-check.mjs`).
- Files under 800 lines; tests beside; the gates.

## Review Focus

1. **The planets' limb and atmosphere** (`planetShading.js`, `createAtmosphere`): the TSL port keeps the exact scattering arithmetic; the parity view `orbit` at Endor, Hoth and Geonosis (rings) under the threshold.
2. **The post presets**: `space` (bloom, god rays, flare, LUT) and the surface's pass never both live; the handover switches the chain at the cut the design describes.
3. **Hyperspace and the trench** are the map's heaviest post users; their twins are measured on the perf probe's journey on both backends.
4. **The landings' skies** (`landings/sky.js`) are shared with the other sector; their twin is beside the original and the other sector keeps GLSL.

---

### Task 1: The closure and the post chain
- [ ] The closure table into `docs/superpowers/evidence/galaxy-engine/M/closure-before.md`; `universe/post.js`'s passes as `passesFor` presets (`space`, `hyperspace`, `reentry`) with tests; commit `The map's post chain as data`.

### Task 2: The planets and the sky
- [ ] `planetShading`, `galaxy/sky`, `sun`, `supernova`, `bodies` (after K) as nodes with tests; parity at `orbit`; commit `The planets, the sun and the sky as nodes`.

### Task 3: The events, the fleets and the flight
- [ ] `stations`, `setpieces`, `citadelSiege`, `infall`, `reentry`, `crash`, `deepspace`, `trail`, `hyperspace`, `interdictor`, `gateway`, `livery`, `landmarks`, `cme`, `battleFx`, `rmWorlds`, `showroomRules`, `fx`, `beacons`, `belt`, the landings; one commit per group.

### Task 4: The flip
- [ ] `module.js` → `'nodes'`; the closure clean; parity at `orbit`, `hyperspace`, `trench`; perf both backends; the flight down and back on both; `docs/stack/webgpu-tsl.md`; the hand-off; merge `origin/main`; PR `The galaxy's engine, lane M: the galaxy map on the node renderer`.
