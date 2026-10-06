# Ground, grass, foliage and shadows: how experts get quality at low cost

Date: 2026-10-06. A second research pass after `2026-10-06-bruno-simon-folio.md`, asking how
studios and the best Three.js sites make ground, grass, trees, props and their shadows look
better than a stock PBR setup (a sun, a hemisphere, a 2048 PCF shadow map, bloom) while
costing less. Read from source where it exists (SimonDev's Quick_Grass, drei, three r186,
Bruno Simon's repos, Henry Heffernan's portfolio), from the papers (Mikkelsen's hex tiling,
Deliot and Heitz, GPU Gems 3), and from case studies. Millisecond figures marked *est.* are
estimates, not measurements. The spec that applies this is
`docs/superpowers/specs/2026-10-06-ground-grass-foliage-design.md`.

## The verdict against Bruno's 2019 folio

Bruno's folio grounds and pre-lights (matcaps, floor masks, bounce, blobs) and that part
stays the cheapest way to make a diorama read as one piece. But it has nothing to say about
grass, foliage detail or large textured grounds: its world is low-poly matcap blobs on a flat
gradient. The techniques below are what the studios do for exactly those things, and they
cost less than what this site does now. Where they beat the folio they are the spec; where the
folio is already the cheapest (shadows, pre-lit props) it stays.

## 1. Grass

**Ghost of Tsushima** (Eric Wohllaib, GDC 2021; secondary write-ups, the slides weren't
checked): each blade a cubic Bezier from height, width, tilt and bend; two LODs at 15 and 7
vertices, morphing toward the switch; far tiles drop three blades in four; Voronoi clumps vary
height, colour, facing and lean; wind from scrolled Perlin noise plus per-blade bobbing;
normals tilted outward for roundness and lerped to the terrain normal with distance;
view-space thickening so edge-on blades don't vanish; fake ambient occlusion from blade
length. About 83k blades in about 2.5 ms.

**SimonDev's Three.js port** (`simondevyoutube/Quick_Grass`, read from `grass-component.js`
and the GLSL): 3,072 blades per 10 × 10 m patch (about 30 a square metre) on a 32 × 32 grid of
patches round the camera, each patch one draw call, CPU frustum- and distance-culled to 100 m.
The geometry holds only a `vertIndex` attribute plus a half-float per-instance offset; the
vertex shader builds the blade. High LOD 6 segments (14 vertices a side, double-sided), low
LOD 1 segment beyond 15 m, height fading to zero toward 100 m. Per-blade hash: angle, shade
0.5–1, height 0.75–1.5, lean 0.1–0.4; blade 0.1 × 1.5 m. Colour base `(0.02, 0.075, 0.01)` to
tip `(0.65, 0.8, 0.25)` by `easeIn(h, 4)`, edges darkened to 0.85, fake AO
`mix(0.25, 1, easeIn(h, 2))`. Two normals rotated ±0.3π round Y for roundness, then pulled
toward world up: `mix(UP, n, 0.25)` near, pure up far (so the blades light like the lawn).
Wrap diffuse (wrap 0.5) plus back-scatter. Wind is procedural: direction from
`noise12(xz * 0.05 + 0.05 t)`, strength from `noise12(xz * 0.25 + t)` remapped to 0.25–1,
squared, × 1.25, × height fraction.

**Elysium** (thebenezer, Codrops 2025): intersecting alpha-cut cards instead of blades; 256
chunks of `InstancedMesh` with frustum culling let it reach 1M instances; three LODs hidden by
fog; base-to-tip colour as AO; `alphaTest`; sine wind plus a scrolling noise texture; one
directional light; runs on a 2018 i3 laptop and phones.

**False Earth** (2026, WebGPU): Bezier blades on compute with indirect draw, 64 bytes a blade,
about 80% culled before the vertex stage, LOD tiers of 15 / 5 / 2 segments at 0–5 / 5–20 /
20+ m, height AO and bent normals, no textures. **Bruno's 2025 folio**: one triangle per blade,
about 78,400 blades looped round the camera.

Breath of the Wild's actual blade topology is unverified (no Nintendo talk found); the fan
reimplementations use 5-vertex blades with vertex-colour gradients and little or no texture.

## 2. Foliage normals

