# Landmarks Implementation Plan (lane E)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every POI on every planet has its buildings, and the clutter is the kits' models: Echo Base's doors and generator on its flat, Mos Eisley's blocks, Kachirho's great tree, Cloud City's towers; trees, rocks and ruins from the Quaternius kits through the existing pools; loaded only when near, freed after, measured in megabytes.

**Architecture:** `landmarks.js` turns a POI into a placement list: where a walkable galaxy site exists, from that site's `places[].things` and `things` (the same specs `galaxy/surface/placer.js` draws), scaled to the flight's POI radius; where none exists, from a list in `landmarkTables.js` (pure) of catalog kinds and kit models. Placements are drawn through `galaxy/surface/placer.js`'s part contract for catalog models and `lib/three/kit.js`'s pools for kit models; `ground.js`'s clutter kinds `trunk`, `rock`, `debris` map to kit models per planet (`clutterKit`), falling back to the code-built shapes on low tier or while a kit loads.

**Tech Stack:** `lib/three/kit.js` (Quaternius pools with LOD and puffs), `galaxy/surface/catalog` and `placer.js`, `rt.assets` with `retain`/`release`, `lib/three/lod.js`.

**Spec:** `docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md` (Pillar 4, decisions 12 and 15); `docs/research/2026-10-09-planet-geographies.md`.

## Global Constraints

