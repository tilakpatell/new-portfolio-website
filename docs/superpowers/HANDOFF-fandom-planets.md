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

## Left

1. **Texture memory.** Every planet's maps load up front (`loadTextures`). Only a strong card ('ultra') gets the 2048 set: 13 maps, about 145 MB with mipmaps. If that budget bites, load each planet's maps only as it comes near. That means `buildPlanet` taking a lazy getter and swapping the material's maps in when they arrive.
2. **Harad's made-up ranges.** At parking distance they read as smooth sausages (`RANGES` in `middleearth-geo.mjs`). They'd look better as broken ridges, for example two or three offset strokes each.
3. **Mordor's walls.** The polygon in `LANDS.mordor` is nearly square. A few more points along Ephel Dúath's bend would round it.
4. **The landings.** Done (2026-10-07, Lane 3 of `plans/2026-10-07-planets-and-universe-upgrade.md`). A landing reads its biome off the planet's colour map under the spot (`landings/biomes.js`; each planet's `biomes` in `landings.js`), so Mordor is ash under a red sky with Orodruin and Barad-dûr on the skyline, Harad is sand, the mountains rock and snow, the old forests dark; Breaking Bad has Albuquerque (by place, at the bake's city), White Sands, the malpais and the ranges; the Caribbean Tortuga (by place), a reef flat and the beach; Invincible the badlands; C-137 the purple hills; Earth the ice. A spot over the sea moves on to the nearest land (`towardLand`). Left: Breaking Bad's current map is soft at the `-sm` size, so White Sands and the malpais rarely come up until Lane 1's New Mexico rebake gives them contrast; if a rebake moves Tortuga or Albuquerque, move the biome's `near` with it. A DEV `?spot=lat,lon` forces where you come down (`scripts/landing-check.mjs --spot`).

## Checking it

- `node scripts/build-fandom-planets.mjs [id …]` rebakes. The ids are `middleearth`, `breakingbad`, `caribbean`, `rickmorty`, `office` and `giants`. `giants` fetches once into `node_modules/.cache/universe`.
- `/scripts/preview/planets.html?id=middleearth&spin=0&yaw=-0.5&pitch=0.4&turn=-2.07&dist=2.2` shows a planet through the dev server. Use `turn` to choose which side faces the key light, and `window.__planets.follow(test | object3D, distance)` to look at something on an orbit.
- In the map, open the nav map (`M`), pick the planet and jump.
- On Windows, two things fail that CI doesn't hit. `src/runtime/shading.test.js` and `src/data/changes.test.js` build paths from `URL.pathname`. `vite build` resolves `components/music/Harmonium` to `harmonium.js` on a case-insensitive disk.
