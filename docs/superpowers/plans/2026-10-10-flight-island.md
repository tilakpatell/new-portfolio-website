# Planet flight, lane J: the flight as an island, gone in one move. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The planet flight (`/fly`) keeps everything it does and becomes a thing the site can remove with one command: it reads the galaxy and the universe only through their `shared/` faces, its pure tables reach nothing above `src/lib`, every row outside its folders that names it is marked, and `node scripts/flight-island.mjs --remove` leaves `main` green with no trace but the docs and a decision entry.

**Architecture:** Three moves from the design, in order: (1) `galaxy/shared/` and `universe/shared/` barrels, the flight’s fourteen cross-world imports moved onto them; (2) `planetSpec.js` and `lifeTables.js` take the Expanse’s systems as an argument, composed in `expanse/flight/planets.js`; (3) `scripts/lib/flight-island.mjs` holds the inventory as data and the pure checks, `scripts/flight-island.mjs` runs `--check`, `--remove --dry` and `--remove`, and a test holds the inventory to the tree on every push.

**Tech Stack:** Node 22 (`node:fs`, `node:path`, `node:child_process`), Vitest, the health measure’s graph (`scripts/health/graph.mjs`), `scripts/stack-census.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-planet-flight-removable-island-design.md`. Read it first, then `docs/health/RULES.md` (“Worlds are islands”), `scripts/health/boundary-breaks.mjs`, and `docs/superpowers/HANDOFF-planet-flight.md`.

## Global Constraints

- Nothing the flight does changes: no pixel, no number, no network message. Before the first edit, take `node scripts/perf-probe.mjs fly`’s report and the smoke on `/fly/hoth`, `/fly/coruscant`, `/galaxy/hoth/surface`; the same after the last.
- Lane H (occurrences, `claude/planet-occurrences`) runs beside this lane in `scene.js`, `FlightHud.jsx`, `life.js` and `lifeTables.js`. Keep this lane’s edits to those files to import lines and signatures, merge `origin/main` before the last push, and keep H’s call sites.
- The Battlefront lanes (phase 1, S, V, W) are in `galaxy/surface/`, `galaxy/fleet.js`, `lib/three/`, `scripts/assets-*`. This lane adds files under `galaxy/shared/` and `universe/shared/` and changes nothing else of theirs. Never edit `catalog/*.js`, `crew*.js`, `placer.js`, `kit.js`, `figures.js`, `fleet.js`.
- Pure logic in tested files beside it, under a second, no network; files under 800 lines; British spelling, curly quotes, comments say why; no model names anywhere; commits end with the harness’s attribution lines; never print or commit a key.
- The gates before the PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `RELAY=fake node scripts/online-check.mjs --fly`.

## Review Focus

1. A re-export barrel must not pull a module’s side effects into a world that did not have them: `shared/models.js` re-exports from the same files the flight already imported, nothing more (compare the flight’s import closure before and after with `scripts/health/graph.mjs`; it may only shrink).
2. `planetSpec.js` is imported by ten flight files and by `Fly.jsx`; the signature change must keep `planetSpecOf(id)` working for a named world with no Expanse argument, and `PLANETS`’s order and ids byte for byte (the seed and `TERRAIN_VERSION`’s hash read them; `planetSpec.test.js` pins the fifty ids).
3. The remover edits files other lanes own (`App.jsx`, `ci.yml`, `package.json`): it must only ever touch a marked row, never a neighbour, and the dry run must print the exact lines (tested on a fixture tree with a decoy row beside each marked one).
4. The check must not pass on a marker alone: a marked row that no longer references the flight is reported too, so markers cannot rot.
5. `npm install` after the dependency is removed rewrites `package-lock.json`; the remover runs it and the census, and the dry run says so; the test never runs it.

---

### Task 1: The galaxy’s and the universe’s faces

**Files:**
- Create: `src/components/galaxy/shared/models.js`, `ground.js`, `fight.js`, `src/components/universe/shared/online.js`, `flying.js`, `src/components/galaxy/shared/shared.test.js`, `src/components/universe/shared/shared.test.js`
- Modify (import lines only): `expanse/flight/landmarkFiles.js`, `lifeScene.js`, `brains.js`, `flightProtocol.js`, `landmarks.js`, `online.js`, `landmarkScene.js`, `air.js`

