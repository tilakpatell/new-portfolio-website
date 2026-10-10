# One house look, the Shire first: design

Date: 2026-10-07. Implements the fix order at the end of
`docs/research/2026-10-06-why-theirs-look-expensive.md` (Bruno Simon's folio-2025, Active
Theory, Igloo Inc against this site). The Shire is the flagship: every step lands there first,
then the other worlds move onto the same pieces one at a time.

## Goal

Every world draws through one shading function and one set of shared pieces, so polish in one
place reaches every world. Each world supplies only a small **look**.

## Pieces

1. **The house look** (`src/lib/three/house.js`). A patch, applied last, onto any lit material
   (standard, physical, Lambert, Phong, toon) and onto new materials from `house.material()`.
   It runs after three's own lights, so lamps, the baked floor light (`lib/three/groundwork`),
   shadow maps and occlusion all still count. Per fragment:
   - **litness** `k`: the light three worked out, against what full light (`uLookRef`, from
     the world's sun and sky) would give this albedo;
   - **shade is a colour**: `mix(light, albedo × shadowColour, shade(k))`, where
     `shade = 1 − smoothstep(edge.x, edge.y, k)`. That gives a soft terminator and a tinted
     shadow, never grey. Metals keep their own light (`× (1 − metalness)`). Emissive is added
     back untouched;
   - **fog is the sky**: three's fog factor, but its colour is the sky's along the view ray
     (the horizon below, a horizon-to-zenith gradient above, the sun's halo), so far ground
     melts into the sky exactly.

   A **look** is `{ shadow, edge, mix, fogLow, fogHigh, fogBelow, halo, toneMapping }`.
   `createHouse(look)` returns `{ uniforms, material(opts), adopt(root), set(look),
   light({ sun, hemi }), sky({ low, high, sunDir, halo }) }`. All materials of one world share
   the uniform objects, so a frame updates them once. Neutral tone mapping is the house tone
   mapper.
2. **Ground map** (`src/lib/three/groundmap.js`). A world paints `paint(x, z) → { colour,
   grass }` once into an RGBA picture over its ground (colour in RGB, grass amount in A) plus a
   height picture. One `groundColour` reads it, in the shader and in JS. The ground, the grass
   and the bounce all take their colour from it, so there is no seam between them.
3. **Grass and wind** (`src/lib/three/grass.js`, `src/lib/three/wind.js`). Bruno's grass: one
   triangle a blade, in one draw, wrapped round the camera, its height from the map's grass
   amount, its colour the ground's, its normal up, its root counted as shade. One wind (two
   scrolling noise lookups, a direction and a strength) moves grass tips, flower heads and
   tree crowns together.
4. **Repaint**: Meshy models that clash with a stylised world lose their atlas and take flat
   palette colours sampled from it per vertex (`scripts/flatten-glb.mjs`, offline).
5. **Supersampling**: `minRatio: 1.25` on the high tier (done, PR #421).
6. **Tuning by eye**: `?debug` (in the address or after the hash route) opens a small panel
   bound to the look, the wind and the grass, with a button that copies the values as code.
   The Shire's walking camera narrows from 50° to 38° and pulls back to keep Frodo's size.

## The core kit, then the universe and the big three

Asked for after the first steps: every world wears **shared core textures**, so the worlds read
as one place, with better models; then the universe map's models; then the three larger
universes' models (Rick and Morty, Star Wars, Breaking Bad).

- **Core kit** (`src/lib/three/core.js`): the 20 CC0 Poly Haven scans in `public/cc0/galaxy/`
  (stone, wood, bark, adobe, metal, concrete, rock, grass, sand, mud and the rest), already
  made into detail maps centred on one brightness, become the site's one kit. `wear()` lays a
  scan over any lit material in world space (triplanar) at the scan's real size, so the grain
  is the same density in every world whatever the UVs. `dress(materials, roles)` maps a
  world's named materials onto roles, folding each one's own painted picture into its colour.
  The galaxy's `withDetail` and `loadScan` are now re-exports of it.
- **Models**: `scripts/flatten-glb.mjs` repaints a Meshy atlas in texture space: smoothed of
  the generator's mush, enlarged, and posterised to a few flat colours (optionally pulled to a
  palette). Windows, brick and trim stay as clean flat shapes; the core kit's grain goes on top
  at runtime. Per-vertex flattening (`--vertex`) is kept for dense meshes but loses painted
  detail on coarse ones (the Smith house's walls), so it is not the default. Where it's used:
  Albuquerque's buildings and cars. C-137's models, already drawn as a cartoon with ink
  lines, came out softer (the hoop's red square, the garage door's panels), and the galaxy's
  2K atlases lost real detail (window muntins), so both keep their originals.
- **Order**: the Shire, then each world onto the house look and the core kit (one pull request
  a world, before and after screenshots), then the universe map, then the Rick and Morty,
  Star Wars and Breaking Bad models.

## Rules

- `house.adopt()` goes after `groundTown()` (so its shade replaces the floor's own tint and
  one shadow colour reaches the floor, the statics and the movers).
- The low tier keeps everything but the grass density; nothing here needs a capability a tier
  lacks.
- Pure shader rewrites are tested on stub shaders and on three's shipped chunks, like
  `lib/three/surface.js`.
- Each step is its own pull request, merged when CI is green and a Shire screenshot (software
  WebGL, `scripts/ground-qa.mjs`) shows nothing broken.

## Out of scope

WebGPU, TSL, a port of Bruno's day cycle, new models, and any world's gameplay.
