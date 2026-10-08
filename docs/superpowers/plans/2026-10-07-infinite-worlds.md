# Infinite Worlds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Worlds that install once and open from the device, space loaded in cells through shared runtime services, an endless seeded universe past the authored map, and saves in IndexedDB with a registry of the visitor's worlds, shareable by seed.

**Architecture:** Three new runtime services (`rt.chunks`, `rt.workers`, `rt.origin`) generalise Minecraft's chunk loop; a build-time pack per world plus a passive service worker gives the install; `rt.store` over IndexedDB holds a world registry and the saves that grow; the Expanse generates sectors, systems, planets, lanes and surfaces from a 64-bit seed and draws them with the universe map's existing pieces. Shared worlds ride the Nostr relays as replaceable events.

**Tech Stack:** Vite 8 (rolldown), React 19, three 0.186, Vitest, Web Workers, Cache API + service worker, IndexedDB, Nostr (NIP-01, NIP-78) over `@noble/secp256k1`.

**Spec:** `docs/superpowers/specs/2026-10-07-infinite-worlds-design.md`

## Phases and sessions

One phase is one pull request from one session. Order and parallelism are in the spec's table. Phase 0 is the existing `docs/superpowers/plans/2026-10-07-smooth-worlds.md`, run as written; this plan starts at Phase 1. Phases 1, 2 and 3 may run at once on branches `claude/infinite-worlds-p1`, `-p2`, `-p3`; Phase 4 branches from main after 3 merges; 5 after 4; 6 after 2 and 4.

## Global Constraints

- Pure modules in `src/runtime/` and `src/components/expanse/gen/` import no three.js and are tested in Node.
- Save keys keep their names: `tp-mc`, `tp-pilot`, `tp-gcw` unchanged.
- Every runtime module is `shading: 'glsl'` (`src/runtime/shading.test.js`).
- Before a PR: `npx eslint .`, `npx vitest run`, `npx vite build`, `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes <touched routes>`.
- Constants from the spec, verbatim: `SECTOR = 80000`, `ORIGIN_CELL = 50000`, `CELL = 64` (surface metres), `UNIVERSE_SEED = 'tilakverse'`, Nostr kind `30078`, delta part cap `60 * 1024` bytes, systems per sector `8..24`.
- The service worker precaches nothing and intercepts only URLs listed in an installed pack.
- No model names in code, comments, commits or docs. Commits end with the harness's attribution lines.

## Review Focus

1. **Install interrupted mid-file** (tab closed at 40%): the next Install must resume with only the missing files fetched and the bar starting where bytes already cached say. Test in Task 1.4.
2. **A pack's file changed on deploy** (same URL, new hash): the old cached file must not be served for the new build. Test in Task 1.2 (hash in manifest) and 1.4 (version compare).
3. **IndexedDB unavailable** (private window in some browsers, quota denied): `rt.store` must fall back to memory and `rt.saves`, and Minecraft must still save the seed. Test in Task 2.1.
4. **A late worker answer for a dropped cell or an older seed** must be discarded, never drawn. Test in Task 3.1 and 3.2.
5. **Two neighbouring sectors must agree on their shared trunk lane** without either knowing the other's full contents. Test in Task 4.3.

---

## Phase 1: Install packs

### Task 1.1: Pack declarations

**Files:**
- Create: `src/components/<world>/pack.js` for each key of `WORLD_MB` (`src/components/worlds/worlds.js:13-30`); the world's folder is the one its page imports (`src/App.jsx:26-45`, `src/pages/*`).
- Create: `src/components/worlds/packs.js`
- Test: `src/components/worlds/packs.test.js`

**Interfaces:**
- Produces: `export const PACK = { id: '/earth', pages: ['src/pages/Earth.jsx'], src: ['src/components/earth', 'src/pages/Earth.jsx'], urls: ['/models/earth/...glb'], globs: ['/textures/earth/*'] }` per world (`pages`: the page modules whose chunks the build adds; `src`: what the pack check scans; `computed`, optional: folders the source only builds paths in, `${DIR}/${name}.glb`, whose used files the pack lists rather than the whole folder; the file imports nothing, so Node reads it); `packs.js`: `export const PACKS = { [to]: PACK }`, `export const packFor = (pathname) => PACK | null` (longest prefix, as `worldAt`).