**Interfaces:**
- `galaxy/shared/models.js` exports exactly: `SURFACE_MODELS, lodUrlFor, modelUrlFor, wantsLod` (from `../surface/catalog`), `createPlacer, loadModel, usesModel, clusterSpecs` (from `../surface/placer`), `PROPS` (from `../surface/props`), `createKit` (from `../surface/kit`), `FIGURES, buildFigure` (from `../surface/figures`), `GALAXY_KINDS, buildGalaxyShip` (from `../fleet`).
- `galaxy/shared/ground.js`: `SITES, siteOf` (from `../surface/sites`), `makeHeight` (from `../surface/terrain`).
- `galaxy/shared/fight.js`: `sensesFor, startBurst, stepBurst, strafeStep` (from `../surface/hostiles`).
- `universe/shared/online.js`: `STALE_MS, createLimiter` (from `../online/protocol`), `cleanName` (from `../online/names`).
- `universe/shared/flying.js`: `turnToward` (from `../hunterRules`), `BUILT_KINDS` (from `../trafficModels`).
- `universe/shared/room.js`: `joinAsVisitor` (from `../online/nostr`), loaded lazily as `online.js` loaded `nostr.js`.

- [ ] **Step 1: Failing tests**: each barrel’s test imports it and checks every name above is a function or an object (`typeof`), and that the module exports nothing else (`Object.keys(mod).sort()` equals the list).
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/shared src/components/universe/shared` → FAIL (no module).
- [ ] **Step 3: Implement** the five barrels: re-exports only, a header comment saying what the face is for (“what the galaxy lends a world that draws its things by kind”), one line per export group saying why a world needs it.
- [ ] **Step 4: Move the flight’s imports** onto them (the fourteen lines the design lists); `grep -rn "galaxy/\|universe/" src/components/expanse/flight --include=*.js --include=*.jsx | grep -v shared/ | grep -v test` must print nothing but `universe/online/useOnline` in `pages/Fly.jsx` (a hook the pages share; leave it).
- [ ] **Step 5: Run** the tests → PASS; `npx vitest run src/components/expanse/flight` → PASS unchanged; `node scripts/health.mjs --skip build` and read `boundary-breaks`’s detail: no `expanse/flight` row under “worlds are islands”.
- [ ] **Step 6: Commit** `The galaxy and the universe lend the flight their things through a shared face`.

### Task 2: The pure tables take the Expanse as an argument

**Files:**
- Create: `src/components/expanse/flight/planets.js`, `planets.test.js`, `src/lib/land/flight/fixtures/expanse.json`, `scripts/flight-expanse-fixture.mjs`
- Modify: `src/lib/land/flight/planetSpec.js`, `planetSpec.test.js`, `lifeTables.js`, `lifeTables.test.js`, `src/pages/Fly.jsx`, and each flight module that imports `PLANETS` (`grep -rln "PLANETS" src/components/expanse/flight src/lib/land/flight src/pages/Fly.jsx`)

**Interfaces:**
- `planetSpec.js`: `planetSpecOf(id, { expanse } = {})` where `expanse` is the rows `[{ id, name, type, seed, system: { faction, traffic, hazard } }]` or a lookup `id → row | null` (a typed `/fly/e:…` reaches past the thirteen); `planetsOf(expanse) → PLANETS` in the same order as today; `PLANETS` is no longer exported from `src/lib` (the component composes it). `TERRAIN_VERSION` and its hash unchanged.
- `lifeTables.js`: `lifeFor(spec, { expanse })` takes rows or a lookup (`isDead(life)` needs neither), import nothing from `src/components`.
- `expanse/flight/planets.js`: `export const EXPANSE = expanseRows()` built from `expanse/gen/sector.js`’s `makeSector` and `seed.js`’s `UNIVERSE` (the only file in the flight that imports `expanse/gen`), `export const PLANETS = planetsOf(EXPANSE)`, `export const planetSpecOf = (id) => specOf(id, { expanse: expanseRow })`, `lifeOf(spec)`.
- `scripts/flight-expanse-fixture.mjs`: writes `fixtures/expanse.json` from `expanse/gen` (run once; the test pins it; re-run when the Expanse changes).

- [ ] **Step 1: Failing tests**: `planetSpec.test.js` and `lifeTables.test.js` read the fixture and pass it; a new assertion that `src/lib/land/flight/*.js` (not tests) imports nothing matching `components/` (read the files, regex the import lines); `planets.test.js` pins the fifty ids in order and that `EXPANSE` has thirteen rows whose ids start `e:`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; the fixture written by the script and committed. **Step 4: Run** → PASS; `npx vitest run src/components/expanse/flight src/lib/land/flight src/pages` → PASS; `node scripts/supabase-seed.mjs` writes a `seed.sql` identical to `main`’s (`git diff --stat supabase/seed.sql` empty); `boundary-breaks`’s detail has no `lib/land/flight` row.
- [ ] **Step 5: Commit** `The flight’s pure tables take the Expanse as rows; nothing in lib reaches a world`.

### Task 3: The island’s inventory and checks, pure

**Files:**
- Create: `scripts/lib/flight-island.mjs`, `scripts/lib/flight-island.test.mjs`, `scripts/fixtures/flight-island/` (a small tree: two marked rows, a decoy row beside each, one unmarked reference, one marker with no reference, a folder of the island)

**Interfaces:**
- `ISLAND`: `{ folders: ['src/components/expanse/flight', 'src/lib/land/flight', 'src/lib/durable'], files: ['src/pages/Fly.jsx', 'scripts/supabase-seed.mjs', 'scripts/supabase-seed.test.mjs', 'scripts/lib/durable-check.mjs', 'scripts/lib/fly-check.mjs', 'scripts/lib/fake-durable.mjs', 'scripts/lib/fake-durable.test.mjs', 'scripts/fixtures/planets.json', 'supabase/migrations/20261009000000_world_entities.sql', '…000100…', '…000200…', '…000300…', 'supabase/seed.sql', 'docs/stack/fastnoise-lite.md'], deps: ['fastnoise-lite'], marker: 'planet flight', rows: [{ file, kind: 'line' | 'block' }] (the files from the design’s list), docsByHand: ['docs/architecture.md', 'docs/stack/README.md', 'supabase/README.md', 'docs/decisions/README.md'], keep: [the design’s “What stays” paths] }`.
- `NAMES`: the regexes a reference matches: `expanse/flight`, `land/flight`, `lib/durable`, `['"]/fly`, `fastnoise-lite`, `world_entities`, `__FLIGHT__`, `online-check.mjs --fly`.
- `referencesIn(text, file) → [{ line, text }]`; `isMarked(lines, i, marker) → boolean` (the line carries the marker, or sits inside a begin/end block); `check(tree) → { unmarked: [{ file, line, text }], stale: [{ file, line }], outsideImports: [...], crossWorld: [...] }` where `tree` is `{ read(file), list(dir), files }` (a fake in tests, `node:fs` in the script); `removal(tree) → { delete: [...files], dropLines: [{ file, lines }], byHand: [...], deps, migration: '<sql>' }`; `apply(removal, tree)` writes.
- Every function pure over the `tree`; `check` and `removal` never read `node:fs`.

- [ ] **Step 1: Failing tests** on the fixture tree: `check` finds the one unmarked reference by file and line, the one stale marker, and nothing else; the decoy rows are never in `dropLines`; `removal` lists the island folder’s files for deletion and the marked rows (a block as its whole span) and the migration text names the four objects; `apply` on the fake tree leaves the decoys byte for byte.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The flight’s island as data: what it is, what names it, how it goes`.

### Task 4: The markers on `main`’s rows, and the script

**Files:**
- Create: `scripts/flight-island.mjs`
- Modify (a marker comment only, on the rows the design lists): `src/App.jsx`, `src/components/worlds/worlds.js`, `looks.js`, `packs.js`, `src/components/universe/universes.js`, `src/components/guide/routes.js`, `pages.js`, `abouts.js`, `src/components/tour/brief.js`, `briefs.js`, `.github/workflows/ci.yml`, `scripts/online-check.mjs`, `scripts/perf-probe.mjs`, `scripts/stack-census.mjs`, `scripts/supabase-check.mjs`, `docs/stack/supabase.md` (`<!-- planet flight -->`), `package.json` (no comments in JSON: the dependency is in `deps`, not a row), `.env.example`, `src/components/universe/online/nostr.js` (the `cells` lines are the universe’s now: *not* marked; `keep`)

**Interfaces:**
- `node scripts/flight-island.mjs --check` → prints `ok` and the counts (files, rows, references), exit 1 with each unmarked or stale line otherwise.
- `node scripts/flight-island.mjs --remove --dry` → the plan: files to delete, rows to drop with their text, the migration, the by-hand list, the owner’s step.
- `node scripts/flight-island.mjs --remove` → does it, then `npm install`, `node scripts/stack-census.mjs --write`, writes the migration and `docs/decisions/<date>-planet-flight-retired.md` from a template (title, context, the command that did it), and prints the by-hand list. Refuses on a dirty tree.
- `scripts/flight-island.test.mjs`: runs `check` over the real tree (through the `node:fs` tree) and asserts no unmarked and no stale references, so `npm test` holds the inventory to `main`.

- [ ] **Step 1: Failing test**: the real-tree test (fails: nothing is marked yet).
- [ ] **Step 2: Mark the rows** with `// planet flight` (`# planet flight` in YAML and `.env.example`; a `begin`/`end` pair round `pages.js`’s `'/fly'` entry, `briefs.js`’s, `ci.yml`’s step and the `perf-probe.mjs` journey). The marker says why in one clause where the row is not obvious: `// planet flight (scripts/flight-island.mjs removes this row)` on the first row of a file, plain `// planet flight` on the rest.
- [ ] **Step 3: Implement** the script over task 3’s module. **Step 4: Run** `node scripts/flight-island.mjs --check` → `ok`; `npm test` → PASS; `--remove --dry` → read every line of the plan and fix the inventory until it is right and complete.
- [ ] **Step 5: Add** `--check` to `scripts/health.mjs --check` as one more gate line (not a metric: a pass/fail), so a session that adds an unmarked `/fly` row fails health.
- [ ] **Step 6: Commit** `Every row that names the flight is marked; one script checks and removes the island`.

### Task 5: The proof, once

- [ ] **Step 1:** On a scratch branch from this lane’s head: `node scripts/flight-island.mjs --remove`. Then `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /galaxy/hoth/surface,/universe`, `RELAY=fake node scripts/online-check.mjs --universe`. All green, or the inventory is wrong: fix it on the lane branch and do the proof again from a fresh scratch branch. `ls dist/assets | grep -i fly` prints nothing.
- [ ] **Step 2:** Record in `docs/superpowers/evidence/flight-island/README.md`: the dry run’s plan (the counts), the gates’ results, the build’s chunk list before and after, the by-hand list. Throw the scratch branch away; nothing of it is pushed.
- [ ] **Step 3:** The before/after of the Global Constraints: the perf report and the three smokes on the lane branch, unchanged.
- [ ] **Step 4: Commit** `The removal proved once: main green without the flight`.

### Task 6: Docs, the hand-off, the PR

- [ ] **Step 1:** `docs/architecture.md`: one sentence in the flight’s paragraph naming the script and the faces; `docs/health/RULES.md`, under “Worlds are islands”: one sentence that the galaxy and the universe lend through `shared/`, and that a world the site may drop keeps its outside rows marked and its remover tested (the flight is the example). `docs/superpowers/HANDOFF-planet-flight.md`: lane J’s row in the lane table and the status table, and a section “Removing the flight” with the three commands. `docs/decisions/README.md` gains no row (the decision entry is written by the remover, when it runs).
- [ ] **Step 2:** The Departures of the design: one line each where the code went another way.
- [ ] **Step 3:** Merge `origin/main` (lane H may have landed), the gates, push, PR to `main` titled `Planet flight, lane J: an island with a face, gone in one move`, out of draft when CI is green. Reply to the session that spawned you in three lines. Not merged by this lane.
