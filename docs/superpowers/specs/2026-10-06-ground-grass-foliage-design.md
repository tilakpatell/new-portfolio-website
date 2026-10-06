# Ground, grass and foliage: quality up, compute down, with Albuquerque as the example

Date: 2026-10-06. Status: researched and specified for Opus 5.5 to implement, as a step
between Step 1 and Step 2 of `2026-10-06-baked-look-and-toy-physics-design.md`; the owner has
not reviewed it. Research: `docs/research/2026-10-06-ground-grass-foliage-techniques.md`
(the studio techniques, ranked by quality per millisecond) and
`docs/research/2026-10-06-bruno-simon-folio.md`.

## Intent

The owner's ask: "Check how other people, experts, did it; if it's better than Bruno's, make
it the example for Opus: this is how you do textures like ground and grass when the quality is
better for lower compute. Make it high quality; this is supposed to make it incredibly more
performant."

The judgement: Bruno's 2019 folio is the cheapest way to *ground* and *pre-light* a diorama
(masks, blobs, bounce, matcaps: the first spec), but it has nothing for grass, foliage or
large textured grounds; its world is matcap blobs on a flat gradient. For those, the studio
techniques below are better on both counts, quality and cost, than what this site does now.
So this spec adds them as shared modules and applies them to Albuquerque, and names where
Bruno's answer stays (shadows and pre-lit props).

Where the gains come from, in one paragraph: a canopy whose normals point out from its centre
lights as one soft volume instead of a hundred flat facets, for nothing; a lawn of real blades
lit as if they were the lawn, darkened at the root, thinning with distance, costs about a
millisecond and looks like grass instead of a green plane; a tiled scan sampled three times
with hex weights never repeats; a cutout card under multisampling has a crisp edge instead of
a shimmering one; wind in the vertex shader costs no CPU; and the shadow pass over the whole
city, which was the single most expensive thing on screen, is gone (Step 1).

## Where the site is (measured in this checkout)

- **Trees and shrubs.** Albuquerque's canopies are 5–7 icosahedron blobs merged (detail 1,
  about 500 triangles), `MeshStandardMaterial` with `flatShading: true` and a vertex tint by
  height, casting shadows, no LOD, no wind. The 520 creosote bushes are flat-shaded blob
  clusters; the yucca a spray of blade geometry. The Shire's oaks, the towns' trees and the
  galaxy's forests are built the same way (`galaxy/surface/props/forest.js` `blob`). Nothing
  on the site reshapes foliage normals.
- **Grass.** The Shire has 21,000 four-blade tufts (`shire/ground.js`): vertex colours root to
  tip, normals pointing up (the right idea), a sine sway in the vertex shader, binned in 18 m
  squares so off-screen bins cull, `MeshLambertMaterial`, lit by the sun's shadow map. No LOD,
  no density falloff with distance, no fake ambient occlusion, no per-blade variation beyond
  placement. The HQ lawn (`avengers/world/grass.js`) draws a patch of blades that follows
  Spider-Man, which is the right structure. Albuquerque's lawns are flat planes.
- **Ground.** Albuquerque's desert is procedural noise at four scales in the shader
  (`terrain.js`), which never repeats: keep it. Its roads and lots are painted 512 tiles
  repeated along the street with normal and roughness maps; `lib/three/surface.js`'s
  `antiTile` (a two-fetch noise blend) exists but isn't used there. The HQ lawn, the music
  courtyard and Roll out use `antiTile`.
- **Edges.** `lib/stage3d.js` renders into a multisampled target (`samples` from the tier,
  4 on high), so `alphaToCoverage` works with bloom; it's used once (`hq/kit/impostor.js`).
  26 materials use `alphaTest` alone. Pixel ratio is capped at 1.75 and stepped down by the
  LADDER when frames pass 24 ms.
- **Draw calls.** `InstancedMesh` everywhere (215 uses), no `BatchedMesh`, no `THREE.LOD`;
  impostors only in the HQ compound.

## Principles

1. **Static shadows are baked, not cast.** (Step 1 of the first spec.) Nothing in this spec
   casts a shadow; blades, canopies and props are darkened by the floor mask where they stand.
2. **Foliage normals come from the volume, not the facet.** Every canopy, bush and tuft gets
   normals from an ellipsoid round its centre (canopies) or from world up (grass), with wrap
   lighting, so it shades like one soft thing.