- [ ] **Step 1: Failing test** `packs.test.js`: `every WORLD_MB route has a pack with the same id`; `packFor('/dot-matrix/minecraft').id === '/dot-matrix/minecraft'`; `packFor('/about') === null`.
- [ ] **Step 2: Run** `npx vitest run src/components/worlds/packs.test.js`. Expected: FAIL, module missing.
- [ ] **Step 3: Write each `pack.js`** from the world's source: every string literal starting `/models/`, `/textures/`, `/audio/`, `/hdri/`, `/hq/`, `/cc0/`, `/mc/`, `/n64/`, `/games/` in that folder, folders as globs. Write `packs.js`.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `feat(worlds): declare each world's pack`.

### Task 1.2: The pack check and the manifest builder

**Files:**
- Create: `scripts/pack-check.mjs`, `scripts/pack-check.test.mjs`
- Create: `scripts/packs.mjs`, `scripts/packs.test.mjs`
- Modify: `vite.config.js`: `packs()` from `scripts/packs.mjs` as a build plugin beside `prerender()`, so `vite build` alone writes the packs (the repo's checks run `npx vite build`, not `npm run build`); `package.json` unchanged.

**Interfaces:**
- `pack-check.mjs`: `export function undeclared(srcDir, pack) → string[]` (asset URLs in source not covered by `urls` or `globs`); CLI exits 1 listing them.
- `packs.mjs`: `export async function buildManifest(pack, { dist, publicDir, chunksOf }) → { v, id, bytes, files: [{ url, bytes, hash }] }`; `hash` = first 16 hex of SHA-256 of the file; `chunksOf(id)` returns the JS/CSS chunk URLs reachable from the world's page module, read from `dist/.vite/manifest.json` (set `build.manifest: true` in `vite.config.js`). CLI writes `dist/packs/<slug>.json` (slug: `to` with `/` → `-`, leading `-` dropped) and `dist/packs/index.json` (`{ [to]: { slug, bytes, v } }`), `v` = hash of the sorted file hashes.

- [ ] **Step 1: Failing tests**: `undeclared` finds `/models/x.glb` in a fixture source and not one covered by a glob; `buildManifest` on a fixture dist yields `bytes` as the sum and a stable `v` across two runs, a different `v` when one file's bytes change.
- [ ] **Step 2: Run**, expect FAIL.
- [ ] **Step 3: Implement** both; glob matching with a small matcher of its own (`path.matchesGlob` is experimental in Node 22).
- [ ] **Step 4: Run** tests, then `npx vite build && ls dist/packs`. Expected: one JSON per world plus `index.json`; `node scripts/pack-check.mjs` exits 0 (fix any pack it names).
- [ ] **Step 5: Commit** `build: pack manifests and the pack check`.

### Task 1.3: The service worker

**Files:**
- Create: `public/sw.js`
- Create: `src/lib/sw.js` (`registerWorker()`: registers `/sw.js` once, as a classic worker (module service workers are not in every browser), only for a visitor with a pack installed or installing, unregistered with the last pack; no-op in development and when `navigator.serviceWorker` is absent)
- Modify: `src/main.jsx`: call `registerWorker()` after render.
- Test: `src/lib/sw.test.js` (registration is called once with `/sw.js`), `scripts/sw-check.mjs` (Playwright: after install of `/earth`, a reload serves one of its GLBs with `response.fromServiceWorker === true`).

**Interfaces:**
- Cache names `tp-pack-<slug>-<v>`. The worker reads `caches.keys()` on `fetch`: a request whose URL is in any `tp-pack-*` cache is answered from cache, else `fetch(event.request)`. It serves no cache whose `v` is not the one `/packs/index.json` lists (read on wake, at most every five minutes) and deletes nothing (the installer drops an old version once the new one is whole, carrying over the files whose hash held). Never handles `wss:`, never handles navigation requests.

- [ ] **Step 1:** write `sw.test.js`, run, FAIL.
- [ ] **Step 2:** implement `public/sw.js` and `src/lib/sw.js`.
- [ ] **Step 3:** `npx vitest run src/lib/sw.test.js` PASS; `npx vite build && npx vite preview` and `node scripts/sw-check.mjs` PASS (the check installs through Task 1.4's API; write the check now, run it after 1.4).
- [ ] **Step 4: Commit** `feat: a passive service worker for installed packs`.

### Task 1.4: `runtime/install.js`

**Files:**
- Create: `src/runtime/install.js`, `src/runtime/install.test.js`
- Modify: `src/runtime/index.js` (expose `install` on `rt`); the fetch and caches bindings are `install.js`'s `installer()` (not `browser.js`, which brings three.js, and the gate needs the installer before any world mounts)

**Interfaces:**
- `createInstaller({ fetch, caches, storage, concurrency = 4, now }) → { installed(to) → Promise<{ v, bytes } | null>, install(to, { onProgress }) → Promise<{ v, bytes }>, uninstall(to) → Promise<void>, estimate() → Promise<{ used, quota }> }`.
- `install`: GET `/packs/index.json`, then the manifest; open `tp-pack-<slug>-<v>`; for each file not already `cache.match`ed, fetch and `cache.put`; `onProgress({ done, total, files, left, eta })` where `eta` is seconds from the running rate; ask `storage.persist()` once on the first install (remember in `tp-worlds-persist`); on success delete older `tp-pack-<slug>-*` caches. A failed file rejects after 3 tries with the URL; already-cached bytes are kept.
- `installed`: the cache with the index's current `v` exists and holds every file in the manifest.

- [ ] **Step 1: Failing tests** with fake `fetch`/`caches`: fresh install puts every file, progress ends at `done === total`; a second call with 3 of 10 files cached fetches 7 and its first progress `done` equals those 3 files' bytes; a new `v` in the index makes `installed` null and install deletes the old cache after; a 404 file rejects with its URL after 3 tries.
- [ ] **Step 2:** run, FAIL. **Step 3:** implement. **Step 4:** run, PASS; run `scripts/sw-check.mjs`, PASS.
- [ ] **Step 5: Commit** `feat(runtime): install a world's pack into the cache`.

