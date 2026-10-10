# Planet Map Implementation Plan (lane F)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A minimap in the HUD and a full planet map on `M`: the ground's biomes and heights round you, POIs, your ship and heading, other pilots, built things, occurrences and the cell address, drawn from the field itself, nothing stored.

**Architecture:** The terrain worker makes a 32 × 32 raster of biome index and height for a 2 km square (depth 3) as its own job, `type: 'raster'`, asked by the map behind the ground (lane F found the depth-3 square under the ship is split into finer leaves and never asked for itself, so a raster riding a leaf would never come for the ground that matters most); `map.js` keeps rasters in a `Map` keyed by leaf, paints them into an offscreen canvas per raster (once), and composites the minimap (a 240 px disc, north up or heading up by a setting) and the full map (the loaded rasters at 1 px per 16 m, pannable, with a POI list to set a waypoint). Pilots, built things and occurrences come from the world's `pilots()` (lane D's `online.peers()`), `built()` (the loader's `all()`) and `occurrences()` (lane G's streamer) when those lanes add them; until then none. Pure layout and projection in `mapRules.js`.

**Tech Stack:** the HUD kit (`src/runtime/hud/`), a 2D canvas, the terrain worker's protocol.

**Spec:** `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (Pillar 4, decision 16); `docs/health/RULES.md`, “The worlds' HUDs”.

## Global Constraints

- Starts from `main` after lane A merges; touches `src/components/expanse/flight/`, `src/lib/land/flight/mapRaster.js`, the HUD kit only if a part is missing (then a kit part, in `src/runtime/hud/`, with its test, per the kit's rules).
- The minimap is a kit part (`src/runtime/hud/MiniMap.jsx`) at `--hud-under` (from `layoutRows`), on the right under the top row, the guide's corner (bottom right) the other end of that column, 240 px on desktop, 160 on a phone; text on it on glass at 0.78; the key `M` is written once in `src/components/guide/pages.js`.
- The raster is 32 × 32 per 2 km square (`MAP_N = 32`); a raster costs about 10 ms in Node on Hoth (two biome-weight samples a cell), about two of the ground's 33-grid leaves, so the test bounds it at three leaves, not 0.3 ms (which the field can't do); it runs in the worker behind the ground. The minimap repaints at most 10 times a second, the full map at once on a pan and 4 times a second otherwise (the ship, the pilots and squares coming in move under it).
- Numbers go to the elements through refs, never React state (the kit's rule).
- No model names in code, docs, commits. Commits end with the harness's attribution lines.
- Before the PR: lint, tests, build, health, smoke on `/fly/hoth` and `--phone`, `node scripts/perf-probe.mjs --routes /fly/hoth` with the map open.

## Review Focus

1. **A raster for a leaf that arrives after the ship moved 10 km**: kept (rasters are small) up to `MAP_KEEP = 256` leaves, oldest dropped, so the full map fills in behind you. Task 2.
2. **The origin shifts**: the map is in world coordinates, so nothing moves; a test projects a point before and after a shift. Task 2.
3. **A phone**: the minimap is 160 px, the full map pans by touch, the POI list is tappable at 44 px rows. Task 3.
4. **A POI with the same name twice** (two Imperial outposts): the list shows both with their bearing and distance. Task 3.
5. **Heading-up mode**: the ship stays centred and the raster rotates; POI labels stay upright. Task 2.

---

### Task 1: The raster in the worker

**Files:**
- Create: `src/lib/land/flight/mapRaster.js`, `mapRaster.test.js`, `src/components/expanse/flight/mapWorker.test.js`; Modify: `terrain.worker.js` (a `type: 'raster'` job answers `{ key, biome: Uint8Array, height: Float32Array }`, transferred)

**Interfaces:**
- Produces: `MAP_N = 32`, `MAP_DEPTH = 3`, `rasterFor(field, leaf, n = MAP_N) → { biome, height }` sampling `field.biomeAt` and `heightAt` at cell centres.

- [x] Tests: a flat field gives constant height; biome indices are under `spec.biomes.length`; the worker answers a raster job with the raster and a leaf as before; a raster costs under three of Hoth's finest leaves.
- [x] Write; PASS; **Commit** `Each 2 km leaf comes with a map raster`.

### Task 2: The map rules and the minimap

**Files:**
- Create: `src/components/expanse/flight/mapRules.js`, `mapRules.test.js`, `map.js`, `MiniMap.jsx` (through the kit's frame)

**Interfaces:**
- Produces: `project(world, { centre, scale, headingUp, heading }) → [px, py]`; `visibleLeaves(centre, radiusPx, scale) → keys`; `biomeColour(spec, index, height) → '#rrggbb'` (the biome's palette, darkened by height below the biome's base, lightened above); `createMap({ spec }) → { put(leafKey, raster), drawMini(ctx, state), drawFull(ctx, state, { pan, scale }), markers(state) → [{ kind, at, label }] }`.

- [x] Tests: projection round-trips; heading-up rotates the raster not the labels; `MAP_KEEP` holds; colours are the spec's palette; the cell address text is `cx,cz` of `NET_CELL`.
- [x] Wire the minimap into `FlightHud.jsx` by `layoutRows`; repaint at 10 Hz from `requestAnimationFrame` through a ref. **Commit** `A minimap drawn from the ground itself`.

### Task 3: The full map

**Files:**
- Create: `PlanetMap.jsx`; Modify: `FlightHud.jsx`, `src/components/guide/pages.js` (the key)

- [x] `M` opens it over the world (the frame's `pointer-events` back on inside the card), pan by drag or touch, zoom by wheel or pinch (two steps), the POI list on the right with bearing and distance, a tap sets a waypoint (a marker on the minimap and a bearing line on the HUD's top row), `Esc` closes. Pilots as dots with callsigns, built things as squares, occurrences as the life streamer's icons when lane G is on main (else none; a test covers both).
- [x] Smoke with `--phone`; screenshots of the map on Hoth, Coruscant and Tatooine (`docs/superpowers/shots/2026-10-09-planet-map/`). **Commit** `The planet map, with waypoints`.

### Task 4: Docs and the PR

- [ ] A paragraph in `docs/architecture.md`; the handoff's lane F row. Merge `origin/main`, the checks, push, PR, CI, no merge.
