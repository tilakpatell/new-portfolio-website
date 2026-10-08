# three.js over Babylon.js

Date: 2026-10-08. The long version: `docs/superpowers/specs/2026-10-08-render-stack-and-stack-docs-design.md`, Part 1.

## Context

The question: is Babylon.js worth adding for performance? Babylon is an engine (physics, PBR, animation blending, particles, a GUI and an inspector in the box) with a WebGPU engine of its own. The site is on three.js (`three@^0.186.1`, see `docs/stack/three.md`), and the WebGPU lane (`docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md`) is making the runtime’s WebGPU backend reachable.

What the spec counted over `src/` and `scripts/` that day:

| what | number |
| --- | --- |
| files importing `three` | 677, tests counted |
| files importing `three/examples/jsm/*` | 185 |
| GLSL sites (`ShaderMaterial`, `onBeforeCompile`, `UnrealBloomPass`, `EffectComposer`, `RenderPass`, `OutputPass`, `ShaderPass`) | 711 in 237 files, tests left out |
| source files under `src/` | 2,420, 34 MB |

The live numbers are now measured rather than counted: `docs/stack/README.md`’s census (532 files imported `three` on 2026-10-08, tests left out) and the measure’s `glsl-sites` (616 sites that day, once comments and the exempt infrastructure are left out).

What Babylon advertises was already here, on three.js and tested:

| Babylon has | the site has |
| --- | --- |
| physics | Rapier (`src/lib/physics/`: world, vehicle, heightfield, pusher, catch) |
| PBR materials | `MeshStandardMaterial`, `MeshPhysicalMaterial`, and the house look (`src/lib/three/house.js`) |
| animation blending | `src/lib/three/animator.js`, `clipLibrary.js`, `ik.js`, `gait.js`, `locomotion.js` |
| particles | `src/lib/three/explosions.js`, `puffs.js`, `flare.js` |
| GUI | the HUD kit (`src/runtime/hud/`) and its rules in `docs/health/RULES.md` |
| inspector | `src/lib/debugPanel.js`, `window.__RUNTIME__`, `scripts/perf-probe.mjs`, `scripts/autopilot-check.mjs`’s screenshots |

Why a swap would not pay:

1. **A rewrite, not a port.** Every scene, the frame guard, the GPU work queue, the house look and the GLSL sites are three.js-shaped, and there is no incremental path: a world is on one engine or the other, and a site on two downloads both.
2. **The gain is the one the WebGPU lane already takes.** The measured bottleneck (`docs/research/2026-10-07-frame-hitches.md`) is draw submission on the main thread. Babylon cuts it with render bundles; three.js’s `WebGPURenderer` with `BundleGroup`. Same mechanism, same class of gain.
3. **The shader port is owed on both roads.** Babylon’s WebGPU engine converts GLSL through a WebAssembly compiler at load; three’s refuses GLSL. TSL rewrites each site once and draws it on WebGPU and on WebGL 2.
4. **Bytes.** Every world is a lazy chunk under a budget; a second engine’s core and shader compiler would be paid by every visitor to a world on it.
5. **Everything around the code is three-shaped**: the `threejs-*` skills, the health rules (`src/lib/three` is a layer), the handoffs, the autopilot.

## Decision

three.js stays the renderer. WebGPU comes through `three/webgpu` and TSL, one world at a time, as the WebGPU design lays out. Babylon.js is not added, as an engine or beside one.

## Consequences

- No second engine: one scene graph, one material system, one set of skills and rules.
- The port is per world, from GLSL to node materials, checked for parity on both backends.
- `glsl-sites` in the measure (`scripts/health/glsl-sites.mjs`) is the port’s progress bar: each ported world lowers it.
- What Babylon would have given for free (an inspector, a GUI) stays the site’s own to build and keep.

## Revisit when

- `three/webgpu` loses its WebGL 2 fallback, so a ported world has nowhere to run for the visitors without WebGPU; or
- two ports in a row fail the parity check for a reason in the renderer rather than in the port.

Either goes in as a new entry that links this one, not as an edit of it.
