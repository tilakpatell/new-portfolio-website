# Plan: the Rick and Morty sector, through a portal

**Problem.** The four Rick and Morty worlds (`universes.js`'s `MOONS`:
Gazorpazorp, Planet Squanch, Bird World, Gear World) sit within a few
hundred units of the Citadel of Ricks (`deep.js`'s wonder at
`[1755, -135, -4660]`), all inside the main map's deep space. Seen from the
Citadel they're a cluster: nothing is a journey, and they clutter the chart
round one wonder. The user wants them *distant*: a galaxy of their own,
reached in a way that fits the show, with real space between the worlds.

**Idea.** A **green portal** hangs in the main map where the Rick and Morty
planet is: fly into it (or pick it on the nav map and go) and the ship
comes out in the **Rick and Morty sector**, a region of space of its own,
far off every other thing on the map (its own origin, out past the rim),
with the Citadel at its heart and the worlds spread on their own spiral,
a thousand and more units apart, as the fandoms are on the main map. The
only way out is the Citadel's own portal (or the nav map's "Back through
the portal"). The precedent is the Star Wars gate: `universes.js`'s
`portal: true` place, `galaxy/gateway.js`'s ring, the scene's `through`.
Here the far side is not another page but another part of the same map,
so every system (ship.js's flight, landings, hunters, traffic, the nav map)
keeps working on plain coordinates.

## What's in the sector

- **The Citadel of Ricks** moved here, at the sector's origin (its parts,
  `CITADEL_PARTS`, go with it; `deep.js`'s wonder entry gets `sector:
  'rickmorty'` and its `at` becomes sector-relative or is placed in
  `layout.js`'s sector frame).
- **The worlds** (`MOONS`, renamed `WORLDS` or kept, kind `'moon'` →
  consider `'sectorworld'`): the four that exist plus room for more from
  the dial (each one has a C-137 destination already and the landing
  system in `landings/`): candidates Cronenberg world, the Purge planet,
  Pluto, Nuptia 4, the Immortality Field Resort, Snake Planet. Add two or
  three now if credits/time allow; the data pattern is `landings/
  rmmoons.js` + `landings/landings.js` entries, and the plan says new ones
  need a model for every figure and set piece (Meshy; scenery in code is
  fine). Spread them on a golden-angle spiral from the sector's origin:
  FIRST ≈ 900, STEP ≈ 450, heights ± 300, so they're beacons on the horizon
  from the Citadel, never neighbours.
- **A wonder or two of the sector's own**: the Central Finite Curve as a
  faint luminous boundary (a ring/dome shader far out, `deepspace.js`
  pattern), and the Galactic Federation's fleet as the sector's traffic
  and hunters (`fleetRickmorty*.js` already has Gromflomite/Federation
  hulls; `hunters.js` factions keyed to the sector).
- **The portal home** beside the Citadel: the same portal object, pointing
  back to the main map's Rick and Morty planet.

## Architecture

### 1. Sectors in `layout.js` (pure)

```js
export const SECTORS = {
  main: { origin: [0, 0, 0], edge: DEEP.edge },
  rickmorty: { origin: [0, 0, -40000], edge: 6000, name: 'The Central Finite Curve' },
};
export const sectorOf = (x, y, z) => (z < -20000 ? 'rickmorty' : 'main');
```
- Every body gets a sector. `POSITIONS` for sector bodies = origin +
  local spiral position. `BODIES` unchanged in shape (ids), so `ship.js`'s
  `PLANETS`/`SOLIDS`/`GOALS`, `deep.js`'s `PLACES`, beacons, the mini-map
  all keep reading `POSITIONS[id]`.
- `MAP_RADIUS` must only count main-sector bodies (the mini-map's scale).
  Add `SECTOR_RADIUS[sector]` for the chart in the other sector.
- `DEEP.edge` becomes per sector: `edgeOf(sector)`; `ship.js step()`'s
  turn-back uses the ship's sector and that sector's origin.
- `nearestStar`/`sunFor` (lighting): add a star for the sector (the
  sector's sun: a wonder `kind: 'star'` placed in it) so its worlds are
  lit from inside the sector, not by the main map's sun 40000 away.

### 2. The portals (`universes.js`, `deep.js`, scene)

- Main map: the Rick and Morty planet keeps its page (`/c-137`) on a
  **crash/dive** as today. Beside it (or in its place, decide by look: the
  planet stays, the portal hangs off its day side at ~2.5 reaches) a new
  body `{ id: 'rmportal', kind: 'portal', portal: true, to: null, sector:
  'main', leadsTo: { sector: 'rickmorty', exit: 'rmportal-back' } }`.
- Sector: `{ id: 'rmportal-back', ... leadsTo: { sector: 'main', exit:
  'rmportal' } }` beside the Citadel.
- Drawing: `planets.js` builds a portal body as a swirling green Rick
  portal (a ring of portal-green plasma; the C-137 page has a portal
  shader/texture to reuse: `rickmorty/portal/`), always facing the camera
  like the gate.
- Transit (scene.js): flying into a `portal` body with `leadsTo` is not a
  crash and not the gate's page jump: a **portal transit**: 0.6 s green
  flash/ripple (the cruiser's portal ripple exists), the ship is set at
  the exit portal's park spot facing away from it, heading kept, speed
  halved, hunters cleared, traffic reseeded for the new sector, the HUD
  says where you are ("Dimension C-137's space"). `emit({ type:
  'sector', id })` so the page/nav/mini-map switch.
- Nav map (`nav.js`/`NavMap.jsx`): `DESTINATIONS` get a `sector`; the list
  shows the current sector's places plus the portal to the other; picking
  a place in the other sector routes **via** the portal (the autopilot's
  `via` already exists: `goalOf`) then on from the exit. `CHART_VIEWS`
  gets the sector chart (square-root scale from its origin). Trip time =
  leg to portal + transit + leg from exit.
- Mini-map: draws the current sector's bodies; a small portal glyph for
  the way back.

### 3. Travel and life inside

- `ship.js`: `driveAt`/`homeAt` are main-sector notions (the home
  system); in the sector the drive is open except near places (`DEEP.near`
  /`ramp` logic by distance to the sector's solids: already generic).
- `hunters.js`/`director.js`: factions per sector (Federation, Gromflomite
  packs, a Council of Ricks patrol near the Citadel). Rifts (`riftExit`)
  stay within the current sector.
- `lanes.js` traffic: `laneLocal` etc. are relative to the place you're
  at: unchanged.
- Landings: `landings/landings.js` entries keyed by id: unchanged.
- `crews.js`/`UniversePanel.jsx`: cards for the sector bodies (the
  rickmorty card fallback exists).

### 4. Tests to update/add (vitest)

- `layout.test.js`: sector positions clear of each other and of the
  Citadel's parts by `REACH`; main `MAP_RADIUS` ignores sector bodies;
  the portals' positions clear of their planets.
- `deep.test.js` moons test → sector test; `scale.test.js` byId lookups.
- `nav.test.js`: a route from the home system to Gazorpazorp goes via
  `rmportal`; `distanceTo`/`tripTime` across sectors finite; autopilot
  arrives (the 25 s allowance was for the clustered moons: re-tune).
- `wars.test.js` clearance (`squanch` was moved for it: with the sector,
  the wars are in the main sector only).
- `landings.test.js` LANDABLE count = bodies with landings.
- New `sector.test.js`: `sectorOf`, transit exit spot clear of solids,
  edge turn-back per sector.

### 5. Order of work (each a PR, merged when CI is green)

1. `layout.js` sectors + move the Citadel and the four worlds into the
   sector + lighting star + tests. The map still works; the worlds are
   just unreachable (edge) for one PR.
2. Portal bodies, drawing, transit in scene.js, HUD line, emit.
3. Nav map and mini-map sector awareness, routing via the portal.
4. Hunters/traffic factions in the sector, Central Finite Curve wonder.
5. More worlds from the dial (models first, landings data, then layout).
6. Docs: `docs/architecture.md` universe section, `README.md` C-137 row
   (the Citadel paragraph), `HANDOFF-universe-*.md` pointer, guide page.

## Rules for whoever builds it

- Branch of your own off `main`; small PRs; `npm run lint`, `npx vitest
  run`, `npm run build`, `node scripts/health.mjs --check --skip build`
  before each push; merge when CI is green. No model identifiers in repo
  artifacts.
- Figures and set pieces are Meshy/Sketchfab models, never shapes; space
  scenery (portals, nebulae, rings) in code is fine.
- Check in a headless browser (`scripts/landing-check.mjs` on port 5173
  for the map; `scripts/c137-shots.mjs` is the C-137 page) and by a
  scripted flight: the ship through the portal, out at the Citadel,
  autopilot to Gazorpazorp, land, back.
- Keep the main map's feel: the fandoms' positions don't move.