3. **Grass is blades built in the vertex shader**, one draw per patch, two LOD rings,
   thinning and shortening with distance, lit like the lawn, dark at the root, never casting.
4. **Tiled scans are hex-tiled** (three fetches) or two-fetch blended (`antiTile`), with a
   macro tint; procedural grounds stay procedural.
5. **Cutouts use alpha-to-coverage under MSAA**, never `alphaTest` alone; the pixel ratio
   stays capped at 1.75 (Bruno's forced 2 is four times the fragment work).
6. **Wind is a vertex shader**, Crysis main bending with a per-instance phase; one uniform.
7. **Far things are cards.** Three LOD levels with hysteresis for trees; a billboard card
   (baked at load with the HQ `bakeImpostor`) beyond the last.
8. **Tiers set counts, not looks.** A phone gets fewer blades and no far-LOD swap, the same
   shading.

## Architecture

### 1. `src/lib/three/foliage.js`

```
spherifyNormals(geometry, { centre, radii, keep = 0.25 }) → geometry   (pure, tested)
wrapLighting(material, { wrap = 0.5, backScatter = 0.25 })  → material  (chunk swap)
wind(material, { kind: 'tree' | 'shrub' | 'grass', strength, trunkHz = 0.45, leafHz = 2.6 }) → material
canopyLevels(geometry, { far = 60, card = 140 }) → { near, mid }        (detail-0 copy of the blobs)
```

- `spherifyNormals`: for each vertex, `n = normalize((p − centre) / radii)`, blended with the
  original normal by `keep`. Ellipsoid radii come from the geometry's bounding box.
  `flatShading` goes off on the material. Tested: a unit sphere's normals come out radial; a
  flattened one's lean outward.
- `wrapLighting`: in `lights_fragment_begin`, replace the directional `RE_Direct` call's
  `dotNL` with `saturate((dot(n, l) + wrap) / (1 + wrap))` and add a back-scatter term
  `backScatter · saturate(dot(−n, l)) · diffuse` to the indirect light; drop the
  `faceDirection` normal flip in `normal_fragment_begin` for `DoubleSide` leaves.
- `wind`: Crysis main bending in `begin_vertex`, length preserved, pivot at the instance's
  base (`instanceMatrix[3]` under `USE_INSTANCING`), phase from the instance's world xz,
  `bend = heightFrac²`; a trunk at `trunkHz` with small amplitude, leaves fluttering at
  `leafHz` scaled by the vertex colour's green (or by height where there is none); grass uses
  SimonDev's `noise12` direction and strength. One `uTime` uniform shared per scene. This
  supersedes the Shire's `swaying`.

### 2. `src/lib/three/grass.js`

```
createGrassField({ patch = 10, perPatch, lods = [{ to: 15, segments: 6 }, { to: 100, segments: 1 }],
                   grows(x, z) → 0..1, colours: { base, tip }, height: [0.75, 1.5], mask, wind, tier })
  → { group, update(camera, t), dispose }
```

- Blades are built in the vertex shader from a `vertIndex` attribute and a half-float
  per-instance offset (`InstancedBufferGeometry`), SimonDev's layout: no per-blade geometry
  on the CPU. Per blade a hash gives angle, shade 0.5–1, height 0.75–1.5, lean 0.1–0.4.
- Patches of `patch` metres on a grid round the camera, each one `InstancedMesh`-style draw,
  frustum-culled by its bounding sphere; `perPatch` from the tier (high 3,072 ≈ 30/m²; mid
  1,200; low 400 or none). Blades thin out past 50 m and shorten to zero by 100 m.
- Shading on `MeshLambertMaterial`: normal `mix(UP, bladeNormal, 0.25)` near and pure up
  far; colour `mix(base, tip, easeIn(h, 4))`; fake ambient occlusion `mix(0.25, 1, easeIn(h, 2))`;
  edges darkened to 0.85; view-space thickening in `mvPosition.x`; wrap 0.5 plus back-scatter.
  The floor mask (Step 1's `uMask`) is read once per blade at its root in the vertex shader
  and multiplied into its colour, so a lawn under a tree is dark where the tree's shadow is.
- `grows(x, z)` is the world's own rule (a lot's lawn rectangle, the Shire's `growable`);
  `mask` an optional top-down texture (the HQ `lawnMask` pattern).
- Never casts or receives a shadow-map shadow. Pure parts (the hash, the LOD ring choice,
  `easeIn`) tested.

### 3. `src/lib/three/surface.js` gains `hexTile`

```
hexTile(material, { patchScale = 2, gamma = 7, contrast = true, maps })  → material
hexTileShader(shaders, opts, chunks)  (pure, tested on stub shaders like antiTileShader)
```

Mikkelsen's method: three fetches a map, one per hex cell, weights `ω^γ` with a contrast
S-curve for colour and derivative blending for the normal; cells rotated per hex. Applied
to `map`, `normalMap`, `roughnessMap`, `aoMap` by chunk swaps, the way `antiTile` does, and
mutually exclusive with it (one or the other). `antiTile` stays as the two-fetch option for
the `mid` tier; `low` gets neither.

### 4. `src/lib/three/contactShadow.js`

```
createContactShadow({ size = [6, 8], resolution = 256, layer, darkness = 0.9, blur = 1.2 })
  → { mesh, update(renderer, scene, position), dispose }
```

mrdoob's `webgl_shadow_contact` as a module: an orthographic camera under the ground looking
up with `far` a little over the car's height, `scene.overrideMaterial` a `MeshDepthMaterial`
patched to output `(0, 0, 0, (1 − depth) · darkness)` into a `resolution²` target, a 9-tap
horizontal and vertical blur twice (the second at 0.4), the result the `map` of a transparent
plane under the car. Only objects on `layer` render into it (the car and its wheels). Replaces
the car's blob where the tier can afford about 0.3 ms; the blob stays on `low`.

### 5. LOD and cards for trees

Per tree kind: `THREE.LOD` isn't used per instance (thousands of objects); instead three
`InstancedMesh`es per kind, near / mid / card, and the scene moves each instance's matrix
between them by distance to the camera with hysteresis 0.1, re-sorted every 0.5 s or 20 m of
camera travel (the Shire's `chunker` and the HQ `impostorForest` are the precedents). The
card is baked once at load with `bakeImpostor` (HQ) from the near geometry under the world's
rig at the current named time, redrawn at a time change; cards use `alphaToCoverage` with
`alphaTest 0.5`.

### 6. Tiers

| | high | mid | low |
| --- | --- | --- | --- |
| blades per 10 m patch | 3,072 | 1,200 | 400 (0 with Data Saver) |
| grass LOD rings | 15 / 100 m | 12 / 70 m | 10 / 40 m |
| tree levels | near 60 m, mid 140 m, card beyond | near 40, mid 100, card | mid only, card beyond 60 |
| ground tiling | `hexTile` | `antiTile` | none |
| car shadow | contact 256² | contact 128² | blob |
| MSAA / coverage | 4× / on | 2× / on | off / `alphaTest` |

## The example: Albuquerque (Step G, after Step 1, before Step 2)

Albuquerque's static set now stands on the baked floor mask and casts nothing (Step 1). This
step makes its trees, bushes, lawns, roads and the car's shadow look like the references at
lower cost than before Step 1.

### G1. Trees and bushes

- `city.js`: the broad and narrow canopies go through `spherifyNormals` (centre: the merged
  canopy's bounding-box centre; radii: its half-extents; `keep 0.2`), `flatShading` off,
  `wrapLighting`, `wind({ kind: 'tree' })`; the trunk keeps its material. The vertex tint by
  height stays (it reads as sky light from above).
- `scene.js`: the creosote clusters and the yucca sprays get `spherifyNormals` (per cluster)
  and `wind({ kind: 'shrub' })`; the yucca's blade normals are blended toward up like grass.
- LOD per the architecture: near (the current detail-1 canopy), mid (`canopyLevels`' detail-0
  copy, about a third of the triangles), card beyond; `scatter` and `many` gain the three-mesh
  arrangement and the distance re-sort.
- `castShadow` is already off (Step 1).

### G2. Lawns

- `plan.js` already marks lawn lots; `roads.js` paints them as a flat `lawn` surface. Add
  `createGrassField` with `grows(x, z)` true inside those rectangles (minus drives), base
  `#4f6e2e`, tip `#a8c25a` tinted by the lot's existing lawn colour, height `[0.18, 0.32]`
  (a mown lawn, not a meadow), the Step 1 mask read at the root. Walt's and the neighbours'
  front lawns and the park are the places to look.
- The flat lawn plane stays underneath as the far LOD and the low tier's whole lawn.

### G3. Roads and lots

- `hexTile` on the asphalt, concrete and paver materials in `roads.js` (`map`, `normalMap`,
  `roughnessMap`), `patchScale 2`; the desert ground keeps its procedural shader. The lot
  surfaces' painted bays and the road markings are separate geometry and are untouched.
- Check at a slant down Central: the 512 tile's repeat is gone; count fetches in the shader
  (3 per map, 9 in all on a road pixel).

### G4. The car's shadow

- `createContactShadow` on layer 1 for the Aztek (and its wheels once Step 2 lands), 256² on
  high, 128² on mid, following the car each frame; the Step 1 blob remains for Hank, the
  traffic, the cast and the tumbleweeds, and for the Aztek on `low`.

### G5. Edges and cards

- Confirm the Albuquerque stage runs the tier's MSAA (`fit.samples`), and that the tree cards,
  the tumbleweed and any cutout use `alphaToCoverage: true` with `alphaTest`; replace bare
  `alphaTest` in this world.

### Measure, before and after Step G (at the same three `api.peek`s: Walt's drive, Central at
4th at a slant, the park)

- draw calls, triangles and frame time from `api.info` over 300 frames, on high and mid;
- the number of blades drawn and patches culled (expose on `api.info`);
- screenshots at noon and golden hour, saved as
  `docs/superpowers/shots/2026-10-06-abq-foliage-<peek>-{before,after}.webp`.

Acceptance: canopies read as soft volumes with no facet flicker when the camera moves; lawns
are visibly blades at the car's distance and still green planes at the far edge, with no
visible ring where the LOD changes; no tiling repeat visible down Central; the Aztek's shadow
is soft and hugs the wheels; every cutout edge is clean under MSAA; triangles drawn at the
Central peek are lower than before (LOD) and frame time on `mid` is lower than before Step 1;
lint, tests and the build pass; `rules.test.js` untouched.

## Next worlds (not in this spec)

The Shire (21k tufts → `createGrassField`; oaks → `spherifyNormals` and cards; `swaying` →
`wind`), the HQ lawn (already blades: adopt the LOD rings and up-normals), the galaxy's
forests (Endor's redwoods and ferns: LOD and cards), the music courtyard and Roll out
(`hexTile` in place of `antiTile` on high), Scranton's office plants.

## Decisions and assumptions

1. **No Blender, no new runtime dependency.** `three-hex-tiling` is unverified on r186 and
   the house pattern is a tested chunk swap, so hex tiling is written in `surface.js`.
2. **Blades, not cards, for grass.** Elysium's cards reach a million instances, but blades
   need no texture, shade correctly with up-normals and read better close to a car.
3. **Trees stay code-built.** Spherified normals and LOD cards make the existing blobs read
   as foliage; photographed Poly Haven trees (the HQ's) are not brought in here.
4. **The contact shadow is a per-tier luxury.** It is one extra depth pass and four small
   blurs; the blob is always the fallback.
5. **Grass reads the floor mask.** That couples `grass.js` to Step 1's `uMask` layout
   (`gRead`); the dependency is one shared GLSL snippet exported from `grounding.js`.

## Working notes for the implementer

- Same conventions and checks as the first spec (`npm run lint`, `npm test`, `npm run build`,
  `node scripts/autopilot-check.mjs --routes /albuquerque --settle 8000`), one pull request
  for Step G, commits on the current branch, no push.
- Precedents to copy from: `lib/three/surface.js` (pure shader rewrite + hook), `shire/ground.js`
  (`chunker`, `tuftGeometry`, `swaying`), `avengers/world/grass.js` (a patch that follows the
  player, a lawn mask), `avengers/hq/kit/impostor.js` (`bakeImpostor`, `impostorForest`,
  `alphaToCoverage`), `office/world/ao.js` (instance colour as alpha).
- SimonDev's `Quick_Grass` and mrdoob's `webgl_shadow_contact` are the two sources to read
  line by line; both are small. The research note has the numbers.
