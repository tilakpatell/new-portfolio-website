# Handoff: the fandoms' planets on the universe map

The planets outside the Star Wars galaxy, as the universe map shows them from space, and the things on their orbits. Branch `claude/non-star-wars-worlds-textures-a2d594`.

## Done

- **The bake.** `scripts/build-fandom-planets.mjs` runs a baker per planet from `scripts/planets/`, on a shared kit (`sphere.mjs`). Each map is baked at 4096 and ships in lib/detail's three sizes: 2048 (`-hq`, a strong card), 1024 (a desktop) and 512 (`-sm`, a phone or a weak device). Night lights, glow, roughness and Breaking Bad's clouds stop at 1024. `scripts/build-universe-textures.py` no longer writes these planets.
- **Middle-earth.** Tolkien's Third Age map, from `middleearth-geo.mjs` on the same 800×560 sheet as `src/components/middleearth/mapData.js`. It has the coasts, the ranges, the rivers, the forests and the lands, plus night lights, Orodruin's glow, the Eye and Minas Morgul. Mordor's smoke sits on a cloud layer that turns with the ground.
- **Breaking Bad.** New Mexico, with the Rio Grande past Albuquerque. The city's grid and the Big I light up at night.
- **The Caribbean.** Banks, reefs and island arcs, plus Tortuga, the maelstrom, a hurricane and Isla de Muerta's fog.
- **C-137.** An alien world in the show's inked cel style.
- **The Office.** A crumpled sheet of Dunder Mifflin letterhead, with faceted geometry, kept inside the sphere's radius.
- **Music and Marvel.** Recoloured from Solar System Scope's 4096-wide maps.
- **The rim glow.** It now uses `nonPerturbedNormal`, so relief no longer lights up in the rim colour.
- **The props.** `src/components/universe/props.js` makes the Stones, Blue Sky's shards, the element tiles and the mug. The Ring is `middleearth/ringShape.js`, shared with the Ring page.

## Sharp and accurate (2026-10-07, Lane 1 of `plans/2026-10-07-planets-and-universe-upgrade.md`)

