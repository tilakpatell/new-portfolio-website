# Galaxy surfaces: the living layer. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The galaxy's seventeen walkable surfaces dressed to the Shire's standard: the nature kit as each world's cover, mid layer and (where no built species stands) trees, by a biome recipe; a look and a grade a world; the ground's scan carried to 150 m; falling leaves, wind lines and grass tracks.

**Architecture:** A pure recipe (`surface/flora.js`) turns a site's `flora` block into the placer's own scatter rows naming `kit:naturemega/<Name>` models, composed into the site by `siteFrom`, so the scene, the placer and the near-shadow phase draw them as they draw everything else. The look is data (`look`, `grade` blocks a site) read by the house look and the post's grade pass. Three library pieces (`leaves`, `windLines`, `tracks`) are wired through one new `surface/living.js`. `scene.js` (3,571 lines, over the measure's ceiling) gains wiring lines only.

**Tech Stack:** three.js 0.186 (WebGLRenderer, GLSL rewrites through `onBeforeCompile`), React 19, Vite 8, Vitest in Node, Playwright-core + the installed Chromium for the checks. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-09-galaxy-surfaces-living-layer-design.md`. Read with it: `docs/health/RULES.md`, `.claude/skills/autopilot/SKILL.md` §5 (the standing rules), `docs/superpowers/HANDOFF-kit-worlds.md` (the kit's rules), `docs/superpowers/HANDOFF-galaxy-asset-upgrade.md` (Endor's numbers), `scripts/kit/README.md`, `src/components/galaxy/surface/sites/index.js:1-59` (what a site is), `src/components/galaxy/surface/placer.js:1-46` (what a spec is).

## Global Constraints

- Branch `claude/compassionate-turing-a8zq9v`, one commit a phase, pushed with `git push -u origin claude/compassionate-turing-a8zq9v`. No pull request. Never force-push.
- No new runtime dependency. No `three/webgpu`, no `three/tsl`. Every shader change is a GLSL rewrite through `onBeforeCompile`, its pure part tested on stub shaders (`src/lib/three/grass.test.js`'s pattern).
- No sequel trilogy content. No runtime calls to asset services. Nothing generated: the kit is on disk (`public/kit/naturemega/`).
- A file stays under 800 lines. `scene.js` gains wiring lines only; new code goes in new files with a test beside each (`x.js` has `x.test.js`; a test runs under a second, touches no network).
- Every kit material is `house.material()` (one per manifest name per kit). No palette re-UV. A tint is a colour on that material, by data.
- The kit never stands within 25 m of a place's centre (`clear: 25` on tree rows) and never replaces a `things` or `places` entry.
- Budgets: a world's `galaxy-check` line at `high` and `mid` under its level's row (`src/lib/budgets.js`: high 3M triangles / 700 calls / 60 MB; mid 1.5M / 500 / 40 MB). A world that grows past its baseline +10% is re-baselined in the same commit with the numbers in the body. Endor (`KNOWN_OVER`) may not grow.
- Before each phase's commit: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, all green; never skip, quieten or delete a test.
- British spelling, curly quotes, plain sentences, comments that say why in the file's voice. Reformat no line you aren't changing.
- Commit messages: one plain sentence, a body with the numbers, ending with the attribution lines the harness gives. No model names in any file or message.
- Shots: `docs/superpowers/evidence/galaxy-surfaces-living-layer/<phase>/<world>-{before,after}.png` from `scripts/surface-shot.mjs` (or `galaxy-check`'s), at the same view each side. Look at them (`Read`): a change that isn't visible, or looks worse, isn't done.

## How to run the checks here

```bash
npx vite --port 5188 &                       # once; the scripts talk to it
# a world's numbers and picture, held to its budget
OUT=lab/shots QUALITY=high BUDGET=1 JSON=1 node scripts/galaxy-check.mjs surface naboo,lothal
OUT=lab/shots QUALITY=mid  BUDGET=1 JSON=1 node scripts/galaxy-check.mjs surface naboo,lothal
# a fixed view of a world (x, z, distance, degrees), for before/after
OUT=lab/shots BAKE_WAIT=60000 node scripts/surface-shot.mjs naboo "0,0,14,30,landing" "60,40,30,200,grove"
```

Headless Chromium draws in software and is slow (minutes a world); `galaxy-check`'s counts mean the same anywhere, its times only against another run here. To re-baseline a world after a run with `JSON=1`: merge that world's object from `lab/shots/surface-<level>.json` into `lab/baseline/surface-<level>.json` (an array of `{ id, calls, triangles, … }`), replacing its entry, and say the old and new `calls`/`triangles` in the commit body.

## Review Focus

Inputs the spec implies that no task's tests would otherwise exercise, each pinned to a task below:

1. A site with `flora` and no `grass`, or `noGround: true`: the recipe lays nothing on a world with no ground, and cover without grass on one that has ground (Task 3).
2. A kit row whose model fails to load (a typo in a `Name`): the placer's existing fallback builds the row's `kind` if `SCATTER` has it, else warns once and draws nothing; the sites test refuses a kit name the manifest doesn't have, so a typo fails in Node, not in a browser (Task 4).
3. A world with water: cover never stands under the water or on a cliff (`above`, `flat` carried on every row) (Task 3).
4. The map's picture: the post's new split-tone uniforms default to black, so `/universe` renders byte-for-byte as before (Task 9).
5. The low tier and a phone: no leaves, no lines, no tracks, no antiTile; the recipe's counts scale by `amounts.scatter` as every scatter does, nothing else (Tasks 15, 17).

---

## Phase 1: the recipe, and the plains (Naboo, Lothal)

### Task 1: a tint a material, in the kit loader

**Files:**
- Modify: `src/lib/three/kit.js:86` (`kitMaterial`), `:135` (`loadKit`), and the dress site at `:162`
- Test: `src/lib/three/kit.test.js`

**Interfaces:**
- Produces: `loadKit(pack, { …, tint = null })` where `tint` is `{ [materialName]: '#rrggbb' | number }`; after a material is dressed from its file, `m.color.set(tint[name])` when the name is in `tint`. `kitMaterial(def, { house, wind, tint })` takes the one colour for its own material and applies it the same way (so a material made before any file is in is tinted too).

- [ ] **Step 1: Write the failing test**, in `kit.test.js`'s `loadKit: models and materials` block:

```js
it('tints a material by its manifest name, once a kit, and leaves the rest as dressed', async () => {
  const kit = loadKit('naturemega', { load: fakeLoad, manifest: MANIFEST, tint: { Leaves_Birch: '#b8a860' } });
  const { parts } = await kit.model('Birch_1');
  const leaves = parts.find((p) => p.material.name === 'Leaves_Birch').material;
  const bark = parts.find((p) => p.material.name === 'Bark_Birch').material;
  expect(leaves.color.getHexString()).toBe('b8a860');
  expect(bark.color.getHexString()).toBe(BARK_HEX_FROM_FIXTURE); // (the file's own, untouched)
  expect(leaves.map).toBeTruthy(); // (the map stays: the tint multiplies it)
});
```

Use the file's existing fixtures (`kit.fixture.js`) for `fakeLoad` and `MANIFEST`; `BARK_HEX_FROM_FIXTURE` is whatever the fixture's bark colour is (read it from the fixture, don't guess).

- [ ] **Step 2: Run it**: `npx vitest run src/lib/three/kit.test.js -t tints` → FAIL (no tint option).
- [ ] **Step 3: Implement**: thread `tint` through `loadKit` to where `kitMaterial` is called (`:162`) and into the dress step (after `dress(m, def, src)`, so the file's colour is overwritten, not multiplied twice). Update the header comment's `loadKit(...)` line.
- [ ] **Step 4: Run** `npx vitest run src/lib/three/kit.test.js` → PASS, all of it.

### Task 2: the placer hands a world's tint to its kits

**Files:**
- Modify: `src/components/galaxy/surface/placer.js:246-250` (`kitFor`) and `createPlacer`'s options
- Test: `src/components/galaxy/surface/placer.test.js` (the `kit:` block at `:170-210`)

**Interfaces:**
- Consumes: Task 1's `tint` option.
- Produces: `createPlacer({ …, kitTint = null })`; `kitFor(pack)` calls `kitLoader(pack, { house, wind, tint: kitTint })`.

- [ ] **Step 1: Write the failing test**, beside `scatters a kit model…`:

```js
it('hands the world’s tint to the kit it loads', async () => {
  const { loader, placer } = setup({ kitTint: { Leaves_Common: '#b8a860' } });
  placer.scatter('fern', items(1), { model: 'kit:naturemega/Fern_1' });
  await placer.ready;
  expect(loader.mock.calls[0][1].tint).toEqual({ Leaves_Common: '#b8a860' });
});
```

(`setup` takes placer options in that file; if it doesn't, give it a second argument spread into `createPlacer`.)

- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/surface/placer.test.js -t tint` → FAIL.
- [ ] **Step 3: Implement** the option and the pass-through. One line in the header comment.
- [ ] **Step 4: Run** the placer tests → PASS.

