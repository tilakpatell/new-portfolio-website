# Handoff: Albuquerque as a city, and the Invincible planet

Session of 2026-10-05. The ask: "Improve the Breaking Bad world and models and make it a proper city. Also the Invincible planet sucks, so really improve that as well."

Scope limit agreed with the owner: the show's character figures (Walt, Jesse, Saul, Gus…) and its branded signage stay as they are; nothing new recreates known characters or the shows' marks. All new buildings, cars, signs and props are original.

## Done (merged)

Albuquerque (`/albuquerque`, `src/components/albuquerque/world/`) is now a city on a street grid instead of a few roads in the sand.

- **`rules.js`** (tested, `rules.test.js`, 35 tests)
  - Grid: N–S streets at x = −240…240 every 60 m, E–W at z = −180…180 every 60 m (`GRID`). Central (16 m, four lanes) and 4th run on out of town to the fence as Route 66 / 4th; the dirt track to the RV runs west off Coal.
  - Dunes now start at r = 310 (`DUNES`), so the whole city is flat.
  - Every place, landmark and `TOWN` building moved onto a block (doors still on a road, still clear of walls). The RV is out west at (−340, 128). Crystals and drops re-placed (most in the desert, four hidden in town).
  - `CITY = planCity(...)`: the generated city. `COLLIDERS` now includes its buildings, yard walls and parked cars; `collidersNear(x, z)` is a spatial hash (use it, not a scan of `COLLIDERS`).
  - Blocks are a kerb (0.14 m) above the street: `onBlock`, `surfaceHeight`. The car is slower on a block (dirt speed), and rides up kerbs.
  - Traffic: `NODES` (every corner), `EDGES` (every stretch), lights on Central and where two boulevards cross (`signalAt`, one 32 s cycle, E–W then N–S), stop signs elsewhere. `createStreets(n)` → Hank (car 0, on `HANK_ROUTE`) plus n cars; `stepTraffic(cars, dt, t, obstacles)` keeps lanes, stops at red and at signs, first-come-first-served at corners (`boxFree`), changes lane on Central or pulls round you when you're stopped in its way. `stepCar(car, input, dt, movers)` bumps off traffic.
  - `hankAt(t)` is kept but no longer drives Hank (the sim does).
- **`plan.js`** (pure): zones per block (`ZONES` in rules: houses, Route 66 strip, downtown core, mid-rise, civic plaza with tower, park, warehouses), lots, buildings (`KIND`: adobe, stucco, brick, glass, concrete, metal, house, garage), car parks with cars, drives, trees, back-yard walls, fountains. Shop names in `SIGNS` are invented.
- **`roads.js`**: asphalt (world-UV, follows the dunes outside town), all markings (Central's double yellow and lanes, boulevards' bike lines, dashed centres, desert edge lines), crosswalks at lights, stop bars, sidewalks with kerb faces, block pads (desert ground material), lots (asphalt with painted bays, concrete, pavers, gravel, lawns).
- **`city.js`**: every building is one instance of a shell geometry sized in the vertex shader, its facade drawn in the fragment shader (windows, lintels, shopfronts, sign bands, garage/roller doors, tower glass that reflects the sky colours, windows lit at night). Plus hip roofs, swamp coolers / AC units, vigas, shop signs (atlas) and awnings, yard walls, trees, street lamps (their heads feed `createNightLights`), traffic lights that follow `signalAt`, stop signs, street-name blades, bus shelters, hydrants, fountains, the power line along Route 66.
- **`vehicles.js`**: six code-built car models (sedan, pickup, SUV, van, lowrider, hatch) from extruded side profiles; one InstancedMesh per kind for both parked and moving cars; head/tail lights glow at night.
- **Merged with main's Aztek handling work (#113)**: `stepCar` is main's sliding model (handbrake, `stepSteer`, driving settings, tyre marks, sounds) with the city added: `collidersNear` for walls, traffic as `movers`, and a block (sidewalk, car park, yard) counts as `'road'` in `surfaceAt`. Its tests run on the new map (56 in `rules.test.js`).
- **`scene.js` / `AbqWorld.jsx`**: wired up; old roads/poles/lamps removed; models and the cast stand on `surfaceHeight`; camera near plane 0.4; shadow box ±58 m; tumbleweeds only in the desert bands; minimap is now north-up round the car with a pre-drawn city layer and the traffic on it.
- **`buildings.js`**: Route 66 arches moved to x = ±254, the two billboards to x = ±272 (just outside town).

## Not done yet (pick up here)

1. **The Invincible planet** (`src/components/universe/planets.js`, `BUILDERS.invincible`, ~line 749). Untouched. Today it's a canvas-painted rust sphere with blobs and stripes, and two dots with trails. Plan that was agreed:
   - Generate proper maps offline like the other planets (`scripts/build-universe-textures.py` is the pattern; a Node + `sharp` script works too): `invincible.webp` / `-sm.webp` albedo from 3D fbm sampled on the sphere (no seam or pole pinch), `invincible-normal.webp`, `invincible-glow.webp` (molten fissures / impact scars / city lights on the night side). Add the names to `PLANET_MAPS` / `FIXED` / `DATA` in `planets.js`.
   - Material like `transformers`/`middleearth` (normal map + emissive map, pulse), a cloud shell like `travel`'s, the halo stays (`rim` colour in `universes.js`).
   - Replace the two dots with comet-like flyers (stretched glowing heads, longer fading trails, an occasional shockwave ring), and add something in orbit: a cracked moon or a debris ring. Keep it original: no characters, logos or suits.
   - The universe map's planet tests: `src/components/universe/*.test.js` (bodies, layout).
2. **Visual QA pass on the city.** Only two street-level screenshots were checked (Central looked right: lanes, crosswalks, signals, trees, traffic, towers). Still to look at: residential streets, the strip blocks with set-back car parks, downtown from above, night (lit windows, sign glow, lamp pools at y 0.19), dawn/noon, the RV out west, Walt's spawn (now parked nose-in on his drive, yaw π, so the camera looks at the house).
   - Headless Chromium with SwiftShader renders ~5 s a frame at `tp-quality=low`, 900×540 (Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` in the cloud sandbox; `playwright-core` is a dev dependency). Set localStorage `tp-intro=1`, `tp-3d=on`, `tp-worlds="load"`, `tp-quality=low` first. Call `window.__ABQ__.api.settle()` or the intro swoop takes minutes. `window.__ABQ__.api.peek([x, y, z], [lx, ly, lz])` (dev only) pins the camera for a screenshot; `peek()` lets it go.
   - Things likely to need tuning: facade shader contrast/colours, sign placement for `PLACES` (computed from door → building in `scene.js`), shop sign heights, tree density, lamp pool size.
3. **Performance.** ~1M triangles before shadows at low quality (trees ≈ 150k, cars ≈ 86k, the city's instanced props, the Meshy models). Fine on a real GPU; for phones consider fewer trees/props when `stage.coarse`, icosahedron detail 0 for canopies, and dropping vigas from shadow casting (already off on `small`).
4. **Docs.** `README.md`'s worlds table line for Albuquerque could mention the city and traffic.

## How to check

- `npx vitest run src/components/albuquerque/world/rules.test.js` (city layout, colliders, traffic for five simulated minutes, red lights, Hank's route, waiting behind you).
- `npm run lint`, `npm test` (1678 tests) and `npx vite build` all passed at merge, on Vite 8 / three r186.
- In the browser (dev): `window.__ABQ__.sim` (car, traffic), `window.__ABQ__.api` (`settle`, `info`, `scene` in dev).
