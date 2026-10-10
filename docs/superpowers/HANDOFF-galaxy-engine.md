# Hand-off: the galaxy's engine

The design: `docs/superpowers/specs/2026-10-10-galaxy-engine-design.md`. The decision: `docs/decisions/2026-10-10-the-engine-in-place.md`. The answer to "should we add a game engine?" is no: three r186's node renderer, its lighting and display addons, TSL and Rapier are the engine, pinned and partly in use; this work puts them under the Star Wars worlds.

## Done

- **The design, the decision and four plans** (this PR): lanes R, P, T and M below.

## The lanes

| Lane | Plan | What | Starts from | Blocked by |
|---|---|---|---|---|
| **R** | `2026-10-10-galaxy-engine-laneR-light.md` | the light as one stack: `SunLight` cascades, `ClusteredLighting` placed lights, probes and a probe grid, the TSL sky and fog, the post chain as data (SSGI, AO, SSR, bloom, god rays, flare, LUT, TRAA); `applyGameLight` | `main` | nothing (lane G's `gameLight.js` read from its branch) |
| P | `2026-10-10-galaxy-engine-laneP-physics.md` (**withdrawn; do not run**) | the physics is `2026-10-10-bf2017-physics-design.md`'s lanes P0–P4 (`HANDOFF-bf2017-physics.md`), running since 05:22 | | |
| **T** | `2026-10-10-galaxy-engine-laneT-surface-port.md` | `galaxy-surface` to `'nodes'`: the `lib/three` twins, the surface's own nodes, the post as data, the light and the ground wired; the flip with parity | `main` | the flip waits for G, L, K merged; the light on R; the ground and the body on the physics design's P0 and P1 |
| M | `2026-10-10-galaxy-engine-laneM-map-port.md` | `galaxy` (the map) to `'nodes'` on T's twins | `main` after T | T |

One lane per session. R and T run at once and own different files (`src/lib/three/light/`, `src/lib/three/*Nodes.js` and `surface/nodes.js`); the physics design's P0–P2 own `src/lib/physics/` and `surface/level/levelPhysics.js`. `surface/scene.js` is touched by T (the import lines and the light wiring), by P0 and P1 (their call sites) and by #810's lanes G and L now: merge `origin/main` before the PR and keep both sides.

### What the other work must know

- **The Battlefront game, lane 5** (`docs/superpowers/plans/2026-10-10-battlefront-lane5-world.md`, not started): its Task 3 (`lighting.js`, `post.js`, the runtime's new passes) is lane R's. When lane 5 starts it takes `applyGameLight` and `passesFor` and writes none of its own; its plan's constants (`CSM_CASCADES`, `CSM_MAX_FAR`, `PROBE_SIZE`, `LIGHT_BUDGET`) live in `src/lib/three/light/`.
- **The WebGPU lane** (`2026-10-08-webgpu-acceleration-design.md`, "The ports, in order", step 4, the Expanse twins): lane T writes those twins under the same names (`<name>Nodes.js` beside the original). Read them from lane T's branch before writing any.
- **The physics design** (`2026-10-10-bf2017-physics-design.md`, `HANDOFF-bf2017-physics.md`): the physics half of this stack; lane T wires P0's `createLevelCollision` and P1's `playerBody.js` behind `site.level`; nothing physical is written under this design.
- **Lane G** (#810): its `siteLightFrom` entry is the input to lane R's `applyGameLight`; its probes (`probeEnv.js`) and shadow cache (`shadowMask.js`) are read by lane R's `probes.js` and `sun.js`. Nothing of G's is replaced; the classic-renderer worlds keep it.
- **Lane L** (#810): lane R writes `lights.json` beside L's pack (not in `level.json`); lane P reads the pack's `physics` per mesh and shares `src/lib/level/collision.js`'s `rapierShapes` with L.
- **The natural-worlds lane** (`2026-10-08-natural-worlds-design.md`): keeps shipping GLSL; lane T's twins are beside its files, not in them.

## Left

- R, T, M as above; the physics in its own hand-off.
- After M: `BundleGroup` round what never moves on a level (lane L's instances), measured on the perf probe; the WebGPU design names it.
- `vxgi/` (voxel cone tracing) measured only if the probe grid is not enough for the hangar's indirect light.
- The placed lights' cookies (the record's `cookie` textures) once lane R's pool draws without them.
- The other `'glsl'` worlds the WebGPU design orders (Mario 64, the Expanse, the Death Star's inside, Middle-earth) take lane T's twins in their own ports.

## Checking it

- `npx vitest run src/lib/three/light src/lib/physics src/runtime` and the twins' tests.
- `node scripts/light-fixture.mjs` (lane R: the lit fixture on both backends).
- `node scripts/gpu-parity.mjs /galaxy/hoth --before --view ground --view hangar` (lane T; the README in `scripts/gpu-parity/`).
- `GPU=webgpu node scripts/perf-probe.mjs` and `GPU=webgl …` on the galaxy journeys.
- `node scripts/galaxy-check.mjs surface hoth,endor,tatooine,kamino` and `space endor,hoth,geonosis`.
- `node scripts/health/measure.mjs`: `glsl-sites` lower after each port; the closure guard green.
