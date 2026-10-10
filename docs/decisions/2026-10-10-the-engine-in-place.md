# No game engine is added; the engine is three's node renderer, its lighting and Rapier, put under the galaxy

Date: 2026-10-10. The long version: `docs/superpowers/specs/2026-10-10-galaxy-engine-design.md`. Links `2026-10-08-three-over-babylon.md`, which stands.

## Context

The owner asked whether the Battlefront II (2017) assets and their lighting demands call for "a robust game engine for the web app", naming Rogue Engine and PlayCanvas, for the lighting and the physics, with the assets streamed from Supabase; the editor is not what is wanted, the engine driving it is.

What was found on 2026-10-10:

- The 2026-10-08 count has not moved: 532 files import `three`, 616 GLSL sites, every world a lazy chunk. PlayCanvas is the same swap Babylon was. Rogue Engine is an editor over three.js (last release 0.5-beta, no WebGPU statement found). Needle Engine is an asset pipeline over three.js that the site already has in its own form.
- three r186 ships, verified in its source: `SunLight` with cascaded shadows, `ClusteredLighting` (1,024 point lights, Forward+), `DynamicLighting`, `LightProbeGrid` (L2 spherical harmonics, GPU-baked), `vxgi/`, and the display nodes `SSGINode`, `SSRNode`, `GTAONode`, `TRAANode`, `TAAUNode`, `RecurrentDenoiseNode`, `GodraysNode`, `LensflareNode`, `Lut3DNode`, `SMAANode`, `FSR1Node`. Rapier 0.21 is pinned with a heightfield, trimeshes, hulls, a character controller and a vehicle controller, wrapped in `src/lib/physics/`.
- All of it runs on the node renderer and none of it on the classic `WebGLRenderer`. The galaxy and its surfaces are `shading: 'glsl'` (133 to 182 GLSL sites in their closures), lit by one directional light, one shadow map and one environment, with the walker on circles and boxes over a height function. Earth and Minecraft are already `'nodes'`; the runtime has the three backend kinds, the closure guard and the parity check.

## Decision

No engine is added. The engine is three.js's node renderer with its lighting and display addons, TSL, and Rapier, written once as a shared stack (`src/lib/three/light/`, `src/lib/physics/`) and put under the Star Wars worlds by porting the galaxy's surfaces, then its map, to `'nodes'` by the WebGPU design's recipe. The Battlefront game world builds on the same stack rather than its own.

## Consequences

- The galaxy gets cascaded sun shadows, the game's placed lights, probes, SSGI, ambient occlusion, reflections, god rays and grading, and the game's physics shapes, without a second engine's bytes or a rewrite of its rules.
- The port the 2026-10-08 decision owed is paid by the galaxy first (the surfaces, then the map) rather than by the WebGPU design's order (Mario 64, the Expanse); the Expanse's twins are written by the surface port under the same names.
- The classic renderer keeps the worlds not yet ported, with lane G's derived light; nothing is built twice for it.
- An editor stays absent. If one is ever wanted, it is a tool over the same scene graph, not a renderer.

## Revisit when

- A port of a galaxy world fails the parity check for a reason in the node renderer, twice; or
- the node renderer loses its WebGL 2 path; or
- a measured frame on the owner's laptop at ultra stays over 16 ms after the post chain is shed to AO and bloom, and the cause is the renderer's draw submission rather than the scene.

Either goes in as a new entry that links this one.
