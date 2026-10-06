# Why Bruno Simon, Igloo Inc and Active Theory look expensive, and why this site looks janky

Date: 2026-10-06. Third pass after `2026-10-06-bruno-simon-folio.md` (the 2019 folio) and
`2026-10-06-ground-grass-foliage-techniques.md`. This one reads the **2025** folio
(`brunosimon/folio-2025` at 41046b5, the site now at bruno-simon.com), Active Theory's shipped
bundle and shaders (a public mirror of activetheory.net, `DDW-X/activetheory.net` at d830e0f:
`assets/js/app.1780406240914.js`, `assets/shaders/compiled.vs`), and what is published about
Igloo Inc (no source is public). Then this repo's screenshots and code.

The live sites, Awwwards, Medium, the three.js forum and webgpu.com were blocked by this
session's network policy, so Igloo's details come from search summaries of its Awwwards case
study and are marked as such.

## The short answer

None of the three has a technology this site lacks. Three.js r186 can do everything Bruno's
folio does; Active Theory's tricks are cheaper than ours, not dearer. What they have is:

1. **One look, enforced by one material.** Bruno's whole world goes through a single shader,
   `MeshDefaultMaterial`. Active Theory's goes through one lighting include, `fbr.fs`.
   This site has 865 `MeshStandardMaterial`, 648 `MeshBasicMaterial`, 60 `MeshPhysicalMaterial`
   and 51 `MeshLambertMaterial` call sites (tests excluded). It also has three tone mappers (ACES 8, Neutral 5,
   None 4) and 12 separate `new WebGLRenderer` calls.
2. **No textures to go blurry.** Bruno colours the world from a **128 × 4 px palette**
   (`static/palette.png`) and a 512² terrain data map. Edges are geometry, so they stay sharp at
   any pixel ratio. This site wraps AI-generated models in one atlas each. The Smith house is
   one 1024² WebP stretched over a house 28 m wide in the C-137 world (`HOUSE_GARAGE`), about
   20–35 texels a metre on its front *(est.)*. The README shot draws it at about 36 screen px
   a metre at 1× (72 on a 2× screen), so the texture is magnified 2–4× and smears.
3. **One art direction, made by one hand in one tool.** Bruno models every object in Blender
   against the same palette. Igloo's team grew its ice in Houdini. This site mixes Meshy AI
   models, Sketchfab and Battlefront rips, Kenney kits, CC0 photo textures and procedural
   meshes. A realistic Han Solo walks past blob trees; a photo-textured Meshy house stands on a
   flat green plane.
4. **Depth on one scene, not breadth over twenty.** The 2025 folio is one island. Its grass,
   wind, leaves, flowers, rain, snow, tornado, lightning and water each have their own file,
   and **408 Tweakpane bindings** (`#debug`) let him tune them by eye. Igloo is three sections.
   This site has 13 worlds plus a galaxy and a universe map. It has 80 files that mention
   grass, 36 `setPixelRatio` sites and no live tuning panel. Its values are chosen by reasoning
   in code, not by looking.

## Bruno Simon, folio-2025, from the source

Stack: three 0.183 `three/webgpu` (WebGPU, WebGL 2 fallback), TSL node materials, Rapier, Howler,
GSAP, Tweakpane. About 16.7k lines in `sources/Game`.

**One material for everything** (`Materials/MeshDefaultMaterial.js`, extends
`MeshLambertNodeMaterial`, overrides `outputNode`). Per fragment:
- base colour × light colour × intensity (day-cycle uniforms);
- **light bounce**: faces pointing down within `lightBounceDistance` 1.5 m of the ground mix
  toward *the terrain colour under them* (`terrain.colorNode(terrainData)`), so nothing floats;
- **core shadow**: `smoothstep(1, -0.25, dot(normal, sunDir))`, a soft terminator, not Lambert;
- **drop shadow**: the shadow map is caught as a float (`receivedShadowNode` returns 1 and stores
  the value) and used only as a mix factor;