### Task 3: the recipe

**Files:**
- Create: `src/components/galaxy/surface/flora.js`
- Test: `src/components/galaxy/surface/flora.test.js`

**Interfaces:**
- Produces:
  - `BIOMES`: `{ plains, temperate, conifer, jungle, swamp, tropical, dry, ash, tundra, none }`, each `{ cover: [[Name, share]…], mid: [[Name, share]…], trees: [[Name, share]…], canopy?: metres }` where `share` is the kind's share of its band's count, and a biome may give `tint` defaults (`{ [materialName]: '#rrggbb' }`).
  - `floraRows(site) → rows[]`: the placer's scatter rows, `{ kind, model: 'kit:naturemega/<Name>', n, within: [r0, r1], scale: [lo, hi], solid, flat?, above?, clear?, canopy? }`. Bands: cover `within [4, 160]`, mid `[20, 320]`, trees `[60, Math.min(560, site.reach ?? 590)]` (`REACH`, `terrain.js`, when the raw site has none). Counts at `density 1`: cover `Math.round(2200 × density)` spread by share; mid `300 × density`; trees `120 × density`, and none when `site.flora.trees` is `false` or the biome has no trees. `solid: false` for cover; mid and trees `solid: true`. Every row has `flat: 0.86` (never on a cliff) and, when `site.water`, `above: 0.4`. Tree rows have `clear: 25`. A tree row carries `canopy` from the biome (metres: `CommonTree` 3.5, `Birch` 3, `Pine` 2.5, `DeadTree` 0, `TwistedTree` 3.5).
  - `kind` on a row: the built kind it stands in for when the kit won't load (`'fern'`, `'rock'`, `'bush'`, `'plant'`, `'stones'`), else the name in lower case (`'flower'`, `'pebble'`, `'grassclump'`, `'commontree'`…): Task 4 makes the test accept those.
  - `floraTint(site) → { [materialName]: '#rrggbb' } | null`: the biome's defaults under the site's `flora.tint`.
  - `floraNames(rows) → Set<string>` of the `Name`s a row list uses (for the sites test).
  - Phase 1 fills `plains` and `none`; the other biomes are empty lists until their phase (an empty biome lays nothing).