- Starts from `main` after lane A merges; touches `src/components/expanse/flight/` and `src/lib/land/flight/landmarkTables.js`, plus `pack.js` and `WORLD_MB['/fly']`.
- The flight world imports `galaxy/surface/placer.js`, `catalog/index.js` and `sites/index.js` as read-only data and builders; it changes nothing in `galaxy/`. (A world may import another through its `index.js`: `docs/health/RULES.md`.)
- A landmark loads only within `LANDMARK_NEAR = 6000` m of its POI and is freed past `LANDMARK_NEAR × 1.3`; a planet's total landmark download at mid is measured and written in `WORLD_MB` as the heaviest planet's figure, with a per-planet table in `pack.js`'s `computed`.
- `look.js` stays `painted`: kit models are flat-shaded; a catalog model with PBR scans is listed in `look.js`'s `why` as the site's own scanned kit (as the galaxy's surfaces do), and `art-mix` in the health budget must not rise (check `node scripts/health.mjs --check --skip build`).
- No new dependency. No model names in code, docs, commits. Commits end with the harness's attribution lines.
- Before the PR: lint, tests, build, health, smoke on `/fly/hoth,/fly/tatooine,/fly/bespin`, `node scripts/perf-probe.mjs --routes /fly/hoth` (the worst frame over Echo Base under 33 ms on mid).

## Review Focus

1. **Flying past a POI at 300 m/s**: the landmark loads in time (prefetch at `LANDMARK_NEAR × 2` through `rt.assets.prefetch`), draws no pop-in within view (puffs first, models after), and is freed without a hitch (dispose spread over frames through `gpuWork`'s slices). Task 3.
2. **A model that fails to load**: the POI keeps its flat and its code-built stand-in; one `console.warn`; no retry storm. Task 2.
3. **Two POIs within 2 km of each other** (Mos Eisley and the Lars homestead are 2.3 km apart): both load, the cap `LANDMARK_CAP = 4` holds the nearest four only. Task 3.
4. **Low tier**: kit models replaced by their puffs beyond 800 m, no catalog model over 20 k triangles, the planet's download under 8 MB. Task 4.
5. **A walkable site's placement list has things that need the site's flats or pits** (Nevarro's town walls follow its river): a placement whose `y` differs from the flight's ground by more than 3 m is dropped, counted, and the count asserted under 10% per site in a test. Task 1.

---

### Task 1: The landmark tables and the site bridge (pure)

**Files:**
- Create: `src/lib/land/flight/landmarkTables.js`, `landmarkTables.test.js`, `src/components/expanse/flight/landmarks.js`, `landmarks.test.js`

**Interfaces:**
- Produces: `LANDMARKS[planetId][poiId] → [{ kind, at: [x, z] (relative to the POI), yaw, scale, opts? }]` for every POI with no walkable site (the note's rows: kinds from `catalog/index.js`'s names and kit model names as `{ kit: 'naturemega', name }`); `placementsFor(spec, poi, { site }) → [{ kind | kit, at (world), yaw, scale, y }]`: from `site.places[].things` and `site.things` within the site's radius mapped onto the flight POI (translate by `poi.at − site.land.at`, rotate by the POI's yaw if the table gives one), else from `LANDMARKS`; `y` from a `heightAt` given.

- [ ] **Step 1: Failing tests**: every planet's every POI has placements (at least 3, at most 80); every `kind` is in the catalog and every `{ kit, name }` in the kit manifest (read `public/kit/*/index.json`); Echo Base's placements come from `sites.hoth` and include the generator and the doors; a placement whose site `y` differs from the given ground by over 3 m is dropped and counted.
- [ ] **Step 2:** FAIL. **Step 3:** Write both. **Step 4:** PASS. **Step 5: Commit** `Every POI's buildings as a placement list, from the walkable sites where they exist`.

### Task 2: Drawing a landmark

**Files:**
- Create: `src/components/expanse/flight/landmarkScene.js`, `landmarkScene.test.js` (a fake placer and kit)

**Interfaces:**
- Consumes: `placementsFor`; `galaxy/surface/placer.js`'s build; `loadKit` from `lib/three/kit.js`; `rt.assets`.
- Produces: `createLandmark(scene, { rt, spec, poi, placer, kit, origin }) → { ready: Promise, group, reanchor(at), dispose() }`; a failed model is a stand-in (the code-built block) and one warn.

- [ ] Tests: builds every placement once; a failing model leaves a stand-in and warns once; `dispose` releases every asset retained; `reanchor` moves the group by the origin shift.
- [ ] Write it; PASS; **Commit** `A landmark drawn and freed`.

### Task 3: The landmark streamer

**Files:**
- Modify: `scene.js`; Create: `landmarkStream.js` (pure: which POIs within `LANDMARK_NEAR`, nearest `LANDMARK_CAP`, prefetch band), `landmarkStream.test.js`

- [ ] Tests: nearest four within reach; a POI leaving reach × 1.3 is dropped; prefetch set is reach × 2.
- [ ] Wire: each frame `update(ship)`, loads and frees landmarks, prefetches assets; on the `origin` event reanchors. Fly Hoth to Echo Base at 300 m/s: the base is there before the ship is. **Commit** `Landmarks stream in as the ship comes near`.

### Task 4: Clutter from the kits

**Files:**
- Modify: `ground.js`, `src/lib/land/flight/planetTables.js` (each planet's `clutterKit`: `{ rock: { kit, name }, trunk: ..., debris: ... }`), `pack.js`, `src/components/worlds/worlds.js`

- [ ] The pools for `rock`, `trunk`, `spire`, `debris` take the kit's model where the planet names one (`kit.pool` with `set`/`free` per leaf), the code-built shape otherwise or on low; a test in `ground.test.js` with a fake kit asserts a leaf's rows go to the kit pool and come back on drop.
- [ ] Measure each planet's download at mid (`scripts/autopilot-check.mjs` reports bytes; or `performance.getEntriesByType('resource')` in a dev probe) and write the heaviest in `WORLD_MB['/fly']` with a comment listing the per-planet figures; `pack.js` lists the kit and catalog folders under `computed`.
- [ ] Screenshots of Echo Base, Mos Eisley, Cloud City, Kachirho, Hobbiton from 300 m. **Commit** `Clutter from the kits, and each planet's download measured`.

### Task 5: Docs and the PR

- [ ] A paragraph in `docs/architecture.md`; the handoff's lane E row. Merge `origin/main`, the checks, push, PR, CI, no merge.
