# Why Bruno Simon's folio looks and feels so good, and what this site does instead

Date: 2026-10-06. Read from the source of `brunosimon/folio-2019` (HEAD 540f135, the site at
2019.bruno-simon.com; bruno-simon.com itself now serves the 2025 WebGPU folio), cannon 0.6.2,
Bruno's portal-scene repos, and his interviews. Then the same questions asked of this repo. The
architecture that follows from it is `docs/superpowers/specs/2026-10-06-baked-look-and-toy-physics-design.md`.

## The headline: there is no light in it

The common belief (and this repo's earlier note, `2026-10-04-webgl-portfolios.md`) is that the
2019 folio is "baked in Blender". It isn't lightmapped. No GLB in the repo carries a material or
an image. The scene has zero lights and zero shadow maps. What it has:

1. **Thirteen matcaps**, 128 × 128 PNG, about 5 KB each (`src/images/matcaps/`). Every Blender
   object is named for its material (`shadeWhite_001`, `shadeBrown.003`, `pureYellow_001`) and
   `World/Objects.js` picks the material by regex on the node name. Counts in the static set:
   shadeWhite 181, shadeBrown 129, shadeOrange 80, shadeGreen 30. A matcap is a photograph of a
   lit sphere: light, shadow and colour in one texel lookup by view-space normal. Bruno, in the
   Mux interview (Feb 2024): "There is actually no light in those. It's called matcaps."
   The `.blend` holds a `matcaps` collection with the same material names and an area light, so
   the spheres were rendered in Blender with the scene's own look (inferred).
2. **A fake bounce in the shader** (`src/shaders/matcap/fragment.glsl`): faces low to the ground
   that point downward are tinted toward the floor's orange, `#d04500`. Distance term
   `clamp(1 - z / 1.75, 0, 1) * 0.5`, squared; angle term `clamp((dot(n, -up) + 0.6) * 1.5, 0, 1)`;
   `gl_FragColor = mix(outgoingLight, uIndirectColor, both)`. This is why nothing floats:
   the bottom of every object is warmed by the ground it stands on.
3. **A baked floor-shadow mask per area** (`src/models/<area>/static/floorShadow.png`, 512 × 512,
   25–85 KB, palette PNGs): white where lit, black under things, soft directional penumbrae.
   Each area's `floor*` node is replaced by a `PlaneGeometry` with the `FloorShadow` material:
   `alpha = (1 - texture(tShadow, uv).r) * uAlpha`, colour `#d04500`, transparent, no depth write.
   Rendered in Cycles from the area's geometry (the `.blend` references the PNGs; inferred).
4. **Blob shadows for everything that moves** (`World/Shadows.js`): a unit plane per object
   (the car's 3 × 2), a rounded-rectangle falloff with `fadeRadius 0.35`, slid away from a fixed
   sun `(-2.5, -2.65, 3.75)` by `-sun / sun.z * height`, faded by `((3 - height) / 3)²` and by
   tilt, sitting at z 0.001. Global alpha tweened to 0.5 on reveal.
5. **The ground isn't a mesh**: a full-screen plane pinned to the far plane samples a 2 × 2
   `DataTexture` (`#f5883c`, `#ff9043`, `#fccf92`, `#f5aa58`) with linear filtering: an infinite
   four-corner gradient in one draw.
6. **Shadows are never grey.** The bounce colour, the floor shadow and the blob shadow are all
   the same warm orange. Nothing sets a colour space; hex colours call `convertLinearToSRGB()`
   so authored colours reach the screen exactly.

So the "textures" that look so good are: one tiny image that *is* the lighting (the matcap),
one soft mask that *is* the shadow, and a shader that *is* the bounce. The world is low poly
(94k triangles for the static set, 361 mesh nodes, Draco) and the whole payload is about 2 MB.

## The physics (cannon 0.6.2, Z up)

- `gravity (0, 0, -13)`, `allowSleep`, default NaiveBroadphase and GSSolver (10 iterations).
- **Every contact material has `contactEquationStiffness: 1000`** (cannon's default is 1e7).
  This is the squish: contacts are spongy springs, so hits look soft and toy-like. Friction:
  floor–prop 0.05, prop–prop 0.5, floor–wheel 0.3; restitution 0.3 / 0.3 / 0.
- **The car is a `RaycastVehicle`**: chassis box 2.03 × 1.02 × 1.16, mass 40, never sleeps.
  Wheels: radius 0.25, `suspensionStiffness 50`, `suspensionRestLength 0.1`, `frictionSlip 10`,
  `dampingRelaxation 1.8`, `dampingCompression 1.5`, `rollInfluence 0.01`,
  `maxSuspensionTravel 0.3`, `customSlidingRotationalSpeed -30`. (cannon multiplies the
  suspension force by chassis mass, so stiffness is an acceleration per metre: static sag is
  13 / (4 × 50) = 0.065 of a 0.1 rest length. It sits low on its springs and bobs.)
  The wheels are also **kinematic cylinder bodies** (mass 5) copied from the wheel transforms
  every step, so they shove props.
- **Props are light**: bowling pins 0.1, bricks 0.5, ball 1, letters 1.5, against the car's 40.
  They start asleep with `sleepSpeedLimit 0.01` and scatter dramatically when hit.
- **Colliders are primitives from Blender**: a `collision.glb` beside each `base.glb`, nodes named
  `cube*`, `cylinder*`, `sphere*`, `center`, their `scale` read as the shape's size. No trimesh.
- **Controls are analog and forgiving**: steering ramps at 0.015 rad/ms to 30.6° and recentres at
  the same rate; rear-wheel drive 272 (476 with boost), a coasting drag impulse of
  `-forward · |v| · 0.1` when off the throttle; brake 1.35; the car flips itself back after a
  second upside down (`applyImpulse (0, 0, 150)` off-centre); R resets; H honks and jumps.
- **Secondary motion**: the antenna is a spring driven by chassis acceleration (`speedStrength 10`,
  `damping 0.035`, `pullBackStrength 0.02`); brake and reverse lights change opacity.
- **Sound is bound to physics**: `body.addEventListener('collide', e => play(name,
  e.contact.getImpactVelocityAlongNormal()))`; volume `clamp((v - vMin) * k)²`, playback rate
  randomised in a range, one of several variants, a 100 ms throttle per sound. The engine is one
  loop whose rate (0.4–1.4) and volume follow `|speed| · 2.5 + accel · 0.4`, eased 0.3 up and
  0.15 down.
- **The camera follows only x and y** (never the chassis's bounce or tilt), eased at 0.15 a
  frame; FOV 40 from a high three-quarter angle at distance 14 + 15 × zoom; wheel and drag ease
  at 0.1.
- **Pitfall**: `world.step(delta)` with one argument is a variable timestep with no interpolation,
  and the camera and antenna are eased per frame, so the feel shifts at 120 Hz (he patched the
  engine sound for it in 2024). Copy the recipe with a fixed step.

## Rendering

Pixel ratio forced to 2 (no MSAA), `RenderPass` → separable 9-tap blur, horizontal then vertical,
weighted by `1 - sin(uv.y · π)` (a tilt-shift: sharp across the middle, soft top and bottom, the
miniature look) → a pink radial "glow" at the left edge. No instancing or merging shipped (the
merge is commented out). It stays fast because a fragment is one texture fetch and there are no
lights and no shadow pass.

## The later, truly baked approach (Three.js Journey's portal, the 2025 folio)

The portal scene is one merged `baked` mesh (41 KB GLB, 4 nodes) with a 4096² JPEG (845 KB) on a
`MeshBasicMaterial`: `flipY = false`, `colorSpace = SRGBColorSpace`, emissive bits as plain
`MeshBasicMaterial` colours. Rendered in Cycles, denoised, saved from the render output. The 2025
folio uses a palette texture indexed by UV, KTX2, Draco, instancing, Rapier and TSL/WebGPU. Both
are "the light is in the texture, the material is Basic".

## Why it feels so good, in one list

1. One cheap pre-lit shading model everywhere, so every surface is one family.
2. One warm palette; shadows and bounce are tinted, never grey; authored colours shown exactly.
3. Three layers of grounding: baked floor masks under static things, sun-offset blobs under moving
   things, a bounce tint on the bottom of everything.
4. Diorama framing: FOV 40, high three-quarter, tilt-shift, camera that ignores the bounce.
5. Soft toy physics: stiffness 1000, restitution 0.3, gravity −13, props 0.1–1.5 against 40.
6. Forgiving analog controls: ramped steering, coasting drag, boost, auto-flip, reset, honk-jump.
7. Secondary motion from real springs (suspension, antenna), not hand-waved sine waves.
8. Sound driven by impact velocity, pitch-randomised, throttled, variants.
9. A choreographed first impression (ring, pad, world rising, car dropping, a sound).
10. About 2 MB in all.

## What this site does instead (audit, three r186)

Counted over `src/` with grep; read in `lib/three/*`, `lib/stage3d.js`, `lib/device.js`,
`albuquerque/world/{rules,scene,terrain,roads,vehicles}.js`, `middleearth/{shire,towns}`,
`office/world/{ao,batch}.js`, `galaxy/surface/ground.js`, `avengers/hq/{engine,assets}.js`.

| | this site | the folio |
| --- | --- | --- |
| Lit materials | `MeshStandardMaterial` 784, `MeshPhysicalMaterial` 46, `MeshLambertMaterial` 42 | none |
| Unlit | `MeshBasicMaterial` 566 (skies, sprites, blobs), `MeshMatcapMaterial` 0 | matcap everywhere, Basic for "pure" colours |
| Lights | `DirectionalLight` 86, `HemisphereLight` 48, `PointLight` 78, `SpotLight` 11 | 0 |
| Shadows | `castShadow = true` 220 times, `shadowMap.enabled` in 35 scenes, 1024–2048 maps over 52–116 m (9–18 px/m) | 0 shadow maps; baked masks + blobs |
| Image-based light | `RoomEnvironment` 31 scenes, HDRI 3 | none |
| Baked light | `lightMap` 0 (one listing of the slot), `aoMap` 26 (CC0 ARM maps), `vertexColors` 223 | matcaps, floor masks |
| Bounce | none | shader tint |
| Contact shade | `office/world/ao.js` (blob pools and wall-foot strips, 3 instanced draws), the Shire's 0.26-alpha circle under everyone but Frodo | everywhere |
| Post | bloom + grade (contrast, saturation, split tone, vignette, grain), ACES or Neutral | tilt-shift blur + glow |
| Physics engine | none | cannon |
| The car | `stepCar`: planar bicycle model `{x, z, yaw, speed, slide, yawRate}`, 1/120 s substeps, grip 19 / 10.5 / 8.5 m/s² by surface, handbrake swing, 56 tests; a 1.7 m circle against axis-aligned boxes and traffic circles; nothing it hits moves | `RaycastVehicle`, real suspension, kinematic wheels, props fly |
| Body motion | faked: roll from yaw rate and slide (±0.11 rad), pitch from acceleration (±0.05), slope and lean from four ground samples, a 22 Hz × 2.5 cm shiver off road | from the rigid body |
| Camera | `1 − exp(−k·dt)` smoothing (correct), follows position and heading | eased 0.15/frame, x/y only |
| Sound on hits | `state.bump` → `carSound` | impact velocity → volume², random pitch, variants, throttle |
| Textures | one loader, `ImageBitmapLoader`, tier anisotropy 16/4/1, KTX2 for 8 normal maps, CC0 1K sets, Meshy/Sketchfab GLBs (478, 133 MB), procedural canvases | 13 × 5 KB matcaps, 4 × ~50 KB masks |

What that means: the site's texture pipeline is already better engineered than the folio's
(decode off thread, anisotropy, KTX2, caching, warm-up). What it lacks is what the folio's
*textures carry*: light, soft shadow and bounce. Every surface here is lit live by a sun and a
hemisphere and shadowed by a map at 9–18 pixels per metre, so flat walls are flat tones, corners
don't darken, nothing has a penumbra, and the whole look is only as good as the shadow map. And
nothing here is simulated: the car can't bounce over a kerb, nothing can be knocked over, and
the body's lean is a sine wave.

Already in the repo that the fix can stand on: headless Chromium rendering (`scripts/hq-impostors.mjs`,
`playwright-core`), `watlas` (xatlas) for charting, `@gltf-transform`, `sharp`, static-mesh
merging (`towns/bake.js`, `office/world/batch.js`), a seeded city (`planCity(seed = 505)`), one
number for time of day (`sky.js` `lightAt(tod)`), a Driving settings panel, and 94
`onBeforeCompile` hooks in the house style (`lib/three/surface.js` is the model).

## Sources

- `brunosimon/folio-2019`: `src/javascript/{Application,Camera,Resources}.js`,
  `Utils/{Loader,Time,Sizes}.js`, `World/{index,Physics,Car,Objects,Materials,Shadows,Floor,Sounds,Controls}.js`,
  `Materials/*.js`, `Passes/{Blur,Glows}.js`, `src/shaders/**`, `resources/3d/render.blend` (strings).
- cannon 0.6.2 (`World.step`, `ContactMaterial`, `RaycastVehicle.updateSuspension`).
- `brunosimon/three.js-tsl-sandbox` (portal-scene), `pmndrs/threejs-journey` (Portal example).
- [Mux: a chat with Bruno Simon (2024)](https://www.mux.com/blog/3d-web-development-and-beyond-a-chat-with-bruno-simon);
  [Awwwards: Bruno's portfolio case study (2025 folio)](https://www.awwwards.com/brunos-portfolio-case-study.html);
  [Pastel interview](https://usepastel.com/blog/how-a-design-portfolio-got-the-attention-of-400-000-visitors);
  [Three.js Journey: Baking and exporting the scene](https://www.threejs-journey.com/lessons/baking-and-exporting-the-scene).
- Unverified: a Medium case study of the 2019 site (403), exact Cycles bake settings (paywalled).
