# Baked light everywhere: Bruno Simon's grounding in every world

Date: 2026-10-06. Status: the design the owner approved in chat (approach 1, "bake on arrival").
It rests on `docs/research/2026-10-06-bruno-simon-folio.md` (why Bruno Simon's folio looks
expensive while costing little) and extends Step 1 of
`docs/superpowers/specs/2026-10-06-baked-look-and-toy-physics-design.md` (Albuquerque's
offline masks) to the rest of the site.

## Intent

The owner: "Check all the different worlds. Bruno's was so performant and ours looked cheap
with textures. Replicate his use of artwork/textures to make it performant, give him credit,
and use it for our worlds to make it look better. Vamp up the engine."

What makes the folio look rich is not texture resolution. Its light is in its textures:
- the shading is a matcap
- the shadow is a soft mask baked under each area
- a shader warms the underside of everything toward the floor
- everything that moves stands on a soft blob slid away from the sun

There are no lights to evaluate and no shadow pass. The worlds here do the opposite. Most
render a 1–2K shadow map every frame, which gives hard grey shadows at 9–18 pixels a metre
and costs a second render of the world. The twelve Middle-earth towns and the Citadel have no
shadows at all, so their buildings and props float on flat ground. Albuquerque alone has the
folio's grounding, from masks baked offline.

Success looks like this:
- every walkable world stands on soft, warm shadows and sky occlusion
- what moves has a blob under it, and nothing hovers
- no world in scope renders a shadow pass
- the frame is no slower anywhere, and faster where a shadow pass went
- no world downloads anything more
- Bruno Simon is credited where people and contributors look

## Approach: bake on arrival

Albuquerque's masks were rendered offline in headless Chromium and committed. Elsewhere that
doesn't fit:
- the galaxy's surfaces are seeded per planet
- there are twelve towns
- software WebGL takes minutes an area

So the same bake runs once, on the GPU, when a world is assembled, and its result never
leaves the GPU. The quality tier sets the bake's cost. It is the folio's idea (light rendered
once, then read as a texture) with the rendering moved to load time.

Albuquerque keeps its offline masks: they cover four times of day, which a load-time bake
can't afford.

## Architecture

### `lib/three/grounding-bake.js`: `bakeFloorTexture`

`bakeFloorTexture(renderer, scene, { area, floor, casters, skip, sun, size, sunSamples,
skySamples, shadowSize, cone, top, chunk })` → `Promise<{ texture, range, dispose }>`. It works
the same way as the offline `bakeFloorMask`:
1. A floor-position picture is drawn from straight above.
2. For each direction there is one shadow map of the static world and one additive pass
   over the picture.

What differs:
- **It keeps the result on the GPU.** The sum is resolved into an RGBA8 render target with
  a 3 × 3 tent filter, linear filtering and mipmaps. There is no readback.
- **The resolved mask's channels:**
  - R: the sun
  - G, B: the floor's height, 16 bits over `range` (high byte, low byte)
  - A: the sky
- **It runs in chunks.** Each chunk sets and restores everything it touches: casters' and
  non-casters' `castShadow`, hidden movers, the light, the render target and the clear
  colour. The world can keep drawing between chunks.
- **It fails soft.** Without a float or half-float render target, or on any error, it
  returns `null`, and the world stands as it did before.
- **Sizes by tier:**

  | | high | mid | low |
  | --- | --- | --- | --- |
  | mask | 1024² | 512² | 512² |
  | sun / sky samples | 40 / 40 | 24 / 24 | 12 / 16 |
  | shadow map | 2048 | 2048 | 1024 |

The shared pass code moves into one internal helper. `bakeFloorMask` keeps its behaviour and
its tests.

### `lib/three/grounding.js`: two additions

- **The bounce from the baked height.** `bounce(material, { mask })` reads the floor's height
  under each fragment from the mask's G and B, so the tint sits right on hills, terraces and
  stairs. Outside the mask it falls back to `floor`.
- **`standIn(material, bake)`.** A mover (a character, a pony, a car) has the sun's
  directional light cut by the mask's sun term at its own origin. Walking into a building's
  baked shadow dims it as a shadow map would.

### `lib/three/groundwork.js` (new): `groundWorld`

One call per world wires the whole kit:

```
groundWorld({ renderer, scene, floor, area, sun, casters, skip, movers, shade, bounce,
              height, tier }) → { ready: Promise, update(), rebake(), blob(i, ...),
              dispose() }
```

It does the following:
- **Ends the shadow pass:** `renderer.shadowMap.enabled = false`, every `castShadow` and
  `receiveShadow` off, and the affected materials recompiled.
- **Shades the floor:** `floorShadow` on the floor's materials, with a white 1 × 1 mask until
  the bake lands. Then the uniform's texture is swapped, with no recompile.