- **shadows are a colour**: `mix(lit, baseColor × shadowColor, max(core, drop, custom))`.
  `shadowColor` is purple by day (`#6d3fff`), `#4e009c` at dusk, `#2f00db` at night, `#db004f`
  at dawn (`Cycles/DayCycles.js`). Shadows never go grey or black;
- **fog** toward a screen-space radial gradient that is also `scene.backgroundNode`, so the far
  ground melts into the sky exactly;
- alpha-test discard and a radial reveal.

Lighting (`Ligthing.js`): one `DirectionalLight` whose shadow camera follows the view's
"optimal area" (a box only as big as what's on screen). The map is 2048² on desktop and 512² on
phones, radius 3 or 2. The sun orbits with the day cycle.

**Grass** (`World/Grass.js`): one mesh, one draw call, `280 × 280 = 78,400` blades, **one
triangle each**. Positions are 2D on a jittered grid. In the vertex shader they wrap round the
camera with `mod(position − center, size)`, so the patch goes with you. Per blade:
- height = `0.6 × random × perlin(pos × 0.0321) × terrain.g`. `terrain.g` is a painted "grass"
  channel in a 512² RGBA terrain map; where it is under 0.5 the blade is pushed 100 m up and out
  of sight;
- the triangle turns to face the camera (`atan` of the offset), so it is never seen edge-on;
- **colour = `terrain.colorNode(terrainData)`, the same function that colours the ground under
  it**, so blade and ground are one surface and there is no seam;
- normal forced to `(0, 1, 0)`, so it lights exactly like the ground;
- `shadowNode = (1 − tipness) × grass`: the root vertices count as in shadow, so each blade
  darkens to the ground with no AO texture;
- **wind**: only the tip vertex moves, by `wind.offsetNode(xz) × tipness × height × 2`.

**Wind** (`Wind.js`) is the whole "sway": two lookups in one Perlin texture. The first is at
`xz × 0.5 × 0.2 + dir × t`; the second is at `xz × 0.5 × 0.1 + dir × 0.2t`, a slower, broader
gust. Their sum, minus one, scales the wind direction (angle 0.6π) × strength. Time runs as
`t += dt × 0.1 × strength`, so a stronger wind also moves faster. Weather drives the strength
from 0.1 to 1. Grass, flowers (`World/Flowers.js`) and bushes all read the same function, so
everything moves together.

**Bushes** (`World/Foliage.js`): 80 planes of 0.8 m, scattered in a sphere and merged into one
geometry. Each vertex normal is lerped 85% toward the sphere's outward direction, so a bush
shades as a ball. One `InstancedMesh` draws them all. The leaf alpha comes from a 128² SDF, and
**its UVs rotate by the wind's strength at that point**. The leaves shimmer without a vertex
moving. The colour mixes two greens by `dot(normal, sun)`. Received shadows are sampled 1 m
along the sun, so bushes don't shadow themselves into mud. Bushes near the car fade out on
screen so the car stays visible.

**Terrain** (`Terrain.js`): ground colour is a 16 px vertical gradient (`#ffa94e` →
`#5bc2b9` → `#13375f`, sand to shallow to deep water) indexed by the terrain map's blue
channel, mixed toward one grass colour `#b8b62e` by its green channel. Wheel tracks are drawn
into a render target and subtracted from `g`, so the car flattens the grass. It has no albedo
texture anywhere.

**Camera** (`View.js`): `PerspectiveCamera(25)`, a telephoto lens, on a sphere 15–30 m out.
A narrow lens flattens depth and frames a diorama, so there is never a horizon to fill.

**Post** (`Rendering.js`): bloom (threshold 1, strength 0.25, 5 mips on desktop and 2 on
phones), then a "cheap DOF": a hash blur weighted by `|uv.y − 0.5|`, a tilt-shift that blurs
only the top and bottom of the frame. MSAA only below pixel ratio 2. The ratio is capped at 2.

**Payload**: every `*-compressed.glb` together is **1.09 MB** (ETC1S KTX2 at quality 255,
Draco edgebreaker, positions quantised to 12 bits and normals to 6, `scripts/compress.js`).
Quality has two levels (desktop 0, mobile 1).
`PreRenderer` renders the whole scene once into a 32 px cube camera with everything made
visible, so every shader compiles before the reveal.

## Active Theory, from the shipped bundle

Their engine is **Hydra**, in-house since the early 2010s. It is not three.js. It has its own
scene graph (`Base3D`), its own compositor (`Nuke`) and a GPGPU particle system (`Antimatter`,
`Proton`). The shipped bundle holds 172 named shaders.

- **"FBR"**, fake-based rendering (`fbr.fs`). The lighting is a **matcap** looked up by the
  reflected view normal. Its UV is pulled toward the centre by roughness (blurrier highlight
  when rough). A Cook-Torrance specular from one light is added on top. All of it is multiplied
  by the occlusion channel of an **MRO** texture (metal, roughness, baked occlusion). No
  environment map, no light loop, no shadows.
- **`_renderer.shadows = !1`**: shadow maps are off for the whole world.
- **Baked lightmaps on a second UV set**: `FloorShader.glsl` reads `tLightmap` at `uv2`
  (R = AO, G = baked light). It adds a planar mirror, radially blurred by roughness, and a fake
  "light reflection" texture slid by view angle.
- **Every costly feature behind a GPU-tier test.** `Tests.enableWorldNukeMSAA()`,
  `Tests.renderFXAA()`, `Tests.volumetricLight()`, `Tests.capFPS()` and others. Tiers run
  `D`…`A++` plus a blocklist (`GPU.TIER`, `GPU.M_TIER`, `GPU.BLOCKLIST`), and `?performance&edit`
  overrides them.
- **Pixel ratio that supersamples on desktop** (`getDPR`): `OVERSIZED` → 1; tier < 0 →
  min(1.3, dpr); tier < 1 → min(1.8, dpr); weak mobile → min(2, dpr); tier > 4 →
  **max(1.5, dpr)**; otherwise **max(1.25, dpr)**. A plain 1× monitor on any decent card is
  drawn at 1.25–1.5× and filtered down. That is a large part of the "high-res" crispness.
- **Expensive effects at a fraction of resolution**: volumetric light at `dpr: .2`–`.4` or
  `resolution: .1`, then blurred and added in the composite.
- **One composite pass per page** (`HomeComposite.fs`: contrast plus volumetric add;
  `GlobalComposite.fs`: frost normal-map refraction, fluid push, RGB shift, bloom).
- Payload: about 2.5 MB of geometry in 32 binary files, 33 KTX2 textures, Draco and Basis
  transcoders.

## Igloo Inc (abeto with Bureaux), from published summaries

Unverified at source (Awwwards and webgpu.com blocked here; these points are from search-result
summaries of the case study). Stack: Three.js, three-mesh-bvh, Svelte, GSAP and Vite, with
Houdini and Blender for content. Ice crystals are grown offline by their own algorithm inside a
base shape (a cube or a cylinder). Particle shapes come from VDB volumes through their own
exporter and compression, "smaller than a typical website image". Particles colour by speed and
glow while morphing. UI text is SDF in WebGL, and scrambles swap SDF offsets instead of
re-laying out the DOM. The page has three sections. It won Awwwards Site of the Year 2024 and
Developer Site of the Year.

The lesson matches the other two: the hard part is done offline in a content tool, then shipped
as compact data. One material family (ice) and one palette run through every frame.

## This site, against them

Read from the README's screenshots (`docs/readme/world-*.webp`, `surface-*.webp`) and counts
over `src/`.

| | Bruno 2025 | Active Theory | this site |
| --- | --- | --- | --- |
| Shading model | one node material | one `fbr` include | Standard 865, Basic 648, Physical 60, Lambert 51 |
| Shadows | 1 map in a view-fitted box, used as a tint | none, baked | `shadowMap.enabled` set in 20 files (PCF), grey |
| Shadow colour | purple/blue by time of day | baked | grey (darkened light) |
| Colour source | 128 × 4 palette + 512² terrain map | KTX2 albedo + MRO + lightmap | 1K Meshy atlases, CC0 photo sets, flat colours |
| Tone mapping | one | one composite | ACES 8, Neutral 5, None 4 |
| Grass colour | the ground's colour at that point | n/a | its own root/mid/tip colours (galaxy), or crossed tuft cards (Shire) |
| Wind | one function for grass, flowers, leaves | n/a | per world |
| FOV | 25 | per scene | mostly 50–60 |
| Fog | equals the sky gradient | composite | `Fog` 30, `FogExp2` 9, colours per world |
| Supersampling on a 1× desktop | no (MSAA instead) | 1.25–1.5× on most tiers | only at `ultra` (`minRatio 1.5`) |
| Live tuning | Tweakpane, 408 bindings | GUI editors, perf overrides | none |
| Payload | ~1.1 MB models | ~2.5 MB geometry | 942 GLBs, 324 MB; `public/` 498 MB |

What the screenshots show:

- **The Shire**: the grass is crossed cards with their own texture and lighting. They don't
  match the ground's green, and the dirt path ends in a hard edge. Flowers stand like sticks.
  The hobbit is low-poly toon, the grass is semi-photo. The character's shadow is a hard grey
  shadow-map edge.
- **Endor**: the ground is a flat brown plane; the ferns are flat cards that seem to float. The
  trees are cylinders with blob canopies, yet Han and Chewie are realistic-ish rigged models.
  The fog is the best part of the frame.
- **C-137**: the Meshy house's 1K atlas is visibly soft. The lawn is one flat green with no
  blades, no gradient and no bounce. Each piece is a different fidelity.
- **Albuquerque**: the closest to cohesive (baked floor shadows, warm). Desert tiles repeat, and
  the tower's texture is low-res close up.

## Why we can't (yet), ranked

1. **No single look.** Every world picks its own materials, tone mapper, fog and lights. Bruno
   and Active Theory route every pixel through one shading function, so polish in one place
   lands everywhere. Here polish stays where it was applied.
2. **Mixed asset sources at mixed fidelity.** AI meshes with baked atlases, photo textures and
   low-poly kits in one frame read as a collage. That reads as "janky" more than any frame-rate
   problem.
3. **Textures carry detail they can't hold.** A 1K atlas over a 28 m house has too few texels.
   Bruno avoids the problem by having no albedo textures. Active Theory avoids it with tuned
   KTX2 maps on simple shapes and lightmaps on a second UV.
4. **Grass and ground are two things.** Ours have separate colours, so the seam shows. His
   blade is the ground, raised.
5. **Grey shadows and generic lighting.** Live PBR lights and a grey PCF map give flat
   midtones. His tinted terminator, coloured shadow and ground bounce give the illustrated
   warmth.
6. **Wide lenses.** FOV 50–60 shows horizons and empty middle ground that must be filled. FOV 25
   frames a diorama.
7. **No tuning by eye.** Without a live panel, numbers come from guesses and screenshots, one
   commit at a time.
8. **Breadth.** Thirteen worlds built at speed (738 commits on 2026-10-06 alone in this clone)
   cannot each get a year of one person's attention. The three studios each built one scene.

Engine speed and the device tiers are **not** the problem. `lib/device.js` tiering, KTX2,
meshopt, `ImageBitmapLoader` and the shader warm-up are already on a par with theirs.

## What would close the gap

In order of effect per hour, all possible on three r186 and WebGL 2 (no WebGPU port needed):

1. **One house material** (`lib/three/house.js`): a `MeshLambertMaterial` patched with
   `onBeforeCompile`, the same shape as `lib/three/surface.js`. It needs: a palette or flat
   colour; a smoothstep terminator; the shadow map read as a mix factor toward
   `base × shadowColor`; a ground-colour bounce under 1.5 m; fog to the sky colour. Each world
   then supplies only a **look**: `{ light, shadowColor, fogA, fogB, bounce }`, with one tone
   mapper (Neutral) everywhere.
2. **A terrain data map per world**: a 512² RGBA (grass amount, height or wetness, ground
   type). One function `groundColor(xz)` feeds the ground, the grass and the bounce.
3. **Bruno's grass as a library piece**: one triangle a blade, about 78k in one draw, wrapped
   round the camera. Colour = `groundColor(xz)`, normal up, root counted as shadow. The galaxy
   and Avengers versions are close; they need the ground's colour and the shared wind.
4. **One wind** (`lib/three/wind.js`): two scrolling Perlin lookups, strength from the world's
   weather, read by grass tips, flower heads, and leaf-alpha UV rotation on bushes.
5. **Restyle or replace the worst-fitting models**: flat palette colours on Meshy meshes
   (drop the atlas, keep the shape) wherever the world's look is stylised.
6. **Supersample desktops like Active Theory**: add `minRatio: 1.25` to the `high` row of
   `BUDGETS` in `lib/device.js`, held by the existing frame-time watchdogs.
7. **A `#debug` panel** (Tweakpane, dev-only and lazy-loaded) bound to the look, the wind and the
   grass, so the values are tuned by eye.
8. **Narrower lenses** where the camera allows (third-person 35–40, overhead 25–30).

Do it on **one flagship world first**, the Shire (the grass the visitor notices), until it
reads like the folio. Then move each world onto the house material, one at a time.

## Sources

- `brunosimon/folio-2025` at 41046b5: `sources/Game/{Rendering,Ligthing,Wind,Terrain,Materials,Fog,View,Viewport,Quality,PreRenderer,Debug}.js`,
  `World/{Grass,Foliage,Flowers}.js`, `Materials/MeshDefaultMaterial.js`, `Passes/cheapDOF.js`,
  `Cycles/DayCycles.js`, `scripts/compress.js`, `static/palette.png`, `static/terrain/terrain.png`.
- `DDW-X/activetheory.net` at d830e0f (a mirror of the production site):
  `assets/shaders/compiled.vs` (`fbr.fs`, `fbr.vs`, `matcap.vs`, `FloorShader.glsl`,
  `TreeFBR.glsl`, `HomeComposite.fs`, `GlobalComposite.fs`), `assets/js/app.1780406240914.js`
  (`getDPR`, `Tests.*`, `GPU.*`, `_renderer.shadows`). The repo's README prose is speculative.
  Only the shipped code and shaders are cited here.
- Igloo Inc: search summaries of [Awwwards: Igloo Inc case study](https://www.awwwards.com/igloo-inc-case-study.html)
  and [webgpu.com: Igloo Inc](https://www.webgpu.com/showcase/igloo-inc-procedural-crystals/);
  [abeto on X, Site of the Year](https://x.com/abeto_co/status/1900152588768579701).
- [Awwwards: Bruno's portfolio case study (2025)](https://www.awwwards.com/brunos-portfolio-case-study.html),
  via search summary: Blender for the whole world, terrain painted in Blender's preview, about
  78,400 one-triangle blades.
- [Active Theory: the story of technology built at Active Theory](https://medium.com/active-theory/the-story-of-technology-built-at-active-theory-5d17ae0e3fb4)
  (Hydra, Aura), via search summary.
- This repo: `docs/readme/*.webp`, `src/lib/device.js`, `src/components/galaxy/surface/grass.js`,
  `src/components/middleearth/shire/ground.js`, `public/models/c137/smith-house.glb`
  (1 mesh, one 1024² WebP), `src/components/rickmorty/world/rules.js` (`HOUSE_GARAGE`, 28 × 14 m).
