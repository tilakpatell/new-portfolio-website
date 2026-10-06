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
