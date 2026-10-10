# Planet Life Implementation Plan (lane G)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each planet is populated as its fiction says: ships in the air on routes and patrols that scramble at you, herds and predators on the ground, people at the settlements, hostiles at garrisons, nothing on a dead world; the same for every pilot in the same place; under a frame budget.

**Architecture:** `lifeTables.js` (pure) gives each planet its kinds, air, ground and densities from the geographies note; `roster.js` makes a cell's roster from the seed (as `galaxy/surface/ground/population.js` does); `routes.js` lays air routes between POIs; `createLife` streams rosters on a `createChunkGrid` at `NET_CELL` radius 2, keeps per-visit state, and steps brains built on `src/lib/ai` (steer for flocks and herds, utility for patrols, squad for hostiles, `galaxy/surface/hostiles.js` for their fire); the scene draws every kind through instanced pools (ships from the universe's ship kinds, creatures from the catalog where a model exists, code-built figures otherwise).

**Tech Stack:** `src/lib/ai/*`, `src/runtime/chunkGrid.js`, `lib/three/pool.js`, `galaxy/surface/catalog`, `galaxy/hunted.js`'s ship kinds, `lib/three/lod.js`.

**Spec:** `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (Pillar 4, decisions 11 to 14, 17); `docs/research/2026-10-09-planet-geographies.md`, “The life of each world”.

## Global Constraints

- Starts from `main` after lane A merges (lane E's landmarks are not required; a camp without its kit is a flat with figures). Touches `src/lib/land/flight/{lifeTables,roster,routes}.js`, `src/components/expanse/flight/{life,air,brains}.js`, `scene.js`, `FlightHud.jsx`.
- Caps verbatim: `LIFE_CAP = { air: 12, ground: 48 }` per loaded cell, `LIFE_RADIUS = 2` cells, `LIFE_MS = { low: 1, mid: 2, high: 3, ultra: 4 }` ms a frame for brains, round-robin when spent; densities halve on low.
- Pure modules import no three.js; `roster.js` is seeded by `hash(planet seed, cellKey, kind)` and a test pins two calls equal.
- A hostile fires only with `galaxy/surface/hostiles.js`'s rules; damage to the ship goes through the flight's shield path (lane D's `hit`), never straight to `hp`.
- No sequel-trilogy names; the site's own words for every creature and ship line.
- No model names in code, docs, commits. Commits end with the harness's attribution lines.
- Before the PR: lint, tests, build, health, smoke on `/fly/hoth,/fly/coruscant,/fly/dagobah`, `node scripts/perf-probe.mjs --routes /fly/hoth,/fly/coruscant` (the worst frame under 33 ms on mid with Coruscant's lanes full).

## Review Focus

1. **A dead world** (mandalore's `glass`, the Expanse's gas types): the roster is empty, no pool is made, no brain runs; the HUD says nothing. Task 1.
2. **Coruscant's lanes at the cap**: 12 ships a cell × 25 cells = 300 ships in three pools, three draws; the brain budget spreads them over frames; the probe stays under 33 ms. Task 4.
3. **A scramble at 300 m/s**: two patrol ships break off within the radius, hunt with `hunterRules`' shape, give up past `CALM` seconds out of range, and return to their route. Task 4.
4. **A herd at a cell edge**: animals that cross into the next cell are kept by the cell they are in now (`population.js`'s `move`), never doubled, never lost. Task 3.
5. **A brain that throws**: removed for the visit, one warn, the frame goes on. Task 3.

---

### Task 1: The life tables (pure)

**Files:**
- Create: `src/lib/land/flight/lifeTables.js`, `lifeTables.test.js`

**Interfaces:**
- Produces: `KINDS = ['wild', 'settled', 'city', 'hostile', 'dead']`; `LIFE[planetId] → { kinds: { [biomeId]: kind }, air: [{ kind, model, perKm2, alt: [lo, hi], speed, route: 'patrol' | 'lane' | 'shuttle', scramble?: { r, n } }], ground: [{ kind, model, perKm2, group: [min, max], biome?, role: 'herd' | 'predator' | 'patrol' | 'settler' | 'hostile' | 'wander', hostile?: hostiles.js's spec, night?: true }] }`; `lifeFor(spec, sectorPlanet = null) → life` (the table's row, or the Expanse rule from `faction`, `traffic`, `hazard` as the note's last row says); `DENSITY = { low: 0.5, mid: 1, high: 1, ultra: 1.2 }`.

- [ ] Tests: every one of the 50 has a row or a rule; every `model` names a catalog kind, a ship kind, or `'figure'` / `'wedge'`; a `dead` biome has no ground rows that allow it; Expanse `hazard: 'pirates'` gives a hostile air row; no row names a sequel-trilogy ship or creature (a denylist test).
- [ ] Write; PASS; **Commit** `What lives on each planet, as a table`.

### Task 2: Rosters and routes (pure)

**Files:**
- Create: `src/lib/land/flight/roster.js`, `roster.test.js`, `routes.js`, `routes.test.js`

**Interfaces:**
- Produces: `rosterFor(spec, life, cellKey, tier, field) → { routes, air: [{ id, kind, model, row, route: routeId, t0 }], ground: [{ id, kind, model, role, row, at: [x, y, z], yaw, home, group, lift }] }` with the caps (`field` is `planetField`'s `{ heightAt, biomeAt }`: a row keeps to its biomes); `routesFor(spec, life, cellKey, field) → [{ id, row, name, model, route, points: [[x, y, z]...], loop: true, speed, alt, scramble, hostile, anchor, length }]` between the two nearest POIs or the cell's edges, at the kind's altitude band over `heightAt` + the band; `cellKey` on the `NET_CELL` grid.

- [ ] Tests: deterministic; under the caps; a herd's members within the row's `spread` metres (default 30) of their `home` (`group` is the count); no ground row on a slope over 0.7 or inside a POI's flat; a route's points are over ground by at least `alt[0]`; a `hostile` POI gives a patrol route with `scramble`.
- [ ] Write; PASS; **Commit** `A cell's roster and routes, from the seed`.

### Task 3: The life streamer and the brains

**Files:**
- Create: `src/components/expanse/flight/life.js`, `life.test.js` (fake scene), `brains.js`, `brains.test.js`

**Interfaces:**
- Consumes: `createChunkGrid`, `rosterFor`, `src/lib/ai`'s `steer`, `utility`, `squad`, `perception`; `hostiles.js`.
- Produces: `createLife({ spec, life, tier, heightAt, rand, now }) → { update(ship, dt) → { make: [], drop: [], moved: [] }, actors: Map, died(id), isDead(id), stats() }`; `brainFor(actor) → { step(ctx, dt) → intent }` per role: `herd` (cohesion, separation, graze, flee from the ship under 60 m), `predator` (stalk the nearest herd member, lunge, rest), `patrol` (a beat round its home, a stop to look), `settler` (needs at the POI's places), `hostile` (utility over hold, strafe, burst, retreat), `wander`.

- [ ] Tests: cells load round the ship and drop behind with hysteresis; a moved animal is kept by its new cell; dead stays dead for the visit; a throwing brain is removed with one warn; the budget steps round-robin (a test with 200 actors and `LIFE_MS` 0.1 asserts no actor starves beyond 5 frames).
- [ ] Write; PASS; **Commit** `Life streams in by cell and thinks on a budget`.

### Task 4: The air, and drawing everything

**Files:**
- Create: `air.js`, `air.test.js`; Modify: `scene.js`, `FlightHud.jsx`

- [ ] `air.js`: ships on routes (position by `t` along the polyline, banked by the turn), instanced per kind, a patrol's scramble (two ships leave the route, hunt as `universe/hunterRules` shapes it, fire with `hostiles.js`, give up after `CALM = 20` s out of range); test the scramble and the return.
- [ ] Draw: pools per model (catalog models through the placer's parts; ships from the universe's kinds; figures from `galaxy/surface/figures.js` where the model is `'figure'`); LOD bands through `lib/three/lod.js`; shadows off beyond 400 m.
- [ ] HUD: a line when a scramble starts (“Patrol inbound”), a hostile marker on the minimap when lane F is on main (else none).
- [ ] Smoke and probe; screenshots of Hoth (tauntauns and a snowspeeder), Coruscant (lanes), Geonosis (a scramble), Dagobah (nothing but bogwings). **Commit** `Ships in the air and life on the ground, each planet its own`.

### Task 5: Docs and the PR

- [ ] A paragraph in `docs/architecture.md`; the handoff's lane G row. Merge `origin/main`, the checks, push, PR, CI, no merge.

## Where the code disagreed (fixed in lane G's PR)

- **Coruscant's traffic flies over its skyline.** Lane A's city is towers to 620 m on a floor at −330 m, and a route's floor is the ground's, so Coruscant's lanes are 660 to 1,040 m over the floor, not 80 to 420.
- **The rosters and routes take the planet's `field`**, not `heightAt` alone: a row keeps to its biomes, so they need `biomeAt` too. A roster also returns its cell's routes.
- **Models are code-built.** The catalogue's GLBs are scanned PBR and the flight is painted (one art a world, `docs/health/RULES.md`), so a row draws as the galaxy's code-built ship or figure, or a body built in code from its `body` and `tint`; `model` still names the catalogue kind where there is one. One `InstancedMesh` a model, written each frame and grown as needed (`lifeScene.js`), not `lib/three/pool.js`'s fixed slots. Nothing casts a shadow: the flight draws none.
- **Damage waits for lane D.** A hit goes to `createLife`'s `onHit` (clamped to 30), which nothing passes yet; nothing touches `hp`.
- **The caps are per loaded cell**, and the grid keeps a band of up to 30 cells loaded, so Coruscant's lanes peak at 360 ships, not 300.
- **A `flock` role** (bogwings, gulls, bird people, Geonosians on the wing) joins the six; **a row marked `night`** waits for the flight to have a night.
- **Files added:** `lifeScene.js` (the drawing, and `withLife`, scene.js's one call), `lifeNews.js` and `LifeLine.jsx` with `life.css` (the HUD's line, FlightHud.jsx's one call), and `FLY` in `scripts/perf-probe.mjs` (the `fly` journey over any planet).
