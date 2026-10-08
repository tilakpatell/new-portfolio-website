# Bruno Simon's folio-2025: the assets, the foliage, the world. And the Quaternius packs.

Date: 2026-10-08. Read from a fresh clone of `brunosimon/folio-2025` (HEAD `41046b5`, three 0.183 on WebGPU and TSL) and from `tilakpatell/tilakverse-assets` (HEAD `8506439`). The earlier note `2026-10-08-folio-2025-physics-terrain-streaming.md` has his physics, terrain and streaming; this one has what it left out: how his assets are made and loaded, the one material and the palette, and the GPU systems that make the leaves, grass, trees, snow and rain move (every number), then a file-by-file inventory of the nine Quaternius packs. The design that follows from it is `docs/superpowers/specs/2026-10-08-kit-worlds-design.md`.

Four reports, as the readers wrote them, lightly cleaned (paths made relative). Line numbers are of those checkouts.


---

# 1. How he uses his assets


# Bruno Simon folio-2025 — HOW HE USES HIS ASSETS (as-is report)

Repo root: `folio-2025/` (all paths below relative to it). HEAD = `41046b5` 2026-04-07. `node_modules` NOT present (no gltf-transform available; GLBs parsed with a hand-rolled JSON-chunk reader). Stack: `three@^0.183.2` (WebGPU + TSL), `@dimforge/rapier3d@^0.17.3`, vite 7, `@gltf-transform/cli|core|extensions|functions@^4.x` (build-time only), `sharp` (UI webp). `package.json:7-10` scripts: `compress` = `node scripts/compress.js static/`.

## 1. scripts/compress.js (build-time asset pipeline)

Three independent blocks, all run against `static/` (argv[2]).

**Block 1 — GLB** (`scripts/compress.js:8-78`)
- `glob('static/**/*.glb')`, ignoring names matching `/-(draco|ktx|compressed).glb$/` (line 20).
- Output name: `inputFile.replace('.glb', '-compressed.glb')` — note `ktx2File` and `dracoFile` are the SAME path (lines 28-29), so step 2 overwrites step 1 in place.
- Step 1 (lines 31-40): `gltf-transform etc1s <in> <out>-compressed.glb --quality 255 --verbose` → embedded PNG textures become KTX2/ETC1S (`KHR_texture_basisu`).
- Step 2, on close (lines 46-61): `gltf-transform draco <compressed> <compressed> --method edgebreaker --quantization-volume mesh --quantize-position 12 --quantize-normal 6 --quantize-texcoord 6 --quantize-color 2 --quantize-generic 2` → `KHR_draco_mesh_compression`.
- Originals are kept; compressed files committed alongside (`*-compressed.glb`).
- Verified on disk: `areas-compressed.glb` extensionsUsed `["KHR_draco_mesh_compression","KHR_materials_emissive_strength","KHR_texture_basisu"]`, generator `glTF-Transform v4.2.1`, all 13 images `image/ktx2`.

**Block 2 — standalone textures → KTX2 via `toktx`** (`scripts/compress.js:83-141`)
- `glob('static/**/*.{png,jpg}')`, ignore `**/{ui,favicons,social}/**`.
- Output: `.png|.jpg` → `.ktx` (NOT `.ktx2` extension; file is KTX2 content, loaded by KTX2Loader).
- Default preset (line 97): `--nowarn --2d --t2 --encode etc1s --qlevel 255 --assign_oetf srgb --target_type RGB`.
- Per-path presets (lines 98-114), notable:
  - `palette.png`: `--encode uastc --genmipmap --assign_oetf srgb --target_type RGB` (line 109) — palette is UASTC (lossless-ish), with mipmaps.
  - `terrain/terrain.png`: `uastc --genmipmap --assign_oetf linear --target_type RGB` (data texture).
  - single-channel masks (`glyphs`, `satanStar`, `floor/slabs`, `foliage/foliageSDF`, `interactivePoints/*`, `intro/*`, `jukeboxMusicNotes`): `etc1s --qlevel 255 --assign_oetf linear --target_type R --swizzle r001`.
  - `whispers/whisperFlame.png`: `uastc ... --target_type R --swizzle r001` (first match wins; a later duplicate rule at line 113 is dead).
  - `overlay/overlayPattern.png`: `uastc --assign_oetf linear`.
  - `career/*.png`: `uastc --assign_oetf srgb --target_type RG`.
- Sizes observed: `palette.png` 362 B → `palette.ktx` 1504 B; `terrain.png` 334262 → `terrain.ktx` 350064 (UASTC bigger than PNG); `foliageSDF.png` 10950 → 3076; `floor/slabs.png` 45637 → 12715; lab/project images ~8x smaller (e.g. `attractors.png` 823784 → 103011).

**Block 3 — UI** (`scripts/compress.js:146-161`): `static/ui/**/*.{png,jpg}` → `.webp` via sharp quality 80.

## 2. readme.md Blender/export notes (`readme.md:117-150`)

- Blender export: "Mute the palette texture node (loaded and set in Three.js `Material` directly)"; "Use corresponding export presets"; "Don't use compression (will be done later)".
- Compress section documents the above: GLB etc1s `--quality 255`; textures `--encode etc1s --qlevel 255` default or per-path; UI → WebP.
- Despite "mute the palette node", every shipped palette GLB still embeds `palette.png` as a texture (areas, scenery, oakTreesVisual, benches, fences, lanterns, bricks, explosiveCrates, poleLights, vehicle/default, oldSchool all have `images: palette:image/png`). The embedded one is ignored at runtime: `Materials.updateObject` swaps the material by NAME (`palette`) to the runtime-built palette material (see §5).
- `readme.md:21-114` documents the tick ordering (ticker priorities 0..999); relevant: Objects at 4, Lighting 9, Foliage/Leaves/Grass/etc at 10, InstancedGroup at 13, Rendering 998.
- Blender source: `resources/folio-2025.blend` (+`.blend1`), `resources/models/bruno.glb|sudo.glb`, PSDs/EXRs for terrain data in `resources/textures/`.

## 3. Palette texture convention

- `static/palette.png` == `resources/palette.png` (byte-identical, `cmp`). PNG 128x4, RGB8, 362 bytes.
- Layout (decoded): 32 swatches of 4px width each × 4 rows. Rows are identical (±1 LSB noise). 24 swatches used (columns 0-23), columns 24-31 are `#000000`. Effective palette = 24 colours in a 1-D strip. Colours in order: `#7c7691 #ebd1a3 #574e37 #3dbbe7 #c8c2c1 #4a413c #575a5e #eec3af #e4a90c #91ad78 #e49a78 #988165 #abae2b #a49876 #b36d45 #e56202 #ec3f1c #fde6e1 #f8a658 #c30e3a #c366ef #ed719f #1e0603 #fff2e8`.
- UV indexing: vertices of palette-material meshes have UV collapsed to swatch centre. In `scenery.glb` all palette UVs: `u*32` ∈ {0.53, 16.50, 17.47…} i.e. `u = (col+0.5)/32`, `v = 0.5` exactly (uv count 6349; columns used 0,16,17,18). In `areas.glb` (70641 UVs) columns 0-24 used, v ∈ [0,1] (rows identical so v irrelevant). Flat-shaded per-face colour = one palette cell.
- Loading: `sources/Game/Game.js:107` declares `['paletteTexture', 'palette.{ktx|png}?cb=1', 'textureKtx'|'texture', cb]` with modifier `minFilter=NearestFilter; magFilter=NearestFilter; generateMipmaps=false; colorSpace=SRGBColorSpace`. Loaded in the FIRST (pre-intro) resource batch (lines 103-109) together with `respawnsReferences`, `behindTheScene/stars`, `intro/sound`.
- Consumer: `sources/Game/Materials.js:36-44 createPalette()` → `new MeshDefaultMaterial({ colorNode: texture(this.game.resources.paletteTexture).rgb })` saved under name `'palette'`. Any GLTF mesh whose material is named `palette` gets this material via `Materials.updateObject` (`Materials.js:356-366` → `getFromName(child.material.name, child.material)` line 363, returns existing by name at 273-277).
- `World.js:103-116 setTestKtx()` is a debug cube showing the palette texture (unused).

## 4. ResourcesLoader (`sources/Game/ResourcesLoader.js`)

- Lazy per-type loader map (`getLoader`, lines 16-53):
  - `'texture'` → `THREE.TextureLoader`
  - `'textureKtx'` → `KTX2Loader().setTranscoderPath('./basis/').detectSupport(game.rendering.renderer)` (lines 27-32); transcoder files: `static/basis/basis_transcoder.js` (57 KB) + `.wasm` (527 KB).
  - `'draco'` → `DRACOLoader().setDecoderPath('./draco/').preload()` (lines 33-38); `static/draco/draco_decoder.wasm` 286 KB, `draco_decoder.js` 719 KB, `draco_wasm_wrapper.js` 59 KB, plus unused `draco_encoder.js` 929 KB.
  - `'gltf'` → `GLTFLoader` with `setDRACOLoader` + `setKTX2Loader` (lines 39-48). No meshopt.
- `load(_files, progressCb)` (lines 55-123): each entry is a tuple `[key, url, loaderType, modifierFn?]`. Modifier (`_file[3]`) is applied to the resource before saving (line 78-79). Resources are cached by URL in `this.cache` (line 85, 99-105) so re-requests resolve synchronously. Rejects on first error (line 89-93). Progress callback `(toLoad, total)`.
- Declaration site: `Game.js:97-101` builds `compressedModelSuffix = '-compressed' | ''`, `compressedTextureFormat = 'textureKtx' | 'texture'`, `compressedTextureExtension = 'ktx' | 'png'` from `import.meta.env.VITE_COMPRESSED` (`.env.example` lists `VITE_COMPRESSED=`). Cache-bust `cb = '?cb=1'` (line 102). Two batches: batch 1 (lines 103-109) awaited before `Options/Respawns/View/Rendering.setPostprocessing/Reveal/.../Materials/Objects/World` are constructed; batch 2 (lines 132-172, 42 entries: foliageSDF, bushesReferences, vehicle, playgroundVisual/Physical, flowersReferences, bricks, fences, benches, explosiveCrates, lanterns, terrain texture+model, floor slabs, birch/oak/cherry Visual+References, scenery, areas, poleLights, whisperFlame, satanStar, tornadoPathReferences, overlayPattern, interactivePoints icons, jukebox, glyphs, 6 career textures, 2 timeMachine screens) is awaited in parallel with `import('@dimforge/rapier3d')` (line 129, 179) with progress feeding `world.intro.updateProgress` (line 175). Then `Terrain, Physics, ..., world.step(1)` (lines 183-199).
- Texture modifiers specify per-texture: filters (Nearest for palette/stars/foliageSDF/overlay/icons; Linear for sound/slabs/whisperFlame/glyphs/career), `generateMipmaps=false` everywhere, `flipY=false` for terrain + career, wrap modes, `colorSpace=SRGB` only for palette/stars/timeMachine screens.
- Secondary direct loader use: `LabArea.js:468,841`, `ProjectsArea.js:482`, `Intro.js:151` call `resourcesLoader.getLoader('textureKtx')` for on-demand image loads (lab/projects galleries).

## 5. Material system

### Materials registry (`sources/Game/Materials.js`)
- `this.list = Map<name, material>` (line 11). Constructor builds: palette (36-44); emissive radial gradients `emissiveOrangeRadialGradient (#ff8641→#ff3e00, 1.7)`, `Purple (#454bbc→#ff2eb4, 1.7)`, `Blue (#91f0ff→#128fff, 1.7)`, `Green (#f8ffa6→#74ff00, 1.5)`, `White (#ffffff→#666666, 2.7, no normalize)` (lines 27-31); `redGradient (#ff3a3a→#721551)` (33).
- `createEmissiveGradient` (132-178): `MeshBasicNodeMaterial({transparent:true})`, color = `mix(colorA, colorB, uv().sub(0.5).length().mul(2))`, optionally divided by `luminance()` then `* intensity` (>1 → feeds bloom threshold 1), passed through `MeshDefaultMaterial.revealDiscardNodeBuilder`, `fog=false`.
- `createGradient` (180-200): `MeshDefaultMaterial({ colorNode: mix(colorA, colorB, uv().y) })`.
- `createFromMaterial(baseMaterial)` (287-343): for GLTF `MeshStandardMaterial`/`MeshLambertNodeMaterial`: colorNode = `texture(map).rgb` or `color(baseMaterial.color)`; alphaNode = `texture(alphaMap)` or `float(opacity)`; special-case names `projectsLabels`/`blackboardLabels` → premultipliedAlpha, transparent, alpha from `map.r`; returns `new MeshDefaultMaterial({colorNode, alphaNode, hasCoreShadows:true, hasDropShadows:true, transparent})` with `.map` kept.
- `getFromName(name, base)` (273-285): name-keyed cache → one shared material instance per GLTF material NAME across all GLBs. `updateObject(mesh)` (356-366) traverses and replaces unless `material.userData.prevent`.
- `Objects.add` calls `materials.updateObject(model)` by default (`Objects.js:48-49`, `updateMaterials: true`).

### MeshDefaultMaterial (`sources/Game/Materials/MeshDefaultMaterial.js`) — extends `THREE.MeshLambertNodeMaterial`
Parameters (lines 27-45): `depthWrite, depthTest, side(FrontSide), wireframe, transparent, shadowSide(FrontSide)`, feature flags `hasCoreShadows, hasDropShadows, hasLightBounce, hasFog, hasWater, hasReveal` (all default true), nodes `colorNode (white), normalNode (normalWorld), alphaNode (1), shadowNode (0)`, `alphaTest 0.1`.
- Shadow catcher (53-62): `receivedShadowNode = Fn(([shadow]) => { catchedShadow.mulAssign(shadow.r); return 1 })` — intercepts Three's shadow factor into a var and removes it from the Lambert pipeline.
- `outputNode` (67-134), in order:
  1. Normal flip for Back/DoubleSide via `frontFacing` (75-79).
  2. Light bounce (82-89): `bounceOrientation = smoothstep(dot(n, (0,-1,0)), lightBounceEdgeLow(-1), lightBounceEdgeHigh(1))`; `bounceDistance = ((lightBounceDistance(1.5) - max(0, worldY)) / lightBounceDistance).max(0)^2`; bounce colour = `terrain.colorNode(terrain.terrainNode(positionWorld.xz))` (ground colour under the point); mixed by `orientation*distance*lightBounceMultiplier(1)`.
  3. Water line (92-97): if `|worldY - water.surfaceElevation(-0.3)| <= surfaceThickness(0.013)` colour → white (a thin waterline ring on every object).
  4. Light: `*= lighting.colorUniform * lighting.intensityUniform` (100) (driven by DayCycles).
  5. Core shadow (103-105): `smoothstep(dot(n, lightDir), coreShadowEdgeHigh(1), coreShadowEdgeLow(-0.25))`.
  6. Drop shadow (108-110): `catchedShadow.oneMinus()`.
  7. Combined: `max(core, drop, shadowNode).clamp` → `mix(outputColor, baseColor * lighting.shadowColor, mix)` (113-119). Shadow colour is multiplicative tint from DayCycles.
  8. Fog (122-123): `fog.strength.mix(outputColor, fog.color)` where `fog.strength = rangeFogFactor(near, far)` (`Fog.js:20-22`) and `fog.color` is a radial screen-space gradient `mix(colorA, colorB, smoothstep(len(viewportUV - radialCenter)))` also set as `scene.backgroundNode` (`Fog.js:16-18`).
  9. `alphaNode.lessThan(alphaTest).discard()` (126).
  10. Reveal (129-130): static `revealDiscardNodeBuilder` (7-19): discard where `len(positionWorld.xz - reveal.position2) > reveal.distance`, and ring of `reveal.thickness(0.05)` coloured `reveal.color(#e88eff) * intensity(5.5)` (`Reveal.js:15-19`).
  11. Returns `vec4(outputColor, alphaNode)`.
- No PBR, no normal maps, no env maps anywhere: one Lambert-derived toon pipeline shared by every mesh.

### MeshGridMaterial (`Materials/MeshGridMaterial.js`) — extends `NodeMaterial`, `lights=false`. Triplanar mask from `normalWorld` (4-26), UV source selectable (`uv`, `worldTriplanar`, `worldX/Y/Z`, `localTriplanar`, `localX/Y/Z`, 107-123), anti-aliased grid per bgolus (51-68) using `fwidth`, multiple `MeshGridMaterialLine(color, scale, thickness 0.05, cross, offset)` layers mixed (127-138). Imported by `Terrain.js:3` (not instantiated there in the shown code; used by `World/Grid.js`).

### Lighting (`sources/Game/Ligthing.js` [sic])
- One `DirectionalLight(0xffffff, 5)` with `castShadow` (110-112), orthographic shadow box `±optimalArea.radius`, `near 1`, `far = near + 2*radius`, `bias -0.001`, `normalBias 0.1`, `radius 3 (quality 0) / 2`, `mapSize 2048 (desktop) / 512 (mobile)` (23-28, 153-172). Light follows `view.optimalArea.position` every tick (199-205). Direction uniform exported for shaders (19). Day-cycle sweep of theta/phi (183-188). Uniforms: `lightBounceEdgeLow/High, lightBounceDistance 1.5, lightBounceMultiplier 1, shadowColor (dayCycles), bounceColor #82487f, coreShadowEdgeLow -0.25 / High 1` (83-91).
- Renderer (`Rendering.js:40-60`): `WebGPURenderer({ powerPreference:'high-performance', forceWebGL:false, antialias: pixelRatio<2 })`, `shadowMap.enabled=true`, `sortObjects=false`, opaque/transparent sort by `renderOrder` only. Post (`74-104`): `RenderPipeline`, `bloom(scenePass output)` with `_nMips 5 (q0) / 2`, `threshold 1`, `strength 0.25`; `cheapDOF(renderOutput(scenePass))` only at quality 0; quality from UA mobile test (`Quality.js:12-13`).

## 6. threejs-override.js (`sources/threejs-override.js`, imported first in `sources/index.js:1`)
Monkeypatches `THREE.Object3D.prototype.copy` (lines 3-48): identical to upstream except `this.userData = JSON.parse(JSON.stringify(source.userData))` is commented out (line 33). Effect: `clone()` does NOT deep-copy userData — so clones share/lack userData (used because `userData.object` holds back-references to physics bodies that must not be stringified, and because `InstancedGroup.getBaseAndReferencesFromInstances` clones `instances[0]`).

## 7. References / Visual / Physical GLB split

### References parser (`sources/Game/References.js`)
- Regex on node names: `/^ref(?:erence)?([^0-9]+)([0-9]+)?$/` (line 18). `refFoo` / `referenceFoo` / `refFoo012` → key `foo` (first char lowercased) → `items: Map<string, Object3D[]>` (array because Blender dupes `.001` are stripped). `getStartingWith(prefix)` (33-50) returns sub-map with prefix removed.
- Note Blender exports `refLine.001` (with dot); GLTFLoader sanitises names → `refLine001`, so the numeric-suffix capture works.

### Objects (`sources/Game/Objects.js`)
- `add(visualDesc, physicalDesc)` (19-112): visual = `{model, updateMaterials:true, castShadow:true, receiveShadow:true, parent:scene}`; physical via `physics.getPhysical`; cross-links `body.userData.object` / `object3D.userData.object` (86-93); if `sleeping || !enabled || fixed`, copies body transform to visual once (104-108).
- `getFromModel(model, visualDesc, physicalDesc)` (114-219) — NODE NAMING CONVENTION:
  - name matches `/physical/i` → has a rigid body. Type from name: `/dynamic/i` → `dynamic`, `/kinematicPositionBased/i`, else `fixed` (126-134). Name is then cleaned of `physical|fixed|dynamic|kinematicPositionBased` (157).
  - Blender custom props (glTF `extras`) on the node: `restitution`, `friction`, `category`, `mass` (137-146; mass read by callers e.g. `Area.js:51`, `Scenery.js:29`). Observed extras in `areas.glb`: `mass` 0.01–5 on dynamic props, `preventAutoAdd`, `preventFrustum`, and data-carrying refs like `refLine:{"hasEnd":true,"size":"4","color":"blue","texture":"careerHetic"}`.
  - Children named `^trimesh` → `trimesh(positions, indices)`; `^hull` → convexHull; `^cuboid` → `cuboid(scale*0.5 xyz)`; `^tube` → `cylinder(scale.y*0.5, scale.x*0.5)`; `^ball` → `ball(scale.y*0.5)` (167-191). Collider children are REMOVED from the visual tree (209) — they are invisible empties/meshes whose scale encodes size. Per-collider extras `restitution/friction/category` (193-200).
  - Returns `[{...visual, model}, physical ? {...physical, colliders} : null]`.
- `update()` (304-361, tick priority 4): copies body translation/rotation into visual only for awake+enabled bodies (or `needsUpdate`); resets objects below `water.depthElevation (-1.5)`; sleeps bodies farther than `view.optimalArea.radius` from the rounded view position.
- Physics (`Physics/Physics.js:84-238`): rapier `RigidBodyDesc` dynamic/fixed/kinematic; default `linearDamping 0.1, angularDamping 0.1, waterGravityMultiplier -1.5`; collider `density 0.1`, `mass` split evenly across colliders when body-level mass given (184), friction default 0.2, restitution 0.15, collision groups `floor/object/bumper` (30-39), contact-force events when `onCollision`/`contactThreshold` (214-222, threshold default 15). Underwater (y<0) → damping 1 (246-258).