- **Maps by distance** (#488). `nearMaps.js` loads a planet's finer set (`planetMaps.js`'s `nearSet`) when the camera comes within six radii, swaps it in place (`swapMaps`: the material's slots and the hooks' uniforms) and drops and disposes it past 7.5, at most two planets at once, the furthest dropped. A set that lands after the ship has gone is freed, not installed. A desktop wears the `-hq` copies near, a weak card's desktop the standard set over its `-sm`; nothing on low or a phone. `planets.js`'s maps table and loader moved to `planetMaps.js`.
- **4096 on ultra** (#498). The seven baked planets' colour maps ship as `-xl` 4096 KTX2 (UASTC, flipped at the bake; `save`'s `[4096, '-xl']` row through `scripts/ktx2.mjs`'s `encodeImage`), worn near on ultra only, with the `-hq` it already wears as the fallback. All are 0.7 to 5.7 MB; Breaking Bad and Music needed rate-distortion 3 to get under 6 MB, none needed ETC1S. `PLANETS_XL=only` bakes just them, `PLANETS_XL=skip` all but them. basisu doesn't write the same bytes twice, even single-threaded, so a rebake shows them changed.
- **The sphere near** (#498). Near, the sphere and its cloud layer go from 64 × 40 segments to 160 × 100 (96 × 60 on mid): the limb is a curve, not chords. The Office keeps its own crumpled shape.
- **Breaking Bad is New Mexico** (#504). `breakingbad-geo.mjs`: the real state in degrees (rivers, twenty-five ranges, volcanoes, the Valles Caldera, White Sands, the lava, the Llano, the plains, the Chihuahuan, the plateau, the Gila, Albuquerque and the Big I, the interstates, twenty-nine towns) on a sheet in km round Albuquerque, put on the globe by Middle-earth's projection. The valley's green reads 0.26 in luminance against the mesa (the bake prints it).
- **The Caribbean is the real Antilles** (#506). `caribbean-geo.mjs`: Cuba, Hispaniola, Jamaica, Puerto Rico, the Bahamas, Trinidad and the Americas round the basin traced in degrees, fifty-eight small islands, fifteen banks with how shallow each is, the mountains, Tortuga, Port Royal and Isla de Muerta. Turquoise rims and reefs round every island, the Bahamas' banks pale, the trenches darkest, Haiti browner than the Dominican side. The maelstrom moved out east of Barbados.
- **The Office reads** (#508). "Dunder Mifflin", "Paper Company, Inc." and the Slough Avenue address in navy on `#f1ead8`, the title block a sixth of the ball's height; fourteen ruled lines, a coffee ring, the World's Best Boss mug's ring; eight long folds in the map and twelve deep cuts in the shape instead of hundreds of small ones.
- **Middle-earth** (#509). Harad's ranges are offset, broken ridges (item 2 below, done); the Ephel Dúath bends round the Morgul Vale and along the south (item 3, done); the forests are a canopy of crowns at three sizes; the `-hq` relief is at twice the strength.
- **Evidence.** `poses.js` has `middleearth`, `breakingbad` and `office` at 2.4 radii; `scripts/universe-check.mjs --near off` measures without the near maps (a DEV `localStorage` switch in `nearMaps.js`), and waits for them to land otherwise. Measured 2026-10-07 (headless Edge in software, 1280 × 720, `--frames 5`), near maps on against off on the same tree:

  | Tier | middleearth | breakingbad | office | caribbean | rickmorty | middleearth-limb |
  |---|---|---|---|---|---|---|
  | high | +0 calls, +78k tris | +0, +80k | +0, +0 | +0, +80k | +0, +80k | +0, +78k |
  | mid, low | the near maps don't run (a mid-tier device counts as small); four poses match exactly, the two Middle-earth poses differ by a few calls and up to 15k triangles of the scene's moving traffic between runs | | | | | |

  The plan's budget is +40 calls and +0.35 M triangles on high, +0 on low.

## Left

1. **Texture memory.** Done by the near maps above. What's left: ultra still loads the `-hq` set up front for every planet (as before); it could load the standard set and wear the `-hq` near too, if a strong card's memory ever bites (the sun and the sky would need their `-hq` kept up front).
2. **Harad's made-up ranges.** Done (#509).
3. **Mordor's walls.** Done (#509).
4. **The landings.** Done (2026-10-07, Lane 3 of `plans/2026-10-07-planets-and-universe-upgrade.md`). A landing reads its biome off the planet's colour map under the spot (`landings/biomes.js`; each planet's `biomes` in `landings.js`), so Mordor is ash under a red sky with Orodruin and Barad-dûr on the skyline, Harad is sand, the mountains rock and snow, the old forests dark; Breaking Bad has Albuquerque (by place, at the bake's city), White Sands, the malpais and the ranges; the Caribbean Tortuga (by place), a reef flat and the beach; Invincible the badlands; C-137 the purple hills; Earth the ice. A spot over the sea moves on to the nearest land (`towardLand`). Left: Lane 1's rebakes (#504, #506) moved things: Albuquerque now sits at the sheet's middle (35.08° N on the globe, the same face as before) and Tortuga at the real 20.04° N, 72.8° W on the chart, which lands on the globe at about 20° and +8.6° (π + 0.15 rad, the old turtle was π + 0.08), so the Tortuga biome's `near: [20, 4.6, 3]` wants to be `[20, 8.6, 3]` (Lane 3 told), and White Sands and the malpais now have contrast in the `-sm`. A DEV `?spot=lat,lon` forces where you come down (`scripts/landing-check.mjs --spot`).

## Checking it

- `node scripts/build-fandom-planets.mjs [id …]` rebakes. The ids are `middleearth`, `breakingbad`, `caribbean`, `rickmorty`, `office` and `giants`. `giants` fetches once into `node_modules/.cache/universe`.
- `/scripts/preview/planets.html?id=middleearth&spin=0&yaw=-0.5&pitch=0.4&turn=-2.07&dist=2.2` shows a planet through the dev server. Use `turn` to choose which side faces the key light, and `window.__planets.follow(test | object3D, distance)` to look at something on an orbit.
- In the map, open the nav map (`M`), pick the planet and jump.
- On Windows, two things fail that CI doesn't hit. `src/runtime/shading.test.js` and `src/data/changes.test.js` build paths from `URL.pathname`. `vite build` resolves `components/music/Harmonium` to `harmonium.js` on a case-insensitive disk.