Card clusters and blob clusters shade as separate planes and flicker like shattered glass. The
industry fix rewrites the vertex normals so the cluster lights as one volume: either transfer
them from a hull proxy, or "spherify" them from a centre (Blender's Data Transfer or Normal
Edit modifier; Airborn's trees transfer from an inner blob, per Simon Schreibt). In Three.js
it is a loop at build time, zero runtime cost:

```js
v.fromBufferAttribute(pos, i).sub(crownCentre).multiply(invRadii).normalize(); // ellipsoid
nrm.setXYZ(i, v.x, v.y, v.z);
```

Keep 20–30% of the original normal if the surface should still read as faceted; use
`DoubleSide` and stop the back face flipping the normal (drop the `faceDirection` multiply in
`normal_fragment_begin`); add wrap or back-face translucency (Crysis).

## 3. Ground without repetition

**Hex tiling** (Mikkelsen, JCGT 2022): three fetches a map, one per hex, weights `ω^γ` with
γ = 7 and β = 0.6, a contrast S-curve for colour, normal maps blended as derivatives; quality
"very similar" to histogram-preserving blending without its precomputation. **Deliot and
Heitz** (2019): three samples plus a lookup table but needs transformed textures and only
suits stochastic textures (sand, moss, rust). A Three.js port exists (`three-hex-tiling`,
tested on r151–r168; r186 unverified) that skips fetches under a weight threshold, so it
averages under three. **Quilez**: two fetches with a low-frequency index texture (what this
site's `antiTile` is, in spirit), four for per-tile transforms, nine for Voronoi. **Macro
variation**: a noise at two or three large scales multiplied over the albedo (standard in
Unreal landscapes), one fetch or none. **Triplanar**: three fetches a layer with the whiteout
normal blend; only on cliffs, gated by slope. **Splat by height and slope**: `smoothstep` on
`normal.y` and world y, no texture.

Most quality per fetch: macro tint (≤ 1), hex-tiled normal (3, the best repetition killer),
Quilez's two-fetch albedo, a detail normal at 8–16× faded by distance.

## 4. Pre-lit shading

Covered in the folio note: matcaps (128², one fetch), bakes on `MeshBasicMaterial`
(Heffernan's 4096² JPEG as `map`, `flipY = false`, sRGB; Bruno's my-room-in-3d mixes day,
night and neutral bakes plus a three-channel lamp mask in one shader). r186 specifics: glTF
`TEXCOORD_1` loads as `uv1`, so a lightmap needs `texture.channel = 1`; `MeshBasicMaterial`
multiplies `lightMap` by `RECIPROCAL_PI`, so `lightMapIntensity = Math.PI` for one-to-one;
putting the bake in `map` is simplest. A 4096² RGBA8 bake is 67 MB resident (89 with mips);
2048² about 22 MB; KTX2 cuts it 4–8×. Vertex colours with AO in alpha (Crysis) and palette
atlases (Synty) are the low-poly equivalents. `MeshToonMaterial.gradientMap` needs Nearest
filters and `NoColorSpace`.

## 5. Shadows cheaper and softer than a shadow map

**mrdoob's `webgl_shadow_contact`** (and drei's `ContactShadows`): an orthographic camera
under the ground looks up with a short far plane; `scene.overrideMaterial` is a
`MeshDepthMaterial` patched to output `(0, 0, 0, (1 − depth) · darkness)` into a 512² target;
a 9-tap horizontal and vertical Gaussian (`HorizontalBlurShader`, `VerticalBlurShader`)
ping-pongs twice (the second at 0.4); the result is the `map` of a transparent plane. drei's
defaults: resolution 512, far 10, `frames` to render only N times (a static scene with
`frames = 1` costs nothing after). Cost about 0.1–0.5 ms *est.* against a full caster pass and
five filtered taps on every receiving pixel. **Windland** (Anderson Mancini, Awwwards 2022):
every shadow in the scene baked into **one 2048² texture**, trees scattered with
`MeshSurfaceSampler`, wind in the vertex shader, Draco; 1.8 MB in all with a 30 fps floor.
**Blobs** as in the folio. **Cascades** only if dynamic sun shadows are a must: r186 ships
`SunLight` (`examples/jsm/lights/SunLight.js`) with a two-cascade shadow at 1024² each, and
its PCF is already a filtered Vogel-disk sample through `sampler2DShadow`.

## 6. Draw calls, memory, edges

`THREE.BatchedMesh` (r186): one material, many geometries and instances, one multi-draw;
`addGeometry`, `addInstance`, `setMatrixAt`, `setColorAt`, `setVisibleAt`, `optimize()`;
`perObjectFrustumCulled` and `sortObjects` (front to back opaque, back to front transparent).
`THREE.LOD.addLevel(object, distance, hysteresis)` takes hysteresis as a fraction of distance
to stop flicker. Impostors: agargaro's octahedral demo draws 200k trees with a meshoptimizer
LOD at 15–100 m and cards beyond; for a diorama one billboard card per far tree is enough
(this site's `avengers/hq/kit/impostor.js` already bakes and draws them).

Edges: Bruno forces pixel ratio 2 with no MSAA, four times the fragment work of ratio 1.
MSAA 4× shades once per pixel and only multiplies coverage and depth, and it enables
`alphaToCoverage`, which in r186 also sharpens an alpha-tested edge automatically
(`alphatest_fragment`: `smoothstep(alphaTest, alphaTest + fwidth(a), a)`), Golus's technique.
Gotcha: `EffectComposer`'s default target has no samples, so bloom kills MSAA and coverage
unless the target is made with `samples` (this site's `lib/stage3d.js` already does). Without
MSAA, `alphaHash` is the fallback and is noisy without temporal AA. Recommendation: MSAA 4×
target, pixel ratio capped 1.5–2, SMAA or FXAA only where MSAA is off.

## 7. Wind, the cheap physics of foliage

**Crysis** (Tiago Sousa, GPU Gems 3 ch. 16): main bending that preserves length,
`f = y · bendScale + 1; f *= f; f = f · f − f; pos.xz += wind · f; pos = normalize(pos) · len`;
detail bending from vertex colours (R edge stiffness, G per-leaf phase, B branch stiffness, A
AO); waves as smooth triangle waves at 1.975, 0.793, 0.375 and 0.193; two-sided leaves with
back-face translucency. In Three.js: `onBeforeCompile` into `begin_vertex`, phase from the
instance's world xz (or a 64² noise at `xz · 0.05 + 0.1 t`), `bend = heightFrac²` from a pivot
at the base, trunk 0.3–0.6 Hz small, leaves 2–4 Hz flutter scaled by vertex colour, one time
uniform a frame; 10–30 ALU a vertex, no CPU.

## Ranked: most quality gained per millisecond (car, trees, shrubs, lawns, desert)

1. Bake static shadows and AO into the ground and stop static things casting (−1 caster pass,
   −5 taps a pixel, +1 fetch; about −1 to −3 ms *est.*; large gain: soft contact, GI-like falloff).
2. Ellipsoid normals on canopies and shrubs with wrap lighting (0 ms; large: canopies read as volumes).
3. The car's shadow as a blob or a 256² contact shadow on its own layer (+0.05–0.3 ms *est.*; softer and better grounded than PCF).
4. Lawns as blades, SimonDev style: normals toward up, root-to-tip gradient as AO, two LOD rings, no casting (+0.5–1.5 ms *est.* for 100–200k blades; large over flat lawns).
5. Desert and roads: hex-tiled normal and albedo plus a one-fetch macro tint and a slope/height splat (+3–4 fetches on the ground, +0.2–0.5 ms *est.*; kills tiling).
6. MSAA 4× target plus `alphaToCoverage` on every cutout card, pixel ratio capped 1.5–2 (≈ 0 to +0.5 ms, often negative against forced ratio 2; crisp edges, no shimmer).
7. Vertex-shader wind, Crysis main bending plus a leaf phase (≈ 0 ms; the scene feels alive).
8. Instance or batch every prop and tree, LOD with hysteresis, billboard cards for far trees (−CPU ms; neutral look, frees budget for 4–6).
9. Matcap or toon ramp for the car and props in place of PBR plus lights (−ALU a pixel, 1 fetch).
10. Only if dynamic sun shadows are required: `SunLight` with 2 × 1024 cascades, casting from the car and trees only (+1–2 ms *est.*).

## Sources

- SimonDev, `simondevyoutube/Quick_Grass` and "How Big Budget AAA Games Render Grass" (2023).
- Ghost of Tsushima procedural grass (GDC 2021) via tigerabrodi's two write-ups and `cainrademan/Unity-Grass`.
- [Codrops: the fluffiest grass with Three.js (Elysium, 2025)](https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/);
  [Codrops: False Earth (2026)](https://tympanus.net/codrops/2026/04/21/false-earth-from-webgl-limits-to-a-webgpu-driven-world/);
  [Codrops: Windland case study (2022)](https://tympanus.net/codrops/2022/04/25/case-study-windland-an-immersive-three-js-experience/).
- [Mikkelsen, Practical Real-Time Hex-Tiling, JCGT 2022](https://jcgt.org/published/0011/03/05/paper.pdf); Deliot and Heitz, Procedural Stochastic Textures by Tiling and Blending (GPU Zen 2, 2019); [Quilez on texture repetition](https://iquilezles.org/articles/texturerepetition/); `three-hex-tiling` on npm.
- [GPU Gems 3 ch. 16, Vegetation Procedural Animation and Shading in Crysis](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-16-vegetation-procedural-animation-and-shading-crysis).
- [Golus, anti-aliased alpha test](https://bgolus.medium.com/anti-aliased-alpha-test-the-esoteric-alpha-to-coverage-8b177335ae4f); [Golus, triplanar normals](https://bgolus.medium.com/normal-mapping-for-a-triplanar-shader-10bf39dca05a).
- [Simon Schreibt, Airborn trees](https://simonschreibt.de/gat/airborn-trees/); the Foliage Normals Blender add-on; [douges.dev fluffy trees](https://douges.dev/blog/threejs-trees-1).
- three r186 at the tag: `examples/webgl_shadow_contact.html`, `examples/jsm/lights/SunLight.js`, `src/objects/BatchedMesh.js`, `src/objects/LOD.js`, `ShaderChunk/alphatest_fragment.glsl.js`, `ShaderChunk/shadowmap_pars_fragment.glsl.js`, `ShaderLib/meshbasic.glsl.js`; drei `ContactShadows.tsx`.
- `henryjeff/portfolio-website` (`BakedModel.ts`); `brunosimon/my-room-in-3d` (`Baked.js`, `shaders/baked/fragment.glsl`); [Awwwards: Bruno's 2025 case study](https://www.awwwards.com/brunos-portfolio-case-study.html).
- Unverified this session: BotW's and Sable's grass internals, Jesse Zhou's pipeline, the Journey portal bake's resolution, `three-hex-tiling` on r186, SimonDev's reported fps.