- The `plains` recipe (the spec's table): cover `Grass_Wide_Short 0.18, Grass_Wispy_Tall 0.14, Grass_Common_Short 0.14, Clover_1 0.12, Flower_1_Group 0.06, Flower_2_Single 0.06, Flower_3_Group 0.05, Flower_7_Single 0.05, Petal_3 0.06, Pebble_Round_2 0.07, Pebble_Square_1 0.07`; mid `Bush_Common 0.4, Bush_Common_Flowers 0.3, Rock_Medium_1 0.15, Rock_Medium_3 0.15`; trees `CommonTree_1 0.25, CommonTree_2 0.25, CommonTree_3 0.2, CommonTree_4 0.15, CommonTree_5 0.15`.

- [ ] **Step 1: Write the failing tests** (`flora.test.js`), the site a small literal with `reach: 590`:

```js
it('lays a plains world’s three bands from its recipe, counts by density, every row a kit model', () => {
  const rows = floraRows({ flora: { biome: 'plains' }, reach: 590, ground: {}, grass: {} });
  const cover = rows.filter((r) => r.within[1] === 160);
  expect(cover.reduce((s, r) => s + r.n, 0)).toBeCloseTo(2200, -2);
  expect(rows.every((r) => /^kit:naturemega\/\S+$/.test(r.model))).toBe(true);
  expect(rows.filter((r) => r.within[0] === 60).every((r) => r.clear === 25 && r.solid === true)).toBe(true);
  expect(cover.every((r) => r.solid === false && r.flat === 0.86)).toBe(true);
});
it('halves at density 0.5 and lays no trees when told not to', () => { … trees: false → no row with within[0] === 60; density 0.5 → cover ≈ 1100 … });
it('lays nothing on a world with no ground, and nothing for the none biome', () => { noGround: true → []; biome 'none' → [] });
it('keeps out of the water: every row carries `above` when the site has water', () => { water: { level: -3 } → every r.above === 0.4 });
it('tints: the biome’s defaults under the site’s own', () => { floraTint({ flora: { biome: 'plains', tint: { Grass: '#c6ad72' } } }) has Grass '#c6ad72' and the plains’ defaults for the rest });
it('names every model it uses from the manifest', () => { for each name of floraNames(rows): expect(manifest.models[name]).toBeTruthy() }, reading public/kit/naturemega/index.json with readFileSync);
```

- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/surface/flora.test.js` → FAIL (no module).
- [ ] **Step 3: Implement** `flora.js`, a header in the file's voice saying what a `flora` block is and that the recipe adds and never replaces.
- [ ] **Step 4: Run** → PASS.

### Task 4: the site takes the recipe; Naboo and Lothal

**Files:**
- Modify: `src/components/galaxy/surface/sites/index.js` (`siteFrom`: `scatter: [...(raw.scatter ?? []), ...floraRows(raw)]`, and the header's field list gains `flora`), `sites/sites.test.js:59`, `src/components/galaxy/surface/scene.js:313` (canopy: `(s.canopy ?? SCATTER[s.kind]?.canopy)`), `scene.js:353` (`createPlacer({ …, kitTint: floraTint(site) })`), `sites/core.js` (Naboo), `sites/outer.js` (Lothal)
- Test: `sites/sites.test.js`

**Interfaces:**
- Consumes: Task 3's `floraRows`, `floraTint`, `floraNames`; Task 2's `kitTint`.

- [ ] **Step 1: Make the sites test accept kit rows**: at `:59`, a scatter row with a `kit:` model passes when its `Name` is in `public/kit/naturemega/index.json`'s `models` (read once at the top of the test with `readFileSync`), else as before. Add, in the same `describe`: `it('names only kit models the manifest has', …)` over `floraNames(site.scatter)`.
- [ ] **Step 2: Compose the rows in `siteFrom`** and run `npx vitest run src/components/galaxy/surface/sites` → PASS (no site has `flora` yet, so nothing changes).
- [ ] **Step 3: Naboo**: in `sites/core.js` add `flora: { biome: 'plains', trees: true }` to `naboo`; delete its `qclover` and `qgrass` rows (`:312-313`); keep `nabootree` and `rock`. **Lothal**: in `sites/outer.js` add `flora: { biome: 'plains', trees: false, tint: { Grass: '#c6ad72', Leaves_Common: '#b8a860', Flowers: '#f2e6bc' } }` (the manifest's material names for the grass, the common leaves and the flowers: read `index.json`'s `materials` and use the exact names); delete its `qgrass` row (`:88`); delete `flower` from both sites' `grass` blocks. Run the sites tests → PASS.
- [ ] **Step 4: Wire the scene**: the canopy line and `kitTint`. Run `npm test` → PASS.
- [ ] **Step 5: Shots before** (on `main`'s picture: stash the working tree or shoot from a second checkout of `main` at the same views; `surface-shot.mjs naboo "0,0,14,30,landing" "60,40,30,200,plain"` and `lothal "0,0,14,30,landing" "-60,30,30,120,prairie"`), then after. Save under `evidence/…/phase-1/`.
- [ ] **Step 6: Budget**: `galaxy-check surface naboo,lothal` at `high` and `mid` with `BUDGET=1 JSON=1`. Expected: within the rows (Naboo under 3M / 700 at high); over its baseline +10% is expected here: re-baseline both levels for both worlds.
- [ ] **Step 7: Verify, commit, push**: lint, test, build, health; commit "Naboo and Lothal take the nature kit as their cover, by a biome recipe" with the before/after numbers and the bytes added (the kit files each world now fetches, from `galaxy-check`'s `glbMB`).

## Phase 2: the forests (Endor, Sorgan, Yavin, Kashyyyk, Dagobah)

### Task 5: four more recipes

**Files:**
- Modify: `src/components/galaxy/surface/flora.js`, `flora.test.js`

- [ ] **Step 1: Tests**: one per biome, asserting its bands are non-empty, its tree names are the spec's (conifer: DeadTree only; temperate: Birch and Pine; jungle: TwistedTree; swamp: DeadTree and TwistedTree), that cover shares sum to 1 (±0.01) in every biome, and that `jungle`'s and `swamp`'s tints give the rocks a mossed colour (`Rocks` material tinted) by default.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** from the spec's table (shares your call, summing to 1; cover mean about 250 triangles: lean on Fern_1/2, Clover, Plant_1/3/5/6, Mushroom_Common, Pebbles; keep Mushroom_Laetiporus to a 0.02 share, it is 3,216 triangles). **Step 4: Run** → PASS.

### Task 6: the forest sites

**Files:**
- Modify: `sites/forest.js` (Endor `:55`, Kashyyyk `:339`, Dagobah `:600`), `sites/outer.js` (Sorgan `:102`), `sites/yavin.js`

- [ ] **Step 1: Endor**: `flora: { biome: 'conifer', density: 0.8 }`; take out its built `fern` scatter rows and its `qfern`/`qmushroom` rows (`:274-275`), keep `redwood`, `spruce`, `bush`, `plant`, `fungus`, `log`. **Sorgan**: `temperate`, remove `qgrass`/`qclover` (`:129-130`), keep `spruce`, `sorganfir`, `sorganfern`. **Yavin**: `jungle`, remove `qfern`/`qclover` (`:217-218`). **Kashyyyk**: `jungle`, `trees: false` (the wroshyrs are the trees), remove `qfern` (`:561`), and add `grass: { h: [0.1, 0.3], w: 0.035, mid: '#3a4a2a', dry: '#6a6a46', cover: 0.4, scale: 60, above: 0.6, wind: 0.3 }`. **Dagobah**: `swamp`, remove `qfern`/`qmushroom` (`:758-759`), add `grass: { h: [0.3, 0.7], w: 0.05, mid: '#4e5a34', dry: '#7a7448', cover: 0.5, scale: 50, above: 0.5, wind: 0.25 }`.
- [ ] **Step 2: Run** `npm test` → PASS (`look.test.js`'s `groundPieces` expectations may name worlds with grass: update them if they enumerate).
- [ ] **Step 3: Shots before and after**, two views a world, under `evidence/…/phase-2/`.
- [ ] **Step 4: Budget**: `galaxy-check surface endor,sorgan,yavin,kashyyyk,dagobah` at `high` and `mid`. Endor: triangles under its baseline (3,345,258 at high in `lab/baseline/surface-high.json`), and say by how much; if it isn't, lower `density` until it is, never the redwoods. The rest within the rows; re-baseline.
- [ ] **Step 5: Commit, push**: "The forest worlds take the kit under their canopies; Kashyyyk and Dagobah grow grass".

## Phase 3: the look, world by world

### Task 7: a split tone in the post, and `grade()`

**Files:**
- Modify: `src/components/universe/post.js` (`FINAL`'s uniforms `:134`, its fragment after the contrast line `:250`, a `grade(opts)` method beside `contrast(k)` at `:399`)
- Test: `src/components/universe/post.test.js`

**Interfaces:**
- Produces: `post.grade({ contrast, sat, vignette, shadow, high, grain })`, each optional; `uShadow`, `uHigh` (`THREE.Color`, default black) added to the picture as the Shire's GRADE does: `c += uShadow * (1 - l)² + uHigh * l²` after the contrast line, before the vignette. Export `GRADE_DEFAULTS = { contrast: 0.07, sat: 1.06, vignette: 0.3, shadow: '#000000', high: '#000000', grain: 0 }`.

- [ ] **Step 1: Test**: in `post.test.js`'s style (it tests pure parts: see what it imports), `it('grade: the split tone is black by default, so the map’s picture is as it was')` asserting `FINAL.uniforms.uShadow.value.getHex() === 0` and `uHigh` likewise, and the fragment contains `uShadow * (1.0 - l) * (1.0 - l)`. If `FINAL` isn't exported, export it for the test.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS. Then `npm run build` and a shot of `/universe` before and after: identical.

### Task 8: the site's `grade`, in the scene and the panel

**Files:**
- Modify: `src/components/galaxy/surface/scene.js` (where `post` is made, `:210`: `post.grade({ ...GRADE_DEFAULTS, ...(site.grade ?? {}) })`), `tune.js` (a `grade` group with the six items, read and set through `post.grade`; `siteCode` prints a `grade: { … }` line), `sites/index.js` header (field `grade`)
- Test: `tune.test.js`

- [ ] **Step 1: Test** `siteCode` prints the grade line from a values list with a `grade` group, and `surfaceTuning({ …, post })` has a `grade` group whose `shadow` item sets `post.grade` (a spy).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.

### Task 9: `LOOK`, for the one-feel sweep

**Files:**
- Modify: `src/components/galaxy/surface/look.js` (export `LOOK`), `src/components/worlds/looks.test.js` (remove `'galaxy/surface'` from `EXPECTED_MISSING`)
- Test: `look.test.js`, `looks.test.js`

- [ ] **Step 1**: `LOOK = { art: 'scanned', tone: 'none', bloom: { threshold: 1.7, strength: 0.8, radius: 0.55 }, why: { tone: 'the surface tone-maps in its own post (universe/post.js), the galaxy’s shoulder, so the picture matches the orbit it came down from' } }`. Run `npx vitest run src/components/worlds/looks.test.js` → PASS.

### Task 10: seventeen looks and grades

**Files:**
- Modify: every site file's world entry (`look` and `grade` blocks)

- [ ] **Step 1**: For each world, from the spec §2's line, write `look` (shadow, edge, halo, fogBelow: keep Coruscant's, Yavin's and Bespin's as they are) and `grade` values. Tune in the browser where you can (`?debug` on the dev server: the panel copies the blocks out); where headless is too slow to iterate, write them from the brief and judge the shot. Starting points: a warm world `shadow` a dark violet-brown, `high` a tan at 0.02–0.04; a cold one `shadow` a deep blue, `high` near zero; `vignette` 0.22 normal, 0.34 on Dagobah and Mustafar; `grain` 0.012 everywhere but Coruscant and Bespin (0); `sat` 0.95 on Sorgan and Dagobah, 1.1 on Naboo and Scarif, 1.04 elsewhere.
- [ ] **Step 2**: `npm test` (the sites' validity test may check `look` fields: keep to the shapes `look.js` reads).
- [ ] **Step 3**: Shots of all seventeen at the landing view, before and after, under `evidence/…/phase-3/`; look at each against its line in the brief.
- [ ] **Step 4**: Commit, push: "Every galaxy world gets a look and a grade of its own".

## Phase 4: the dry, the ash, the ice and the beach

### Task 11: the last four recipes and their sites

**Files:**
- Modify: `flora.js`, `flora.test.js`, `sites/desert.js` (Tatooine), `sites/core.js` (Geonosis `:570`), `sites/outer.js` (Mandalore `:23`), `sites/edge.js` (Mustafar `:5`, Scarif `:293`), `sites/nevarro.js`, `sites/ice.js` (Hoth)

- [ ] **Step 1: Tests** as Task 5's: `dry` has no trees and no grass clumps; `ash` tints `Rocks` near black (`#2a2624`) and lays no plant; `tundra` lays no plant and tints rocks blue-grey; `tropical` has no trees.
- [ ] **Step 2: Implement** the recipes. `dry`'s mid band adds `RockPath_Round_Small_1/2` and `RockPath_Square_Small_1` at a 0.1 share with `flat: 0.97` (they are flats: they lie on level ground only). Scrub tint for `dry`'s plants: `Leaves` toward `#8a8a5a` (use the manifest's material name).
- [ ] **Step 3: Sites**: Tatooine, Geonosis, Mandalore `dry` (Tatooine `density: 0.5`: the Jundland Wastes are bare); Mustafar, Nevarro `ash` (`density: 0.6`); Hoth `tundra` (`density: 0.3`); Scarif `tropical`, remove its `sorganfern` row if the recipe's cover reads better in the shot, else keep both at lower `density`.
- [ ] **Step 4**: Shots before and after; `galaxy-check` at both levels, re-baseline; commit, push: "The dry, ash, ice and beach worlds take the kit's rocks, pebbles and scrub".

## Phase 5: the ground far off, and the living layer

### Task 12: the scan carried to 150 m

**Files:**
- Modify: `src/components/galaxy/surface/ground.js` (`groundMaterial`, where the scan loads `:84-94`)
- Test: `ground.test.js`

- [ ] **Step 1: Test**: `groundMaterial(site, { small: false })` at `high` (stub `detailLevel`) has `uScanFade` at `(40, 150)` and its material carries `antiTile`'s uniforms (`uAtAngle` etc.); at `mid`, `(28, 90)` and no antiTile uniforms; `small` as before.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**: once the scan is in, at `high`/`ultra` and not `small`, `antiTile(material, { scale: 3.7, detail: detailNormal({ size: 256, seed: 11, strength: 1.6 }) })` called last, `uScanFade` to `(40, 150)` (the splat's own fades at ultra stay the larger of the two). **Step 4: Run** → PASS. A shot at 150 m before and after (`surface-shot tatooine "0,0,150,30,far"`).

### Task 13: `living.js`: leaves, wind lines, tracks

**Files:**
- Create: `src/components/galaxy/surface/living.js`
- Test: `src/components/galaxy/surface/living.test.js`

**Interfaces:**
- Produces:
  - `livingFor(site, { level, small }) → { leaves: count | 0, lines: boolean, tracks: boolean, colours: [int, int] }` (pure): leaves on `conifer`, `temperate`, `jungle`, `swamp` at the level's `budget(level).leaves`, 0 when `small`; lines on `plains`, `dry`, `tundra` from `mid` up and not `small`; tracks from `high` up, not `small`, only when the site has grass; colours by biome (`conifer` `[0x95513a, 0x6b4a30]`, `jungle` `[0x4a7a3a, 0x8aa24a]`, `temperate` `[0xd0a040, 0x95513a]`, `swamp` `[0x5a6a3a, 0x8a7a40]`).
  - `createLiving(site, { wind, grass, floorAt, level, small, seed }) → { group, update(dt, focus, movers), setLevel(step), shift(sx, sz), dispose(), tracks }` (`group` holds the leaves' mesh and the lines, added to the scene): makes what `livingFor` says through `createLeaves`, `createWindLines`, `createTracks`; `tracks` (or null) is handed to `createGrass` so the blades read it; `update` steps the leaves with the focus and the first mover as the `car`, spawns lines round the focus, pushes each mover's `track(width).push(x, z, true, now)` and renders the tracks' target; `setLevel(step)` hides all three at the pace's last step.
- Consumes: `createLeaves({ count, wind, floorAt, half, colours, seed })`, `createWindLines({ wind, count, radius, seed })`, `createTracks({ size, texels, count })` (`lib/three/leaves.js:104`, `windLines.js:66`, `tracks.js:95`).

- [ ] **Step 1: Tests** for `livingFor` (each clause above, one `it` each) and for `createLiving` with stubbed makers (`vi.mock` the three lib modules) asserting what is made per biome and that `dispose` disposes each.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.

### Task 14: the scene takes the living layer

**Files:**
- Modify: `scene.js`: make `living` before `grass` (`:364`) so `createGrass` gets `tracks: living.tracks`; `living.update(dt, { x: you.x, z: you.z }, movers)` beside `grass?.update` (`:3008`), movers the party and the rides; `living.setLevel(level)` in `lowerQuality` (`:3248`); `living.dispose()` beside `grass?.dispose()` (`:3542`); `living.group` into the floor bake's `skip` (`:3162`).

- [ ] **Step 1: Wire**, six lines. `npm test`, `npm run build`.
- [ ] **Step 2: Frame time**: `galaxy-check surface endor,naboo` at `high`, `JSON=1`, before (stash) and after on this machine: `p50` within 2 ms × (this machine's slowdown: compare the same run's `p50` to the baseline file's ratio) of before; in practice, no more than 10% slower here. If over, halve the leaves' `count` at `high` and say so.
- [ ] **Step 3: Shots** of Endor (leaves), Lothal (lines) and Naboo (tracks after walking: `__surfaceDo('advance', 40)` then shoot) under `evidence/…/phase-5/`.
- [ ] **Step 4**: Commit, push: "The ground carries its scan to 150 m; leaves fall, the wind shows, the grass lies where you walked".

## Phase 6: the hand-off

### Task 15: the hand-off note and the docs that name the worlds

**Files:**
- Create: `docs/superpowers/HANDOFF-galaxy-surfaces-living-layer.md`
- Modify: `docs/architecture.md` (the galaxy surface paragraph: a sentence on the recipe and the living layer), `docs/autopilot/backlog.md` (tick "Galaxy grounds past 90 m"; add any finding), `docs/superpowers/HANDOFF-kit-worlds.md` (Phase 6's galaxy rows: done here, with this spec's path), `src/components/worlds/worlds.js` (`WORLD_MB['/galaxy']`'s comment, if the bytes moved it)

- [ ] **Step 1**: Write the hand-off as the others are written (`HANDOFF-galaxy-asset-upgrade.md`'s shape): the rules, what each phase did with its numbers, what's left (tree puffs as the far band through `lib/three/kit`'s pools; a Shire pass with the same recipe; the Rick and Morty moons with the space kit), the commands.
- [ ] **Step 2**: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build` → green. Commit, push: "The living layer’s hand-off".