### Task 1.5: The gate becomes the install card; `/worlds` lists installs

**Files:**
- Modify: `src/components/worlds/WorldGate.jsx`, `worldgate.css`
- Create: `src/pages/Worlds.jsx`, `src/components/worlds/InstalledList.jsx`, `installed.css`
- Modify: `src/App.jsx` (route `/worlds`, lazy), `src/components/Nav.jsx` or `GuidePanel.jsx` (one link, where `WorldSwitcher` lists worlds)
- Test: `src/components/worlds/WorldGate.test.jsx` (new: card shows `Install · 184 MB · about 2 min` from a fake `rt.install` and `index.json`; after `install` resolves it shows `Open`; a pack under 8 MB on a desktop shows `Open` at once), `src/pages/Worlds.test.jsx` (lists installed slugs with sizes, Remove calls `uninstall`).

**Interfaces:**
- The time estimate: `minutes = round(bytes / (1.5 MB/s) / 60)` shown as `about N min`, under 1 as `under a minute` (rounded: 184 MB is about 2 min, as the test says).
- A desktop (the old gate's `ask` false) is not held: a heavy world not installed offers Install in a pill beside the guide button, so the QA scripts and every visitor's way in stay as they were; a light one opens at once.
- `WorldGate` keeps `WHY` warnings and `Hold3D`; the hold lifts on Open. Keyboard: Install and Open are buttons; progress is `role="progressbar"` with `aria-valuenow`.

- [ ] **Step 1:** failing tests. **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS; `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /worlds,/earth`.
- [ ] **Step 5: Commit** `feat(worlds): install, then open; the worlds page`.
- [ ] **Step 6:** PR `claude/infinite-worlds-p1` → main.

## Phase 2: The store and the registry

### Task 2.1: `runtime/store.js` over IndexedDB

**Files:**
- Create: `src/runtime/store.js`, `src/runtime/store.test.js` (uses `fake-indexeddb` as a devDependency; add it)
- Create: `src/runtime/local.js` (the page visit's one `rt.saves` and one store, made with `indexedDB` when present, so `/worlds` reads them without a runtime; `browser.js` is the lazy three.js half and does not hold it)
- Modify: `src/runtime/index.js`, `runtime.js` (`rt.store`)

**Interfaces:**
- `createStore({ indexedDB, name = 'tp-store', version = 1, fallback }) → { get(table, key) → Promise<any>, set(table, key, value) → Promise<void>, remove(table, key), list(table, { prefix }) → Promise<[key, value][]>, ready → Promise<'idb' | 'memory'> }`. Tables: `saves`, `worlds`, `blobs`. No call ever throws: on a failed open it resolves `'memory'` and keeps a `Map`; `fallback` (an `rt.saves`-like `{get,set}`) mirrors `saves` rows under `tp-store:<key>` when in memory mode so a seed survives a reload.

- [ ] **Step 1:** failing tests: round trip; `list` by prefix sorted; `ready` is `'memory'` when `indexedDB` is undefined and `set` then `get` still works; a value of 2 MB round-trips.
- [ ] **Steps 2-4:** FAIL, implement, PASS.
- [ ] **Step 5: Commit** `feat(runtime): an IndexedDB store with a memory fallback`.

### Task 2.2: The world registry

**Files:**
- Create: `src/components/worlds/registry.js`, `registry.test.js`

**Interfaces:**
- `createRegistry(store) → { list() → Promise<World[]>, add({ kind, seed, name, route }) → Promise<World>, touch(id), rename(id, name), remove(id), get(id), exportWorld(id) → Promise<{ world, save }>, importWorld({ world, save }) → Promise<World> }`.
- `World = { id, kind: 'minecraft' | 'pocket' | 'planet', seed, name, route, created, played, size, thumb: Blob | null }`; `id` = `${kind}:${seed}`; the save of a world is `store.get('saves', id)`.
- `worldUrl(world) → string`: `/dot-matrix/minecraft?world=<seed>` for `minecraft`, `/universe?seed=<seed>` for `pocket`, `/universe/expanse/<seed>` for `planet`.

- [ ] **Steps 1-4:** tests (add then list sorted by `played` desc; rename; remove drops its save; export/import round-trips a save), FAIL, implement, PASS.
- [ ] **Step 5: Commit** `feat(worlds): a registry of the visitor's worlds`.

### Task 2.3: Minecraft saves move to the store; many worlds by seed

**Files:**
- Modify: `src/components/minecraft/module.js:104-145` (register, `persist`, `begin`), `src/components/minecraft/Minecraft.jsx` (reads `?world=` → `props.seed`; a new game registers the world)
- Modify: `src/components/minecraft/rules/save.js` (no format change; `SAVE_VERSION` stays 1)
- Test: `src/components/minecraft/module.test.js` (new: with a `tp-mc` value in `rt.saves` and nothing in the store, create() copies it to `store.set('saves', 'minecraft:<seed>')` once and plays it; with `?world=42` it loads `minecraft:42`; `persist` writes the store, not `localStorage`)

**Interfaces:**
- Consumes: `rt.store` (2.1), `createRegistry` (2.2).
- The migration: on first create, if `rt.saves.get('tp-mc')` exists and the store has no row, write it as `minecraft:<its seed>`, register the world named `My first world`, and leave `tp-mc` in place (read-only from now).

- [ ] **Steps 1-4:** tests, FAIL, implement, PASS. Browser: `/dot-matrix/minecraft`, dig, reload, the hole is there; `/dot-matrix/minecraft?world=7` is a different world; both appear on `/worlds`.
- [ ] **Step 5: Commit** `feat(minecraft): saves in the store, one world per seed`.

### Task 2.4: `/worlds` My worlds

**Files:**
- Create: `src/components/worlds/MyWorlds.jsx`, `myworlds.css`
- Modify: `src/pages/Worlds.jsx` (1.5's page, or create it here if Phase 1 has not merged: the page is two lists, this one first)
- Test: `src/components/worlds/MyWorlds.test.jsx`: lists registry rows with name, kind, played; New world → seed input (blank: random) and Create goes to `worldUrl`; Rename, Delete (confirm), Export (downloads JSON `tp-world-<id>.json`, the id's `:` made `-`: `tp-world-minecraft-42.json`), Import (file input).

- [ ] **Steps 1-4:** tests, FAIL, implement, PASS; smoke `/worlds`.
- [ ] **Step 5: Commit** `feat(worlds): my worlds`. **Step 6:** PR `claude/infinite-worlds-p2`.

## Phase 3: Chunk services

### Task 3.1: `runtime/chunkGrid.js`

**Files:**
- Create: `src/runtime/chunkGrid.js`, `chunkGrid.test.js`

**Interfaces:**
- `createChunkGrid({ size, radius, inFlight = 8, hysteresis = 1 }) → grid`.
- `grid.update({ x, z, heading = null, radius? }) → { ask: Key[], drop: Key[], cancel: Key[] }`: `ask` is cells within `radius` (Chebyshev, in cells) not loaded and not in flight, sorted by distance then by alignment with `heading` (a cell ahead before one behind at the same distance), capped so flying plus asked never exceeds `inFlight`; `drop` is loaded cells beyond `radius + hysteresis`; `cancel` is flying cells now beyond `radius`. `grid.cells(x, z, { radius, heading })` is the ordered window (with no heading, Minecraft's `wantedChunks` order); `grid.unload(key)`.
- `grid.began(key, gen)`, `grid.done(key, gen) → boolean` (false, and ignored, when `gen !== grid.gen` or the key was dropped meanwhile), `grid.failed(key)`, `grid.reset(gen)` (new seed: everything dropped, `gen` bumped), `grid.loaded: Set<Key>`, `grid.flying: Map<Key, gen>`, `grid.gen: number`. `Key = '<cx>,<cz>'`; `grid.cellOf(x, z) → [cx, cz]`.

- [ ] **Step 1: Failing tests**: at origin, radius 2, `ask` has 25 keys nearest first; with heading `+x`, `'1,0'` precedes `'-1,0'`; after `began` of 8, the ninth is not asked; `done` with an old gen returns false and loads nothing; a cell at distance `radius + 1` loaded is not dropped, at `radius + 2` it is; a `reset` empties `loaded` and makes every earlier `done` false.
- [ ] **Steps 2-4:** FAIL, implement, PASS. **Step 5: Commit** `feat(runtime): a chunk grid`.

### Task 3.2: `runtime/workers.js`

**Files:**
- Create: `src/runtime/workers.js`, `workers.test.js`
- Modify: `src/runtime/index.js` (no three.js, so not `browser.js`): `rt.workers = createWorkerPool({ size: poolSize(hardwareConcurrency) })`, `size = min(4, max(1, hardwareConcurrency - 1))`; a world says how to make its workers with `rt.workers.define(name, make)` (the `new Worker(new URL(...))` must sit in the world's own module for the bundler).

**Interfaces:**
- `createWorkerPool({ make: (name) => Worker-like, size }) → { define(name, make, { size }), request(name, msg, transfer?) → Promise<reply>, cancel(name, key), close(name), stats(), dispose() }`; `msg` has `key` and `priority` (lower first); a request is sent to the least-busy worker; `cancel` removes a queued request (resolves its promise with `null`) or posts `{ type: 'cancel', key }` to the worker that holds it. Workers are made by `name` lazily, one pool per name.
- Worker contract (what `make(name)` returns must speak): receives `msg`, answers `{ key, ...reply }` with transferables, honours `{ type: 'cancel', key }`. Minecraft's `worker.js` already does.

- [ ] **Steps 1-4:** tests with a fake worker (priority order, cancel before send resolves null, two workers share work, dispose terminates), FAIL, implement, PASS. **Step 5: Commit** `feat(runtime): a worker pool`.

### Task 3.3: Minecraft onto `rt.chunks` and `rt.workers`

**Files:**
- Create: `src/components/minecraft/stream.js` (the chunk loop out of `module.js`, pure: a grid `size: 16`, `radius: distance`, `hysteresis: 2` as `dropFar`'s; `editsAround`, `remesh`; requests through `rt.workers.request('minecraft', …)`)
- Modify: `src/components/minecraft/module.js` (`wantedCache`, `flying`, `IN_FLIGHT`, `load`, `dropFar` replaced by the stream), `scene/chunks.js` and `rules/jobs.js` (`workerClient` and `makeClient` removed: the pool is their protocol)
- Test: `src/components/minecraft/module.test.js` (the set of chunk keys requested for a player at `(40, 0, -20)` with distance 4 equals `wantedChunks(g)` from `rules/game.js`; the dropped set is `dropFar`'s; a chunk reply after a seed change, or for a chunk let go of, is not added)
- The GPU queue hook (meshes through `gpuWork` under its budget) comes when Phase 0 lands; until then Minecraft's meshes are uploaded as before.

- [ ] **Steps 1-4:** tests, FAIL, implement, PASS. Browser: walk 200 blocks in each direction; `perf-probe` shows no frame over 50 ms from chunk arrival.
- [ ] **Step 5: Commit** `refactor(minecraft): chunks through the runtime's grid and pool`.

### Task 3.4: `runtime/origin.js`

**Files:**
- Create: `src/runtime/origin.js`, `origin.test.js`
- Modify: `runtime.js` (`rt.origin`, made there; before `step`, `origin.check(world.anchor())` for a world with an `anchor()`; emit `rt.events.emit('origin', { shift })`; reset to zero when a world begins)

**Interfaces:**
- `createOrigin({ cell = 50000 }) → { at: [x, y, z], check(worldPos) → shift | null, toLocal(worldPos, out?), toWorld(localPos, out?), on(fn) → undo }`; `check` moves `at` by whole cells when `|worldPos - at|` exceeds `cell` on x or z and returns the shift applied; the world (the universe module, Phase 4) subtracts the shift from every object's position in that frame and the camera's.

- [ ] **Steps 1-4:** tests (no shift inside a cell; a shift of exactly one cell at `cell + 1`; `toLocal(toWorld(p)) === p` to 1e-9 at 1e9), FAIL, implement, PASS.
- [ ] **Step 5: Commit** `feat(runtime): a floating origin`. **Step 6:** PR `claude/infinite-worlds-p3`.

## Phase 4: The Expanse

### Task 4.1: Seeds and names

**Files:**
- Create: `src/components/expanse/gen/seed.js`, `seed.test.js`, `names.js`, `names.test.js`

**Interfaces:**
- `hash64(...parts: (string | number)[]) → bigint` (FNV-1a 64 over the UTF-8 of parts joined by `\0`); `rngOf(seed: bigint) → () => number` (splitmix64 → [0, 1)); `UNIVERSE_SEED = 'tilakverse'`; `sectorSeed(universe, sx, sz) → bigint`; `systemSeed(sectorSeed, i)`, `planetSeed(systemSeed, j)`.
- `nameOf(rng, culture: 'core' | 'rim' | 'drift') → string` (two or three syllables from a table per culture, title case, never a word in a short blocklist); `designation(rng) → string` like `KX-417`.

- [ ] **Steps 1-4:** tests (`hash64('a') !== hash64('b')`; `rngOf` sequence stable across runs; 10,000 draws uniform within 5 % per decile; 1,000 names unique at 95 % or better), FAIL, implement, PASS. **Step 5: Commit** `feat(expanse): seeds and names`.

### Task 4.2: `makeSector`

**Files:**
- Create: `src/components/expanse/gen/sector.js`, `sector.test.js`, `tables.js` (star classes, planet types with radius/colour/moon/ring ranges, factions by distance band)

**Interfaces:**
- `SECTOR = 80000`; `makeSector(universe, sx, sz) → Sector`; `Sector = { id: 'E:sx,sz', seed, origin: [x, 0, z] (sector centre in universe units: sx * SECTOR, sz * SECTOR), systems: System[], wonders: Wonder[], beacons: { n, e, s, w: [x,y,z] } }`; `System = { id: 'E:sx,sz:<i>', name, at, star: { class, color, size }, planets: Planet[], faction, traffic: 0..1, hazard: null | 'storm' | 'pirates' | 'minefield' }`; `Planet = { id, name, type, radius, color, at (orbit position at t = 0), moons: number, rings: boolean, seed }`.
- Systems placed by Poisson disc (minimum gap `6000`) inside the sector's inscribed disc, count in `8..24` by `rng`; none within `MAP_RADIUS + 4000` of the authored map's centre when `(sx, sz)` is one of the eight neighbours of `0,0` (so nothing overlaps the map), and none within `SECTOR_RADIUS.rickmorty + 4000` of the Rick and Morty pocket, which lies inside sector `0,-1`. Sector `0,0` itself returns the authored map's places: `systems: []`, `wonders: []`, with `beacons` at the map's four hyperlane home beacons (`hyperlanes.js`'s `BEACONS` for `home`).

- [ ] **Steps 1-4:** tests (same input, deep-equal output twice; count in range over 200 sectors; min gap holds; neighbours of `0,0` clear the map; `0,0` empty), FAIL, implement, PASS. **Step 5: Commit** `feat(expanse): sectors from seeds`.

### Task 4.3: Lanes within and between sectors

**Files:**
- Create: `src/components/expanse/gen/lanes.js`, `lanes.test.js`
- Modify: `src/components/universe/hyperlanes.js` (export `buildFor(places, beacons, opts)`: today's `build()` body over given places, `build()` calls it with the authored ones; no behaviour change, `hyperlanes.test.js` still passes)

**Interfaces:**
- `sectorLanes(sector) → { nodes, lanes }` in `hyperlanes.js`'s shapes: local lanes system → the sector's hub (its reach-weighted centroid), trunk ring hub ↔ the four edge beacons.
- `trunkBetween(a: Sector, b: Sector) → lane`: from `a`'s beacon facing `b` to `b`'s beacon facing `a`; the control point lift uses `rngOf(hash64(min(a.seed, b.seed), max(a.seed, b.seed)))`, so `trunkBetween(a, b)` deep-equals `trunkBetween(b, a)` with ends swapped.

- [ ] **Steps 1-4:** tests (connectivity of each sector's graph; the symmetric trunk; `build()` output unchanged, snapshot), FAIL, implement, PASS. **Step 5: Commit** `feat(expanse): lanes across the grid`.

### Task 4.4: Drawing sectors on the universe map

**Files:**
- Create: `src/components/expanse/scene/sectors.js` (one loaded sector: far-place impostors via `farPlaces.js`, stars as `bodies.js` spheres, lanes via the map's lane drawer, a `dispose`), `starfield.js` (the beyond: one `Points` of distant sectors' systems at impostor size, rebuilt on a sector change)
- Modify: `src/components/universe/scene.js` (the universe map is a `useScene` scene, not a runtime module, so it has no `rt`: `expanse/scene/expanse.js` holds a `createChunkGrid({ size: SECTOR, radius: 1 })` keyed on the ship's position and adopts `runtime().origin`: the Expanse's root sits at the origin and each sector's group at its centre less it, re-anchored in the frame the origin moves, while the authored map keeps its coordinates (its draw already re-centres on the camera, `drawn`) and the origin stays at the middle inside the rim; `sectorOf` in `layout.js` returns `'E:sx,sz'` beyond the two authored sectors, `mapSectorOf` keeps the map's own logic on `main`/`rickmorty`; `ship.js`'s `OPEN_SPACE` lets the ship past the main edge, `SPACE` still turns it back), `src/components/universe/online/rosterWhere.js` (a pose with `sec` reads `Universe · E:3,-2 · <system name>`; `whereOf` keeps `/universe`, which older clients match exactly), `online/protocol.js` (a pose carries `sec: 'E:sx,sz'` and local coordinates; a reader without the field assumes the authored sector)
- Test: `src/components/universe/layout.test.js` (sectorOf beyond the map), `online/protocol.test.js` (pose round-trips `sec`), `expanse/scene/sectors.test.js` (a loaded sector adds N impostors and disposes to zero objects, three.js in Node as the repo's scene tests do)

- [ ] **Steps 1-4:** tests, FAIL, implement, PASS. Browser: fly past the rim; sectors appear ahead; `window.__RUNTIME__.origin.at` changes once past 50,000 and nothing jumps; roster shows `E:1,0`.
- [ ] **Step 5: Commit** `feat(universe): the Expanse past the rim`.

### Task 4.5: Pocket universes

**Files:**
- Modify: `src/components/universe/Front.jsx` (or the page that owns `/universe`): `?seed=` → the Expanse's universe seed; a seed other than the default registers a `pocket` world (Phase 2's registry) and the HUD names it.
- Test: `src/components/expanse/pocket.test.js`: `pocketOf('?seed=marble')` gives `universe: hash64('marble')`, and `registerPocket` registers `pocket:marble` (`pages/Universe.jsx` passes it to `UniverseMap` as `universe`, keyed on the word).

- [ ] **Steps 1-5:** tests, FAIL, implement, PASS, commit `feat(universe): pocket universes by seed`. **Step 6:** PR `claude/infinite-worlds-p4`.

## Phase 5: Landing on the Expanse

> Tasks 5.2 and 5.3 are superseded by the natural-worlds plan's Phase 3 (`docs/superpowers/plans/2026-10-08-natural-worlds.md`: `src/components/expanse/surface/`, built on `src/lib/land` and `src/lib/physics`); Task 5.1 maps the Expanse's planet types onto `landSpec`'s types (`temperate`, `desert`, `ice`, `ocean`, `volcanic`).

### Task 5.1: `planetSpec`

**Files:**
- Create: `src/components/expanse/gen/planet.js`, `planet.test.js`

**Interfaces:**
- `planetSpec(planet: Planet) → { ground: keyof landings/ground.js's styles, palette: { low, mid, high, sky }, biomes: Biome[], gravity: 0.6..1.4, sky: { kind, color }, kit: 'rocks' | 'ice' | 'desert' | 'forest' | 'ruins', amplitude, roughness }` by `planet.type` from a table and the planet's `rng`.

- [ ] **Steps 1-5:** tests (every type yields a spec whose `ground` exists in `ground.js`), implement, commit `feat(expanse): a planet's surface from its seed`.

### Task 5.2: Terrain cells in the worker

**Files:**
- Create: `src/components/expanse/surface/terrain.js` (pure: `cellHeights(spec, seed, cx, cz) → Float32Array((CELL+1)²)` via `galaxy/surface/noise.js`'s `fbm`; `cellMesh(heights) → { positions, normals, indices }` transferable), `terrain.test.js`, `src/components/expanse/surface/worker.js` (speaks the Task 3.2 contract: `{ type: 'cell', key, seed, cx, cz, spec }` → `{ key, heights, positions, normals, indices }`), `props.js` (`cellProps(spec, seed, cx, cz) → [{ kind, at, yaw, scale }]`, 0 to 40 per cell by biome)
- Test: edges of adjacent cells share heights exactly; mesh index count is `CELL² × 6`.

- [ ] **Steps 1-5:** tests, implement, commit `feat(expanse): terrain cells`.

### Task 5.3: The surface module

**Files:**
- Create: `src/components/expanse/surface/module.js` (`id: 'expanse-surface'`, `shading: 'glsl'`, `mb: 4`; `create(rt, { planet })`: a `rt.chunks` grid `size: CELL, radius` by tier (high 8, mid 5, low 3) round the walker; cells through `rt.workers.request('expanse-surface', …)`; meshes with `ground.js`'s style material; props as `InstancedMesh` per kind from the CC0 kit GLBs through `rt.assets.gltf`; the walker from `footScene.js`'s `createFoot` with `map` as a flat sampler of the heights), `surface.css`
- Modify: `src/components/universe/landings/landings.js` (`landingFor(planetId)`: an `E:` id yields a generated landing that opens this module), the universe's land/take-off handover.
- Test: `module.test.js` (validates, creates with a fake rt, asks the grid for the right cells at the walker's start, disposes clean).

- [ ] **Steps 1-5:** tests, implement, PASS; browser: land on a generated planet, walk 500 m, take off. Commit `feat(expanse): walk a generated world`. PR `claude/infinite-worlds-p5`.

## Phase 6: Worlds for others

### Task 6.1: Measure retention first

- [ ] Script `scripts/nostr-retention.mjs`: publish a kind 30078 event with `d = tp-probe` to each of `RELAYS`, read it back after 1 hour, 1 day, 7 days (run by hand; log to `docs/research/2026-10-XX-nostr-retention.md`). Proceed with the relays that keep it 7 days; if none do, stop here and report (the spec's seam to a server is the next design).

### Task 6.2: World cards and deltas on the relays

**Files:**
- Create: `src/components/worlds/share.js`, `share.test.js`
- Modify: `src/components/universe/online/events.js` (`signEvent` takes `kind` with default `KIND`), `nostr.js` (`publish(ev)`, `fetchReplaceable({ kinds: [30078], '#d': [...] })`)

**Interfaces:**
- `cardEvent(world) → { kind: 30078, tags: [['d', `tp-world:${id}`], ['t', 'tilakverse-world']], content: JSON({ v: 1, kind, seed, name, route }) }`; `deltaEvents(world, save) → events` with `d = tp-world:<id>:<n>`, content parts of at most `60 * 1024` bytes of the JSON save; `readWorld(events) → { world, save } | null` (reassembles, rejects a card whose `kind` or `route` is not one of the registry's).
- `/worlds` gains "Worlds from others": cards from the relays (query `#t`), Open (registers a copy under the visitor's own id), and on My worlds a Share toggle per world (publish card, and deltas on each save, debounced 30 s).

- [ ] **Steps 1-5:** tests (parts split and rejoin; an oversize or malformed card is dropped; a card for a route not in the registry is dropped), implement, PASS, commit `feat(worlds): share worlds over the relays`. PR `claude/infinite-worlds-p6`.

---

## Self-review notes

- Spec answer 1 → Phase 3; answer 2 → Phase 1 (and Phase 0 for the Prepare bar); answer 3 → Phases 4 and 5; answer 4 → Phases 2 and 6. Decisions 1-10 each have a task: 1 (Phase 0 reference), 2 (3.1-3.3), 3 (1.1-1.2), 4 (1.3), 5 (1.5), 6 (4.1, 4.5), 7 (2.3, 5.x store nothing generated), 8 (3.4), 9 (4.4, 5.3 reuse lists), 10 (6.x).
- Names used across tasks: `createChunkGrid`, `grid.update/began/done/reset`, `createWorkerPool.request/cancel`, `createOrigin.check`, `createStore.get/set/list`, `createRegistry`, `worldUrl`, `hash64`, `rngOf`, `makeSector`, `planetSpec`, `cellHeights` are each defined once above and consumed by name.
- Review Focus items 1-5 have tests in 1.4, 1.2/1.4, 2.1, 3.1/3.3, 4.3.