### InstancedGroup (`sources/Game/InstancedGroup.js`)
- `getBaseAndReferencesFromInstances(children)` (72-84): base = `children[0].clone()` zeroed; references = plain `Object3D`s copying each child's pos/rot/scale with `needsUpdate=true` (55-70).
- `setMeshes` (28-53): for each mesh in base → `new InstancedMesh(geometry, material, count)`, keep `localMatrix` (child's local matrix) so multi-part bases (lantern = base+light, poleLight = body+glass) become one InstancedMesh per part. `update` (92-119, tick 13): `finalMatrix = localMatrix * reference.matrixWorld` per dirty reference, sets `instanceMatrix.needsUpdate`.
- Pattern used by Benches/Fences/Lanterns/Bricks/ExplosiveCrates/PoleLights/SocialArea fans/CookieArea cookies/BowlingArea pins: GLB contains N full copies of the prop (Blender linked duplicates `benchPhysicalDynamic.00x` each with its own `cuboid` collider children); runtime takes copy #0 as the base, extracts colliders once (`Benches.js:17 getFromModel(base)`), creates one rapier body per copy (`Benches.js:26-47`, mass 0.1, friction 0.7, sleeping) whose visual is the reference `Object3D` with `parent:null` (never added to scene), and renders all via InstancedGroup; a tick hook sets `reference.needsUpdate` when its body is awake (`Benches.js:55-62`). Fences/Lanterns/PoleLights strip trailing digits from child names so parts are addressable (`Fences.js:23-24`, `PoleLights.js:40` finds `'glass'`).

### Trees: References GLB + Visual GLB (`sources/Game/World/Trees.js`, `World.js:69-71`)
- `new Trees(name, visualScene, referencesScene.children, colorA, colorB)`: birch `#ff4f2b/#ff903f`, oak `#b4b536/#d8cf3b`, cherry `#ff6d6d/#ff9990`.
- Visual GLB: meshes named `treeBody*` (one) and `treeLeaves*` (6 empties-with-mesh giving leaf-cluster positions+scales, e.g. oak `treeLeaves.006 t[0.057,6.897,-0.415] s0.902`, `treeLeaves.010 s0.526`). `setModelParts` (32-48) splits by name prefix.
- `setBodies` (50-66): `materials.updateObject(body)` then ONE `InstancedMesh(body.geometry, body.material, references.length)` with `StaticDrawUsage`, matrix = `treeReference.matrix`.
- `setLeaves` (68-98): for every tree × every leaves node → `leaves.matrix.premultiply(treeReference.matrixWorld)` → one big `Foliage` (24 oaks × 6 = 144 clusters).
- `setPhysical` (100-120): per tree a fixed cylinder collider `[2.5, 0.15]` at `+2.5 y`.
- References GLB content: `oakTreesReferences.glb` 48 nodes = 24 `treeBody.NNN` (mesh=Plane.005, 28 verts POSITION-only, draco) each with child `GN Instance` (Blender geometry-nodes instance, 24 verts). Only translation/rotation are used (`t [46.277,0,29.827] r quat`). I.e. the "References" GLB is a placement list that still carries a tiny dummy mesh.

### Foliage renderer (`sources/Game/World/Foliage.js`) — the "leaves" look
- Geometry (34-87): 80 `PlaneGeometry(0.8,0.8)` scattered in a unit sphere via `Spherical(1 - rng^3, 2π rng, π rng)`, random Z-rotation, custom normal = `lerp(planePos, sphereNormal, 0.85)` (fake spherical shading), merged into one geometry (`mergeGeometries`). Seeded `alea('foliage')`.
- Material (89-167): `MeshDefaultMaterial({ colorNode, alphaNode, hasWater:false })`; colour = `mix(colorA, colorB, smoothstep(dot(normalWorld, lightDir)))`; alpha = `texture(foliageSDF, rotateUV(uv, len(wind.offsetNode(positionLocal.xz))*2.2, 0.5)).r` (wind rotates the SDF cutout), minus `threshold 0.3`, with screen-space see-through hole around the vehicle (`screenUV` distance, `seeThroughEdgeMin/Max` = `3/radius`, `15/radius`, 115-129, 214-220). Instancing via manual `instance(object.count, instanceMatrix).toStack()` in `positionNode` (155-160) over a custom `InstancedBufferAttribute(count*16)` (203-211). Shadow tricks: `receivedShadowPositionNode = positionLocal + lightDir * shadowOffset(1)` (push shadow sampling toward the light to avoid self-shadow acne) and `maskShadowNode = foliageSDF.r > 0.5` (164-166) for cut-out shadow casting.
- `setFromReferences` (169-192): each reference's `scale.x` = cluster size; billboard orientation = `lookAt(view.spherical.offset)` with random roll so planes face the default camera angle.
- Bushes (`Bushes.js:14`) = `Foliage(bushesReferences.scene.children, ...)` directly: `bushesReferences.glb` = 130 `Icosphere.NNN` nodes (12-vert icosphere, t+scale e.g. `s1.075`).
- Flowers (`Flowers.js`): `flowersReferences.glb` 108 nodes `flowers.NNN` (9-vert mesh, uniform scale 3.143); each ref → 3–10 random instances in a 3×3 m spread (47-80); geometry 8 planes 0.08 m (82-118); wind displacement via `wind.offsetNode` scaled by `positionLocal.y` (134-143).
- Falling leaves (`Leaves.js`): GPU compute (`instancedArray` position/velocity, `init.compute`, `update.compute`, 151-254), count `2^round(remap(yearCycles.leaves, .25,1, 7,11))` (17-18), pushed by vehicle velocity, wind noise, explosions; wraps in a `size = optimalArea.radius*2` square around the focus point (250-252); floor from `terrain.terrainNode(position.xz).b`.
- Wind (`Wind.js:30-42`): `offsetNode(position)` = direction × noise(two perlin octaves scrolled by `localTime`) × `strength 0.5`.
- Terrain data (`Terrain.js:93-117`): `terrain.ktx` sampled at `pos/128/1.5 + 0.5` (world 192 m square, 128 subdivisions); channels: `.g` grass mask (× wheel-tracks RT), `.b` depth/water; colour = gradient (`#ffa94e / #5bc2b9 / #13375f` stops .1/.3/.9) mixed with `grassColor #b8b62e`. `terrain.glb`: 1 mesh, 16641 verts (129²), 32768 tris, no material.

### Areas GLB (`areas.glb` → `World/Areas/Areas.js` + `Area.js`)
- One GLB holds every zone as a top-level group: roots `landing(26), career(14), social(21), projects(31), lab(28), cookie(11), altar(7), toilet(8), bowling(34), circuit(61), behindTheScene(9), achievements(11), timeMachine(15)` + 5 stray `cuboid.08x`. `Areas.js:39-48` maps root name prefix → Area subclass.
- `Area.setObjects` (`Area.js:32-70`): every direct child not flagged `preventAutoAdd` → `objects.addFromModel(child, {}, {position: child.position + model.position, rotation, sleeping:true, mass: child.userData.mass})`; visual-only or fixed objects go to `hideable` list (frustum culling by zone). `References.parse(child)` for every child. `refZoneBounding` (scale.x = radius) → cylinder zone trigger (72-102); `refZoneFrustum` (position+scale.x) → per-area visibility test (104+).
- Node-name stems in areas.glb (737 nodes, 286 meshes, 451 empties, 70875 verts, 27 materials, 13 textures): `cuboid×191, Bone×64, tube×43, refObjectsPhysicalDynamic×24, refZoneBounding×13, refZoneFrustum×13, physicalFixed×11, refLettersPhysicalDynamic×10, refCheckpoints×8, refInteractivePoint×7, refLine×6, stoolPhysicalDynamic×6, refIntersectPagination×5, refObstaclesPhysicalKinematicPositionBased×5, couchPhysicalDynamic×4 …`. Materials: `palette` + 5 emissive gradient names + `redGradient`, `darkGray`, `black`, `waterfall`, `stylizedMap`, and textured label/carpet materials (`projectsLabels` BLEND, `blackboardLabels`, `labCarpet`, `cookieBanner`, `circuitWebgl/Webgpu/Brand/Threejs`, `airDancer`, 6 `careerText*`).
- Scenery GLB (`scenery.glb` → `World/Scenery.js:12-35`): roots `bridgePhysicalFixed(×2, 3 cuboid children each)`, `basaltRocksPhysicalStatic(×5, hull children)` (note: `Static` is not a recognised keyword → falls back to `fixed`), 15 plain `Cube.*` (visual only), `refRoad` (gets a procedural glitter `MeshDefaultMaterial` at 45-113, `hasLightBounce:false, hasWater:false`).
- Playground: `playgroundVisual.glb` (9 nodes, 27 prims, 2842 verts, 3 colour materials `carBlack/carMetal/emissiveWarnWhite`, `KHR_materials_unlit`) + `playgroundPhysical.glb` (1 mesh `Circle`, 232 verts POSITION-only → trimesh). Christmas uses the same Visual/Physical pair (`christmasTreeVisual.glb` 2478 verts / `christmasTreePhysical.glb` 14 verts).
- Pure-empty reference GLBs (no meshes, JSON only): `respawnsReferences.glb` (18 empties `respawn<Name>` with t+rot, 2848 B), `tornadoPathReferences.glb` (17 empties `tornado.000..016`, 1820 B), `easterEggReferences.glb` (20 `eggPosition`).
- Vehicle `vehicle/default.glb`: 24 nodes (`chassis.001` 11 children, `wheelContainer.001` 3), 5874 verts, materials `palette, redGradient, darkGray, emissiveOrange/PurpleRadialGradient`, extras `{"booleans":{}}` leftovers. `VisualVehicle.js:106,126` run `updateObject` on chassis and wheels; paint swaps by `getFromName('redGradient')` (134); backlights swap to `emissiveOrangeRadialGradient` (496).

## 8. static/ GLB inventory (bytes, `find -printf`)

| folder | file | raw | -compressed | variant kind |
|---|---|---|---|---|
| areas | areas.glb | 3,286,220 | 639,312 | single (refs+visual+physical inside) |
| scenery | scenery.glb | 266,188 | 47,892 | single |
| terrain | terrain.glb | 730,120 | 26,208 | mesh only, no material |
| vehicle | default.glb | 237,616 | 34,824 | visual |
| vehicle | defaultAntenna.glb | 79,076 | 49,388 | visual (9 colour mats, no palette) |
| vehicle | oldSchool.glb | 175,396 | 15,316 | visual |
| playground | playgroundVisual.glb / playgroundPhysical.glb | 96,140 / 6,276 | 27,536 / 1,904 | Visual + Physical |
| oakTrees | oakTreesReferences.glb / oakTreesVisual.glb | 19,424 / 4,516 | 21,572 / 5,188 | References + Visual |
| birchTrees | birchTreesReferences / Visual | 21,568 / 4,488 | 23,980 / 5,084 | References + Visual |
| cherryTrees | cherryTreesReferences / Visual | 17,016 / 4,548 | 19,624 / 5,232 | References + Visual |
| bushes | bushesReferences.glb | 25,640 | 25,588 | References only |
| flowers | flowersReferences.glb | 19,404 | 19,412 | References only |
| respawns | respawnsReferences.glb | 2,848 | 2,836 | References only (empties) |
| tornado | tornadoPathReferences.glb | 1,820 | 1,808 | References only (empties) |
| benches | benches.glb | 14,492 | 7,080 | N copies w/ colliders (InstancedGroup) |
| fences | fences.glb | 8,152 | 8,692 | same |
| lanterns | lanterns.glb | 28,960 | 11,388 | same (base+light parts) |
| bricks | bricks.glb | 6,808 | 7,456 | same |
| explosiveCrates | explosiveCrates.glb | 27,720 | 8,588 | same |
| poleLights | poleLights.glb | 44,044 | 43,204 | same (body+glass) |
| christmas | christmasTreeVisual / Physical / GiftReferences / GiftVisual | 18,428 / 1,112 / 5,424 / 10,752 | 12,360 / 1,084 / 4,732 / 3,324 | seasonal |
| easter | easterEggVisual / References | 3,816 / 2,204 | 3,240 / 2,192 | seasonal |
| blackFriday | fragment / fragments | 17,620 / 1,384 | 7,024 / 1,376 | seasonal |

- Already-draco'd Blender exports (`KHR_draco_mesh_compression` in the raw file, generator Blender I/O 4.5.47 / 4.3.47) sometimes grow after re-compression (bushes, flowers, fences, bricks) — the pipeline only helps on uncompressed exports.
- Total `static/` 197 MB (dominated by `sounds/`, lab/projects PNG+KTX pairs); all runtime GLBs compressed sum ≈ 1.1 MB; palette.ktx 1.5 KB; decoders ≈ 870 KB wasm/js.

## 9. Representative GLB JSON facts (hand parser)

- `areas.glb`: generator Blender I/O v5.0.21, ext `KHR_materials_emissive_strength`, 737 nodes / 266 meshes / 278 prims / 70,875 verts / ~58.7k tris / 27 materials / 13 PNG images (palette, stylized-map, blackboardLabels, projectsCarpet, projectsLabels, labCarpet, cookieBanner, bowlingLabelStrike, circuitLogoWebgl/Webgpu/Brand/Threejs, circuitAirDancerFace); all materials `doubleSided`; attrs `POSITION,NORMAL,TEXCOORD_0` (+`TEXCOORD_1` on a few). Compressed: 70,900 verts (draco), JSON 306 KB of 639 KB total — node names/extras dominate.
- `oakTreesReferences.glb`: 48 nodes, 25 meshes (1 shared `Plane.005` 28 verts POSITION-only + 24 `GN Instance` 24-vert), 0 materials. `oakTreesVisual.glb`: 7 nodes, 2 meshes (`Plane.005` body 272 verts/1152 idx, `Icosphere.003` leaves 60 verts/60 idx = 20 tris), 1 material `palette` with embedded `palette.png`.
- `scenery.glb`: 38 nodes, 32 meshes, 6,525 verts, 4,665 tris, materials `palette` + `black`, 1 image. Collider prims (`Cylinder.03x` hulls) have `POSITION,NORMAL` only, `m=null`.
- `playgroundVisual.glb`: 9 nodes, 27 prims (3 mats × 9 meshes), 2,842 verts, `POSITION,NORMAL` only (no UV — colour materials). `playgroundPhysical.glb`: 1 prim `Circle{POSITION}` 232 verts.
- `terrain.glb`: 1 prim `Plane.134{POSITION,NORMAL,TEXCOORD_0}` 16,641 verts / 98,304 idx.



## Transferable
- One-palette convention: 128x4 PNG, 32 swatches of 4px, UV = ((col+0.5)/32, 0.5) per face; Nearest filtering, no mipmaps, sRGB; every GLB material named `palette` is swapped by NAME to a single runtime material (Materials.getFromName). Obstacle: our GLBs must be authored/re-UV'd with collapsed UVs per face (Blender material-slot → palette index workflow or a gltf-transform script that rewrites TEXCOORD_0).
- Build-time compress script: `gltf-transform etc1s --quality 255` then `gltf-transform draco --method edgebreaker --quantization-volume mesh --quantize-position 12 --quantize-normal 6 --quantize-texcoord 6` into `*-compressed.glb`; standalone textures via `toktx --t2 --encode etc1s --qlevel 255` (uastc + mipmaps for palette/data textures, `--target_type R --swizzle r001` for masks). Needs gltf-transform CLI + KTX-Software `toktx` installed; VITE_COMPRESSED env flips filename suffix/extension at runtime.
- Loader stack: GLTFLoader + DRACOLoader(setDecoderPath './draco/', preload) + KTX2Loader(setTranscoderPath './basis/', detectSupport(renderer)); resources declared as [key, url, loaderType, modifierFn] tuples, URL-cached Map, two batches (tiny pre-intro batch, big batch awaited in parallel with the physics wasm import). No obstacle.
- Node-name physics convention: node name contains `physical` (+`dynamic`/`kinematicPositionBased`, else fixed); collider children named `cuboid*/tube*/ball*/hull*/trimesh*` whose scale encodes half-extents, removed from the visual tree; glTF extras `mass/friction/restitution/category`. Obstacle: only if our pipeline is Tripo-generated GLBs with no hand-placed collider empties — would need an auto-collider step (bbox cuboid / hull).
- References-vs-Visual GLB split: a `*References.glb` of empties/tiny meshes (positions, rotation, scale.x=size) + a `*Visual.glb` prototype; runtime builds one InstancedMesh for the body and merges all `treeLeaves*` nodes × references into one Foliage InstancedMesh. Name-based ref parsing `^ref(?:erence)?Name[0-9]*`. No obstacle.
- InstancedGroup pattern for repeated physical props: GLB holds N duplicates each with collider children; take copy 0 as base, extract colliders once, one rapier body per copy, one InstancedMesh per base part, matrices refreshed only for awake bodies (needsUpdate flag) at tick priority 13.
- Foliage look: 80 random 0.8m planes in a sphere with normals lerped 85% toward the sphere normal, merged geometry, colour = mix(A,B, smoothstep(dot(N, lightDir))), alpha from a single-channel SDF texture rotated by wind noise, `receivedShadowPositionNode = positionLocal + lightDir*offset` and `maskShadowNode = sdf>0.5` to get clean cut-out shadows, screen-space see-through hole around the player. Obstacle: TSL/WebGPU node material API (three ≥0.170 `three/webgpu`); needs porting if our site uses classic WebGL materials.
- Single shared toon material (MeshLambertNodeMaterial subclass): shadow catcher via receivedShadowNode, core shadow smoothstep on N·L, ground-colour light bounce from terrain data, waterline ring, range fog with radial screen gradient background, radial reveal discard; per-object variants are just feature flags + colorNode. Obstacle: TSL-only.
- Fully GPU-compute falling leaves (instancedArray position/velocity, wrap-around tile of 2×optimalRadius around the camera focus, terrain-aware damping/floor, vehicle push, wind noise, explosion impulse). Obstacle: WebGPU compute (WebGL fallback in three handles compute via transform feedback but slower).
- Monkeypatched Object3D.copy that skips userData deep copy so clones don't JSON-stringify physics back-references; trivial to port.

## Gaps
- Draco-compressed GLBs (all tree Visual/References, bushes? no — bushes is uncompressed; fences, bricks, flowers, poleLights, vehicle antenna, christmas, easter) could not have their vertex/UV data inspected without a decoder; vertex counts come from accessor `count` fields, not decoded buffers.
- Exact Blender material-slot → palette-UV authoring workflow is not in the repo (only the `.blend` binary); inferred from UV values in uncompressed GLBs.
- `resources/palette.png` vs `static/palette.png` are identical; whether `static/palette.ktx` (UASTC, 1504 B) was produced from the same file was not verified beyond size/preset.
- `World/Grid.js`, `Floor.js`, `WaterSurface.js`, `Grass.js`, `VisualVehicle.js`, Area subclasses (Lab/Circuit/etc.) were only grepped, not read line-by-line; their per-area use of references is listed by line in the grep output but not described.
- DayCycles property values (lightColor, shadowColor, fog colours) feeding the material uniforms were not read.
- The Rapier `heightfield` collider path exists in Physics.js but no caller was located in this pass (terrain collision mechanism not confirmed).


---

# 2. How he renders leaves, grass, trees, snow, rain: the GPU systems

## Scope / stack

Repo: `folio-2025/`. `three ^0.183.2` (`package.json:36`), all imports from `three/webgpu` + `three/tsl`. Physics `@dimforge/rapier3d ^0.17.3`, `gsap ^3.12.5`, `seedrandom ^3.0.5` (alea for deterministic foliage/flowers). Renderer: `THREE.WebGPURenderer` with `forceWebGL: false` (`Rendering.js:40-45`), so WebGL fallback is automatic via the WebGPU backend's GLSL path. Only `Game.js:203` gates on `backend.isWebGPUBackend` (PreRenderer cube warmup).

## Shared infra every GPU system leans on

### Ticker (`sources/Game/Ticker.js`)
- `delta` clamped to `maxDelta = 1/30` (L14, L32). `scale = 2` (L15) so `deltaScaled = delta*2`. `elapsedScaled += deltaScaled`.
- Four TSL uniforms: `elapsedUniform`, `deltaUniform`, `elapsedScaledUniform`, `deltaScaledUniform` (L21-24, updated L47-50). Compute shaders use `deltaScaledUniform`.
- `deltaAverage` over last 30 frames (L37-44). `wait(frames, cb)` frame-deferred callbacks (L68-71).
- `renderer.setAnimationLoop(elapsed => ticker.update(elapsed))` (`Rendering.js:68`): renderer drives the ticker. `events.trigger('tick')` fires ordered listeners (`Events.js`, priority int arg).

### Tick order (`readme.md:22-114`) — matches code priorities
0 Time, Inputs · 1 Player pre-physics · 2 PhysicalVehicle pre · 3 Physics · 4 PhysicsWireframe, Objects · 5 PhysicalVehicle post · 6 Player post · 7 View · 8 Intro, DayCycles, YearCycles, Weather (`Weather.js:654`), Zones, VisualVehicle · 9 Wind (`Wind.js:494`), Lighting (`Ligthing.js:46`), Tornado, InteractivePoints, Tracks (`Tracks.js:41`) · 10 Areas, Foliage (`Foliage.js:31`), Fog (`Fog.js:28`), Reveal, Terrain (`Terrain.js:29`), Trails (`Trails.js:51`), Floor (`Floor.js:148`), Grass (`Grass.js:334`), Leaves (`Leaves.js:37`), Lightnings, RainLines (`RainLines.js:25`), Snow (`Snow.js:40`), VisualTornado, WaterSurface, Benches/Bricks/ExplosiveCrates/Fences/Lanterns, Whispers · 13 InstancedGroup (`InstancedGroup.js:349`) · 14 Audio, Notifications, Title · 998 Rendering (`Rendering.js:30`) · 999 Monitoring.
Key: Weather(8) → Wind(9) → Tracks RT render(9) → all foliage/floor samplers(10) → render(998). Everything at 10 only writes uniforms or dispatches compute; the single `postProcessing.render()` at 998.

### View optimal area (`sources/Game/View.js:172-290, 755-767`)
- `optimalArea.update()` (L213-280) computed only on `needsUpdate` (resize). Puts camera at max radius `radiusMax = spherical.radius.edges.max + ratioOverflow*nonIdealRatioOffset`; at quality 0 `radiusMax *= 1 - zoom.speedAmplitude` where `speedAmplitude = -0.4` (L222-223, L290), i.e. 1.4x (speed-zoom headroom). Raycasts the 4 NDC corners + (0,-1)/(0,1) onto the y=0 plane (`floorPlane` L191). `basePosition` = centre of the two diagonal midpoints; `radius = basePosition.distanceTo(farPosition)` (L263); `nearDistance/farDistance` = camera-to-bottom/top-edge floor hits (L272-273, used by Fog).
- Per frame: `optimalArea.position = basePosition + focusPoint.smoothedPosition.xz` (L758-760). This is THE focus point every wrapping system reads (`view.optimalArea.position.x/z`) and `radius*2` is THE tile size.
- Camera: `spherical.phi = PI*0.31` (q0) or `PI*0.27` (q1) (L335), theta `PI*0.25`, radius edges `{min:15, max:30}` (L339). Speed zoom only at quality 0 (L699).

### Noises (`sources/Game/Noises.js`) — three 128×128 render-target textures, rendered once at startup via `THREE.QuadMesh` (L141-147, `resolution = 128` L143)
- `voronoi`: HalfFloat RGBA, Repeat wrap, `voronoiNode(uv(), 8)` → `vec3(minDist, minEdge-minDist, hash(cellId).x)` (L22-71, L176-210).
- `perlin`: `RedFormat` HalfFloat, Repeat wrap. `.r = perlinNode(uv, cellAmount=6, period=6).remap(0.1,0.9,0,1)` (L232); the perlin function outputs `*0.8+0.5` (L124). Periodic (tileable) via `modulo` on cell ids (L115-116) so world-space sampling wraps seamlessly. `.g` is written as `hash(floor(uv*128)/128)` but format is Red so only `.r` survives (L233).
- `hash`: `RedFormat` HalfFloat, Repeat, **Nearest** filters, no mipmaps (L264-269), `hash(viewportUV).x` (L275). Used for glitter (Snow L362, Scenery road L65).
- Each render wraps `RendererUtils.resetRendererState` / `restoreRendererState` and `setPixelRatio(1)` (L202-209). Same pattern reused by Tracks and Snow per-frame RT renders.
- WebGL equivalent: all three are pure-TSL `Fn`s with `setLayout` — compile to GLSL under the WebGL backend unchanged; could also be baked to PNGs.

### Terrain data (`sources/Game/Terrain.js`)
- `subdivision = 128`, `size = 192` (L12-13). `terrainTexture` = `static/terrain/terrain.png` 512×512 RGBA, `flipY=false` (`Game.js:145`). Channels (viewed image + usage): **R = slabs/furniture (paved areas)**, **G = grass mask**, **B = water depth** (0 = dry → 1 = deep).
- `worldPositionToUvNode(p) = p / 128 / 1.5 + 0.5` (L88-91) → covers 192 world units.
- `terrainNode(position)` (L93-106): samples terrain texture, then multiplies `.g` by `1 - tracksRT.r` (wheel tracks flatten grass) using `(pos + tracks.halfSize - tracksDelta) / tracks.size` (L99-103). `tracksDelta` = `tracks.focusPoint` updated at tick 10 (L128-131).
- `colorNode(terrainData)` (L108-117): base = 1×16 canvas gradient (`#ffa94e`@0.1, `#5bc2b9`@0.3, `#13375f`@0.9, L45-49, sRGB) sampled at `vec2(0, 1-data.b)` → dirt→shallow→deep water; then `mix(base, grassColorUniform '#b8b62e', data.g)`. This is the single source of floor colour for Floor, Grass, Snow, light bounce.
- `terrain.glb` (`static/terrain/terrain.glb`, 730 KB) is the physics heightfield only (`Floor.js:238-271`).

### Wind (`sources/Game/Wind.js`)
- `angle = PI*0.6`, `direction = uniform(vec2(sin, cos))` (L15-19). `positionFrequency = uniform(0.5)`, `strength = uniform(0.5)`, `localTime = uniform(0)`, `timeFrequency = 0.1` (L20-23).
- `offsetNode(position)` (L25-38): `p = position*0.5`; `noise1 = perlin(p*0.2 + direction*localTime).r - 0.5`; `noise2 = perlin(p*0.1 + direction*localTime*0.2).r - 0.5`; returns `direction * (noise1+noise2) * strength` (vec2 XZ offset). Two octaves scrolling along wind direction at different speeds.
- Per tick 9 (L67-72): `strength = remapClamp(weather.wind, 0,1, 0.1,1)` (L53), `localTime += deltaScaled * 0.1 * strength` — scroll speed scales with strength.
- Consumers: Grass (offset ×tipness×height×2), Flowers (offset × clamp(y,0,1)), Foliage (rotates SDF UV by `|offset|*2.2`), Leaves (own sampling `windFrequency 0.005` + `direction*localTime`), WaterSurface ripples (`wind.localTime*0.5`).

### Weather (`sources/Game/Weather.js`)
- Pseudo-noise `noise(x) = sin(x)*sin(x*1.678)*sin(x*2.345)` (L133-136). `dayCycles.absoluteProgress` = `Date.now()/1000/240` (day = 4 min, `DayCycles.js:16`).
- Properties (L22-125, each `addProperty(name,min,max,getter)`): temperature `-15..40` = year.temp + day.temp + noise(t*0.4)*7.5; humidity `0..1` = year.humidity + noise(t*0.36)*0.2; electricField `-1..1` = day.electricField * noise(t*0.53); clouds `-1..1` = noise(t*0.44); wind `0..1` = noise(t)*0.5+0.5; rain = `remapClamp(humidity,0.65,1,0,1) * remapClamp(clouds,0,1,0,1)`; snow `-1..1` = `remapClamp(rain,0.05,0.3,0,1)*remapClamp(temp,0,-5,0,1) + remapClamp(temp,0,10,0,-1)`.
- `override.start(values, duration=5)` gsap-lerps `override.strength` 0→1 and blends each property to `overrideValue` (L194-222). Zones use this.
- `debug.addManualBinding` (`Debug.js:27-57`) is the pattern: `binding.update()` sets `object[prop] = manual ? manualValue : getter()`. Every weather-driven uniform (wind strength, rain visibleRatio, snow elevation, ripples, ice) is such a binding updated per tick.

### Cycles (`Cycles/Cycles.js`, `DayCycles.js`, `YearCycles.js`)
- `Cycles` = keyframe interpolator on `progress = (Date.now()/1000/duration) % 1`, smoothstep between stops (L230), colours via `lerpColors`. Fake wrap steps added if stops don't span 0..1 (L120-136). `progressDelta` (L147) used by Snow accumulation. Override system identical to Weather.
- DayCycles: duration `4*60` s. Presets day/dusk/night/dawn with `revealColor, revealIntensity, electricField, temperature, lightColor, lightIntensity, shadowColor, fogColorA, fogColorB, fogNearRatio, fogFarRatio` (L4-9). Stops: day 0/0.15, dusk 0.25, night 0.35/0.6, dawn 0.8, day 0.9 (L51-61). Intervals `night 0.25-0.7`, `deepNight 0.35-0.6` (L64-70). Night preset: lightColor `#3240ff`, intensity 3.8, shadowColor `#2f00db`, fogNearRatio -0.85.
- YearCycles: duration 1 year. `leaves`: winter 0.25, spring 0, summer 0.25, fall 1 (L15-18) — drives Leaves count. Stops offset +0.125.

### Lighting (`sources/Game/Ligthing.js`)
- One `DirectionalLight(0xffffff, 5)` castShadow (L110-112). Spherical phi 0.63 / theta 0.72 base, animated by day progress: `theta = 0.72 + sin(-(progress+9/16)*2PI)*1.25`, `phi = 0.63 + cos(...)*0.5*0.62` (L185-187).
- Shadow camera ortho ±`optimalArea.radius`, near 1, far `1 + radius*2` (L155-160), bias -0.001, normalBias 0.1, radius 3 (q0) / 2 (q1), mapSize 2048 (q0) / 512 (q1) (L23-28, L170). Light position = spherical + `optimalArea.position`, target = `optimalArea.position` (L204-205) — shadow frustum follows focus.
- Uniforms for custom shading: `directionUniform`, `colorUniform`, `intensityUniform`, `shadowColor` (from day cycle), `bounceColor '#82487f'`, `lightBounceEdgeLow -1 / High 1 / Distance 1.5 / Multiplier 1`, `coreShadowEdgeLow -0.25 / High 1` (L83-91).

### MeshDefaultMaterial (`sources/Game/Materials/MeshDefaultMaterial.js`) — the one material all foliage uses
- Extends `MeshLambertNodeMaterial`. Flags `hasCoreShadows, hasDropShadows, hasLightBounce, hasFog, hasWater, hasReveal` default true; `alphaTest` 0.1; `_colorNode/_normalNode(normalWorld)/_alphaNode/_shadowNode` (L34-47).
- **Shadow catcher**: `receivedShadowNode = Fn(shadow => { catchedShadow *= shadow.r; return 1 })` (L53-62) — intercepts three's shadow factor into a float, removes it from Lambert lighting, re-applies it as a colour mix.
- `outputNode` (L67-134), fully custom unlit-style toon shading: (1) flip normal when `!frontFacing` for DoubleSide (L76-79); (2) light bounce: `bounceOrientation = smoothstep(dot(n, (0,-1,0)))`, `bounceDistance = ((1.5 - max(0,y))/1.5)^2`, mixes in `terrain.colorNode(terrainNode(positionWorld.xz))` (L82-89) — undersides pick up floor colour; (3) water line: pixels within `surfaceThickness 0.013` of `surfaceElevation -0.3` forced white (L92-97); (4) `*= lightColor*intensity`; (5) `coreShadowMix = smoothstep(dot(n, lightDir), 1, -0.25)`; `dropShadowMix = 1 - catchedShadow`; `combined = max(core, drop, _shadowNode)`; `mix(output, baseColor*shadowColor, combined)` (L103-119); (6) fog `fog.strength.mix(output, fog.color)` (L122-123); (7) `_alphaNode < alphaTest → discard` (L126); (8) reveal ring: discard beyond `reveal.distance` from `reveal.position2Uniform`, emissive ring of `thickness 0.05` (L7-19, L129-130).
- All of this is TSL on `MeshLambertNodeMaterial`; GLSL equivalent = `onBeforeCompile` on MeshLambertMaterial with custom shadow-mask capture, or a ShaderMaterial with manual shadow sampling.

### Fog (`sources/Game/Fog.js`)
- `scene.backgroundNode = mix(colorA, colorB, smoothstep(length(viewportUV - radialCenter), 0, 1))` (L16-18) — radial screen gradient background. `strength = rangeFogFactor(near, far)` (L22). Per tick: colours from day cycle, `near = nearDistance + fogNearRatio*(far-near)`, `far = nearDistance + fogFarRatio*amplitude` (L44-48). Fog colour is the same screen-gradient so far objects dissolve into background.

### Rendering (`sources/Game/Rendering.js`)
- `WebGPURenderer({ powerPreference:'high-performance', forceWebGL:false, antialias: pixelRatio < 2 })` (L40-45): MSAA on only when DPR < 2. `setPixelRatio(min(devicePixelRatio, 2))` (`Viewport.js:23-25`). `sortObjects = false`, opaque+transparent sort by `renderOrder` only (L48-60). `shadowMap.enabled = true`, default (PCF) type (L51-52). No tone-mapping call anywhere → default `NoToneMapping`; sRGB output default.
- Post: `RenderPipeline` (L76). `scenePass = pass(scene, camera)`; `bloom(scenePassColor)` with `_nMips = 5 (q0) / 2 (q1)`, threshold 1, strength 0.25, smoothWidth 1 (L81-85). `cheapDOF(renderOutput(scenePass))` (L87). Quality 0: `output = cheapDOF + bloom`; quality 1: `scenePassColor + bloom` (L90-102). `renderOutput` applies colour-space/tone-map before DOF.
- `render()` = `postProcessing.render()` (L174). Stats via `#stats` hash.
- cheapDOF (`Passes/cheapDOF.js`): `TempNode`; `strength = smoothstep(|uv.y-0.5|, start 0.2, end 0.5)` (L32) — a vertical tilt-shift band; `hashBlur(texture, strength*amount 0.003, { repeats: 25, premultipliedAlpha:true })` then `mix(tex, blur, strength)` (L36-49). Box blur path commented out.
- PreRenderer (`PreRenderer.js`): at quality 0 on WebGPU only, renders a 32px `CubeRenderTarget` with every hidden object temporarily visible (L17-33) to force pipeline/shader compilation up front (eliminates first-use hitches).

### Quality (`sources/Game/Quality.js`)
- Two tiers only: `level = isMobile ? 1 : 0` from UA regex (L12-13). `changeLevel()` triggers `events 'change'` (L40-48); toggled in Options UI (`Options.js:33`).
- Per-system behaviour: Rendering: DOF on/off, bloom mips 5/2 (`Rendering.js:82,92-99`). Lighting: shadow map 2048/512, radius 3/2 (`Ligthing.js:23,28,170`). View: camera phi 0.31π/0.27π, speed zoom only q0, optimal area 1.4× radius only q0 (`View.js:222,335,699`). WaterSurface: blurred-refraction output only q0 (`WaterSurface.js:329-344`). PhysicsVehicle: fixed 1/60 step on q1 vs `min(1/60, deltaAverage)` (`PhysicsVehicle.js:511`). Intro label layout (`Intro.js:29`). PreRenderer only q0 (`Game.js:203`). **No instance counts change with quality**; Leaves count is year-cycle-driven, Grass/Snow/Rain fixed. Instance extents scale with `optimalArea.radius` (hence with q0's 1.4× radius → more area covered, same count).

## GPU systems

### Leaves (`sources/Game/World/Leaves.js`) — GPU particle sim, compute + instanced plane
- Count: `power = round(remap(yearCycles.leaves, 0.25,1, 7,11))`, `count = 2^power` (L17-18) → 128 … 2048 (summer/winter 128, fall 2048; spring value 0 remaps below 7 → 2^~5.7≈2^6=64 after round). Fixed at construction (year cycle changes need reload).
- Geometry: `PlaneGeometry(1,1)` with x of verts 0,1 shifted +0.15 and 2,3 shifted -0.15 (parallelogram), rotated -90° X to lie flat (L42-51). One quad per instance, `mesh.count = count`, `frustumCulled = false`, cast+receive shadow, `renderOrder 2` (L278-284). Material `DoubleSide`, `transparent`, `hasWater:false` (L116-122).
- Buffers: `positionBuffer = instancedArray(count,'vec3')`, `velocityBuffer = instancedArray(count,'vec3')` (storage, L75-76). Static per-instance **attributes** via `instancedArray(array,'float').toAttribute()`: `baseRotation` rand 0..2π (L79-82), `scale` 0.5..1 (L85-88), `normal` vec3 = up rotated ±1 rad around X then Z (L106-114). `weight` 0.1..0.2 stays a storage buffer read in compute (L91-94).
- Uniforms (L57-72): `scale 0.25`, `rotationFrequency 3`, `rotationElevationMultiplier 1`, `pushSidewaysMultiplier 20`, `pushMultiplier 100`, `windFrequency 0.005`, `windMultiplier 0.5`, `upwardMultiplier 1`, `defaultDamping 1.5`, `waterDamping 0.75`, `gravity 9.807`, `explosion vec4(x,z,radius,strength)`, `tornado vec4` (unused).
- Colour: `mix(colorA 0x95513a, colorB 0xf56a3a, hash(instanceIndex+99))` (L97-103).
- **Fake normal**: `positionNode` does `materialNormal.assign(modelViewMatrix * vec4(normalBuffer,0))` (L128) — per-instance random tilted normal in view space so flat quads shade like curled leaves; material `normalNode: normalWorld` (L119).
- Vertex (L125-146): `p = positionGeometry * scale * 0.25`; `rotMul = max(leafPos.y * rotationElevationMultiplier, 0)` → leaves only tumble when airborne; `rotZ = sin(leafPos.x*3)*rotMul`, `rotX = sin(leafPos.z*3)*rotMul`, `rotY = baseRotation`; three `rotateUV` applications on xy/yz/xz planes; `+ leafPos`.
- Init compute (L151-168): `pos = (hash(i)-0.5, 0, hash(i+1)-0.5) * size` with `size = optimalArea.radius*2` (L148); `pos.x += perlin(pos.xz*0.02).r * 15` (clumping). Dispatched once via `renderer.computeAsync(init.compute(count))`.
- Update compute (L171-254), per instance per frame:
  1. `terrainData = terrain.terrainNode(pos.xz)`.
  2. Vehicle push: `delta = pos - vehiclePos`; `pushSideways = normalize(delta.xz)*20`; `pushVelocity = vehicleVel.xz*100`; `vehicleMultiplier = remapClamp(|delta|, 0.5,2, 1,0)`; `velocity += (pushVelocity+pushSideways) * |vehicleVel| * vehicleMultiplier` (L182-193). `vehicleVelocity` = per-frame position delta of chassis (`PhysicsVehicle.js:519`), so it is small (~m/frame).
  3. Wind: `noise = perlin(pos.xz*0.005 + wind.direction*wind.localTime).r`; `windStrength = max(wind.strength - noise, 0) * weight * 0.5`; `velocity.xz += direction*windStrength` (L196-201) — gusts only where strength exceeds noise.
  4. Explosion: `mult = remapClamp(dist, radius*0.5, radius, 0.2, 0)`; `velocity.xz += delta * mult * explosion.w` (L204-210). `explode(coords, radius)` sets `w = 20` (L287-293) and `update()` resets `w = 0` after dispatch (L303) → one-frame impulse. Triggered from `Explosions.js:23`.
  5. Upward: `velocity.y = min(|velocity.xz|, 2) * 1 * remapClamp(pos.y, 0,6, 1,0)` (L230-231) — horizontal speed lifts leaves, fades by 6 m.
  6. Damping: `groundDamping = remapClamp(terrain.b, 0.4,0, 0.75,1.5)` (water = less damping), `inTheAir = step(0.05, y)*1.5`; `velocity *= 1 - max(...)*deltaScaled` (L234-237).
  7. Gravity: `velocity.y -= 9.807 * weight` (L240) — note not multiplied by dt.
  8. `pos += velocity * deltaScaled` (L243).
  9. Floor clamp: `floorY = remapClamp(terrain.b, 0.02,0.13, 0, water.surfaceElevation(-0.3)) + 0.02`; `pos.y = max(pos.y, floorY)` (L246-247) — leaves float on water surface.
  10. **Wrap**: `pos.x = mod(pos.x + half - focus.x, size) - half + focus.x` (same z) (L250-252). Toroidal wrap around `focusPoint` (= `optimalArea.position.xz`, L297).
- Per frame JS (L295-305): set focusPoint, copy vehicle velocity/position, `renderer.computeAsync(updateCompute)`, reset explosion.
- Tornado section commented out (L212-227).
- WebGL equivalent: no compute in WebGL backend → three's WebGL backend emulates `instancedArray` compute via transform feedback (supported in r16x+ WebGLBackend for storage buffers) — or port to ping-pong FBO/GPGPU textures.

### Grass (`sources/Game/World/Grass.js`) — single non-instanced triangle soup, vertex-shader blades
- `subdivisions = 280` → `count = 78 400` blades (L17-20), one triangle each (3 verts). `size = optimalArea.radius*2`, `fragmentSize = size/280`. `surfaceIdeal = 2000` m²; `surfaceOverflow = max(0, size²-2000)/2000` scales blade width/height so bigger view areas keep coverage (L23-25, L45-46, L107-108): `bladeWidth = 0.1*(1+overflow*0.5)`, `bladeHeight = 0.6*(1+overflow*0.5)` (on resize ×0.4).
- Geometry (L54-95): `position` attribute is **vec2 XZ** (itemSize 2), same for all 3 verts of a blade = grid cell centre + random jitter ±fragmentSize/2; `heightRandomness` float per vertex. Bounding sphere stubbed (L92), `frustumCulled=false`, `receiveShadow` (L205-207). Rebuilt on `viewport throttleChange` (L36-51).
- Material: `MeshDefaultMaterial({ colorNode: terrain.colorNode(terrainData), normalNode: vec3(0,1,0), hasWater:false, hasLightBounce:false, shadowNode: tipnessShadowMix })` (L136-142) — blades take floor colour exactly → invisible seam with floor; normal forced up; `shadowNode = (1-tipness)*terrain.g` darkens blade bases (L134).
- Vertex (L144-187): `vertexLoopIndex = vertexIndex mod 3` varying, `tipness = step(loop, 0.5)` (vertex 0 is tip) (L102-103). Wrap: `loopPosition = mod(position - center + half, size) - half` then `+ center` (L149-154) — same toroidal wrap, in vertex shader. `bladePosition = worldPosition.xz` varying feeds `terrainNode` (L128-131). `height = 0.6 * (0.6*rand + 0.4) * (perlin(pos*0.0321).r + 0.5) * terrain.g` (L159-163). Shape from `uniformArray` `[0,1, 1,0, -1,0]` (tip, left, right) ×width×terrain.g / ×height (L112-125, L166-170). **Billboard**: `angleToCamera = atan(wz-camz, wx-camx) - PI/2`; `rotateUV(xz, angle, worldPosition.xz)` (L176-177). Wind: `wind.offsetNode(world.xz) * tipness * height * 2` added to xz (L180-181). Hidden where `terrain.g - 0.4 < 0.1`: `y += 100` (L127-131, L184).
- Per frame: only `center` uniform (L212-215). Zero CPU work, one draw call, 78 400 tris.

### Foliage (`sources/Game/World/Foliage.js`) — tree crowns / bushes
- Geometry (L34-87): 80 `PlaneGeometry(0.8,0.8)` merged (`mergeGeometries`) into one crown. Each plane placed at spherical `(r = 1 - rng()^3, φ = 2π rng, θ = π rng)` (dense toward surface), `rotateZ(rng*9999)`, no Y rotation (all planes face +Z, i.e. parallel). **Fake normal**: each vertex normal = `lerp(vertexPos, normalize(planeCentre), 0.85)` (L59-79) → crown shades as a sphere ("materialNormal" via normal attribute) regardless of flat cards. Deterministic `alea('foliage')` rng (L9).
- Instancing (L169-212): each reference (`treeLeaves*` mesh matrix × tree reference world matrix for Trees; raw `bushesReferences.glb` children for Bushes) becomes one `Object3D` with random roll (`up = (sin a, cos a, 0)`) then `lookAt(towardCamera)` where `towardCamera = view.spherical.offset.normalize()` (L173-191): every crown is pre-rotated to face the default camera angle so the parallel cards never show edge-on. `InstancedMesh(geometry, material, n)` + a manual `InstancedBufferAttribute(n*16, 16)` `instanceMatrix` (StaticDrawUsage) consumed in `positionNode` via `instance(object.count, this.instanceMatrix).toStack()` (L155-160) — TSL instancing node instead of three's built-in.
- Alpha / SDF (L94-138): `foliageTexture` = `static/foliage/foliageSDF.png` 128×128 greyscale, Nearest filters, no mipmaps (`Game.js:134`) — image is a scatter of ~25 soft 4-pointed leaf-cluster blobs (SDF-ish gradient). `foliageAlpha = texture(sdf, rotateUV(uv, |wind.offsetNode(positionLocal.xz)|*2.2, 0.5)).r` — card UV rotates with wind magnitude so blobs wiggle. `alpha -= threshold 0.3` then material `alphaTest 0.1` discards (L136, Material L126). Nearest filtering + threshold = crisp pixel-art leaf edges.
- See-through (trees only, `seeThrough=true` L13, `Trees.js:306`): `toVehicle = (screenUV - seeThroughPosition) * (aspect,1)`; `distanceFade = smoothstep(edgeMin, edgeMax, |toVehicle|)`; `alpha = sdf * (fade*(1-threshold) + threshold)` (L115-129). Per tick: `seeThroughPosition = visualVehicle.screenPosition`, `edgeMin = 3/radius.current`, `edgeMax = 15/radius.current` (L214-220) → screen-space hole in canopy around the car.
- Colour: `mix(colorA, colorB, smoothstep(dot(normalWorld, lightDir), 0, 1))` (L141-145) — two-tone by fake sphere normal vs sun. Colours: bushes `#b4b536/#d8cf3b` (`Bushes.js:11-12`), birch `#ff4f2b/#ff903f`, oak `#b4b536/#d8cf3b`, cherry `#ff6d6d/#ff9990` (`World.js:69-71`).
- Shadows: `receivedShadowPositionNode = positionLocal + lightDir * shadowOffset 1` (L163-164) pushes the shadow lookup toward the light to avoid card self-shadow acne; `maskShadowNode = texture(sdf).r > 0.5` (L166) so cast shadows are cut by the same SDF (shadow map alpha). `castShadow + receiveShadow` (L197-198), `frustumCulled=false`.
- Trees (`Trees.js`): visual GLB split by name `treeLeaves*` / `treeBody*` (L38-47); body → `InstancedMesh` with palette material via `materials.updateObject` (L52-67, StaticDrawUsage); each tree adds fixed cylinder collider `[2.5, 0.15]` at +2.5 y (L100-120). Reference GLBs (`*TreesReferences.glb`) are empties carrying transforms.

### Flowers (`sources/Game/World/Flowers.js`)
- Clusters: each reference in `flowersReferences.glb` spawns `3 + floor(rng*8)` flowers within ±1.5 m, random Y rot, scale 0.6..1 (L46-79). Geometry: 8 merged `PlaneGeometry(0.08,0.08)` petals placed on a cone (`Spherical(1, π*0.2*rng, 2π rng)`), each `lookAt(direction)`, offset −0.75 y, random scale ±0.5 (L81-117), uv deleted. White `DoubleSide` material, `receivedShadowPositionNode = positionLocal + lightDir*0.25` (L121-131). Vertex: `instance(count, instanceMatrix).toStack()` then `+ (wind.x, 0, wind.y) * clamp(y,0,1)` (L133-142). Plain `THREE.Mesh` with `mesh.count` set (L151-157) + manual 16-float instance attribute. `instanceColorIndex` references undefined `this.colorIndices` (L167) — dead code, no colour variation.

### Floor (`sources/Game/World/Floor.js`)
- Visual: `PlaneGeometry(size, size, size/1.5, size/1.5)` where `size = round(radius*2)+1`, `cellSize 1.5` (L34-42), normals deleted. Material `normalNode (0,1,0)`, `shadowNode: terrain.g` (grass areas get darkened — shows as darker grass base), no water/bounce (L69-76).
- Colour (L45-66): `base = terrain.colorNode`; `slab = terrain.r * perlin(xz*0.03)`; `slabColor = mix('#a87762','#ffcf8b', slabsTexture(xz*0.175).r)` (`static/floor/slabs.png`, repeat, linear); `mix(base, slabColor, slab)`.
- Displacement: `y += terrain.b * -1.5 * min(min(uv.x,uv.y)*20, 1)` (L78-86) — water depth sinks the plane up to 1.5 m, edge-faded.
- Per frame: `mesh.position.xz = round(optimalArea.position / 1.5) * 1.5` (L177-178) — snaps to cell grid so vertices never swim. Physics: heightfield from `terrain.glb` vertices (L119-152), friction 0.2, restitution 0.15. Bedrock kinematic cuboid under player outside the 192 map (L154-173, L181-207).

### Snow (`sources/Game/World/Snow.js`) — dynamic snow blanket, two-pass
- Grid: `subdivisions 256` over `size = radius*2` → 65 536 quads, 2 tris each, built as explicit triangle list with a `pivot` vec2 attribute (cell centre) per vertex (L163-244). `frustumCulled=false`, `castShadow=false`, `receiveShadow`, hidden until `elevation > -0.9` (L413-421, L427-474).
- Elevation RT (L112-161): `RenderTarget((256+1)², RedFormat HalfFloat, Linear, Clamp)`, rendered per frame with a `QuadMesh` whose `outputNode = elevationNode(uv-0.5)*(size+subdivisionSize) + roundedPosition` (L119-125, L462-469).
- `elevationNode(position)` (L61-93): `elevation uniform` (−1..0.5) `+ smoothstep(perlin(p*0.1).r * perlin(p*0.07).r) * noiseMultiplier 1`; `*= min(1 - tracks.r, remapClamp(1 - tracks.g, 0.5,1, 0.25,1))` (wheel channel r, chassis channel g flatten snow); `+= terrain.b.remap(0,1,0,-2)` (sinks under water).
- Elevation driver (L55-59, L95-109): initial `elevation = remapClamp(rainRatio + meltRatio, -1,1, -1,0.5)`; per tick `elevation += weather.snow * max(dayCycles.progressDelta,0) * 10`, clamped −1..0.5 — snow accumulates/melts over real time.
- Vertex (L280-344): offset by `roundedPosition` (focus snapped to `subdivisionSize`, L448-449); samples elevation RT at 4 cell corners ±subdivisionSize, flips quad diagonal (`rotateUV` by π/2 about pivot) when `|A-C| < |B-D|` (L292-313) — picks the diagonal that best fits the surface; height from `elevationFromTexture(p) = RT.r - terrain.r*2` (L263-271, slabs/furniture get no snow); **normal from finite differences** `cross(A-B, A-C)` with `normalNeighbourShift 0.2`, assigned to varying `computeNormal` → `normalNode` (L316-331); `waterDrop = remapClamp(terrain.b, 0.185,0.235, 0,-1)` after normal (L334-335); `deltaY = y - terrain.b*-2` → `alphaNode = smoothstep(deltaY, 0.022, 0.5)` fades thin snow (L275, L338).
- Glitter (L346-379): `hash(xz*0.2).r*2 + glitterVariation mod 2 - 1 |abs|`, `× remapClamp(perlin(xz*0.05),0,0.5,0,1)`, `^1000`, `×2` added to rgb; `glitterVariation += deltaScaled*0.0004 + view.delta.length()*0.0004` (L445) — sparkles twinkle with time and camera motion. Same recipe on road (`Scenery.js:52-86`, scarcity 100, intensity 0.3, variation `+= deltaScaled*0.004 + view.delta*0.004`).
- `tracksDelta = roundedPosition - tracks.focusPoint` (L452-455).

### Tracks (`sources/Game/Tracks.js`) — ground-contact mask RT
- `RenderTarget 512²`, Linear, Clamp (L25-34); ortho camera ±20 (`size 40`), y=5 looking down (L18-20); own `scene`. Per tick 9: camera xz = `focusPoint`, render scene to RT with `resetRendererState`/`setPixelRatio(1)` (L76-90).
- `Track(thickness, channel)` (L94-250): `DataTexture(128×1 RGBA Float)` ring of positions (L121-130); `PlaneGeometry(1,1,128,1)` strip; `positionNode` reads texture at `uv.x` and previous texel, computes `atan` heading, offsets ±thickness perpendicular (L142-177); `outputNode` = `vec4(channelVec3, alpha)` with end/start/contact/edge fades and screen-edge fade (L179-195), `AdditiveBlending`, `depthTest:false`. CPU `update(position, touching)` shifts data by one texel when `elapsed - lastTime > 1/30` and moved > 0.2 m, always writes slot 0 (L212-249). Vehicle: 4 wheels `Track(0.5,'r')`, chassis `Track(1.5,'g')` (`VisualVehicle.js:251,287`).
- Consumers: `Terrain.terrainNode` (grass flattening), Snow elevation.

### Trails (`sources/Game/Trails.js`) — emissive ribbons (drift/boost)
- `CylinderGeometry(0.1,0.1,1,4,32,true)` rotated so length along −Z, uv deleted (L61-69). Per item: `DataTexture(32×1 RGBA Float)` (L78-84). Vertex: `ratio = 1 - z`; sample position at `ratio` and `ratio+1/32`, build rotation matrix from direction via Rodrigues (`getRotationMatrix`, L5-22), rotate ring verts and normal (L91-118). Fragment: fresnel `1 - |dot(n, +Z)|`, gradient texture lookup (`materials.gradientTexture` `#ffb646→#ff347e→#01005f`) × `emissiveMultiplier 5`, alpha `(1-ratio)*alpha` (L120-131). CPU per tick: shift when moved > 0.4, fade alpha by `deltaScaled*0.2` on every texel (L142-183). `MeshBasicNodeMaterial transparent depthWrite:false`, `renderOrder 1`. Bloom (threshold 1) picks up the ×5 emissive.

### RainLines (`sources/Game/World/RainLines.js`)
- `count = 2^11 = 2048` lines, each 4 verts / 2 tris, indexed; attributes `position` (random x,z in 0..1, y 0, same for 4 verts), `offset` vec2 (which corner), `random` (L13, L100-154). Not instanced — plain indexed mesh, one draw.
- Vertex (L180-213): `xz *= size (radius*2)`, wrap around `center` (same mod trick), thickness along fixed `tangent (0.707,-0.707)` × 0.015; `progress = fract(localTime + random)`; y from `elevation 20 + length` down by `progress*(elevation+length)`, bottom vertex offset by `length`, clamped 0..elevation; `visible = step(visibleRatio, fract(random*99))` → hidden lines pushed `+99` y; incline `xz += tangent * -y * incline`.
- Weather bindings (L45-97): `visibleRatio = rain²`; `length = lerp(remapClamp(rain,0,1,1,3), 0.03, snowRatio)` where `snowRatio = 1-(1-max(snow,0))^4` (rain → snowflakes = short dashes); `speed = lerp(remapClamp(rain,0,1,0.2,0.4), 0.05, snowRatio)`; `incline = remapClamp(wind,0,1,0.1,0.4)`. Per tick: `localTime += deltaScaled*speed`, mesh visible if `visibleRatio > 1e-5` (L225-246). Material: normal up, no shadows cast/no bounce/fog/water, `hasCoreShadows:true`, `renderOrder 1`, `mesh.position.y = -0.3`.

### WindLines (`sources/Game/World/WindLines.js`)
- Pool of 4 `WindLine` (L79-84). Geometry `WindLineGeometry(length 10, 4 handles, amplitude 1, 30 divisions)` = CatmullRom through zig-zag handles → `LineGeometry` (2 verts per point, `ratio` attr, indexed ribbon, `Geometries/LineGeometry.js`). `vertexNode` (L33-51): thickness = `0.1 * smoothstep(1-|ratio-0.5|*2) * smoothstep(1-|ratio - (progress*3-1)|)` — a bump travelling along the ribbon; side offset along fixed tangent `(0,1,-1)` by `±0.5*thickness` using `vertexIndex` parity; manual `cameraProjectionMatrix*cameraViewMatrix*world`.
- Spawn: `setTimeout` loop every 300..2000 ms (L74, L86-94, L139); position = `focusPoint ± radius/2` random, `rotation.y = wind.angle`, y=2; gsap moves `translation 1` m along wind over `duration = remapClamp(wind,0,1,8,2)` s while `progress 0→1` (L142-190). Material white, no shadows/fog/water, transparent, `renderOrder 1`.

### InstancedGroup (`sources/Game/InstancedGroup.js`) — physics-driven props (benches, bricks, fences, lanterns, crates)
- Takes `references[]` (Object3D with `needsUpdate` flag) + a template `group`; for each mesh in the template creates `InstancedMesh(geometry, material, count)` keeping local matrix (L25-50). Per tick 13: for references with `needsUpdate` (or global `needsUpdate`), `finalMatrix = localMatrix.premultiply(reference.matrixWorld)`, `setMatrixAt`; flags `instanceMatrix.needsUpdate` only if any changed (L89-116). Static helpers to derive references from GLB children (L52-81). Game `reset()` sets `instancedGroup.needsUpdate = true` on groups (`Game.js:238-266`).

### Scenery (`sources/Game/World/Scenery.js`)
- Iterates `scenery.glb` children: `objects.addFromModel` (physics + palette material) unless `userData.prevent` (L13-35); `References.parse` for named lookup. Road material: `#383039` + glitter (hash 0.2 freq, perlin 0.05, scarcity 100, intensity 0.3, `sin(uv.y*π)` centre weighting) (L45-94).

### Water (`Water.js`, `WaterSurface.js` partial)
- `surfaceElevation -0.3`, `depthElevation -1.5`, `surfaceThickness 0.013` uniforms (L10-14). WaterSurface: single `PlaneGeometry(1,1)` scaled; ripples = `floor/mod` of `(terrain.b + wind.localTime*0.5)*10` offset by `perlin(xz + idx/0.345)*0.1` and stepped by `ripplesRatio` (temperature 0→−3 fades ripples) (L70-105); ice ratio `remapClamp(temp,0,-5,0,1)` (L116-131); quality 0 uses `viewportSharedTexture` hashBlur refraction behind alpha<0.5 (L300-344).

## Asset pipeline facts
- All GLBs have `-compressed.glb` siblings (etc1s KTX2 embedded, via `npm run compress`, `readme.md:124-151`); textures `.png` + `.ktx` (`VITE_COMPRESSED` picks, `Game.js:97-100`). `palette.png` is the shared colour atlas; Blender materials mute the palette node and `Materials.createFromMaterial` rebuilds every GLB material as `MeshDefaultMaterial` with `texture(map)` or `color` (`Materials.js:287-343`).
- Reference GLBs (bushes/flowers/trees/respawns/tornado path) are transform-only; visuals come from one `*Visual.glb` per species instanced N times.
- `threejs-override.js` patches `Object3D.copy` to skip `userData` deep clone (L1-35).

## TSL node inventory used (WebGL/GLSL mapping)
- Compute: `instancedArray(n,'vec3')`, `.element(instanceIndex)`, `Fn().compute(n)`, `renderer.computeAsync` (Leaves only among foliage; Lightnings/Confetti use `instancedArray(...).toAttribute()` for static per-instance data, no compute). GLSL: transform feedback or GPGPU textures.
- Per-instance attrs: `instancedArray(typedArray).toAttribute()`, `instance(count, instancedBufferAttribute).toStack()` (Foliage/Flowers/Confetti). GLSL: `InstancedBufferAttribute` + manual `mat4` in vertex shader.
- Normals: `materialNormal.assign(...)` (Leaves), vertex `normal` attribute lerped toward sphere (Foliage), varying `cross()` finite difference (Snow). All trivially GLSL.
- Shadows: `receivedShadowNode`, `receivedShadowPositionNode`, `maskShadowNode`, `castShadowNode` — WebGPU node-material hooks; GLSL needs `onBeforeCompile` shadow-mask capture + custom depth material with alphaTest.
- Procedural: `texture()` of RT noise, `hash(instanceIndex)`, `rotateUV`, `remapClamp`, `smoothstep`, `rangeFogFactor`, `screenUV`, `viewportUV`, `cameraPosition`, `modelViewMatrix`, `uniformArray`, `vertexIndex`, `varying`. All have direct GLSL equivalents.
- Post: `pass()`, `RenderPipeline`, `bloom`, `hashBlur`, `renderOutput`, `TempNode` subclass, `QuadMesh`, `RendererUtils.resetRendererState/restoreRendererState`.


## Transferable
- Toroidal wrap of any particle/blade field around a focus point: `pos = mod(pos + half - focus, size) - half + focus` with size = 2x view radius (Leaves.js:250-252, Grass.js:149-154, RainLines.js:188-193). Pure vertex/compute math, GLSL-trivial.
- Optimal-area computation: raycast NDC corners onto ground plane once per resize, radius = centre-to-far-corner, position follows smoothed focus (View.js:213-280, 755-760). Gives one tile size for all wrapping systems. Needs a ground plane assumption (works for planets if done per local tangent plane).
- Grass as one non-instanced triangle soup with vec2 XZ position attribute, per-vertex tipness via vertexIndex mod 3, camera-facing via atan rotateUV, wind at tip only (Grass.js). 78 400 blades one draw call. Obstacle: needs a floor-colour node so blades match ground.
- Floor-colour-matched vegetation: grass colorNode = terrain.colorNode(terrainData) and bounce lighting reads the same (Terrain.js:108-117, MeshDefaultMaterial.js:82-89). Eliminates seams.
- Terrain data texture RGBA = slabs/grass/water masks, sampled by world XZ with one uv function (Terrain.js:88-106). Portable; for planets requires an equirect or cube-face UV instead.
- Foliage crown = 80 merged parallel cards, sphere-lerped vertex normals (0.85), per-instance random roll + lookAt(default camera), Nearest-filtered 128px SDF alpha with threshold 0.3, wind rotates SDF UV (Foliage.js). Works on any backend. Obstacle: cards assume a fixed camera angle; for free orbit cameras use lookAt per frame or spherical billboarding.
- Shadow catcher trick: receivedShadowNode captures the shadow factor into a float and re-applies as colour mix with max(core, drop, custom) (MeshDefaultMaterial.js:53-62, 103-119). GLSL: onBeforeCompile replacing lights_fragment shadow usage.
- receivedShadowPositionNode = position + lightDir*offset and maskShadowNode = sdf > 0.5 for alpha-cut foliage shadows without acne (Foliage.js:163-166). GLSL needs customDepthMaterial with alphaTest and a normal/light-direction bias.
- Leaves GPU sim recipe: storage position+velocity, per-frame vehicle push (remapClamp 0.5..2), perlin-gated wind (strength - noise, max 0), one-frame explosion impulse via vec4 uniform reset after dispatch, upward lift from horizontal speed, damping by terrain water channel, gravity*weight, floor/water clamp, toroidal wrap (Leaves.js:171-254). Obstacle on WebGL: compute must become transform feedback or FBO ping-pong.
- Per-instance fake normal via materialNormal.assign(modelViewMatrix * randomNormal) on flat quads (Leaves.js:106-128) so particles shade with volume.
- Two-octave scrolling perlin wind field offsetNode(position) = dir * (n1(p*0.1 + dir*t) + n2(p*0.05 + dir*0.2t)) * strength, t advanced by deltaScaled*0.1*strength (Wind.js:25-38, 69). Shared by grass, flowers, foliage, water ripples.
- Procedural 128px tileable perlin/hash/voronoi render targets rendered once with QuadMesh and sampled in world space everywhere (Noises.js). Could be baked PNG for GLSL.
- Tracks RT: ortho top-down 512px render of ribbon meshes driven by 128-texel DataTexture position rings, additive per-channel (r wheels, g chassis), consumed by terrain grass mask and snow elevation (Tracks.js). Portable to WebGL as-is.
- Snow blanket: 256^2 quad grid, elevation baked per frame into a 257^2 R16F RT from noise*noise + track flattening + water sink, vertex shader flips quad diagonal to best-fit and derives normal from finite differences, alpha fades thin snow, accumulation = weather.snow * dayProgressDelta * 10 (Snow.js). Heavy but all vertex-shader.
- Glitter sparkle: |((hash(xz*f)*2 + variation) mod 2) - 1| * perlin, pow(scarcity 100..1000), * intensity, variation += dt*k + cameraDelta*k (Snow.js:356-379, Scenery.js:59-86).
- Weather = sum of sin products on a 4-minute day clock with override lerp system; every visual knob is a debug 'manual binding' whose auto getter maps weather to the uniform (Weather.js, Debug.js:27-57). Pure JS, portable.
- Rain as 2048 indexed quads with progress = fract(localTime + random), visibility via step(visibleRatio, fract(random*99)), length/speed lerp toward snow dashes when weather.snow rises (RainLines.js). No instancing needed.
- Wind lines: pooled 4 CatmullRom ribbons, thickness bump travelling by progress uniform, gsap translate along wind angle, spawn interval 300-2000 ms (WindLines.js).
- Tilt-shift cheapDOF: hashBlur with strength = smoothstep(|uv.y-0.5|, 0.2, 0.5) * 0.003, 25 repeats, mixed back (cheapDOF.js). WebGL: any screen-space blur pass with same mask.
- PreRenderer: render a 32px cube camera once with all hidden objects visible to precompile pipelines (PreRenderer.js). WebGL equivalent: renderer.compile(scene, camera).
- Quality tiers are binary (mobile UA); only shadow map 2048/512, bloom mips 5/2, DOF on/off, water refraction blur on/off, camera phi and speed-zoom differ. Instance counts never change with tier (Quality.js + grep).

## Gaps
- Did not read Lightnings.js, Confetti.js, VisualTornado.js, Whispers.js, Areas/* in full (only grep for counts/instancing); task list did not name them.
- Did not read View.js beyond optimalArea/spherical/zoom sections, nor Reveal.js, Objects.js, Physics/*; only grepped the uniforms they expose.
- Did not run the project; exact draw-call/triangle counts at runtime are inferred from counts in code, not measured.
- terrain.png channel semantics (R slabs, G grass, B water) inferred from code usage and a visual read of the image; no authoring doc in repo confirms it.
- Foliage.js uses `instance(object.count, this.instanceMatrix)` but `this.instanceMatrix` is created after `setMaterial()` (setInstancedMesh runs later); it works because the Fn body is evaluated lazily at compile time. Not verified at runtime.
- Flowers.js references undefined `this.colorIndices` (L167); likely harmless (Float32Array of undefined length) but not verified.
- Spring `leaves: 0` makes Leaves count `2^round(remap(0,0.25,1,7,11))` = 2^round(5.67) = 2^6 = 64; the commented-out early return (Leaves.js:14-15) suggests intent to skip leaves entirely below 0.25; actual visual behaviour unverified.
- WebGL fallback: three r0.183 WebGLBackend supports storage buffers via transform feedback for `instancedArray` compute but the extent of coverage for this code's compute (texture sampling inside compute) was not tested.


---

# 3. How one Blender scene becomes the site: composition and lifecycle

## folio-2025 WORLD COMPOSITION AND LIFECYCLE (read 2026-10-08, checkout at folio-2025/; paths below relative to `sources/Game/` unless `static/`)

### 0. Prior research already covers (docs/research/2026-10-08-folio-2025-physics-terrain-streaming.md), 10 lines
1. Rapier wasm, one `world.step` per frame at `deltaScaled` (delta capped 1/30 s × time scale 2), no substeps; `Physics.getPhysical` field list, density 0.1 / friction 0.2 / restitution 0.15 defaults, collision groups floor/object/bumper, opt-in contact-force events.
2. `Objects.getFromModel` Blender naming: `*Physical*` + `dynamic|kinematicPositionBased`, children `cuboid|tube|ball|hull|trimesh` → colliders, userData friction/restitution/category/mass.
3. Vehicle: `DynamicRayCastVehicleController`, 3-cuboid chassis mass 2.5 with CoM −0.5 m, bumper group, suspension-as-jump, soft top speed, flip/stuck/unflip, tracks ring-buffer RT.
4. Ticker/Events phase ordering 0..999 (same as readme "Game loop").
5. Terrain: 192 m square, RGBA mask texture (r slab, g grass, b water depth), 129² heightfield, camera-following floor plane snapped to 1.5 m cells, water quad at −0.3, edge bedrock slab.
6. Optimal area (4 corner rays → ground quad centre+radius) drives floor, grass (78,400 blades toroidal wrap), rain, leaves, snow, shadow cam, fog.
7. Wind function shared by grass/leaves/flowers/ripples; trees = InstancedMesh trunks + Foliage quads; lighting look (MeshDefaultMaterial).
8. Areas: one GLB, all areas + bodies exist from boot, `refZoneBounding`/`refZoneFrustum` semantics, radii per area, loader = two flat batches, lazy KTX2 project screenshots only.
9. Quality tiers (mobile UA → level 1), InstancedGroup matrix math, sleeping discipline (spawn asleep, force-sleep outside radius, reset below −1.5).
10. Transfer list for an infinite world (chunked heightfields, chunk manager, seeded placement, resource queue).
→ Below I do NOT re-derive physics body creation, terrain, grass, streaming; I report composition, lifecycle, text, props, debug, monitoring with the exact mechanisms.

### 1. Boot sequence (Game.js)
- Singleton `Game.getInstance()` (`Game.js:54-68`); `init()` async (`:70-216`).
- Order: scene, Debug, ResourcesLoader, Quality, Server, Ticker, Time, DayCycles, YearCycles, `Inputs([], ['intro'])`, Audio, Notifications, RayCursor, Viewport, Modals, Menu, Rendering, `await rendering.setRenderer()` (`:78-95`).
- Env flags: `VITE_COMPRESSED` picks `-compressed.glb` + `.ktx` vs `.glb` + `.png` (`:97-100`); every URL gets `?cb=1` cache-buster (`:102`); `VITE_PLAYER_SPAWN` default `'landing'` (`:111`).
- **Batch 1** (`:103-109`): `respawnsReferencesModel` (respawns GLB), `behindTheSceneStarsTexture`, `soundTexture` (intro mute icon, `repeat.x = 0.5`), `paletteTexture` (Nearest, sRGB). Then Options, Respawns, View, postprocessing, `rendering.start()`, Reveal, Noises, Weather, Wind, Tracks, Lighting, Fog, Water, Materials, Objects, Explosions, `World` (which runs `step(0)`) (`:110-126`).
- **Batch 2** (`:132-179`): `import('@dimforge/rapier3d')` in parallel (`:129`); ~40 files incl. `areasModel` (`:155`), `sceneryModel` (`:154`), `playgroundVisual`/`playgroundPhysical` (`:137-138`), prop GLBs bricks/fences/benches/explosiveCrates/lanterns/poleLights (`:140-144,156`), tree visual+references GLB pairs ×3 (`:148-153`), terrain tex+GLB (`:145-146`), 6 `career*Texture` (`:166-171`, flipY false, Clamp), timeMachine screens. Progress callback → `world.intro.updateProgress(1 - toLoad/total)` (`:175-178`).
- `Promise.all` (`:181`) → `this.resources = {...new, ...old}` (`:183`) → Terrain, Physics, PhysicsWireframe, PhysicsVehicle, Zones, Player, ClosingManager, InteractivePoints, KonamiCode, Achievements, Tornado, Map, Title (`:185-197`), `world.step(1)` (`:199`), Overlay (`:200`), `PreRenderer.render()` only if quality 0 and WebGPU backend (`:203-204`), then `ticker.wait(3, () => reveal.updateStep(0))` (`:206-209`). Debug → achievement `'debug'` (`:212-215`).
- **playground GLBs are dead**: loaded at `Game.js:137-138`, referenced nowhere else (`grep -rn playground sources` → only those two lines). `static/playground/playgroundVisual.glb` 96,140 B (9 meshes, materials carBlack/carMetal/emissiveWarnWhite), `playgroundPhysical.glb` 6,276 B (1 mesh `Circle`).
- `Game.reset()` (`:218-274`): clears interactive buttons, `player.respawn(null, cb)`; cb: `objects.resetAll()`, explosiveCrates.reset, bowling.restart, cookie/social/benches/fences/bricks/lanterns `instancedGroup.needsUpdate = true`, achievement `'reset'` after 2 s.
- ResourcesLoader (`ResourcesLoader.js:16-53`): lazy loader map `texture`→TextureLoader, `textureKtx`→KTX2Loader (`./basis/`, `detectSupport(renderer)`), `draco`→DRACOLoader(`./draco/`), `gltf`→GLTFLoader with both. `load(files, progress)` (`:55-123`): file tuple `[name, url, type, modifierFn]`, counter-based Promise, URL cache Map, modifier applied before save (`:78-79`).

### 2. World.js step machine
- `World.constructor` → `step(0)` (`World.js:38`).
- `step(0)` (`:49-53`): `Grid`, `Intro`.
- `step(1)` (`:54-80`), called from Game after batch 2: VisualVehicle(resources.vehicle.scene), Floor, WaterSurface, Grass, WindLines, Confetti, Leaves, RainLines, Lightnings, Fireballs, Snow, VisualTornado, Bushes, `Trees('Birch Tree', birchTreesVisualModel.scene, birchTreesReferencesModel.scene.children, '#ff4f2b', '#ff903f')`, Oak `'#b4b536','#d8cf3b'`, Cherry `'#ff6d6d','#ff9990'` (`:69-71`), Flowers, Bricks, Fences, Benches, ExplosiveCrates, PoleLights, Lanterns, Scenery, Areas (`:72-80`). Construction order = creation order of bodies/instanced meshes; no dependency graph.
- `step(2)` (`:82-85`): `Whispers` only (after reveal completes).
- `setPhysicalFloor` (`:88-101`) 1000×1×1000 cuboid at y −1.01, category floor — defined, not called from step (Floor.js owns the heightfield). Rest of file = commented test helpers (`:103-245`).

### 3. One Blender scene → the site: GLB contents (parsed from GLB JSON chunk)
- **`static/areas/areas.glb`** 3,286,220 B (`-compressed` 639,312 B): 737 nodes, 266 meshes; materials `palette, emissiveOrangeRadialGradient, stylizedMap, redGradient, emissivePurple/Blue/WhiteRadialGradient, careerTextHetic/Uzik/Immersive/OnlineTeacher/Freelancer/IRLTeacher, darkGray, blackboardLabels, projectsCarpet, projectsLabels, labCarpet, cookieBanner, bowlingLabelStrike`. Root nodes = one per area: `landing, career, social, projects, lab, cookie, altar, toilet, bowling, circuit, behindTheScene, achievements` (+ timeMachine, easter) plus 5 orphan root `cuboid.082-086` empties (ignored: no `Physical` in name, and `Areas` only matches prefixes).
- Per-area root children are a mix of: plain meshes (`Plane.018`, `Cube.065`…), `*PhysicalDynamic`/`*PhysicalFixed`/`*PhysicalKinematicPositionBased` groups with `cuboid.N`/`tube.N`/`ball`/`hull`/`trimesh` children, and `ref*` empties/meshes. Examples: landing `gamepadPhysicalDynamic.001` {body mesh, `cuboid.011` scale [3.18,0.76,1.76]}, `refLettersPhysicalDynamic.010-019` each `extras {mass:0.2}` + one cuboid; career `refLine`…`refLine.005` with `extras {size, hasEnd, color, texture}` and child `stone.N` mesh, `refYear` with `digit0*` meshes; social `baguiraPhysicalDynamic` has `Bone` children (rigged mesh); projects `refOvenPhysicalDynamic` {Cube.092, Cube.101, cuboid.053, refCharcoal}, `refTitle/{inner.003}`, `refUrl/{inner.004}`, `refAttributes/{at,role,with}`, `refDistinctions/{awwwards,cssda,fwa}`, `refIntersectNextImage` scale 0.19, `refIntersectPreviousProject` 0.78; lab `refMini/{Cube.166,image,intersect,panel.001,text.008}` template, `refGearA/B/C`, `refChainLeft/Right/Pulley`; cookie `refCookie extras {preventAutoAdd:true}`, `refSpawner`, `refTable`, `cookiePhysicalFixed/{...,lava,refBanner,refCounterPanel,refOvenHeat}`; bowling `refPinPhysicalDynamic extras {preventAutoAdd:true}` with 2 tubes, `refPinPositions/{pin0..pin9}` empties, `refBumpersPhysicalKinematicPositionBased` 2 cuboids scale [28.59,0.82,0.34], `refJukeboxPhysicalDynamic {mass:5}`, couches `{mass:0.35}`, sauces `{mass:0.05}`; circuit `refCheckpoints.000-007 extras {preventFrustum:true}` scale [10,1.67,1.67], `refObjectsPhysicalDynamic.000-020 {mass:1}`, `refObstaclesPhysicalKinematicPositionBased.001-005` (`.005 {restitution:1}`), `bumpersPhysicalFixed.001 {restitution:1}`, `refTimer {preventFrustum}`, `refStartingLights {preventFrustum}`, `Text.002` (Blender text mesh); achievements `physicalFixed.008 extras {category:'floor'}`; toilet `refCabinPhysicalDynamic {mass:5}`, papers `{mass:0.1/0.01/0.02}`.
- Zone empties (scale.x = radius, m) bounding/frustum: landing 17.23/13.23, career 10.89/9.9, social 15.81/14.82, projects 7.22/6.25, lab 7.22/5.8, cookie 7.34/4.32, altar 12.35/12.87, toilet 6.08/12.18, bowling 17.27/21.74, circuit 19.48/55.16, behindTheScene 8.16/5.9.
- **`static/scenery/scenery.glb`** 266,188 B (compressed 47,892): 38 nodes, 32 meshes, materials `palette, black`. Roots: `bridgePhysicalFixed`, `bridgePhysicalFixed.001` (each 3 cuboids [3.67,2.18,10.3],[0.29,2.18,8.6]×2), `basaltRocksPhysicalStatic`…`.004` (hull children; "Static" not matched by `dynamic|kinematic` → fixed), `slabes`, `refRoad` (mesh), ~15 plain `Cube.N`. Static non-area props only.
- **`static/respawns/respawnsReferences.glb`**: 18 empties `respawnCookie, Landing, Altar, Bonfire, Projects, Lab, Career, Social, Bridge, Toilet, Controls, Bowling, OnlyFans, Circuit, TimeMachine, BehindTheScene, Achievements, Test`.
- **Prop GLBs** = N placed copies of the same object: `benches.glb` 7× `benchPhysicalDynamic.N` scale 1.09 each with 2 cuboid children; `lanterns.glb` 17× `lantern.N/{base.N, light.N}` (materials palette + emissiveOrangeRadialGradient); bricks/fences/poleLights/explosiveCrates same shape. Trees: `*TreesReferences.glb` (empties) + `*TreesVisual.glb` (one `treeBody*` + `treeLeaves*` meshes, `Trees.js:33-47`).
- Material mapping is by Blender material NAME: `Materials.updateObject(mesh)` (`Materials.js:356-366`) traverses meshes, skips `material.userData.prevent`, replaces with `getFromName(material.name, material)` (`:273-285`, cached Map); `createFromMaterial` (`:287-343`) converts Lambert/Standard → `MeshDefaultMaterial({colorNode: texture(map).rgb | color, alphaNode: texture(alphaMap) | float(opacity), hasCoreShadows, hasDropShadows, transparent})`; exceptions `projectsLabels`/`blackboardLabels` → premultipliedAlpha, alpha from `map.r` (`:316-324`). Readme: palette texture node is muted in Blender, set in Three (`readme.md` "Blender > Export").

### 4. References: name-parsing
- `References.parse(object)` (`References.js:11-31`): `object.traverse`, regex `^ref(?:erence)?([^0-9]+)([0-9]+)?$` (`:18`); key = group1 with first char lower-cased (`:22`); trailing digits dropped so `refLine`, `refLine.001`… → NO: `.001` contains a dot, `[^0-9]+` stops at the digit so `refLine.001` → `line.` — in practice Blender names are exported without suffix collisions for refs, and multi copies like `refLettersPhysicalDynamic.010` key as `lettersPhysicalDynamic.`; `Objects.getFromModel` strips `physical|fixed|dynamic|kinematicPositionBased` from the node name first (`Objects.js:157`) ONLY for the object itself, and `Area.setObjects` calls `addFromModel` before `references.parse(child)` (`Area.js:48,68`), so a `refLettersPhysicalDynamic.010` node is keyed `letters.` → `LandingArea.js:26` gets `items.get('letters')` (works because `[^0-9]+` includes `.`: key = `letters.` ... verified usage relies on `getStartingWith`? No: Landing uses `get('letters')`. Hence the exporter must emit names without `.NNN` for that to hit; GLB shows `.010` suffixes → key is `lettersPhysicalDynamic.`→ after name cleanup becomes `refLetters.010` → key `letters.`. **Gap flagged below**; mechanism as written is the regex.)
- Items stored as arrays per key (`:25-28`); `getStartingWith(prefix)` (`:33-50`) returns Map of stripped lower-camel suffix → array.
- Consumers always `references.items.get('x')[0]` (position, mesh, group) e.g. `ProjectsArea.js:346,551,693,897,936`, `LabArea.js:746-751,786`, `CareerArea.js:70,154`, `Audio.js:473,475,495`.

### 5. Area base + Areas
- `Areas` (`Areas.js:23-48`): static list `[name, Class]` ×13; iterates `areasModel.scene.children`, `child.name.startsWith(name)` → `this[name] = new Class(child)`. All at once, synchronous, at `world.step(1)`.
- `Area(model)` (`Area.js:9-30`): `isIn=false`, `Events`, `References`; `setObjects`, `setBounding`, `setFrustum`; tick order 10: `frustum.test()` then `update()` only if no frustum or `frustum.isIn` (`:22-29`).
- `setObjects` (`:32-70`): for each child without `userData.preventAutoAdd` → `objects.addFromModel(child, {}, {position: child.position.add(model.position), rotation: child.quaternion, sleeping: true, mass: child.userData.mass})` (`:42-53`, note `add` MUTATES child.position into world space); hideable if visual && (no physical || fixed) && !preventFrustum (`:57-63`); `references.parse(child)` for every child (`:68`).
- `setBounding` (`:72-102`): `zoneBounding[0]` → `zones.create('cylinder', position.clone(), scale.x)`; enter/leave → `isIn` + events `boundingIn/boundingOut`.
- `setFrustum` (`:104-177`): circle (x,z,scale.x), `alwaysVisible=false`; `test()` = `circleIntersectsPolygon(pos, r, view.optimalArea.quad2[0..3].offseted)` (`:137-146`); on transition sets `visible` on all hideable (`:152-153,166-167`), events `frustumIn/frustumOut`.
- Representative areas:
  - **CareerArea** (`CareerArea.js`): sounds stoneOut/stoneIn positional, distanceFade 14, rate `1.2 + index*0.1` (`:32-60`); `lines` from `references.items.get('line')` reading `userData.size/hasEnd/color/texture` (`:70-86`), `stone` child (`:88`), `careerText*` child gets a MeshLambertNodeMaterial whose outputNode discards `uv.x > labelReveal` and tints baked texture by colour/luminance ×1.7 (`:100-127`); sorted by origin.z (`:133`). Years: 7-segment `DataTexture(7×10, RedFormat)` (`:175-201`), each `digitN` mesh `positionNode` pulls inactive bar vertices down by 1 using `uv(1)` as bar index (`:216-229`), year start 2008, size 17 m (`:156-158`). `update()` (`:268-375`): per line `delta = origin.z - player.z`, in when `-0.25 < delta < size+0.5`, stone elevates to 2.5 with `deltaScaled*3` easing, slides z toward `-clamp(delta,0,size)` with `*10`; year group follows player z and `updateDigits(2008 + floor(offset))`.
  - **ProjectsArea** (1555 lines): constructor builds sounds (anvil positional), interactive point from `refInteractivePoint` (`:88-89`), inputs left/right/forward/backward/interact + interactiveButtons previous/next/open/close (`:119-170`), cinematic offsets with tweakpane (`:176-208`), shadeMix, texts, hover, navigation, images (`refImages` mesh `:346`), pagination (`refPagination`, `refIntersectPagination`, arrows), attributes (`refAttributes` + TextCanvas per item `:708`), adjacents (`refPrevious/refNext` + TextCanvas `:781,828`), title (`:893-930`), url (`:932-1038`), distinctions, pendulum (`refBalls` gsap timelines `:1103-1111`), blackboard (labels per input mode `:1142-1198`), oven (`refBlower`, `refCharcoal`, manual binding `:1200-1243`), grinder, anvil (`refHammer`, `refBlade`). `open()` (`:1296-1358`): state machine OPENING→OPEN after 1.5 s, `inputs.filters` delete wandering add cinematic, `view.cinematic.start(pos, target)`, `interactivePoints.temporaryHide()`, shadeMix uniforms gsap 2 s, activate rayCursor intersects, `physicalVehicle.deactivate()`, interactive buttons, click sound, achievement. `update()` (`:1535-1554`): blower `scale.y = sin(t)*0.2+0.8`, grinder `rotation.z = -t*0.75`, hammer `rotation.x = (1-|sin|)^5 - 1`, anvil sound on loop wrap.
  - **LabArea** (1458 lines): same skeleton (`:22-66`) + scroller: chains `refChainLeft/Right/Pulley` with `alphaNode: positionWorld.y.step(4)` (vertical vs pulley inverse) (`:759-779`), gears `refGearA/B/C`, `refMini` template `removeFromParent()` then cloned per `labData` entry (`:786-800`) with per-mini `TextCanvas(…, 0.18, 1.5, 0.2, density, 'center', 0.2)` and panel width `= measure.width/density + 0.2` (`:891-903`), `labScroll` input (`:1023`); candle flames `refCandleFlame` toggled by `dayCycles 'night'` (`:1126-1152`); cauldron `refHeat/refWood/refLiquid` shader uniforms with debug colour bindings (`:1175-1266`). `update()` only `scroller.animate()` while not CLOSED (`:1452-1458`).
  - Instancing inside areas: Bowling `InstancedGroup.getReferencesFromChildren(refPinPositions.children)` + base `refPinPhysicalDynamic` zeroed (`BowlingArea.js:81-89`), colliders via `objects.getFromModel(basePin)` (`:94`), per-pin `objects.add({model: reference, parent: null}, {dynamic, friction .5, mass .02, contactThreshold 5, ...})` (`:107-131`), `new InstancedGroup(references, basePin)` (`:153`). Cookie: 22 synthetic `Object3D` references (20 at spawner y+99 disabled, 2 on table), cylinder collider `[0.275, 0.625]`, mass 0.02 (`CookieArea.js:186-251`). Social fans same (`SocialArea.js:135`).
  - Landing letters: after auto-add, retrieves `userData.object.physical` and enables contact events threshold 5 + `hitBrick` sound (`LandingArea.js:24-37`).

### 6. Prop classes (one class per kind)
Pattern (`Benches.js`, `Bricks.js`, `Fences.js`, `Lanterns.js`, `PoleLights.js`):
1. `[base, references] = InstancedGroup.getBaseAndReferencesFromInstances(resources.X.scene.children)` (`InstancedGroup.js:73-85`): base = `instances[0].clone()` with position/rotation zeroed; references = one `Object3D` per child copying position/rotation/scale, `needsUpdate=true` (`:56-71`).
2. Base flags: `castShadow/receiveShadow = true`, `frustumCulled` true (benches/fences) or false (bricks/lanterns). Lanterns/PoleLights/Fences strip trailing digits from child names `name.replace(/[0-9]+$/i, '')` so instances can be found by name later (`Fences.js:21`, `Lanterns.js:13`, `PoleLights.js:29`).
3. Colliders: benches/fences extract from base via `objects.getFromModel(base, {}, {})[1].colliders` (`Benches.js:17,39`); bricks hard-code cuboid `[0.5625, 0.375, 0.75]` (`Bricks.js:40`); lanterns `[0.35, 0.5, 0.35]` (`Lanterns.js:42`); pole lights fixed `[0.2, 1.7, 0.2]` (`PoleLights.js:58`).
4. `materials.updateObject(base)`.
5. Per reference `objects.add({model: reference, updateMaterials: false, parent: null}, {type:'dynamic', position, rotation, friction 0.7, mass 0.1, sleeping true, colliders, waterGravityMultiplier -1, contactThreshold 10|15, onCollision → audio group hitBrick/hitMetal})` (`Benches.js:26-47`, `Bricks.js:25-49`, `Lanterns.js:27-51`).
6. `this.instancedGroup = new InstancedGroup(references, base)`.
7. Tick order 10: `if(!body.isSleeping() && body.isEnabled()) object.visual.object3D.needsUpdate = true` (`Benches.js:55-62`).
- `InstancedGroup` (`InstancedGroup.js`): `setMeshes` traverses base, per mesh stores `localMatrix = _child.matrix` and creates `InstancedMesh(geometry, material, count)` added to scene directly (`:29-54`); `update()` tick 13 (`:93-120`): for references with `needsUpdate` or group `needsUpdate`, `reference.updateMatrixWorld()`, `finalMatrix = localMatrix.clone().premultiply(reference.matrixWorld)`, `setMatrixAt(i, …)`; `instanceMatrix.needsUpdate = true` once if any updated. `autoUpdate=false` variant for PoleLights (`PoleLights.js:38`).
- PoleLights extras: `glass` instance found by name (`:40`), fireflies = `SpriteNodeMaterial` mesh with `count = refs×5`, positions via `instancedArray(...).toAttribute()`, offset `sin(t*0.4)*0.5, sin(t)*0.2, sin(t*0.3)*0.5` with `hash(instanceIndex)*999` phase, `scaleNode` uniform, `CircleGeometry(0.015, 8)` (`:75-118`); night interval toggles glass visible + gsap scale 5 s (`:120-141`).
- Scenery (`Scenery.js:6-35`): every `sceneryModel.scene.children` without `userData.prevent` → `objects.addFromModel(child, {}, {position, rotation, sleeping true, mass})`; `references.parse(child)`; `setRoad` (`:45-113`): `refRoad` mesh gets `MeshDefaultMaterial({colorNode: glitter Fn, hasLightBounce false, hasWater false})` where glitter = `|((hash(xz*0.2)*2 + variation) mod 2) - 1|^scarcity(100) * intensity(0.3) * perlin(xz*0.05) * sin(uv.y*π)` added to `#383039`; `update()` advances `glitterVariation += deltaScaled*0.004 + view.delta.length()*0.004` (`:115-118`).

### 7. Objects registry (`Objects.js`)
- `add(visualDesc, physicalDesc)` (`:19-112`): visual defaults `updateMaterials true, castShadow true, receiveShadow true, parent scene`; `parent: null` keeps the Object3D out of the scene (used by instanced references); cross-links `body.userData = {object}` and `object3D.userData.object` (`:86-93`); key counter into `list` Map (`:98-99`); if sleeping/disabled/fixed copies body translation+rotation into visual once (`:102-109`).
- `getFromModel` (`:114-219`), `addFromModel` (`:221-225`), `resetObject` (`:227-270`), `resetAll` (`:272-278`), `disable` (zero vel, `setEnabled(false)`, `removeFromParent`) (`:280-293`), `enable` (`:295-302`), `update` tick 4 (`:304-361`).

### 8. Zones, Respawns, Map, InteractivePoints, Explosions, Events
- `Zones` (`Zones.js`): tick 8; `create(type='sphere'|'cylinder', position, radius)` pushes `{type, position, radius, isIn, events, preview}`; wireframe sphere preview in hidden `previewGroup` (`userData.preventPreRender`, debug toggle) (`:18-30,40-45`); `update` 2D (cylinder) or 3D distance vs `player.position`, fires `enter`/`leave` with zone (`:50-81`).
- `Respawns` (`Respawns.js:14-38`): each child of respawns GLB → name `child.name.replace(/^respawn(.+)$/i,'$1')` lower-camel, `position = (x, 4, z)`, `rotation = child.rotation.y` (YXZ reorder); `getByName`, `getDefault`, `getClosest` (xz hypot) (`:40-67`).
- `Map` (`Map.js`): lazy `init()` on modal open (`:17-23`); 12 hard-coded locations with `respawnName` + % offsets (`:43-56`), DOM pins positioned by `worldToMap` = `coord/terrain.size + 0.5` clamped (`:154-169`); click → `player.respawn(name)` + close (`:80-87`); image `ui/map/map-night.webp`/`map-day.webp` swapped by `dayCycles.intervalEvents.get('night').inInterval` (`:109-119`); key M (`:139-151`); tick 14 moves player marker only when rounded position changes, rotate `-physicalVehicle.yRotation` (`:171-192`).
- `InteractivePoints` (`InteractivePoints.js`): states HIDDEN/OPEN/CONCEALED (`:12-14`); shared geometries plane 2×2 and label 1×1 translated +0.5 x (`:66-77`); uniforms `playerPosition`, `backColor #251f2b`, `frontColor #fff` (`:82-85`); key icon mesh swaps texture per input mode/gamepad type (`:96-160`). `create(position, text, align, state, interact, reveal, conceal, hide)` (`:181-575`): group rot x −0.15π y 0.25π scale 0.85 (`:198-204`); label = 2D canvas, height 64 px, font `700 64px "Amatic SC"`, width = `measureText + padding(60/12)+2`, black bg white text, `THREE.Texture(canvas)` Nearest (`:212-248`); label material discards outside `uv.x - labelOffset ∈ [0,1]`, mixes fogged backColor → frontColor by text (`:254-275`); label mesh `scale.x = 0.75*width/height`, `scale.y = 0.75`, renderOrder 6 (`:281-289`); diamond = square-distance SDF with `threshold/lineThickness/lineOffset` uniforms, renderOrder 7 (`:292-330`); rayCursor sphere r 0.75 (`:350-385`); `hide/reveal/conceal/interact/show` drive gsap on the 4 uniforms + keyIcon scale (elastic.out(1.3,0.4) 1.5 s on reveal, back.in(4.5) 0.6 s on hide), `depthTest` toggled off while open (`:391-537`); items created before `revealed` are forced HIDDEN with `showAfterReveal` (`:542-560`). `update` tick 9 (`:577-642`): only when player moved > 0.2 m or `needsTest`; nearest item within 2.5 m (2D) becomes active → reveal, others conceal. `temporaryHide()/recover()` (`:644-664`) used by area open/close and Reveal step 2.
- `Explosions.explode(coords, radius=7, strength=4, vehicleOnly=false, bulletTimeStrengthThreshold=3)` (`Explosions.js:15-81`): camera roll kick `remapClamp(dist, 2, 15, 1, 0)`; `world.leaves?.explode`; per dynamic enabled body: `fadedStrength = remapClamp(xzDist, 1, radius, 1, 0)`, impulse dir = (xz dir ×0.5, y 1) normalised × `fadedStrength*strength*mass`, applied next frame via `ticker.wait(1)` with `applyImpulseAtPoint(impulse, bodyPos, true)`; vehicle hit above threshold → `time.bulletTime.activate()`; returns `vehicleHit`.
- `Events` (`Events.js`): `on(name, cb, order=1)` stores `callbacks[name][order][]`; `trigger` iterates `for(const order in …)` (sparse array, ascending numeric keys) (`:8-21,50-65`); `off(name, cb?)` (`:24-48`).
- Ticker `wait(frames, cb)` frame-count queue (`Ticker.js:52-70`), `maxDelta 1/30` (`:14`).

### 9. Intro + Reveal animation (the "site load" sequence)
- `Grid` (`Grid.js`): 100×100 plane at default respawn (`:58-67`), `MeshGridMaterial` scale 0.001 with lines `#8d55ff` (10, 0.02, 0.2) and `#675369` (100, 0.002, 1) (`:27-41`), wrapped in `MeshDefaultMaterial({hasWater false, hasReveal false, hasLightBounce false})` (`:43-48`), outputNode discards where `|positionWorld.xz - reveal.position2| < reveal.distance` (`:50-56`) → grid is visible OUTSIDE the reveal circle; `show()` re-adds, `destroy()` disposes material+geometry (`:91-101`).
- `Intro` (`Intro.js`): center = default respawn (`:13-14`); loading ring `RingGeometry(3.46, 3.5, 128)` at y 0.001, outputNode discards fragments whose angle-progress > `smoothedProgress` uniform, colour `reveal.color*reveal.intensity` (`:55-85`); `updateProgress(p)` + tick 8 smoothing `+= (p - s)*delta*10` (`:306-313`); `circle.hide(cb)` gsap scale→0 1.5 s power4.in then `removeFromParent` (`:88-113`); label group scale 0.01 placed by quality (`:23-49`); `setText()` lazily loads `intro/{mouseKeyboard|gamepadXbox|gamepadPlaystation|touch}Label.ktx` via `resourcesLoader.getLoader('textureKtx')`, caches in Map, material discards `r < 0.5` (`:116-200`), re-run on `gamepad typeChange` / `inputs modeChange`; sound button plane with `soundTexture` alphaMap, `offset.x = 0.5` when muted, rayCursor sphere r 0.5 toggles `audio.mute` (`:202-259`); `showLabel` elastic.out(0.5) 2 s delay 1 (`:261-279`), `hideLabel` 0.3 s then removes meshes + intersect (`:281-304`); `destroy()` disposes 3 geometries, 3 materials, `soundTexture`, cached label textures, unhooks tick/gamepad/inputs events (`:316-343`). Debug mode ×4 speed.
- `Reveal` (`Reveal.js`): uniforms `position2Uniform` (respawn xz), `distance 0`, `thickness 0.05`, `color #e88eff`, `intensity 5.5` (`:16-21`); sound `sounds/reveal/reveal-1.mp3` (`:22-28`); tweakpane folder (`:30-41`); tick 10 copies `dayCycles.properties.revealColor/revealIntensity × intensityMultiplier` (`:232-236`). Every `MeshDefaultMaterial` with `hasReveal` (default true, `MeshDefaultMaterial.js:39`) runs `revealDiscardNodeBuilder` (`:7-17`): discard where `distanceToCenter > reveal.distance`, and within `thickness` of the edge mix to `color*intensity` → an expanding glowing ring that reveals the world.
  - **Step 0** (`:51-148`, fired by `Game.js:206-209` 3 frames after boot): `intro.circle.hide` → `grid.show()`, `distance 0→3.5` back.out(1.7) 2 s, `view.zoom.baseRatio 0.6→0.3` power1.inOut 1.25 s, `intro.setText/setSoundButton`, `showLabel` after 1 frame, cherry `leaves.seeThroughMultiplier = 0.5`; waits for click on sphere r 3.5 (hover scales `intensityMultiplier` 1.22) or `introStart` action (Enter/ArrowUp/Down/W/D/Gamepad cross) (`:124-145`); `#skip` hash auto-advances.
  - **Step 1** (`:149-210`): `audio.init()` + reveal sound; `distance → 30` back.in(1.3) 2 s then `99999` (`:156-168`); `intro.hideLabel()`; `inputs.filters` = {wandering}; `view.focusPoint.isTracking = true`, `magnet.active = false`; `zoom.baseRatio → 0` back.in(1.5) 1.75 s → `updateStep(2)`; cherry leaves → 1.
  - **Step 2** (`:211-227`): `interactivePoints.recover()`, `world.step(2)` (Whispers), `grid.destroy()`, `intro.destroy()` + `world.intro = null`, `overlay.moveOnTop()`, `server.start()`, `menu.preopen()`, unhook own tick.

### 10. Text in-world
- **TextCanvas** (`TextCanvas.js`): `(fontFamily, fontWeight, fontSize, width, height, density, horizontalAlign, lineHeight)`; canvas `width*density × height*density` px, font `${weight} ${size*density}px "${family}"` (`:6-26`); `THREE.Texture(canvas)` sRGB, Nearest, `flipY false`, no mipmaps (`:44-52`); `updateText(string | string[])` → `draw()` black fill, white text, `textBaseline middle`, line y = `h/2 + (i - (n-1)/2)*lineHeight` (`:82-112`), `texture.needsUpdate`; `getMeasure()` widest line (`:66-80`). Canvas never appended to DOM (debug `top` stacking commented, `:30-42`).
- Consumption: Blender-authored plane meshes named `text*` under `ref*` groups (`refTitle/inner.003/text…`, `ProjectsArea.js:897-899`) get `MeshDefaultMaterial({hasWater false, alphaNode: texture(tex).r, transparent true})` with outputNode mixing toward `texts.baseColor` by `shadeMix.texts.mixUniform` (`ProjectsArea.js:254-290`). Settings: density 200, `Amatic SC` 700; title `TextCanvas(…, 0.4, 4, 0.6)` (world units 4×0.6), url `0.23, 4, 0.2`, lab minis `0.18, 1.5, 0.2, lineHeight 0.2`. Title swap animates `inner.rotation.x` 0→π power2.in then →2π back.out(2) and updates text mid-flip (`:912-929`). Panel width fitted from `getMeasure().width/density` (`LabArea.js:902-903`).
- Other text: baked Blender textures (`careerText*`, `projectsLabels`, `blackboardLabels` materials in areas.glb); 7-segment digit meshes (Career); Blender `Text.002` mesh (circuit); InteractivePoints per-label canvas (section 8); `document.title` ASCII animation `Title.js:24-90` (🚗 at index 10, 🌳 every 18 chars, offset by `forwardSpeed*deltaScaled`, min 1/60 s). HTML UI font = Pally (`static/fonts/Pally-*.woff2`).

### 11. View (camera follow)
- `View.js`: FOV 25, near 0.1, far 200; three cameras `camera` (final), `defaultCamera`, `freeCamera` (`:394-400`); `CameraHelper` hidden (`:402-405`); `freeMode = CameraControls` smoothTime 0.075 dollySpeed 0.2 (`:413-420`), V key toggles in debug (`:84-97`).
- Focus point (`:116-170`): `trackedPosition` ← `Player.updatePostPhysics` `focusPoint.trackedPosition.copy(this.position)` (`Player.js:608`); `isTracking` re-enabled by any driving action (`View.js:151-155`); `magnet` (active, multiplier 0.25) pulls detached focus back `+= dist*0.25*delta*delta_vec` (`:640-650`); pointer drag / 2-finger / right stick detach tracking and pan (`:584-618, 621-632`); smoothed position lerp `delta*10` (`:656-658`).
- Zoom (`:284-330`): `baseRatio 0.6`, wheel sensitivity 0.05, R3 toggle, speed zoom-out `speedAmplitude -0.4 × smoothstep(focusSpeed, 5, 40)` only when tracking and quality 0 (`:694-702`), `smoothedRatio` lerp `delta*10`.
- Spherical (`:332-356`): phi `π*0.31` (desktop) / `π*0.27` (mobile), theta `π*0.25`, radius 15..30 + `ratioOverflow*9` for narrow aspect (`:704-707`); `position = smoothedFocus + sphericalOffset` (`:710`); `delta` = camera move this frame (`:713`); roll spring (`:720-724`). Cinematic (`:422-460`): `start(pos, target)` lerps/slerps defaultCamera toward dummy by `progress` (gsap 1.5 s), DOF strength → 0; `end` back in 1 s, DOF 1.5. Speed lines: 30 triangles in clip space pulled toward projected car position (`:462-563`, `Player.js:611-616` sets strength when boosting & speed > 15).
- `optimalArea.update()` on `throttleChange` resize (`:579-582`) and when `needsUpdate` (`:754-756`); per-frame `position`/`quad2.offseted` refresh (`:758-766`).

### 12. Audio ↔ objects
- `Audio.register({group, path, autoplay, loop, volume, preload, positions, distanceFade, rate, antiSpam, onPlay, onPlaying})` → Howl `pool 2` (`Audio.js:45-145`); groups get `playRandomNext(...)` (never same id twice, `:56-63`) and `play(...)`; `item.play(...params)` runs `onPlay(item, ...params)` then `howl.play()`, antiSpam default 0.1 s (`:106-140`). Before `init()` (called at Reveal step 1) `play` is a no-op; autoplays start at init (`:26-43`).
- Ties to objects: (a) collision callbacks pass `(force, position)` → `onPlay` copies position into `item.positions[0]`, volume = base × `remapClamp(force, 0, 200, 0, 1)` (hitDefault) or `remapClamp(force, 5, 20, 0, 1)^2` (hitBrick/hitMetal), rate `0.9 + rand*0.2`, `distanceFade 20` (`:547-635`); (b) static emitters read area references: ovenFire positions = `areas.cookie.references.items.get('spawner')[0].position` + `areas.projects…get('oven')[0].position`, campfire = `areas.lab…get('fire')[0].position`, both `distanceFade 13`, loop autoplay (`:469-509`); (c) ambient one-shots placed at `focusPoint ± 30` random corners (`:259-266`), birds only by day every 0.5–5.5 s at 50 %, owl at night every 30–90 s, rooster on night→day, wolf on deepNight, crickets/rain/wind/waves/jingleBells volume from weather/terrain edge via `onPlaying` (`:268-467`).
- `update` tick 14 (`:713-768`): per item `onPlaying`; positional: closest of `positions` to `view.focusPoint.position`, transformed by `camera.matrixWorldInverse`, normalised, `z *= 0.1`, `howl.pos(x,y,z)`; `distanceFadeMultiplier = remapClamp(dist, 0, distanceFade, 1, 0)`; `howl.rate(clamp(rate × time.scale/defaultScale, 0.5, 4))`; `howl.volume(volume × fade)`; `howl.mute(volume < 0.01)`. Playlist of 3 mp3 chosen by `floor(now/3min) % 3`, `VITE_MUSIC` gate (`:147-255`). Mute persisted in `localStorage.soundToggle`, key L, window blur/focus (`:638-711`).

### 13. Dispose / lifecycle
- Only explicit teardown in the game: `Intro.destroy()` (`Intro.js:316-343`) and `Grid.destroy()` (`Grid.js:96-101`), both at Reveal step 2. Nothing else is ever disposed: areas, props, bodies, instanced meshes live for the session. `Objects.disable/enable` (`Objects.js:280-302`) and body `setEnabled` are the only "unload" primitives (cookies, vehicle during area open via `physicalVehicle.deactivate()`).
- Reset paths: `Objects.resetObject` (disable → set transform with `wakeUp=false` → re-enable next frame → sleep → `needsUpdate` a frame later, `:227-270`), `Game.reset()` (`Game.js:218-274`), area-specific `restart()/reset()`.
- Per-frame gates instead of unloading: area `frustum.isIn` → `visible` + `update()`; `Objects.update` sleeps far bodies; InteractivePoints only tests on ≥0.2 m moves; Map only when modal open.
- Lazy loads after boot: intro label KTX (`Intro.js:151-169`), project/lab screenshots KTX2 (prior doc), map webp, Howl `preload:false` playlist, `load()` on first play when `preload false` (`Audio.js:114-118`).

### 14. Debug / tweakpane pattern
- `Debug` (`Debug.js`): `active = location.hash.match(/debug/i)` (`:11`); `Pane` + `@tweakpane/plugin-essentials` + `@tweakpane/plugin-camerakit` (`:15-17`); key H toggles `panel.hidden` (`:19-23`). Helpers: `addManualBinding(panel, obj, prop, settings, updateFn)` returns `{manual, manualValue, update()}` with manual/auto buttons (`:27-63`, used by ProjectsArea oven threshold `:1236-1243`); `addThreeColorBinding(panel, color, label)` binds `color.getHex(SRGBColorSpace)` → `color.set` (`:65-69`); `addButtons(panel, {name: fn}, title)` = `buttongrid` blade (`:71-90`).
- Convention in every class: `if(this.game.debug.active) { this.debugPanel = this.game.debug.panel.addFolder({ title: '<emoji> Name', expanded: false }) }` then `addBinding(uniform, 'value', {label, min, max, step})` directly on TSL uniforms (e.g. `Reveal.js:30-41`, `Scenery.js:101-112`, `View.js:36-55, 335-347, 362-390`, `InteractivePoints.js:565-572`, `Zones.js:23-30`, `PoleLights.js:12-18`, `CareerArea.js:14-21,141-148`, `LabArea.js:1229-1263`); debug-only buttons `open/close` on areas (`ProjectsArea.js:60-64`); debug speeds intro ×4 (`Intro.js:88,262,282`); debug-only input actions (`View.js:84-97`).

### 15. Performance monitoring
- `Monitoring` (`Monitoring.js:1-38`): `stats-gl` `Stats({trackGPU true, trackHz true, trackCPT true, logsPerSecond 4, graphsPerSecond 30, samplesLog 40, samplesGraph 10, precision 1, horizontal false, minimal false, mode 0})`, `stats.init(renderer)`, appended to body; per-tick `resolveTimestampsAsync()+update()` at order 999 commented out (`:31-36`). The import and `new Monitoring()` are commented in `Game.js:15,198` → disabled in shipped build. Readme lists phase 999 Monitoring.
- Other runtime perf levers: `Quality.level`, `PreRenderer.render()` shader warm-up (`Game.js:203-204`), `PhysicsWireframe` debug lines, `Areas.js:51-82` commented visible-area counter, `View.focusPoint.helper`/`cameraHelper` toggles.

### Gaps / flags
- `References` regex on names with Blender `.NNN` suffixes: `[^0-9]+` consumes the dot so `refLine.001` keys as `line.`; CareerArea `items.get('line')` returns 6 lines in practice, implying the exporter/compress script strips suffixes or the GLB names seen (`refLine`, `refLine.001`) are post-Draco names — not verified at runtime.


## Transferable
- Blender-as-level-editor: one GLB root node per area; `Areas` maps root name prefix → JS class; `ref*` empties carry positions/radii/userData (size, color, texture, mass, hasEnd, preventAutoAdd, preventFrustum). Obstacle: needs a disciplined naming/export pipeline (readme: mute palette node, no compression, `npm run compress`).
- `References.parse` regex `^ref(?:erence)?([^0-9]+)([0-9]+)?$` + `Map<name, Object3D[]>` with `getStartingWith` — a 50-line class that replaces hand-wired scene lookups. Obstacle: Blender `.NNN` suffixes alter keys; strip them on export.
- Per-area bounding cylinder (enter/leave events for state/audio/achievements) + frustum circle vs camera ground-quad (`circleIntersectsPolygon`) that gates `visible` and `update()`; two authored empties per area, no code.
- InstancedGroup: clone instance[0] as base, one `Object3D` reference per placement, per-mesh `InstancedMesh` with `localMatrix.premultiply(reference.matrixWorld)` updated only for dirty references; the reference Object3D (never in scene) is what the physics sync writes to. Prop classes are 60-line copies of one template.
- Reveal = material-level discard ring: every `MeshDefaultMaterial` discards `|xz - center| > distance` and tints a `thickness`-wide edge; intro ring/grid/zoom/label are gsap on three uniforms in three steps (0→3.5 back.out 2 s; →30 back.in 2 s then 99999). Obstacle: requires a shared base material (TSL) so one node builder applies everywhere.
- Load pattern: tiny batch 1 (respawns GLB + 3 textures) so camera/intro exist, then batch 2 + `import('rapier')` in `Promise.all`, construct every world system in one `World.step(1)`, warm shaders with a pre-render pass, then start reveal 3 frames later.
- TextCanvas: Canvas2D → `THREE.Texture` (sRGB, Nearest, flipY false) used as `alphaNode` red channel on Blender-authored `text*` quads; size from `measureText/density`; density 200 px per world unit; font Amatic SC 700. Interactive labels measure text to size the canvas and the quad (`scale.x = 0.75*w/h`).
- InteractivePoints: pooled geometries, SDF diamond + sliding label driven by 4 uniforms via gsap, nearest-within-2.5 m test only when player moves >0.2 m, `temporaryHide/recover` for cinematic modes, keyIcon texture swap per input mode.
- Audio registry: named groups with `playRandomNext`, `onPlay(item, force, position)` lets collision callbacks set emitter position/volume/rate; static emitters placed from area `ref*` positions with `distanceFade`; per-tick Howler `pos` from camera-relative normalised vector with z×0.1 and global rate = time scale. Obstacle: Howler dependency; must gate `init()` behind a user gesture.
- Debug convention: `location.hash` `#debug` → tweakpane root; every system adds a collapsed emoji folder and binds TSL uniforms' `.value` directly; `addManualBinding` manual/auto override; `addThreeColorBinding` sRGB colour; debug-only ×4 intro speed and `#skip`.
- Monitoring: stats-gl with `trackGPU/trackHz/trackCPT`, `init(renderer)` — present but disabled in shipping code; cheap to enable behind `#debug`.
- Lifecycle: nothing is disposed except intro+grid; the engine relies on sleep/enable/visible gates and reset-to-initial-state instead of unload. Explosions apply impulses one frame later via `ticker.wait(1)` to avoid mid-step writes.
- Dead code to not copy: `playgroundVisual/Physical` GLBs are loaded (Game.js:137-138) and never used; `World.setPhysicalFloor` unused.

## Gaps
- How Blender `.NNN` name suffixes survive `scripts/compress.js` / GLTF export — the `References` regex treats the dot as part of the key, yet code calls `items.get('line')`, `get('letters')`; did not run the game to confirm resolved keys.
- Exact mapping of `playground*.glb` intent (loaded, unreferenced) — likely leftover from a sandbox scene.
- Did not read Whispers.js (step 2), Overlay, Server, Menu internals, nor the 10 other area classes beyond grep-level structure (Bowling/Cookie/Social instancing snippets only).
- Line numbers for Area.js, World.js, Scenery.js, Intro.js, Reveal.js, Zones.js, Respawns.js, InteractivePoints.js, Events.js, Explosions.js, Bricks/Fences/Lanterns/PoleLights, InstancedGroup.js, Objects.js, TextCanvas.js, View.js, Monitoring.js, Debug.js were derived by offset from concatenated `cat -n` output; ±1 possible at file boundaries.
- Runtime counts (bodies, instanced meshes, draw calls) not measured; Monitoring is disabled in the shipped source.


---

# 4. The Quaternius packs in tilakverse-assets: inventory

Repo: `tilakverse-assets` (git, remote `https://github.com/tilakpatell/tilakverse-assets`, HEAD `8506439`). Tool used: `gltf-inspect.mjs` (plain fs + JSON; GLB JSON chunk parsed from the 12-byte header) and `gltf-table.mjs` (per-directory TSV; per-pack TSVs saved beside this report as `*-table.tsv`). Triangle counts = index count / 3 per TRIANGLES primitive; vertex counts = POSITION accessor count (post-split, i.e. render vertices).

## 0. Repo-wide facts

- **No git LFS.** No `.gitattributes` anywhere in the repo (`find . -name .gitattributes` outside `.git` returns nothing); `git lfs ls-files` returns nothing; `grep -rl '^version https://git-lfs'` across the working tree finds **zero pointer files**. Every file is real content.
- Working tree `du -sh .` = **2.4G** (README says "about 2.2 GB"). `.git` pack = 692.58 MiB in 2 packs, 2893 objects; `git status` clean.
- Per-pack `du -sh`:
  | pack | size |
  |---|---|
  | `quaternius/stylized-nature-pack` | 449M |
  | `quaternius/stylized-nature-megakit` | 370M |
  | `quaternius/universal-animation-library-2` | 246M |
  | `quaternius/downtown-city-megakit` | 244M |
  | `quaternius/universal-animation-library` | 207M |
  | `quaternius/ultimate-space-kit` | 143M |
  | `quaternius/farm-animals` | 16M |
  | `quaternius/street-pack` | 16M |
  | `quaternius/furniture-pack` | 13M |
  | `sketchfab/star-wars` | 8.0K (README only; GLBs are on a GitHub release) |
- Top-level `README.md` (3886 B): all `quaternius/*` packs are CC0 1.0; packs kept "exactly as downloaded" (Blender, FBX, OBJ, glTF/GLB, textures, engine exports). Nature MegaKit's Unreal/Unity/Godot projects (204/207/89 MB zips) are on the `engine-projects` GitHub release, not in git. Site repo fetches a pack zip with `node scripts/assets-fetch.mjs <pack>` from the site repo's `assets-quaternius` release into `lab/assets/`. UAL clips are baked onto the Meshy skeleton by `scripts/ual-bake.mjs` in the site repo.
- `sketchfab/star-wars/README.md`: 6 GLBs (not CC0; CC BY 4.0 or CC BY-NC-SA 4.0) live on the `sketchfab-star-wars` release split in 8 MB parts + `SHA256SUMS`. Table as written there: `b1-battle-droid.glb` (leoxx300, CC BY 4.0, rigged 53 joints, no clips, 20k tris, 33 MB); `at-at-walker.glb` (Quiznos323, CC BY-NC-SA 4.0, 72 joints, clips Walk / Walk and shoot / Trip and fall, 74k tris, 69 MB, 4K maps); `at-at-walker-1k.glb` (same, 1K maps, 16 MB); `tie-fighter.glb` (Mickael Boitte, CC BY 4.0, unrigged, 20k tris, 7 MB); `venator-clone-wars.glb` (ShineyFX, CC BY 4.0, 294k tris, 47 MB); `venator.glb` (ForkyForklift, CC BY 4.0, 402k tris, 74 MB). Heataker's Imperial Star Destroyer deliberately excluded (Sketchfab Standard licence, no re-hosting). Site credits in `src/data/modelCredits.json`; `scripts/sketchfab-import.mjs` shrinks before `public/models/`. Nothing else is in that folder.

## 1. `quaternius/stylized-nature-megakit` (370M)

Layout: `Blends/` (213M: 117 .blend incl. `All models.blend` 30.6 MB, + `Blends/textures/` with the master PNGs), `FBX/` (20M, 116 .fbx), `FBX (Unity)/` (20M, 116 .fbx), `OBJ/` (33M, 116 .obj + 116 .mtl), `glTF/` (84M), `License_Source.txt` (CC0 1.0; "SOURCE version"; Godot 4.2.2 / Unity URP 2022.3.3 / UE 4.27.2), 4 preview JPGs. The `glTF/` dir also has a stray `desktop.ini`.

**glTF format:** `.gltf` + sidecar `.bin` + external PNGs (not GLB). **116 `.gltf` + 116 `.bin`** (25 MB together) + **36 PNG** (58 MB) + one extra **`Birch_4GLB.glb`** (0.47 MB, 480K on disk) which is Birch_4 with the geometry embedded but **zero images** (materials keep their names but have no baseColorTexture). Generator: `Khronos glTF Blender I/O v4.0.44`. One node, one mesh per file; no extensions used; node name = model name (e.g. `GiantPine_1`), mesh names are Blender leftovers (`tree.001`, `Plane.013`, `Cube.005_Retopology.001`).

**Model names by kind (116):**
- Trees (45): `Birch_1..5`, `CherryBlossom_1..5`, `CommonTree_1..5`, `DeadTree_1..5`, `GiantPine_1..5`, `Pine_1..5`, `TallThick_1..5`, `TwistedTree_1..5` (+ `Birch_4GLB.glb`).
- Bushes (6): `Bush_Common`, `Bush_Common_Flowers`, `Bush_Large`, `Bush_Large_Flowers`, `Bush_Long_1`, `Bush_Long_2`.
- Grass (7): `Grass_Common_Short`, `Grass_Common_Tall`, `Grass_Wheat`, `Grass_Wide_Short`, `Grass_Wide_Tall`, `Grass_Wispy_Short`, `Grass_Wispy_Tall`.
- Flowers (12): `Flower_1_Group`, `Flower_1_Single`, `Flower_2_Group`, `Flower_2_Single`, `Flower_3_Group`, `Flower_3_Single`, `Flower_4_Group`, `Flower_4_Single`, `Flower_6`, `Flower_6_2`, `Flower_7_Group`, `Flower_7_Single` (no Flower_5).
- Petals (6): `Petal_1..6` (13–71 tris each).
- Plants/ferns/clover (14): `Fern_1`, `Fern_2`, `Clover_1`, `Clover_2`, `Plant_1`, `Plant_1_Big`, `Plant_2`, `Plant_2_Big`, `Plant_3..7`, `Plant_7_Big`.
- Mushrooms (4): `Mushroom_Common`, `Mushroom_Laetiporus`, `Mushroom_Oyster`, `Mushroom_RedCap`.
- Rocks (6): `Rock_Big_1`, `Rock_Big_2`, `Rock_Medium_1..4`.
- Rock paths (10): `RockPath_Round_Small_1..3`, `RockPath_Round_Thin`, `RockPath_Round_Wide`, `RockPath_Square_Small_1..3`, `RockPath_Square_Thin`, `RockPath_Square_Wide`.
- Pebbles (11): `Pebble_Round_1..5`, `Pebble_Square_1..6`.

**Representative counts (verts / tris):**
| model | verts | tris | primitives |
|---|---|---|---|
| `GiantPine_1` | 12,138 | 7,482 | bark 7,837v/5,890t + leaves 4,301v/1,592t |
| `Birch_1` | 10,669 | 6,378 | bark 7,597v/4,842t + leaves 3,072v/1,536t |
| `CherryBlossom_1` | 19,073 | 12,876 | bark 11,878v/9,280t + leaves 7,195v/3,596t |
| `Grass_Common_Tall` | 303 | 326 | 1 |
| `Rock_Medium_1` | 351 | 342 | 1 |
| `RockPath_Round_Wide` | 7,084 | 3,500 | 1 |
Ranges: trees 2,315v/1,646t (`Pine_5`) to 22,590v/14,739t (`CherryBlossom_3`); CherryBlossoms 12.4–14.7k tris, TwistedTrees 9.1–10.1k, TallThick 7.1–8.0k, GiantPines 6.8–7.5k, Birches 5.1–6.6k, DeadTrees 5.6–6.6k, CommonTrees 3.2–6.3k, Pines 1.6–5.0k. Grass 155–1,190 tris; rocks 244–1,944; rock paths 559–3,500; pebbles 48–136; mushrooms 704–3,216; bushes 522–5,393 (`Bush_Long_2` is the outlier at 5,393). Full per-model table: `reads/megakit-table.tsv`.

**Materials / textures — NOT one palette; per-kind textures, no vertex-colour palette:**
- Every tree with foliage = **1 mesh, 2 primitives**: primitive 0 = bark material, primitive 1 = leaves material (trunk and crown are separate primitives of the same mesh, same node, not separate meshes/nodes). DeadTrees = 1 primitive (bark only). Bushes = 1 primitive (a leaf material), `*_Flowers` bushes = 2 (leaves + `Flowers`). Flower groups/singles = 2 primitives (`Leaves` + `Flowers`). Everything else = 1 primitive.
- Bark materials (one per tree family, all have baseColor 2048² + normal 2048², `metallicFactor:0`, no roughness factor, doubleSided): `Bark_Birch` (Birch), `Bark_Pine` (GiantPine, TallThick), `Bark_NormalTree` (CommonTree, CherryBlossom, Pine — alphaMode MASK 0.2), `Bark_DeadTree`, `Bark_TwistedTree`. Others are OPAQUE.
- Leaf materials (baseColor only, 1024² except `Leaf_Pine_C` 2048², alphaMode MASK cutoff 0.2, doubleSided): `Leaves_Birch`, `Leaves_GiantPine`, `Leaves_NormalTree`, `Leaves_Pine`, `Leaves_TallThick`, `Leaves_TwistedTree`; **`Leaves_CherryBlossom` is alphaMode BLEND** (no cutoff). Bushes reuse tree leaf materials (`Bush_Common`→`Leaves_TwistedTree`, `Bush_Large`→`Leaves_GiantPine`, `Bush_Long_*`/`Bush_Common_Flowers`→`Leaves_NormalTree`).
- Ground-cover materials: `Leaves` (`Leaves.png` 2048² RGBA, MASK; ferns, clovers, plants, flower leaves), `Flowers` (`Flowers.png` 1008×981 RGBA, MASK), `Grass` (`Grass.png` 512² RGBA, OPAQUE), `Mushrooms` (`Mushrooms.png` 1024² RGB), `Rocks` (`Rocks_Diffuse.png` 2048² RGB), `PathRocks` (`PathRocks_Diffuse.png` 1024² RGB; shared by RockPath_* and Pebble_*).
- Images referenced by the 116 gltf (count of files referencing): Leaves.png 26, PathRocks_Diffuse 21, Flowers 20, Bark_NormalTree(+Normal) 15, Bark_PineTree(+Normal) 10, Leaves_NormalTree_C 8, Leaves_GiantPine_C 7, Grass 7, Rocks_Diffuse 6, Leaves_TwistedTree_C 6, Leaves_TallThick_C/CherryBlossom_C/Birch_C/Leaf_Pine_C 5 each, Bark_TwistedTree/DeadTree/BirchTree (+Normal) 5 each, Mushrooms 4. **13 PNGs in `glTF/` are referenced by no gltf**: the non-`_C` leaf maps (`Leaf_Pine.png`, `Leaves_Birch.png`, `Leaves_CherryBlossom.png`, `Leaves_GiantPine.png`, `Leaves_NormalTree.png`, `Leaves_TallThick.png`, `Leaves_TwistedTree.png`, `Leaves_Square.png`), `Noise_Perlin.png` 512², `Noise_Wind.png` 1024² RGB, `Normal_Default.png` 128², `PathRocks_Desert_Diffuse.png` 1024², `Rocks_Desert_Diffuse.png` 2048² (desert recolour variants exist as textures only; no gltf uses them).
- Texture sizes: bark PNGs 1.8–6.4 MB each (2048² RGBA, 10 files = ~47 MB of the 58 MB); leaf `_C` maps 59–159 KB; `Leaves.png` 2.5 MB; `Rocks_Diffuse` 2.4 MB; `Mushrooms` 1.2 MB. Sampler: mag LINEAR, min LINEAR_MIPMAP_LINEAR.
- **Vertex colours:** `COLOR_0` (VEC4 float) is present on all trees, bushes, grass, ferns, clovers, plants; absent on rocks, rock paths, pebbles, mushrooms, flower groups, petals. It is **not a colour palette**: values are greyscale (R≈G≈B, A=1), e.g. GiantPine_1 bark has 207 distinct values ranging 0.137→1.0 (dark at the base, white up the trunk), leaves 7 distinct values 0.962→1.0 — a wind/sway weight mask used by the pack's engine shaders (`Noise_Wind.png` goes with it). Rendering it as colour would darken trunk bases.
- `Blends/textures/` holds the same master PNGs (Bark_* same byte sizes as `glTF/`).

## 2. `quaternius/stylized-nature-pack` (449M)

Layout: `AllModels.blend` (36.7 MB), `Blends/` (103M, 63 .blend), `FBX/` (5.9M, 63 .fbx), `OBJ/` (13M, 63 .obj + 63 .mtl), `Textures/` (193M, 21 PNG), `glTF/` (99M), `License.txt` (CC0 1.0 — note the file's header reads "Ultimate Platformer Pack by @Quaternius", a copy-paste), `Preview.jpg` (1.9 MB).

**glTF format:** `.gltf` + `.bin` + external textures (no GLB). **Only 36 `.gltf` + 36 `.bin`** (3.3 MB together) + 21 textures (96 MB: 14 PNG + 7 JPG). Generator `Khronos glTF Blender I/O v4.0.44`, no extensions, one node + one mesh per file, node named after the model. Attributes POSITION|NORMAL|TEXCOORD_0 only (**no COLOR_0**; `BirchTree_3` additionally has TEXCOORD_1 on both primitives).

**The glTF folder is an incomplete export.** 27 of the 63 models exist only as FBX/OBJ/Blend: `NormalTree_1..5`, `PalmTree_1..5`, `PineTree_1..5`, `Petals_1..4`, `Plant_1`, `Plant_2`, `Plant_Flowers`, `Rock_1..5`. Their textures are nevertheless shipped in `glTF/` unreferenced: `NormalTree_Leaves.png`, `PalmTree_Leaves.png`, `PalmTree_Trunk.jpg`, `PalmTree_Trunk_Normal.png`, `PineTree_Bark.jpg`, `PineTree_Bark_Normal.png`, `PineTree_Leaves.png`, `Rocks.jpg`, plus `Leaves_BW.png` and `MapleTree_Leaves_BW.png` (black-and-white leaf variants, referenced by nothing).

**Models present as glTF (36), by kind:**
- Trees (20): `BirchTree_1..5`, `MapleTree_1..5`, `DeadTree_1..10`.
- Bushes (6): `Bush`, `Bush_Flowers`, `Bush_Large`, `Bush_Large_Flowers`, `Bush_Small`, `Bush_Small_Flowers`.
- Grass (3): `Grass_Large`, `Grass_Large_Extruded`, `Grass_Small`.
- Flowers (7): `Flower_1`, `Flower_1_Clump`, `Flower_2`, `Flower_2_Clump`, `Flower_3_Clump`, `Flower_4_Clump`, `Flower_5_Clump`.
- Rocks / paths / mushrooms / pebbles: **none in glTF** (rocks exist as FBX/OBJ/Blend `Rock_1..5` only; no paths, mushrooms or pebbles in this pack at all).

**Counts (verts / tris):** BirchTree_1 5,450/4,596 (bark 2 prims: see below); BirchTree_2 7,735/7,660; BirchTree_3 9,922/6,818; BirchTree_4 3,702/3,562; BirchTree_5 4,800/4,520. MapleTree_1 3,543/3,848; _2 4,714/4,800; _3 6,467/6,678; _4 1,375/1,256; _5 4,544/4,504. DeadTree_1..10: 511–3,246 verts / 824–5,344 tris. Bushes 190–478 tris. Grass_Small 80v/58t, Grass_Large 150v/108t, Grass_Large_Extruded 732v/516t. Flowers 34–620 tris (`Flower_2..5_Clump` are all identical 92v/136t). Full table: `reads/naturepack-table.tsv`.

**Materials / textures:** per-species maps, no palette, no vertex colours. Birch and Maple trees = 1 mesh with 2 primitives (prim 0 bark, prim 1 leaves: a separate primitive, not a separate mesh/node). DeadTrees = 1 primitive, bark only (`DeadTree_1..5` use `NormalTree_Bark`, `DeadTree_6..10` use `MapleTree_Bark`). All materials `metallicFactor 0`, `roughnessFactor 0.5`, doubleSided.
- `BirchTree_Bark`: `BirchTree_Bark.jpg` 2048² RGB (1.0 MB) + `BirchTree_Bark_Normal.png` 2048² RGBA (22.7 MB), OPAQUE.
- `MapleTree_Bark`: `MapleTree_Bark.jpg` 2048² (0.8 MB) + `MapleTree_Bark_Normal.png` 2048² (22.1 MB), OPAQUE.
- `NormalTree_Bark`: `NormalTree_Bark.jpg` 2048² (0.6 MB) + `NormalTree_Bark_Normal.png` 2048² (19.1 MB), OPAQUE.
- `BirchTree_Leaves`: `BirchTree_Leaves.png` 1024² RGBA 78 KB, **alphaMode BLEND** (no cutoff). `MapleTree_Leaves`: `MapleTree_Leaves.png` 1024² 212 KB, BLEND. `Bush_Leaves`: `Bush_Leaves.png` 1024² 75 KB, BLEND. `Flowers`: `Flowers.png` 1024² 318 KB, BLEND. `Grass`: `Grass.png` 1024² RGB 735 KB, OPAQUE.
- All leaf/flower/bush materials are BLEND (not MASK) — alpha-sorting rather than cutout as exported.
- The bark normal PNGs are enormous (8.9–22.7 MB each, uncompressed-looking RGBA 2048²); `Textures/` has the same normals plus PNG versions of the bark colour maps (`BirchTree_Bark.png` 23.1 MB etc.), which is why `Textures/` is 193M and the pack 449M.

## 3. `quaternius/ultimate-space-kit` (143M)

Layout: `Atlas.png` (512×512 RGB, 5,276 B — a flat colour palette), `License.txt` (CC0; header again says "Ultimate Platformer Pack"), `Preview.jpg`, and four groups each with `Blends/`, `FBX/`, `GLTF/`, `OBJ/`: `Characters` (27M/27M/12M/4.8M), `Environment` (40M/4.5M/4.9M/7.0M), `Items` (3.9M/248K/348K/416K), `Vehicles` (6.4M/1.1M/2.2M/2.7M). Each `Blends/` also has a copy of `Atlas.png`. 92 models in each of the four formats (92 .gltf / .fbx / .obj+.mtl / .blend).

**glTF format:** single `.gltf` files with the buffer **embedded as a base64 `data:` URI** and the atlas PNG embedded via bufferView (no `.bin`, no external PNG; "glTF Embedded"). Generator `Khronos glTF Blender I/O v1.7.33` (Blender 2.8x era). Every material = `Atlas` (`metallicFactor 0`, `roughnessFactor 0.5`, doubleSided, OPAQUE, baseColor texture only); two outliers: `Enemy_Flying` material is named `Glub_Main`, `Rover_2` material is `Atlas.001`. **One shared palette atlas, but downsampled per file:** the embedded atlas is 32×32 (626 B RGBA) in 66/66 Environment, 7/7 Items, 4/7 Vehicles and 6/12 Characters; 32×32 RGB 3,396–3,427 B in the 3 Rovers and `Mech_FinnTheFrog`; 32×32 RGBA 612 B in the other 3 Mechs; only the 4 Astronauts and `Enemy_Large` carry a 512×512 RGBA (3,128 B) atlas. The root `Atlas.png` is the 512² master. No normal/ORM maps, no vertex colours except `Mech_FinnTheFrog` (has COLOR_0 + TEXCOORD_1); `Astronaut_RaeTheRedPanda` and all 4 Spaceships have TEXCOORD_1.

**Characters/GLTF (12 files, 12M):**
| file | MB | verts | tris | skin / joints | clips |
|---|---|---|---|---|---|
| `Astronaut_BarbaraTheBee` | 1.69 | 8,446 | 8,562 | CharacterArmature / 43 | 18 |
| `Astronaut_FernandoTheFlamingo` | 1.63 | 7,543 | 7,938 | CharacterArmature / 43 | 18 |
| `Astronaut_FinnTheFrog` | 1.67 | 8,045 | 8,606 | CharacterArmature / 43 | 18 |
| `Astronaut_RaeTheRedPanda` | 1.70 | 7,730 | 8,032 | CharacterArmature / 43 | 18 |
| `Enemy_ExtraSmall` | 0.16 | 1,128 | 1,572 | CharacterArmature / 5 | 8 |
| `Enemy_Flying` | 0.27 | 2,847 | 3,820 | CharacterArmature / 4 | 8 |
| `Enemy_Large` | 1.16 | 3,485 | 4,724 | CharacterArmature / 43 (same humanoid rig) | 14 |
| `Enemy_Small` | 0.18 | 1,435 | 1,856 | CharacterArmature / 5 | 8 |
| `Mech_BarbaraTheBee` | 0.84 | 5,841 | 6,756 | RobotArmature / 13 | 17 |
| `Mech_FernandoTheFlamingo` | 0.75 | 4,811 | 4,086 | RobotArmature / 13 | 17 |
| `Mech_FinnTheFrog` | 0.99 | 6,267 | 5,846 | RobotArmature / 13 | 17 |
| `Mech_RaeTheRedPanda` | 0.74 | 4,684 | 4,008 | RobotArmature / 13 | 17 |
- Astronauts have 2 meshes on 2 nodes: the body (node named after the character, e.g. `FinnTheFrog`) and a separate `Pistol` mesh node, both skinned (JOINTS_0/WEIGHTS_0). 46 nodes total.
- **Astronaut / Enemy_Large skeleton (43 joints, `CharacterArmature`)**: `Root, Foot.L, Body, Hips, Abdomen, Torso, Neck, Head, Shoulder.L, UpperArm.L, LowerArm.L, Pinky1.L, Pinky2.L, Pinky3.L, Middle1.L, Middle2.L, Middle3.L, Index1.L, Index2.L, Index3.L, Thumb1.L, Thumb2.L, Shoulder.R, UpperArm.R, LowerArm.R, Pinky1.R, Pinky2.R, Pinky3.R, Middle1.R, Middle2.R, Middle3.R, Index1.R, Index2.R, Index3.R, Thumb1.R, Thumb2.R, UpperLeg.L, LowerLeg.L, UpperLeg.R, LowerLeg.R, PoleTarget.L, Foot.R, PoleTarget.R` (no Hand bones; fingers hang off LowerArm; IK pole targets exported as joints). This is Quaternius's own rig, **not** the UAL/UE `root/pelvis/spine_01` naming.
- **Astronaut clips (18)** name → duration: Death 0.767, Duck 1.667, HitReact 0.6, Idle 1.0, Idle_Gun 1.0, Jump 0.367, Jump_Idle 0.5, Jump_Land 0.367, No 1.667, Punch 0.867, Run 0.567, Run_Gun 0.567, Run_Gun_Shoot 0.567, Walk 1.0, Walk_Gun 1.0, Wave 1.667, Weapon 0.867, Yes 1.667 s. Identical across all four astronauts. `Enemy_Large` has the same minus Idle_Gun, Run_Gun, Run_Gun_Shoot, Walk_Gun (14).
- **Mech skeleton (13 joints, `RobotArmature`)**: `Body, Torso, Chest, Neck, Head, UpperLeg.L, LowerLeg.L, UpperLeg.R, LowerLeg.R, PoleTarget.L, PoleTarget.R, Foot.L, Foot.R` (no arms). **Mech clips (17)**: Dance 0.8, Death 0.567, Hello 1.5, HitRecieve_1 0.533 (sic), HitRecieve_2 0.667, Idle 3.333, Jump 0.867, Jump_Landing 0.867, Jump_NoHeight 0.6, Kick 0.833, No 1.4, Pickup 1.4, Run 0.833, Shoot_Big 0.4, Shoot_Small 0.233, Walk 0.833, Yes 1.4 s.
- **Small enemies**: `Enemy_Small`/`Enemy_ExtraSmall` joints `Root, Torso, Neck, Head, Body1`; `Enemy_Flying` joints `Root, Torso, Neck, Head`. Clips (8, all three): Death 0.667, Fast_Flying 0.833, Flying_Idle 1.167, Headbutt 1.167, HitReact 0.467, No 1.167, Punch 1.167, Yes 1.167 s.

**Environment/GLTF (66 files, 4.9M)** — all static, 1 node + 1 mesh + 1 primitive, `Atlas` material, 32×32 embedded atlas:
- Planets (11): `Planet_1` 2,850v/2,672t; `_2` 2,945/2,720; `_3` 2,440/2,400; `_4` 2,461/2,622; `_5` 1,116/1,320; `_6` 1,307/1,598; `_7` 1,708/2,010; `_8` 983/1,070; `_9` 1,456/1,864; `_10` 2,057/2,586; `_11` 2,059/2,178. Mesh names are Blender icospheres (`Icosphere.001`); textured only by the flat-colour atlas (UV'd to palette cells), no planet maps.
- Base/buildings (13): `Base_Large` 2,790t, `Building_L` 2,940t, `Connector` 508t, `GeodesicDome` 1,432t, `House_Cylinder` 1,166t, `House_Long` 2,228t, `House_Open` 1,156t, `House_OpenBack` 1,180t, `House_Single` 1,080t, `House_Single_Support` 464t, `MetalSupport` 540t, `Ramp` 192t, `Stairs` 256t.
- Roof add-ons (5): `Roof_Antenna` 492t, `Roof_Opening` 350t, `Roof_Radar` 972t, `Roof_VentL` 140t, `Roof_VentR` 140t. Solar (3): `SolarPanel_Ground` 372t, `SolarPanel_Roof` 812t, `SolarPanel_Structure` 1,432t.
- Alien trees (17): `Tree_Blob_1..3` (6,112 / 5,776 / 1,892t), `Tree_Floating_1..3` (2,440 / 4,048 / 4,080t), `Tree_Lava_1..3` (1,282 / 1,174 / 1,088t), `Tree_Light_1..2` (2,280 / 1,080t), `Tree_Spikes_1..2` (2,548 / 1,698t), `Tree_Spiral_1..3` (748 / 1,490 / 1,280t), `Tree_Swirl_1..2` (2,010 / 1,112t).
- Bushes/grass/plants (9): `Bush_1..3` (2,304 / 1,504 / 640t), `Grass_1..3` (246 / 96 / 408t), `Plant_1..3` (540 / 196 / 1,608t). Rocks (7): `Rock_1..4` (224 / 210 / 224 / 456t), `Rock_Large_1..3` (222 / 432 / 448t).

**Vehicles/GLTF (7 files, 2.2M):** `Rover_1` 8,612v/7,346t (5 meshes/nodes: 4 wheels + body), `Rover_2` 9,322v/8,032t (7 nodes: `Wheel_1..6` + `Rover_2`), `Rover_Round` 7,976v/7,052t (5 nodes); `Spaceship_BarbaraTheBee` 5,507v/6,208t, `Spaceship_FernandoTheFlamingo` 3,636v/2,814t, `Spaceship_FinnTheFrog` 4,016v/3,376t, `Spaceship_RaeTheRedPanda` 2,360v/1,614t (single mesh each). Wheels are separate nodes (animatable); no animations exported.

**Items/GLTF (7 files, 348K):** `Pickup_Bullets` 653v/624t, `Pickup_Crate` 1,906v/1,348t, `Pickup_Health` 1,144v/684t, `Pickup_Jar` 381v/308t, `Pickup_KeyCard` 329v/256t, `Pickup_Sphere` 1,743v/1,824t, `Pickup_Thunder` 231v/228t.

Per-file tables: `reads/spacekit-{Characters,Environment,Items,Vehicles}-table.tsv`.

## 4. `quaternius/farm-animals` (16M)

**No glTF/GLB at all.** Formats: `Blends/` (7 .blend, 859 KB–981 KB each), `FBX/` (7 binary FBX, version 7400: Cow 1.04 MB, Horse 1.02 MB, Zebra 1.04 MB, Llama/Pig/Pug/Sheep 357–361 KB), `OBJ/` (7 .obj + .mtl, static, 26–63 KB), `License.txt` (CC0, "Farm Animals Pack by Quaternius"), `Preview.gif` (4.8 MB). Animals: **Cow, Horse, Llama, Pig, Pug, Sheep, Zebra**.
- OBJ geometry (v / f, quads+tris as exported): Cow 400/424, Horse 347/375, Llama 332/352, Pig 283/298, Pug 324/320, Sheep 307/326, Zebra 679/712. Materials are flat `Kd` colours in the `.mtl` (e.g. Cow: `Black`, `Pink`, `White`), no textures.
- FBX `AnimStack` names (scanned for `\0\x01AnimStack` records; Blender `Armature|` prefix): **Cow, Horse, Zebra: `Armature|Death`, `Armature|Idle`, `Armature|Jump`, `Armature|Run`, `Armature|Walk`, `Armature|WalkSlow` (6 clips)**; **Llama, Pig, Pug, Sheep: `Armature|Idle`, `Armature|Jump` (2 clips)**. Durations not readable without an FBX parser. (`strings | grep AnimStack` alone only shows the `AnimStack` type token because FBX binary separates name and class with `\0\x01`.)

## 5. `quaternius/universal-animation-library` (207M) and `-2` (246M)

UAL1 files: `Unreal-Godot/UAL1.glb` 21,378,992 B (20.39 MB) and `UAL1_RM.glb` 21,405,544 B (root motion baked), `Unity/UAL1.fbx` 67.9 MB + `UAL1_RM.fbx` 67.9 MB, `UAL1.blend` 36.7 MB, `root_motion_toggle.py` (Blender 4.5 addon that mutes/unmutes the `root` fcurve group), `README.txt`, `License.txt` (CC0), 4 setup PNGs. UAL2: `Unreal-Godot/UAL2.glb` 20,717,364 B (19.76 MB), `UAL2_RM.glb` 20,756,380 B, `Unity/UAL2.fbx` 70.4 MB + `UAL2_RM.fbx` 70.5 MB, `UAL2.blend` 68.0 MB, same addon/readme/pngs, plus `Female Mannequin/` (`Mannequin_F.blend` 4.1 MB, `Unity/Mannequin_F.fbx` 575 KB, `Unreal-Godot/Mannequin_F.glb` 1,442,824 B, `README.txt`: "doesn't include the animations ... both mannequins share the same rig and very similar proportions").

**GLB structure (UAL1.glb / UAL2.glb identical mesh+rig):** generator `Khronos glTF Blender I/O v4.5.48`, no extensions, no images. 67 nodes, 1 mesh `Mannequin` with 2 primitives (`M_Main` 3,389v/5,732t + `M_Joints` 5,157v/8,012t) totalling **8,546 verts / 13,744 tris** (POSITION, NORMAL, TEXCOORD_0, TEXCOORD_1, JOINTS_0, WEIGHTS_0). Materials: `M_Main` baseColorFactor (0.8, 0.4, 0.04) orange, `M_Joints` (0.4, 0.13, 0.71) purple, metal 0 / rough 0.5. Mannequin_F.glb (generator v4.3.47): 25,636v / 14,612t (`M_Main` 10,070v/6,415t + `M_Joints` 15,566v/8,197t), colours swapped (M_Main purple, M_Joints orange), **0 animations**.

**Skeleton (65 joints, skin `Armature`) — identical name list and order in UAL1.glb, UAL1_RM.glb, UAL2.glb, UAL2_RM.glb and Mannequin_F.glb (verified by sorted diff):** `root, pelvis, spine_01, spine_02, spine_03, neck_01, Head, clavicle_l, upperarm_l, lowerarm_l, hand_l, index_01_l, index_02_l, index_03_l, index_04_leaf_l, middle_01_l, middle_02_l, middle_03_l, middle_04_leaf_l, pinky_01_l, pinky_02_l, pinky_03_l, pinky_04_leaf_l, ring_01_l, ring_02_l, ring_03_l, ring_04_leaf_l, thumb_01_l, thumb_02_l, thumb_03_l, thumb_04_leaf_l, clavicle_r, upperarm_r, lowerarm_r, hand_r, index_01_r, index_02_r, index_03_r, index_04_leaf_r, middle_01_r, middle_02_r, middle_03_r, middle_04_leaf_r, pinky_01_r, pinky_02_r, pinky_03_r, pinky_04_leaf_r, ring_01_r, ring_02_r, ring_03_r, ring_04_leaf_r, thumb_01_r, thumb_02_r, thumb_03_r, thumb_04_leaf_r, thigh_l, calf_l, foot_l, ball_l, ball_leaf_l, thigh_r, calf_r, foot_r, ball_r, ball_leaf_r`. (UE4 Mannequin naming with `Head` capitalised and `_leaf` end bones; no `ik_*` bones.)

**Clip counts:** UAL1.glb **120** animations, UAL2.glb **134** animations; every clip has 195 channels on all 65 nodes. `*_RM.glb` files have the identical clip list and durations (diff of the inspector output differs only in byte length: 16,143,344 vs 16,165,216 B for UAL1, 14,821,308 vs 14,852,172 B for UAL2).
--- UAL1 clips ---
```
A_TPose 2.5s | BackFlip 1.933s | Celebration 4s | Climb_Down_Loop 1.267s | Climb_Enter 1.467s | Climb_Exit 1.467s | Climb_Idle_Loop 2.933s | Climb_Left_Loop 0.867s | 
Climb_Right_Loop 0.867s | Climb_Up_Loop 1.267s | ClimbLedge 0.633s | Counter_Angry 2s | Counter_Enter 1.167s | Counter_Exit 1.167s | Counter_Give 4.367s | Counter_Idle_Loop 2.667s 
| Counter_Show 4.667s | Crawl_Bwd_Loop 2.5s | Crawl_Enter 2.133s | Crawl_Exit 2s | Crawl_Fwd_Loop 2.167s | Crawl_Idle_Loop 2.333s | Crawl_Left_Loop 1.267s | Crawl_Right_Loop 
1.267s | Crouch_Bwd_L_Loop 2s | Crouch_Bwd_Loop 2s | Crouch_Bwd_R_Loop 2.4s | Crouch_Enter 0.833s | Crouch_Exit 0.833s | Crouch_Fwd_L_Loop 2s | Crouch_Fwd_Loop 2s | 
Crouch_Fwd_R_Loop 2s | Crouch_Idle_Loop 2.933s | Crouch_Left_Loop 2s | Crouch_Right_Loop 2s | Crying 4.833s | Dance_Loop 1s | Death01 2.4s | Death02 2.467s | Dodge_Left 1.3s | 
Dodge_Right 1.3s | Drink 3s | Driving_Loop 1.667s | Fixing_Kneeling 5.2s | GroundSit_Enter 2.5s | GroundSit_Exit 2.167s | GroundSit_Idle_Loop 1.333s | Hit_Chest 0.333s | Hit_Head 
0.433s | Hit_Shoulder_L 0.533s | Hit_Shoulder_R 0.5s | Hit_Stomach 0.667s | Idle_LookAround_Loop 4.6s | Idle_Loop 2.5s | Idle_Paper 3.133s | Idle_Rock 3.133s | Idle_Scissors 
3.133s | Idle_Talking_Loop 2.933s | Idle_Tired_Loop 2.3s | Idle_Torch_Loop 1.267s | Interact 2s | Jog_Bwd_L_Loop 0.933s | Jog_Bwd_Loop 0.933s | Jog_Bwd_R_Loop 0.933s | 
Jog_Fwd_L_Loop 0.933s | Jog_Fwd_LeanL_Loop 0.933s | Jog_Fwd_LeanR_Loop 0.933s | Jog_Fwd_Loop 0.933s | Jog_Fwd_R_Loop 0.933s | Jog_Left_Loop 0.933s | Jog_Right_Loop 0.933s | 
Jump_Land 1.267s | Jump_Loop 2.5s | Jump_Start 1.333s | Kick 1.1s | PickUp_Kneeling 1.933s | PickUp_Table 0.833s | Pistol_Aim_Down 0.167s | Pistol_Aim_Neutral 0.167s | 
Pistol_Aim_Up 0.167s | Pistol_Idle_Loop 1.667s | Pistol_Reload 1.667s | Pistol_Shoot 0.633s | Punch_Cross 1s | Punch_Jab 0.867s | PunchKick_Enter 0.667s | PunchKick_Exit 0.667s | 
Push_Enter 0.667s | Push_Exit 1.2s | Push_Loop 2.667s | Roll 1.467s | Sitting_Enter 1.3s | Sitting_Exit 1.033s | Sitting_Idle02_Loop 2.5s | Sitting_Idle03_Loop 4.167s | 
Sitting_Idle_Loop 1.667s | Sitting_Nodding_Loop 2.933s | Sitting_Talking_Loop 2.933s | Spell_Double_Enter 0.633s | Spell_Double_Exit 0.633s | Spell_Double_Idle_Loop 2.1s | 
Spell_Double_Shoot_Loop 0.267s | Spell_Simple_Enter 0.533s | Spell_Simple_Exit 0.433s | Spell_Simple_Idle_Loop 2.1s | Spell_Simple_Shoot 0.5s | Sprint_Enter 0.867s | Sprint_Exit 
1.667s | Sprint_Loop 0.667s | Swim_Fwd_Loop 1.333s | Swim_Idle_Loop 3.333s | Sword_Attack 1.533s | Sword_Attack_Standing 1.533s | Sword_Enter 1.3s | Sword_Exit 1.3s | Sword_Idle 
1.667s | Turn90_L 2s | Turn90_R 2s | Walk_Formal_Loop 1.333s | Walk_Loop 1.333s
```
--- UAL2 clips ---
```
A_TPose 2.5s | Bandage_Loop 0.667s | Bow_Aim_Down 1.333s | Bow_Aim_Neutral 2.5s | Bow_Aim_Up 1.333s | Bow_Notch 2.5s | Bow_RapidShoot_Loop 0.433s | Bow_Shoot 0.667s | Chest_Open 
1.367s | ClimbUp_1m 0.667s | ClimbUp_2m 1.3s | Consume 1.333s | DoubleJump 0.9s | Farm_Harvest 2.5s | Farm_PickingTree 2.233s | Farm_PlantSeed 2.767s | Farm_ScatteringSeeds 1.567s 
| Farm_Watering 3.8s | Fish_Cast 1.833s | Fish_Cast_Idle_Loop 2.333s | Fish_OH_Idle_Loop 2.333s | Fish_Reel 2.3s | Fish_Reel_Failed 2.767s | GetOffWall_2m 0.633s | Hit_Knockback 
0.833s | Idle_FoldArms_Loop 2.5s | Idle_Lantern_Loop 2.5s | Idle_No_Loop 2.5s | Idle_Rail_Call 2.5s | Idle_Rail_Loop 2.5s | Idle_Shield_Break 1.067s | Idle_Shield_Loop 2.5s | 
Idle_TalkingPhone_Loop 2.933s | IdleToLay 3s | JogToFlip 1.2s | KipUp 1.167s | LayToIdle 1.533s | LiftAir 0.467s | LiftAir_Fall 0.933s | LiftAir_Fall_Air_Loop 1.3s | 
LiftAir_Fall_Impact 0.667s | LiftAir_Hit_L 0.5s | LiftAir_Hit_R 0.5s | LiftAir_Idle_Loop 2s | Melee_Combo 2.267s | Melee_Hook 0.467s | Melee_Hook_Rec 0.6s | Melee_Knee 0.867s | 
Melee_Knee_Rec 0.233s | Melee_Uppercut 1.067s | Mining_Loop 0.9s | MonsterTransformation 2.233s | NinjaJump_Double 0.9s | NinjaJump_Idle_Loop 2s | NinjaJump_Land 1.267s | 
NinjaJump_Start 0.967s | OverhandThrow 1.333s | SafetyVault 0.733s | Shield_Dash 1.1s | Shield_OneShot 0.833s | Slide_Exit 0.5s | Slide_Loop 2s | Slide_Start 0.833s | 
Sprint_Shield_Loop 0.667s | StepUp 0.667s | Surprise 2.467s | Sword_Aerial_A 0.4s | Sword_Aerial_A_Rec 0.433s | Sword_Aerial_B 0.567s | Sword_Aerial_Combo_Loop 1s | 
Sword_Aerial_Idle_Loop 1.067s | Sword_Block 1.233s | Sword_Dash 1.567s | Sword_GroundPound 1.167s | Sword_Heavy_A 0.733s | Sword_Heavy_A_Rec 1s | Sword_Heavy_B 0.5s | 
Sword_Heavy_B_Rec 0.767s | Sword_Heavy_C 0.7s | Sword_Heavy_C_Rec 0.567s | Sword_Heavy_Combo 4.333s | Sword_Heavy_D 2.333s | Sword_Light_A 0.367s | Sword_Light_A_Rec 0.5s | 
Sword_Light_B 0.433s | Sword_Light_B_Rec 0.567s | Sword_Light_C 0.867s | Sword_Light_C_Rec 0.7s | Sword_Light_Combo 3.4s | Sword_Light_D 1.667s | Sword_Regular_A 0.433s | 
Sword_Regular_A_Rec 0.967s | Sword_Regular_B 0.533s | Sword_Regular_B_Rec 1.033s | Sword_Regular_C 2s | Sword_Regular_Combo 3s | Sword_UpperCut 0.7s | TreeChopping_Loop 0.967s | 
Turn180_L 1.667s | Turn180_R 1.667s | Walk_Bwd_L_Loop 1.333s | Walk_Bwd_Loop 1.333s | Walk_Bwd_R_Loop 1.333s | Walk_Carry_Loop 2s | Walk_Fwd_L_Loop 1.333s | Walk_Fwd_Loop 1.333s | 
Walk_Fwd_R_Loop 1.333s | Walk_L_Loop 1.333s | Walk_R_Loop 1.333s | WallRun_Jump_L 0.733s | WallRun_Jump_R 0.733s | WallRun_L_Loop 0.733s | WallRun_R_Loop 0.733s | Yes 2.5s | 
Zombie_Bite 1.5s | Zombie_Idle_Loop 1.333s | Zombie_Run_Bwd_L_Loop 0.733s | Zombie_Run_Bwd_Loop 0.733s | Zombie_Run_Bwd_R_Loop 0.733s | Zombie_Run_Fwd_L_Loop 0.733s | 
Zombie_Run_Fwd_Loop 0.733s | Zombie_Run_Fwd_R_Loop 0.733s | Zombie_Run_L_Loop 0.733s | Zombie_Run_R_Loop 0.733s | Zombie_Scratch 1.8s | Zombie_Spawn 2.833s | 
Zombie_Walk_Bwd_L_Loop 1.333s | Zombie_Walk_Bwd_Loop 1.333s | Zombie_Walk_Bwd_R_Loop 1.333s | Zombie_Walk_Fwd_L_Loop 1.333s | Zombie_Walk_Fwd_Loop 1.333s | Zombie_Walk_Fwd_R_Loop 
1.333s | Zombie_Walk_L_Loop 1.333s | Zombie_Walk_R_Loop 1.333s
```

## 6. `quaternius/downtown-city-megakit` (244M) — `Exports/glTF (Godot)`

Layout: `Exports/FBX (Unity)/` (6.0M, 153 .fbx, binary FBX 7400), `Exports/FBX (Unreal Engine)/` (6.1M, 153 .fbx), `Exports/glTF (Godot)/` (89M), `Textures/` (142M: 33 PNG + 3 `.HDR` interior cubemaps `CM_Dark_Interior_1/CM_Lit_Interior_1/CM_Lit_Interior_2` 5.4–6.1 MB each, + `Unreal-Normals/` with 9 PNG + 1 JPG DirectX-flipped normals incl. a `T_Sign_Normal.png` that no glTF uses), `License_Standard.txt` (CC0; **this is the FREE "standard" version — "only contains a portion of the models"; the SOURCE version with all models + Unity/Unreal/Godot projects, collisions and fake-interior shaders is paid**), 3 preview JPGs. No .blend files in this pack.

**glTF format:** `.gltf` + `.bin` + external PNG. **153 `.gltf` + 153 `.bin`** (9.9 MB together) + **29 PNG** (79 MB). Generator `Khronos glTF Blender I/O v4.3.47`, no extensions. One node + one mesh per file (node named after the model, mesh names Blender leftovers like `Plane.235`, `Cube.030`); a multi-material piece is one mesh with N primitives. FBX (Unity) file names match the glTF names 1:1.

**Naming (153, by prefix):** `Brick_` 38, `Cornice_` 15, `Decal_` 17, `Street_` 14, `Metal_` 14, `Roof_` 13, `Trim_` 11, `Sidewalk_` 8, `Prop_` 5, `Stairs_` 4, `Building_` 3, `Door_` 3, `DoorFrame_` 3, `Floor_` 3, `Entrance_` 2.
- Brick facades: `Brick_90Angle_L/R`, `Brick_BottomTrim`, `Brick_Column_RedBricks`, `Brick_Column_Small`, `Brick_Column_TrimBricks`, `Brick_CornerColumn_{Bottom,Cap,CapShort,Center,Center_Half,Top}`, `Brick_Corner_Plain`, `Brick_HalfColumn_{Bottom,Center,Top}`, `Brick_HalfTrim`, `Brick_Inset`, `Brick_Inset_Window`, `Brick_Inset_Window_Curved`, `Brick_Inset_Window_Curved_Small`, `Brick_InteriorWall_{1,3,4}`, `Brick_Ornament_Horizontal`, `Brick_Plain_{1,3,3_noWear,4}`, `Brick_RedWhite_DoubleWindow`, `Brick_TopTrim`, `Brick_TopTrim_90Angle_L/R`, `Brick_TopTrim_Corner`, `Brick_Window_CurvedDouble`, `Brick_Window_Square_Single`, `Brick_Window_Trim`, `Brick_Window_Trim_Single`.
- Metal facades: `Metal_Column_{Bottom,Center,Top}`, `Metal_Column_Small_{Bottom,Center,Top}`, `Metal_FirstFloor_Wall`, `Metal_FirstFloor_Wall_1`, `Metal_FirstFloor_Window`, `Metal_FullWindow`, `Metal_Plain_{1,3}`, `Metal_Window`, `Metal_Window_Half`. Trim facades: `Trim_90Angle_TopCover`, `Trim_Column_{Bottom,Center,Top}`, `Trim_Corner`, `Trim_FirstFloor_Wall`, `Trim_FirstFloor_Window_001`, `Trim_FirstFloor_Window_Columns`, `Trim_Plain_3`, `Trim_Wall_Guard`, `Trim_Window`.
- Cornices: `Cornice_{Brick,Metal,Trim}_{90Angle_L,90Angle_R,Center,L,R}`. Roofs: `Roof_2x2`, `Roof_2x2_90Angle_{Center,L,R}`, `Roof_4x4`, `Roof_SlateCornice_{Center,Corner,InnerCorner,Window_1}`, `Roof_Slate_{Center,Corner,InnerCorner,Window_1}`. Floors: `Floor_2x2`, `Floor_4x4`, `Floor_Inset`. Doors: `Door_1..3`, `DoorFrame_{Metal_Single,Trim,Wooden}`, `Entrance_Concrete_2x1`, `Entrance_Concrete_2x2`, `Stairs_Entrance_Concrete`, `Stairs_Rails_Metal`, `Stairs_Rails_Metal_Straight_{1,2}`.
- Whole buildings (3): `Building_Large_2`, `Building_Medium_2_001`, `Building_Small_1`.
- Streets: `Street_2Lane`, `Street_2Lane_noSidewalk`, `Street_4Lane`, `Street_4Lane_noSidewalk`, `Street_4WayIntersection`, `Street_TIntersection`, `Street_Asphalt_6x6`, `Street_Asphalt_9x9`, `Street_Asphalt_Curve_2Lane`, `Street_Asphalt_Curve_4Lane_Short`, `Street_Curve_2Lane`, `Street_Curve_2Lane_Curb`, `Street_Curve_4LaneShort`, `Street_Curve_4Lane_Short_Curb`. Sidewalks: `Sidewalk_Corner_Flat_3m[_Stripe]`, `Sidewalk_Corner_Round_3m[_Stripe]`, `Sidewalk_NoCurb_3m`, `Sidewalk_Planter`, `Sidewalk_Straight_3m[_Stripe]`.
- Road decals (17, BLEND quads on `T_Street_Decals.png`): `Decal_Arrow{ForwardLeft,ForwardRight,Straight,TurnLeft,TurnRight}`, `Decal_Bikelane`, `Decal_BrokenLine_Straight`, `Decal_Crosswalk`, `Decal_Crosswalk_Wide`, `Decal_Curve_2Lane_Stripe`, `Decal_Curve_4LaneShort[_DoubleYellow|_Stripe]`, `Decal_DoubleYellow_Straight`, `Decal_Only`, `Decal_Slow`, `Decal_Stop`.
- Props (5): `Prop_ACUnit`, `Prop_Bollard`, `Prop_Drain`, `Prop_ManholeCover`, `Prop_Planter_Single`.

**Textures: several PBR texture sets, not one atlas.** 21 distinct material names across the pack, sharing 9 texture sets (BaseColor + Normal + ORM, all 2048² except MarbleFloor BaseColor/ORM 1024²) plus decals and interiors:
| material (files using it) | textures |
|---|---|
| `MI_Trim_MetalConcrete` (53) | `T_MetalConcrete_{BaseColor,Normal,ORM}` |
| `MI_Trim` (44), `MI_Trim_Dark` (7), `MI_Trim_Green` (5) | `T_Trim_{BaseColor,Normal,ORM}` (same maps; tint presumably differs in-engine; in glTF they are identical definitions) |
| `MI_InteriorWall` (41), `MI_RedBrick` (27), `MI_RedBrick_Pale` (16) | `T_RedBrick_{BaseColor,Normal,ORM}` (same maps for all three) |
| `MI_StreetDecals` (28) | `T_Street_Decals.png` 2048² RGBA, alphaMode BLEND |
| `MI_Glass` (24) | no textures, BLEND, metal 0 rough 0.5 (no baseColorFactor alpha set — opaque white glass as exported) |
| `MI_Asphalt` (20) | `T_Concrete_Asphalt_BaseColor` + `T_Concrete_{Normal,ORM}` |
| `MI_FakeInterior` (16) | no texture (placeholder); `MI_FakeInterior_1/_3` → `T_lit_interior_1.png` 512², `_2` → `T_lit_interior_2.png`, `_4` → `T_dark_interior.png` (3 files each: the whole buildings) |
| `MI_Roof_Slate` (8) | `T_RoofSlate_*` |
| `MI_InteriorFloor` (6) | `T_MarbleFloor_*` |
| `MI_InteriorRoof` (3), `MI_Concrete` (2) | `T_Concrete_*` |
| `MI_Ornaments` (3) | `T_Ornaments_*` |
| `MI_Dirt` (2) | `T_Dirt_*` |
PBR materials have no metallic/roughness factors set (defaults 1/1 with the ORM map in `metallicRoughnessTexture`), doubleSided true. `T_Blinds.png`, `T_Curtains.png`, `T_Noise_Drips.png`, `T_CornerDamage_Normal.png` and the HDR cubemaps exist only in `Textures/` (engine shader inputs, no glTF references).

**Vertex attributes:** most primitives carry `COLOR_0` (116 primitives also `COLOR_1`, 17 also `TEXCOORD_2`; 72 primitives have no colour; 24 have only TEXCOORD_0). `COLOR_0` is a **wear/dirt mask, not an albedo tint**: e.g. `Street_2Lane` asphalt R=1.0 with G=B ranging 0→1; `Brick_Plain_3` has 3 distinct values incl. (0.0002, 0, 0, 1); `Brick_Window_Trim` is all-white. `TEXCOORD_1` is a second UV set (lightmap/detail), `TEXCOORD_2` a constant (0,1). Rendering COLOR_0 as a multiplier in three.js (`vertexColors: true`) would turn many pieces red/black.

**Representative triangle counts (verts / tris / primitives):**
| kind | model | verts | tris | prims |
|---|---|---|---|---|
| plain facade | `Brick_Plain_1` | 8 | 4 | 2 (RedBrick front + InteriorWall back) |
| plain facade | `Brick_Plain_3` / `Metal_Plain_1` | 12 | 6 | 2 |
| window facade | `Brick_Window_Trim` | 1,022 | 652 | 5 |
| window facade | `Metal_Window` | 758 | 578 | 5 |
| window facade (most complex) | `Brick_Window_CurvedDouble` | 1,619 | 1,137 | 5 |
| whole building | `Building_Large_2` | 64,052 | 45,122 | 12 |
| whole building | `Building_Medium_2_001` | 40,886 | 25,612 | 12 |
| whole building | `Building_Small_1` | 27,809 | 18,344 | 13 |
| street tile | `Street_2Lane` | 304 | 220 | 3 (asphalt, decals, curb) |
| street tile | `Street_4Lane` | 344 | 252 | 3 |
| street tile | `Street_4WayIntersection` | 1,021 | 892 | 3 |
| street tile | `Street_Asphalt_6x6` / `_9x9` | 4 | 2 | 1 |
| sidewalk | `Sidewalk_Straight_3m` | 82 | 60 | 1 |
| floor | `Floor_4x4` | 32 | 16 | 2 |
Everything except the 3 buildings is under 1,200 tris. Full table: `reads/downtown-table.tsv`.

## 7. `quaternius/street-pack` (16M) and `quaternius/furniture-pack` (13M)

**street-pack:** `Blends/` 25 .blend (13M), `FBX/` 25 binary FBX 7400 (884K), `OBJ/` 25 .obj + 25 .mtl (1.3M), `License.txt` (CC0, "Street Pack by Quaternius"), `Preview.png` 1920×1080. **No glTF/GLB.** Names: `Sign_NoParking`, `Sign_Stop`, `Sign_Triangle`, `Street_3Way`, `Street_3Way_2`, `Street_4Way`, `Street_4Way_2`, `Street_Bridge`, `Street_Bridge_Ramp`, `Street_Bridge_Underpass`, `Street_Bridge_Water`, `Street_Bridge_WaterRamp`, `Street_Curve`, `Street_Deadend`, `Street_Elevated`, `Street_Elevated_Ramp`, `Street_Empty`, `Street_Empty_Water`, `Street_Straight`, `Streetlight_Double`, `Streetlight_Single`, `Streetlight_Triple`, `Streets_all`, `TrafficLight`, `TrafficLight_2`. OBJ faces (quads/tris as exported): tiles 6–352 (`Street_Empty` 6, `Street_Straight` 178, `Street_4Way` 352), bridges 522–812, streetlights 514–1,402, `Streets_all` 6,017. Materials are flat `Kd` colours in the `.mtl` (16 distinct colours, no `map_Kd`, no textures).

**furniture-pack:** `Blends/` 23 .blend (11M), `FBX/` 23 binary FBX 7400 (504K), `OBJ/` 23 .obj + 23 .mtl (536K), `Preview.png` 960×540; no licence file in the folder (README says CC0). **No glTF/GLB.** Names: `Bed`, `BedKing`, `BookCase`, `BookCaseBooks`, `BookCaseLarge`, `BookCaseLargeBooks`, `Chair`, `ChairCushioned`, `ChairHandle`, `Closet`, `Closet2`, `CoffeeTable`, `CoffeeTable2`, `Lamp`, `Lamp2`, `Plant`, `Sofa`, `SofaDouble`, `SofaLong`, `Stool`, `Table`, `Vase`, `Vase2`. OBJ faces 52 (`Lamp`) to 1,752 (`BookCaseLargeBooks`); most 84–268. **All 56 `.mtl` materials have `Kd 0.64 0.64 0.64`** (names like `DarkWood`, `Sheets`, `Sofa` but colours not exported) — colours live only in the `.blend`/FBX.

## 8. Cross-pack facts

- Formats per pack: glTF `.gltf+.bin+png` = nature-megakit (116), nature-pack (36 of 63), downtown (153); glTF embedded (data-URI, single `.gltf`) = space kit (92); GLB = UAL1/UAL2/_RM/Mannequin_F (5) + the lone `Birch_4GLB.glb`; **no glTF of any kind** = farm-animals, street-pack, furniture-pack (FBX/OBJ/Blend only).
- Blender exporter versions: v1.7.33 (space kit), v4.0.44 (both nature packs), v4.3.47 (downtown, Mannequin_F), v4.5.48 (UAL1/UAL2). All FBX are binary 7400.
- No `KHR_*` extensions anywhere (no Draco/meshopt/texture_transform/materials_*).
- Rigged + animated glTF: only space-kit Characters (Quaternius rig, 43/13/5/4 joints) and UAL1/UAL2 (UE-style 65 joints). Farm animals are rigged/animated only in FBX/Blend.
- Three licence files are copy-pasted from "Ultimate Platformer Pack" (nature-pack, space kit) — all still state CC0 1.0.
- Repo contents are all real files (no LFS, no pointers); big binaries that were kept out of git are only the engine projects and Sketchfab GLBs (on GitHub releases).
