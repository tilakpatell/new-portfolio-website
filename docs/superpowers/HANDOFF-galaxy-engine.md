# Hand-off: the galaxy's engine

The design: `docs/superpowers/specs/2026-10-10-galaxy-engine-design.md`. The decision: `docs/decisions/2026-10-10-the-engine-in-place.md`. The answer to "should we add a game engine?" is no: three r186's node renderer, its lighting and display addons, TSL and Rapier are the engine, pinned and partly in use; this work puts them under the Star Wars worlds.

## Done

- **The design, the decision and four plans** (#819): lanes R, P, T and M below.
- **Lane T, tasks 1 to 3** (`claude/engine-t-surface`, draft PR): the shared twins the surface's closure needs and its own node materials, each a new file beside its GLSL original with the same exports, flags and uniform names; the wiring for lanes R and P; the browser check that compares each twin with its original.
  - `src/lib/three/hookNodes.js`: what an `onBeforeCompile` chunk swap is on the node renderer: the material's own setup method wrapped and chained (`onPosition`, `onColor`, `onNormal`, `onDirect`, `onIndirect`, `onLight`, `onFog`), the program keyed by each hook's uniforms; `asNode` and `twinScene` put classic materials on their node twins.
  - Twins (`src/lib/three/<name>Nodes.js`): grounding, groundingBake (the floor bake: depth pictures of its own, read back and resolved on the CPU), groundwork, foliage, groundLook, groundmap, core, scans, splat, puffs, ink, wind, house, recolour, dust, grass, matcap, kit.
  - The surface's own (`src/components/galaxy/surface/nodes/`): sky, skyfog, weather (flakes as instanced sprites), water (the plane and the Gerstner sea), props (the towers' windows, the shield, the light shafts), activity (the beam), missions (the posts), post (universe/post.js's surface pass: the TSL bloom and the FINAL grade).
  - `surface/engine.js`: `lightFor` behind `site.gameLight`, `groundFor` behind `site.level` (the physics design's P0 `createLevelCollision` and P1 `createPlayerBody`, which replace lane P), `postFor` by the backend; two calls in `scene.js` are the seams. Lane R has no branch and P0 and P1 are not merged, so nothing is handed in and every site keeps today's light and ground. (P0's branch also edits `lib/three/dust.js`: `dustNodes.js` takes the change when it lands.)
  - `scripts/twin-parity.mjs`: each twin against its original, drawn in Chromium through the same post. On SwiftShader every twin is 43 to 80 dB but dust (27 dB) and matcap (17 dB): `docs/superpowers/evidence/galaxy-engine/T/twin-parity.md`.
  - The closure: 55 files with GLSL at the start (`evidence/galaxy-engine/T/closure-before.md`), 30 with the twins in place, all behind six imports (`closure-now.md`).

## The lanes

| Lane | Plan | What | Starts from | Blocked by |
|---|---|---|---|---|
| **R** | `2026-10-10-galaxy-engine-laneR-light.md` | the light as one stack: `SunLight` cascades, `ClusteredLighting` placed lights, probes and a probe grid, the TSL sky and fog, the post chain as data (SSGI, AO, SSR, bloom, god rays, flare, LUT, TRAA); `applyGameLight` | `main` | nothing (lane G's `gameLight.js` read from its branch) |
| **P** | `2026-10-10-galaxy-engine-laneP-physics.md` | the level's ground, shapes, walker and bolts on Rapier: heightfields and Havok hulls per cell, the character controller, ray casts | `main` | nothing (lane L's pack format from its plan; `rapierShapes` shared with L) |
| **T** | `2026-10-10-galaxy-engine-laneT-surface-port.md` | `galaxy-surface` to `'nodes'`: the `lib/three` twins, the surface's own nodes, the post as data, the light and the ground wired; the flip with parity | `main` | tasks 1–3 in a draft PR (`claude/engine-t-surface`); the flip waits for G, L, K merged and the six imports below; the light on R; the ground on P |
| M | `2026-10-10-galaxy-engine-laneM-map-port.md` | `galaxy` (the map) to `'nodes'` on T's twins | `main` after T | T |

One lane per session. R, P and T may run at once: they own different files (`src/lib/three/light/`, `src/lib/physics/`, `src/lib/three/*Nodes.js` and `surface/nodes.js`). `surface/scene.js` is touched by P (one call site) and T (the import lines and the light wiring) and by #810's lanes G and L now: merge `origin/main` before the PR and keep both sides.

### What the other work must know

- **The Battlefront game, lane 5** (`docs/superpowers/plans/2026-10-10-battlefront-lane5-world.md`, not started): its Task 3 (`lighting.js`, `post.js`, the runtime's new passes) is lane R's. When lane 5 starts it takes `applyGameLight` and `passesFor` and writes none of its own; its plan's constants (`CSM_CASCADES`, `CSM_MAX_FAR`, `PROBE_SIZE`, `LIGHT_BUDGET`) live in `src/lib/three/light/`.
- **The WebGPU lane** (`2026-10-08-webgpu-acceleration-design.md`, "The ports, in order", step 4, the Expanse twins): lane T writes those twins under the same names (`<name>Nodes.js` beside the original). Read them from lane T's branch before writing any.
- **Lane G** (#810): its `siteLightFrom` entry is the input to lane R's `applyGameLight`; its probes (`probeEnv.js`) and shadow cache (`shadowMask.js`) are read by lane R's `probes.js` and `sun.js`. Nothing of G's is replaced; the classic-renderer worlds keep it.
- **Lane L** (#810): lane R writes `lights.json` beside L's pack (not in `level.json`); lane P reads the pack's `physics` per mesh and shares `src/lib/level/collision.js`'s `rapierShapes` with L.
- **The natural-worlds lane** (`2026-10-08-natural-worlds-design.md`): keeps shipping GLSL; lane T's twins are beside its files, not in them.

## Left

- R, P, M as above.
- **T, before the flip** (the six imports that keep 30 GLSL files in the surface's closure, `evidence/galaxy-engine/T/closure-now.md`):
  - `loadModel` from `universe/planets.js`: take `loadGLTF` and `cloneScene` from `lib/three/gltfCache` instead (no twin needed); eleven files go.
  - `PARTY`, `loadPartyFigure`, `loadSharedFigure` from `universe/footScene.js`: the figure-loading slice of footScene as a GLSL-free file, with twins of its two matte-figure patches and its ShaderMaterial; fifteen files go (footScene, portalFx, and furnish's landings).
  - `rickmorty/portal/meshyCast.js` (with `toon.js` and `wardrobe/dress.js`), `rickmorty/cruiser3d.js`'s own patch, `universe/livery.js` (ships' paint), `universe/landings/models.js`'s `sizeFor` (pure), `lib/three/portalFx.js`: twins.
  - Two twins under the line: **dust** (its cards smaller and softer; scaling by 1.4 gets 34 dB, so the instanced billboard's size differs somewhere) and **matcap** (the baked sphere brighter on the node renderer; the surface does not ask for matcaps).
- **T, the flip** (Task 4), once G, L and K are merged: merge `origin/main`, move the surface's imports to the twins and `nodes/` (scene.js, ground.js, placer.js, kit.js, detail.js, props/*, sky.js, skyfog.js, water.js, weather.js, activity.js, assaultScene.js), `postFor` in place of `createPost`, `module.js` to `'nodes'`, `shading.test.js` green, the parity tables on the four routes and perf on both backends.
- **Lane R, from lane T**: three's TSL `bloom` glows a third as much as `UnrealBloomPass` with the same numbers (Unreal's composite multiplies by `3.0 * bloomStrength`). `nodes/post.js` hands the strength over three times; `src/runtime/webgpu.js`'s bloom pass does not, so a `bloom` pass in `rt.gfx.post` glows a third as much on the node renderer as on the classic backend's `UnrealBloomPass` for the same data: `passesFor` should settle it once.
- **The natural-worlds lane and the WebGPU lane's step 4**: the twins of grounding, foliage, groundLook, wind, grass, puffs, house, core and the rest are on lane T's branch; read them there rather than writing others.
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