- **Adds the bounce:**
  - which materials: every lit material in `casters` and `movers`
  - colour: `bounce.color`, or the hemisphere light's ground colour
- **Adds `standIn`:** on movers' lit materials.
- **Adds blob shadows:** one `createBlobShadows` draw for every mover in `movers`. Each one
  is `{ object, size, height? }`. `update()` places them from the objects' world positions and
  `height(x, z)`, and slides them away from `sun`.
- **Bakes:**
  - `ready` resolves when the bake has landed
  - `rebake()` bakes again for a sun that moved
- **Skips automatically:** points, sprites, lines and transparent meshes; skinned meshes;
  anything larger than the area (sky domes); and `userData.noBake`.

### `lib/three/matcap.js` (new): matcaps from the world's own light

- `bakeMatcap(renderer, { lights, color, roughness, metalness, size = 128 })` renders a
  sphere lit by the world's own lights into a small render target, cached by key.
- `matcapFor(material, renderer, lights)` returns a `MeshMatcapMaterial` that keeps
  `map`, `vertexColors` and `color`.

`groundWorld({ matcap: [roots] })` turns the lit materials under those roots into matcaps:
far rims of hills and trees, and instanced scatter where the view-locked light can't be told
apart. It is opt-in per world because our cameras orbit (the folio's never turns).

## The worlds

| world | floor | movers | today |
| --- | --- | --- | --- |
| Middle-earth towns (12: Bree, Edoras, Minas Tirith, Rivendell, Lórien, Weathertop, Moria, Orthanc, Amon Hen, Cirith Ungol, Doom, the Marshes) | `makeTerrain` mesh | the walker, the cast, ponies, wraiths (their circle blobs go) | no shadows |
| the Shire | terrain | Frodo, the folk | shadow map, circles |
| C-137 (the Smiths' street) | ground and road | Rick, Morty, the visitors | shadow map |
| the Citadel | its plaza floors | the crowd | no shadows |
| Scranton (the walkable office) | the carpet | the cast | shadow map (it already has AO strips) |
| the music courtyard | the stone floor and dunes | the player | shadow map |
| Avengers HQ compound | ground | Spider-Man, the people | shadow map |
| Invincible city | streets | (flying: blobs only near the ground) | shadow map |
| Cybertron Roll out | road and land | the convoy | shadow map |
| Galaxy surfaces | `groundMesh` | the player, walkers | shadow map |

Out of scope:
- **Caribbean:** the open sea; nothing stands on a floor.
- **The Death Star, Earth and Dot-matrix:** space, a globe and a sign.
- **The interiors:** the Shire's Bag End, Casa Tranquila and Metherria are rooms lit their
  own way.
- **Albuquerque:** already done.

Some worlds may turn out to be built in a way the kit can't wrap without restructuring them.
Each of those is noted in its commit and skipped rather than forced.

## Credit

- **README:** a "Lighting after Bruno Simon" entry in Assets and credits, linking his folio
  (bruno-simon.com) and `brunosimon/folio-2019` (MIT).
- **Code:** a header credit in `groundwork.js` and `matcap.js`. `grounding.js` already
  credits him.
- **Each grounded world:** one line in the world's credit area, where it has one.

## Testing

- Pure parts in Vitest, beside the existing `grounding*.test.js`:
  - height packing and unpacking
  - tier presets
  - the auto-skip rules
  - the bounce and `standIn` shader swaps on stub shaders
  - `groundWorld` against a stub renderer: the shadow pass off, the materials hooked, the
    blobs placed
  - the matcap cache key
- Lint, tests and the build pass. `vite build` shows the kit only in world chunks.
- Browser QA in headless Chromium:
  - screenshots before and after of a town, the Shire, C-137 and a galaxy surface
  - `renderer.info` draw calls before and after
  - the bake's time per tier logged

## Decisions

1. **Walls aren't shadowed by other buildings.** The shadow map goes, as in Albuquerque and
   the folio. Floors carry the shadows, and movers dim in them (`standIn`).
2. **The bake is fixed to one sun.** A world whose sun moves calls `rebake()` on a mood
   change rather than every frame.
3. **Load cost:** about 30–80 extra shadow renders once, spread over chunks during the reveal.
   No download.

## As built

Commits `be77d32` to the branch head. The changes from the design above, and why:

1. **Options the worlds turned out to need** (each with its test in
   `lib/three/groundwork.test.js`):
   - **`auto`:** bake on the first frame the floor is shown. A town places its sun during
     render, and a zone or a world seen from indoors can't be drawn from above while it's
     hidden.
   - **`follow`:** bake again when the sun turns more than about 10°. This catches Bree's
     and the Shire's moods.
   - **`clip`:** for a world shown one zone at a time (the Marshes, Moria, Orthanc, Cirith
     Ungol, Doom). Each outdoor zone has its own ground, and its blobs show only while that
     zone is shown, and only for the movers inside it.
   - **`contact`:** a mover's old circle shadow is hidden while its blob is drawn. Indoor
     zones, and C-137's rooms, keep theirs.
   - **`track()`:** stands a later mover in the shade: a figure swapped by the wardrobe, a
     model swapped in, a robot spawning.
   - **No blob** for a mover more than 2 m under the floor, or one no longer in the scene.
     `standIn` reads the mask only between 2 m under the floor's lowest point and 8 m over
     its highest, so the halls 900 m below Edoras and Minas Tirith are left alone.
   - **Blobs on the baked height:** the bake reads its mask back once
     (`heightFromPixels`), so blobs lie on the floor as baked where a world has no height
     function. Minas Tirith's terraces have none.
   - **`keepShadows`:** Invincible's city is 4.3 km across and flown over fast. It keeps
     its own sun shadow pass and bakes only the sky's occlusion, city-wide (mask channel 3,
     so the sun isn't cut), with the bounce.
   - **`castersTop`** counts instanced meshes, which is how Invincible builds its towers.
2. **Fail soft, sooner.** A GPU without `EXT_color_buffer_float` keeps the world's own
   shadow pass. The world isn't changed until it's known the bake can happen.
3. **The resolve turns the picture over**, so that v = 0 is the area's z0 edge, as the
   floor's shader reads it. The offline masks are turned over by being read back and saved.
4. **Matcaps:** the key leaves out colour (a material's colour multiplies a white sphere's
   light). The picture is linear half-float, and the stage's output pass tone-maps the
   frame, matcaps included.
5. **Skipped, with reasons:**
   - **Scranton:** `office/world/ao.js` already paints Bruno-style contact shade on every
     tier, so a bake on top would darken it twice.
   - **Cybertron Roll out:** an endless runner. Its road and land are recycled under the
     convoy, so a mask baked once can't follow.
   - **Cybertron's indoor arena:** its roof shares the ground's material.
   - Instead of Roll out, Cybertron's arena game (Iacon at war and the outdoor areas) is
     grounded: it bakes each area as it's built.
6. **Credit:** the universe map's credits (where every world is opened from), the README's
   Assets and credits, and the module headers. That replaces one line per world.
7. **Floors that share a material with something raised** would have that thing read its
   own footprint. The compound's mast plinths were given their own material.
8. **QA:** `scripts/ground-qa.mjs`. Run it from a copy of the tree. Vite's hot reload of a
   file being edited remounts a world, and the old renderer's deferred `forceContextLoss`
   then kills the shared canvas. That is what lost Bree's context twice while it was being
   wired. On a frozen copy, 2 of 2 runs were clean.
9. **Late fixes from QA:**
   - Weathertop showed Frodo all but black in a hill's dusk shadow. A mover in baked shade
     now keeps 45% of the sun, and the bake lifts low suns to at least 20° (`BAKE_LIFT`;
     the folio's sun stands at about 46°).
   - In C-137, `render()`'s own local `ground` (the road's height) shadowed the handle, and
     the street fell back to cards. The handle is now named `floorLight`.
   - `ground.enabled` switches the whole kit off and back on, for a same-frame A/B
     (`ground-qa --ab`).

### Measured (headless Chromium, SwiftShader)

| world | tier | draw calls before → after | bake |
| --- | --- | --- | --- |
| Avengers compound | low | 271 → 185 (−32%) | 28 passes, 46.7 s in software |
| the Shire (same moment, `--hold`) | mid | 439 → 357 (−19%) | 48 passes, 35.8 s in software |
| Minas Tirith | low | 174 → 171 | 28 passes, 10.8 s |
| the Citadel | low | 94 → 94 (now grounded at all) | 28 passes, 8.0 s |
| C-137 street | low | 78 → 79 | 28 passes, 13.6 s |
| music courtyard | low | 124 → 124 | 28 passes, 6.8 s |
| Tatooine surface | low | 407 → 408 | 28 passes, 23.2 s |
| Invincible (sky only) | low | — | 16 passes, 19.6 s |

Notes on the table:
- **What the draw calls show:** where a world had a shadow pass (the compound on every
  tier, the towns from mid up), it's gone, and the draw count drops by its share. On the low
  tier most worlds had none, and the kit adds one instanced blob draw.
- **Bake times:** software WebGL is two orders of magnitude slower than a GPU. The same
  28–48 passes are a few frames' work on a phone.
- **Smoke:** `autopilot-check --only smoke` passes the core pages, all twelve Middle-earth
  routes, C-137 and Cybertron. The heavy worlds it reports as "no canvas" fail the same way
  on `main`: the world gate holds them on software WebGL. `ground-qa` (with
  `tp-worlds=load`) shows every one of them rendering and baking with no errors.
- **Shots:** `docs/superpowers/shots/2026-10-06-baked-*.webp`.
