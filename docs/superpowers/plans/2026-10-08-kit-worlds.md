# Kit worlds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The nine Quaternius packs as one site-wide kit (family GLBs, a manifest, one loader, keyed instanced pools with three LOD bands), Bruno Simon's living layer (puffs, leaves, wind lines, tracks, weather) drawn through those pools, flora generated per cell and streamed on the Expanse, the universe map's planets as data with lazy maps and screen-size LOD, crowds baked into vertex-animation textures, and every world taking the kit one pull request at a time.

**Architecture:** An offline pipeline (`scripts/kit/`) turns a pack into `public/kit/<pack>/<family>.glb` + `index.json`; `src/lib/three/kit.js` loads a kit, shares materials by name, and pools instances per part per LOD band through `lib/three/lod.js`; `src/lib/land/flora.js` turns a land spec into species and cover and `makeCell` writes kit names into a cell's props; the Expanse hands cells to pools under `rt.chunks`. Planets become a `SPECS` table plus per-planet extras over one bake manifest. `scripts/vat-bake.mjs` + `lib/three/vat.js` make crowds one draw.

**Tech Stack:** three.js 0.186 (WebGLRenderer, GLSL rewrites on `MeshLambertMaterial`), `@gltf-transform/{core,extensions,functions}` 4.5, `meshoptimizer`, `sharp`, React 19, Vite 8, Vitest 5 in Node, Playwright-core + Chromium for the probes. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-10-08-kit-worlds-design.md`. Read with it: `docs/research/2026-10-08-folio-2025-assets-foliage-and-quaternius-packs.md` (his numbers, the packs' numbers; quoted per task by section), `docs/research/2026-10-08-site-planets-generation-rigging-today.md` (where each file is today), `docs/superpowers/plans/2026-10-08-natural-worlds.md` (Phases 2 and 3 are this plan's Phases 2 and 3), `docs/superpowers/HANDOFF-world-runtime.md` (what `rt` gives a module).

## Phases and sessions

| Phase | PR branch | Starts from | Blocked by |
|---|---|---|---|
| 1 kit pipeline + loader + pools | `claude/kit-worlds-p1` | `main` (this plan's docs are on `claude/pensive-curie-kjivhw`; merge that branch in first) | nothing |
| 2 living layer (= natural worlds Phase 2 + deltas) | `claude/natural-worlds-p2` | `main` after 1 | 1 |
| 3 flora + the Expanse (= natural worlds Phase 3 + deltas) | `claude/natural-worlds-p3` | `main` after 2 | 1, 2 |
| 4 planets as data | `claude/planets-data` | `main` | nothing (parallel with 1–3) |
| 5 crowds baked + kit creatures | `claude/kit-rigging` | `main` after 1 | 1 |
| 6 world passes | `claude/kit-world-<name>` | `main` after 1 (after 2 where leaves are wanted) | 1 |

One session may do them in order, merging each before the next; or one session per phase; 4 can run beside 1–3.

## Global Constraints

- No new runtime dependency. Offline scripts use what `package.json` has: `@gltf-transform/*` 4.5.1, `meshoptimizer` 1.3.0, `sharp` 0.35.5, `playwright-core` 1.56.
- Every shader change is a GLSL rewrite of a `MeshLambertMaterial`/`MeshStandardMaterial` through `onBeforeCompile`, exported as a pure `xShader(shader, opts) → { vertexShader, fragmentShader, swapped }` tested on stub shaders (`src/lib/three/grass.test.js`'s pattern). No `ShaderMaterial` where a rewrite will do. No `three/webgpu`, no `three/tsl`.
- `src/lib/land/*.js` and `scripts/kit/lib.mjs` import no three.js and no DOM.
- Constants, verbatim: `CELL = 64`, `ORIGIN_CELL = 50000`, chunk hysteresis `1`; kit bands by level `near/mid` = low `30/90`, mid `45/140`, high `70/220`, ultra `110/400`; `leaves` = low `0`, mid `256`, high `1024`, ultra `2048`; pool capacity growth `×1.5`; puff band ends at `2 × mid`; `lodBand` hysteresis `0.1`, re-sort every `0.5` s or `20` m; leaf `alphaTest 0.3`; LOD1 bark `simplify ratio 0.25, error 0.05`, crown cards kept `0.4`, kept cards scaled `×1.25`; kit textures bark `1024` (`-sm 512`), leaf `512`, WebP `q82`; family GLB ≤ `1.5` MiB, tree ≤ `15000` tris, LOD1 ≤ `40 %` of full; VAT `24` fps, three RGBA16F texels a bone a frame; planet px thresholds `24` (halo only) and `6` (hidden); near-map ladder `12` radii (`''`), `6` radii (`-hq`/`-xl`).
- Budgets: new columns in `src/lib/budgets.js` only (`near`, `mid`, `leaves`); every QA script reads them from there.
- A world's `pack.js` lists every `/kit/...` file it fetches; `scripts/pack-check.mjs` stays green.
- Licence and credit: every kit manifest carries `licence: 'CC0-1.0'` and `source`; `scripts/credits.mjs` names Quaternius; nothing from `sketchfab/` is imported by this plan.
- Nothing a visitor can do today changes except the species a world scatters (Phase 6) and the host of Rohan's rig (Phase 5); existing tests stay green and are not loosened.
- Each phase is its own PR to `main`, merge commit, after `npx eslint .`, `npx vitest run`, `npx vite build` pass; browser checks per task. Never merge red, never force-push, never rebase a branch someone else has.
- Comments in the codebase's voice (a prose header per file saying why and listing signatures; British spelling); no model names in code, docs or commits; commits end with the harness's attribution lines.

## Review Focus

1. A kit family whose leaf material is BLEND in the source (CherryBlossom, every nature-pack leaf): after import it must be MASK at `alphaTest 0.3` with coverage-preserving mips, or far crowns go bald (Task 1.2's `coverageMips` test, Task 1.3's manifest `alpha: 'mask'` test).
2. A pool keyed by a cell that is dropped while the camera is inside its mid band: `free(key)` must zero those instances in every level's mesh in the same call, never leave a stale matrix at the puff level (Task 1.5's free test counts every level).
3. A floating-origin shift of 50,000 while pools hold 2,600 trees: every level's matrices move by the same shift in one `shift(dx, dz)` before the next re-sort; a tree must not jump bands because its distance was read against the old origin (Task 1.5's shift test, Task 3.3's origin event test).
4. A planet at 5 px that owns a model on an orbit (the Game Boy, the sitar): hiding the body must hide its orbit models too, and showing it again must not re-run `mount` (Task 4.4's px test checks `group.visible` and the slot's child count).
5. A VAT clip of `length 1` frame (a held pose) or `phase` ≥ `length`: the frame index must wrap with `mod`, never read past the texture's last row (Task 5.1's `vatFrame` test at phase 0.999 × length and at length 1).

---

## Phase 1: the kit pipeline, the loader, the pools (PR 1)

### Task 1.1: `scripts/kit/lib.mjs`, the pure helpers

**Files:** Create `scripts/kit/lib.mjs`, `scripts/kit/lib.test.mjs`.

**Interfaces (produces):**
- `familyOf(name) → string`: `'Birch_3' → 'birch'`, `'Flower_1_Group' → 'flower'`, `'RockPath_Round_Wide' → 'rockpath'`, `'Astronaut_FinnTheFrog' → 'astronaut'`, `'Building_Large_2' → 'building'`: the name before the first `_` followed by a digit or a size word (`Small|Medium|Big|Large|Common|Wide|Thin|Tall|Short|Single|Group|Round|Square|Flowers|Long|Wispy|Wheat`), lower-cased.
- `kindOf(name, pack) → kind` from the spec's list, by family: trees (`birch cherryblossom commontree deadtree giantpine pine tallthick twistedtree tree`) → `tree`, `bush` → `bush`, `grass` → `grass`, `flower|petal` → `flower`, `fern|clover|plant` → `plant`, `mushroom` → `mushroom`, `rock` → `rock`, `rockpath` → `path`, `pebble` → `pebble`, `planet` → `planet`, `astronaut|mech|enemy|cow|horse|zebra|llama|pig|pug|sheep` → `character`, `rover|spaceship` → `vehicle`, `street|sidewalk` → `street`, `decal` → `decal`, `building` → `building`, else `prop`.
- `thinCards(positions: Float32Array, indices: Uint32Array, keep: number, seed: number) → { positions, indices, map: Uint32Array }`: treats the index list as quads (every 6 indices, two triangles sharing two vertices) when it is, else triangle pairs; keeps a seeded `keep` fraction of them (mulberry32 from `src/lib/seeded.js`'s algorithm, copied, not imported); scales each kept card about its own centroid by `1 / sqrt(keep)` capped at `1.25`; returns compacted arrays and `map` (new vertex → old vertex) so other attributes (normals, uvs, `_WIND`) can be gathered.
- `windFromColor(color0: Float32Array, stride: 3 | 4) → Uint8Array`: the red channel ×255 rounded.
- `boundsOf(positions, { trunkFraction = 0.08 }) → { radius, height, trunk }`: `radius` the XZ extent's half-diagonal, `height` max y, `trunk` the XZ radius of vertices below `trunkFraction × height`.
- `tonesOf(rgba: Uint8Array, w, h) → [ [r,g,b], [r,g,b] ]`: mean colour of texels with alpha > 128, then that colour at luma ×0.88 and ×1.12, clamped, as linear 0..1.

- [ ] Step 1: Write `lib.test.mjs`: `familyOf` on the ten names above; `kindOf` on one name per kind; `thinCards` on a 4-quad fixture with `keep 0.5, seed 1` keeps 2 quads, 8 vertices, `map.length === 8`, and each kept card's centroid is unchanged within 1e-6 while its extent grew ×1.25; `windFromColor` on `[0.137, 0.137, 0.137, 1, 1, 1, 1, 1]` stride 4 gives `[35, 255]`; `boundsOf` on a unit cylinder of radius 0.2 under a sphere of radius 1 at y 3 gives `trunk 0.2 ± 0.02`, `height 4`; `tonesOf` on 4 texels of pure green with alpha 255 gives tones with equal r/b and g ≈ 0.88 / 1.0.
- [ ] Step 2: Run `npx vitest run scripts/kit/lib.test.mjs` (fail: module missing).
- [ ] Step 3: Implement `scripts/kit/lib.mjs` with the five exports.
- [ ] Step 4: Run the test (pass).
- [ ] Step 5: Commit `feat(kit): the pure helpers of the pack pipeline`.

### Task 1.2: `coverageMips` into `src/lib/three/textures.js`

**Files:** Modify `src/lib/three/textures.js` (add an export), `src/components/galaxy/surface/kit.js:276-339` (`keepCoverage` becomes a call to the new export), create `src/lib/three/textures.coverage.test.js`.

**Interfaces (produces):** `coverageMips(canvasOrImageData, { cut = 0.3 }) → { mipmaps: ImageData[], coverage: number }`: hand-built mip chain where each level's alpha is scaled so the fraction of texels over `cut` equals the base level's (the galaxy kit's rule, kit.js:303-339, moved verbatim); `coverageTexture(texture, { cut })` sets `texture.mipmaps`, `generateMipmaps = false`, `minFilter LinearMipmapLinear`.

- [ ] Step 1: Test: a 64² ImageData with a 32² opaque disc (coverage 0.196) → every mip's coverage within 0.03 of the base; the galaxy kit's `leafTexture()` still returns a texture with `mipmaps.length === 7` (import the kit in Node with the fake canvas `src/lib/three/gpuFake.fixture.js` offers, or skip that assertion if it needs a DOM: say which in the test).
- [ ] Step 2: Run (fail), implement, run (pass). `npx vitest run src/components/galaxy` stays green.
- [ ] Step 3: Commit `refactor(textures): coverage-preserving mips, shared`.

### Task 1.3: `scripts/kit/import.mjs` and the manifest

**Files:** Create `scripts/kit/import.mjs`, `scripts/kit/manifest.mjs`, `scripts/kit/manifest.test.mjs`, `scripts/kit/README.md`; fixture `scripts/fixtures/kit/tiny/` (two `.gltf` trees of one family, 8 triangles each, one 8×8 bark PNG, one 8×8 leaf PNG with alpha, `COLOR_0` on both; written by hand or by a 30-line generator checked in beside it).

**Interfaces (produces):**
- CLI: `node scripts/kit/import.mjs <pack> [family …] [--from <dir>] [--out public/kit/<pack>] [--dry]`. `<pack>` is a key of `scripts/assets-fetch.mjs`'s `PACKS` (`naturemega`, `nature`, `space`, `farm`, `city`, `street`, `furniture`); source dir defaults to `lab/assets/<pack>/`, the glTF subfolder per pack in `SOURCES` (`naturemega: 'glTF'`, `nature: 'glTF'`, `space: ['Characters/GLTF','Environment/GLTF','Items/GLTF','Vehicles/GLTF']`, `city: 'Exports/glTF (Godot)'`, `farm|street|furniture: '<pack>-glb'` from Task 1.4).
- `importPack({ pack, from, out, families, log }) → manifest`: per family, one `Document`: every model's mesh as its own node named `name`, primitives tagged `extras.part = 'bark' | 'leaves' | 'main'` by material (leaf materials are those whose name starts `Leaves|Leaf|Flowers|Grass` or whose base texture has alpha), `COLOR_0` → `_WIND` (`windFromColor`, `Uint8 normalized`) on `naturemega`, dropped elsewhere; LOD1 as a second mesh `name.lod1` (bark `simplify({ ratio: 0.25, error: 0.05, lockBorder: false })`; leaves `thinCards(…, 0.4, seed)` with attributes gathered by `map`); textures: `textureCompress` to WebP q82 after resizing by slot (`baseColor` on bark 1024, leaf 512, normals 1024, the space atlas 512 untouched); every leaf material `alphaMode MASK`, `alphaCutoff 0.3`, `doubleSided`; `dedup`, `prune`, `meshopt({ level: 'medium' })`; written to `<out>/<family>.glb`.
- `manifest.mjs`: `buildManifest(pack, families: [{ family, file, models: [...] }]) → manifest` (the spec's schema) and `checkManifest(manifest, files: { [path]: bytes }) → string[]` (errors: a model's file missing, family GLB over 1.5 MiB, a tree over 15,000 tris, a tree's `tris1 > 0.4 × tris`, any model's `tris1 > tris`).

- [ ] Step 1: `manifest.test.mjs`: `buildManifest` on the tiny fixture's shape yields `models.Tiny_1.kind === 'tree'`, `parts` `['bark','leaves']`, `materials.Leaves_Tiny.alpha === 'mask'`, `tones` two linear colours; `checkManifest` flags a file of 1.6 MiB, a tree of 16k tris, a lod1 at 50 %.
- [ ] Step 2: Run (fail), implement `manifest.mjs`, run (pass).
- [ ] Step 3: Implement `import.mjs` (gltf-transform `NodeIO` with `ALL_EXTENSIONS`, `MeshoptEncoder`, `sharp` for textureCompress), run it on the fixture: `node scripts/kit/import.mjs tiny --from scripts/fixtures/kit/tiny --out /tmp/kit-tiny` → `tiny.glb` + `index.json`; assert in `manifest.test.mjs` (an `it` that runs the CLI with `execFileSync` and reads the output) that the GLB opens in gltf-transform with 2 meshes + 2 lod1 meshes, 2 materials, `_WIND` present, leaf `alphaMode MASK 0.3`.
- [ ] Step 4: Run the real packs: `node scripts/assets-fetch.mjs naturemega space farm` (or `--from /path/to/tilakverse-assets/quaternius/<pack>`), then `node scripts/kit/import.mjs naturemega` (all families), `node scripts/kit/import.mjs space`. Record sizes in the README: the megakit must come to under 12 MiB for 116 models; if a family is over 1.5 MiB, split it into numbered files (`<family>.glb`, `<family>-2.glb` …, in model order); only a model over 1.5 MiB on its own has its bark colour halved to 512, said in the manifest's `materials[name].maps`.
- [ ] Step 5: Write `scripts/kit/README.md` (the manual: fetch, import, check, credit; the manifest's fields; the budgets) and add `scripts/kit/import.mjs` to `README.md`'s scripts list.
- [ ] Step 6: Commit `feat(kit): a pack as family GLBs and a manifest` (the `public/kit/` GLBs in a second commit `assets(kit): nature megakit, space kit`).

### Task 1.4: FBX packs through `scripts/kit/fbx.mjs`

**Files:** Create `scripts/kit/fbx.mjs`. Uses `scripts/fbx-to-glb.mjs`'s `fbxToGlb(file, out, { maps })`.

**Interfaces (produces):** `node scripts/kit/fbx.mjs <pack>` → `lab/assets/<pack>-glb/<Name>.glb` for every FBX in `lab/assets/<pack>/FBX/` (dev server on 5188 started by the script if not up, as `fbx-to-glb` expects), then Task 1.3's import reads that folder. For the farm animals the clips come through (`Armature|Walk` → named `Walk` by stripping `Armature|`); for the furniture the FBX's material colours are kept.

- [ ] Step 1: Run on `farm`; check with `node scripts/kit/import.mjs farm --dry` that `Horse` lists `rig: { bones: N, clips: { Idle, Walk, WalkSlow, Run, Jump, Death } }` (durations from the GLB).
- [ ] Step 2: Import `farm` for real; `checkManifest` green; `Horse.glb` under 400 KB.
- [ ] Step 3: Commit `feat(kit): FBX packs through fbx-to-glb; the farm animals in`.

### Task 1.5: `src/lib/three/kit.js`: the loader, the materials, the pools

**Files:** Create `src/lib/three/kit.js`, `src/lib/three/kit.test.js`, `src/lib/three/kit.fixture.js` (a fake `load(url)` returning a tiny parsed scene shaped like Task 1.3's output: 2 meshes × 2 primitives, names, extras, materials by name; and a manifest). Modify `src/lib/budgets.js` (three columns), `src/lib/budgets.test.js`.

**Interfaces (consumes):** `loadGltf(url)` from `src/lib/three/gltf.js`; `createHouse`/`house.material()` from `house.js` (optional: when no house is given, a plain `MeshLambertMaterial`); `faceless`, `wind` from `foliage.js` (Task 1.6 adds `weight`); `lodBand` from `lod.js`; `coverageTexture` from Task 1.2.

**Interfaces (produces):**
- `budget(level).near`, `.mid`, `.leaves` with the Global Constraints' values; `COLUMNS` gains `'near', 'mid', 'leaves'`.
- `loadKit(pack, { load = loadGltf, base = '/kit', house = null, wind = null }) → { manifest: Promise, model(name) → Promise<{ parts, radius, height, kind, tones }>, lod1(name) → Promise<parts>, material(name) → Material, dispose() }`. `parts` = `[{ geometry, material, local: Matrix4 }]` (the placer's contract). Materials by manifest name through `kitMaterial(def, { house, wind })`: bark `house ? house.material() : new MeshLambertMaterial()` with `map` (+ `normalMap` where the manifest lists one); leaves the same + `alphaTest 0.3`, `side DoubleSide`, `faceless`, `wind(material, { kind: def.leaf ? 'tree' : 'shrub', weight: '_wind', time: wind?.time })` (`'_wind'`: GLTFLoader lower-cases custom attributes, so the GLB's `_WIND` loads as `_wind`), maps `coverageTexture`d; the space atlas material once for the pack.
- `createPool(kit, name, { bands = [budget().near, budget().mid], cap = 256, shadows = true, puff = null }) → { set(key, items), free(key), shift(dx, dz), update(camera, dt), stats: { total, levels: number[] }, group, dispose() }`. Levels: 0 full parts, 1 lod1 parts, 2 the puff (`puff` is `{ geometry, material }` supplied by Phase 2; until then level 2 draws lod1). An item: `{ x, y, z, yaw, scale = 1 }`. `set` replaces the key's items (the old ones out at once, the new marking a re-sort); `free` removes them from every level at once, each level's last instance moved into a freed slot (no re-sort, no rewrite of the pool); `update` re-sorts by `lodBand(dist, [bands[0], bands[1], 2 × bands[1]], prev, 0.1)` every 0.5 s or 20 m of camera travel, writing each level's `InstancedMesh.count` and matrices (`DynamicDrawUsage`); capacity grows `×1.5` by replacing the meshes (geometry shared) when `total > cap`; shadows: `castShadow` on level 0 only.

- [ ] Step 1: `budgets.test.js`: every row has `near < mid`, `leaves` as listed; `COLUMNS.length === 12`.
- [ ] Step 2: `kit.test.js` with the fixture: `model('Tiny_1')` yields 2 parts whose `material === material('Bark_Tiny')` identity across `Tiny_1` and `Tiny_2`; leaf material has `alphaTest 0.3` and `userData.wind`; `createPool` `set('a', 10 items at 10 m)`, `set('b', 10 at 100 m)`, `set('c', 10 at 300 m)` then `update(cameraAt0)` → `stats.levels` `[10, 10, 10]`; `free('b')` → `[10, 0, 10]` and level 1's mesh `count === 0`; `shift(-1000, 0)` then `update` → every instance moved by `-1000` in x (read `getMatrixAt`), bands unchanged; `set` of 300 items at cap 256 → every level's mesh `instanceMatrix.count ≥ 384`.
- [ ] Step 3: Run (fail), implement, run (pass).
- [ ] Step 4: Commit `feat(three): the kit loader and its pools`.

### Task 1.6: `wind({ weight })` in `src/lib/three/foliage.js`

**Files:** Modify `src/lib/three/foliage.js:175-224`, `src/lib/three/foliage.test.js`.

**Interfaces (produces):** `windShader(shader, { weight = null })`: when `weight` is a name, the vertex shader declares `attribute float <weight>;` and multiplies the bend and the leaf flutter by it (so a trunk's foot, at 0.03–0.14, barely moves and a crown at 1 moves fully); `wind(material, { weight })` passes it through and adds `|w:<name>` to the cache key.

- [ ] Step 1: Test: with `weight: '_wind'` (GLTFLoader lower-cases custom attributes: the GLB's `_WIND` loads as `_wind`) the rewritten vertex shader contains `attribute float _wind;` and `* _wind`; without, neither; `swapped.wind === true` both ways.
- [ ] Step 2: Run (fail), implement, run (pass). `npx vitest run src/lib/three/foliage.test.js src/components/galaxy` green.
- [ ] Step 3: Commit `feat(foliage): a per-vertex wind weight`.

### Task 1.7: the galaxy placer takes `kit:` models

**Files:** Modify `src/components/galaxy/surface/placer.js:46-63, 94-132, 409-421` (resolve `model: 'kit:<pack>/<Name>'` through a module-level `kits` map of `loadKit(pack)`; `usesModel(spec)` true for it; scatter parts come from `kit.model(name).parts` and lod1 from `kit.lod1(name)`), `src/components/galaxy/surface/placer.test.js`, `scripts/pack-check.mjs` (`/kit/` an asset prefix), `public/sw.js` (`kit` served from an installed pack). `src/components/galaxy/pack.js` gains the kit files a site row uses, in Phase 6: a world's pack lists only the kit files it fetches, and no galaxy row names a kit model before then.

- [ ] Step 1: Test (placer.test.js, with a fake `loadKit` injected through an exported `setKitLoader` or the existing injection pattern the file uses): a scatter of 3 items with `model: 'kit:naturemega/Fern_1'` makes 1 `InstancedMesh` per part with `count 3`; `hasModel` stays false for an unknown kind; a `kit:` single `put` places `parts` under one Group.
- [ ] Step 2: Run (fail), implement, run (pass); `node scripts/pack-check.mjs` green.
- [ ] Step 3: Commit `feat(galaxy): a scatter row can name a kit model`.

### Task 1.8: `scripts/kit-check.mjs`, credits, docs

**Files:** Create `scripts/kit-check.mjs` (reads every `public/kit/*/index.json`, `checkManifest` against the files, exit 1 on errors, prints the per-pack MiB). Modify `scripts/credits.mjs` (a `kits()` reader of the manifests → a "Quaternius" line in the CC0 section with the pack names and model counts), `CREDITS.md` (regenerated by `npm run credits`), `docs/architecture.md` (a paragraph under "Third-party models": the kit, its loader, the pools; pointing at `scripts/kit/README.md`), `docs/assets/quaternius.md` (the "Then import…" paragraph now says `scripts/kit/import.mjs`).

- [ ] Step 1: `node scripts/kit-check.mjs` green on the three imported packs; `npm run credits` names Quaternius.
- [ ] Step 2: `npx eslint .`, `npx vitest run`, `npx vite build` green. Commit `chore(kit): check, credits, docs`. Open PR 1.

---

## Phase 2: the living layer (PR 2, branch `claude/natural-worlds-p2`)

Natural worlds Tasks 2.1–2.5 are already on `main` (#638), so this phase is the deltas below on top of them, each its own commit.

### Task 2.4′: puffs are the pools' far band; leaves by budget

**Files:** `src/lib/three/puffs.js` (natural Task 2.4) gains `puffFor(tones: [a, b], { radius, height, trunk, wind, sun, bark, seed, house }) → { geometry, material }` (the manifest's size, tones and trunk fit his cards to the model; `house` dresses it in the house's look); `src/lib/three/kit.js` `loadKit(pack, { puffs = true, puffWind })` makes each model's puff once a kit, seeded by a hash of its name, and hands it out as `kit.puff(name)` (null for a model without tones, with `puffs` false, or once the kit is disposed of), `createPool` takes `puff ?? kit.puff(name)` as level 2, and level 2's instances always face the camera, yaw only, turned about up on each re-sort (there is no `facing` option: the camera is the only way they face); `leaves.js`'s `createLeaves({ count = budget(detailLevel()).leaves })`, a count of 0 → `mesh: null`.

- [ ] Step: `kit.test.js` gains: with a `puff` supplied, level 2 draws the puff geometry (`mesh.geometry === puff.geometry`), and after `update` with the camera at `(100, 0, 0)` a level-2 instance's matrix has its +Z toward the camera (dot > 0.99); a kit's own puff is one a model, seeded by its name (two models of one size differ in silhouette), and `kit.puff` answers null once the kit is disposed of. `puffs.test.js` gains: `puffFor` without a `trunk` has no NaN in any attribute. `leaves.test.js` gains: `createLeaves()` at `?quality=low` fakes to count 0 and makes no mesh.
- [ ] Step: Commit with Task 2.4's commit, message `feat(three): his trees, falling leaves and wind lines; puffs as the kit's far band`.

### Task 2.6: `src/lib/three/weather.js` (pure)

**Files:** Create `src/lib/three/weather.js`, `weather.test.js`.

**Interfaces (produces):** `createWeather({ day = 240, seed = 0, year = 365 × 86400 }) → { at(nowSeconds, out?) → { temperature, humidity, electric, clouds, wind, rain, snow, dayProgress, lightColour, lightIntensity, shadowColour, fogA, fogB, fogNear, fogFar, leaves }, override(values, { duration = 5, now }), release({ duration, now }) }`, his functions verbatim (his `Weather.js`, `Cycles.js`, `DayCycles.js`, `YearCycles.js`; research note §2 Weather and Cycles, and `2026-10-08-folio-2025-physics-terrain-streaming.md` part 2 §6, with the day and year presets read from his source): `noise(x) = sin(x)·sin(1.678x)·sin(2.345x)` on **t = nowSeconds / day, in days, not seconds** (`seed` shifts t by `seed × 1000`, never the hour); temperature `year.temperature + day.temperature + 7.5·noise(0.4t)` (year 5/15/25/15 winter/spring/summer/fall, day 5/0/−7.5/0 day/dusk/night/dawn; his −15..40 is a debug panel's range, not a clamp: the sums stay in −10..37.5); humidity `year.humidity + 0.2·noise(0.36t)` (0.8/0.65/0.5/0.65, so 0.3..1); electric (his `electricField`) `day.electricField · noise(0.53t)` (0/0.25/1/0.25); clouds `noise(0.44t)` (−1..1); wind `0.5·noise(t) + 0.5`; rain `remapClamp(humidity, 0.65, 1, 0, 1) × remapClamp(clouds, 0, 1, 0, 1)`; snow `remapClamp(rain, 0.05, 0.3, 0, 1) × remapClamp(temp, 0, −5, 0, 1) + remapClamp(temp, 0, 10, 0, −1)` (−1..1, below nought the thaw); worked out in that order, each override applied before the next one reads it (so holding rain holds snow on a cold night); day cycle stops day 0/0.15, dusk 0.25, night 0.35/0.6, dawn 0.8, day 0.9 (and day at 1, his wrap step), smoothstepped, his presets light ×intensity / shadow / fogA / fogB / fogNear / fogFar: day `#ffd2c2` ×1.2 / `#6d3fff` / `#00ffff` / `#9b89ff` / 0.315 / 1.25, dusk `#ff8181` ×1.2 / `#4e009c` / `#3e53ff` / `#ff4ce4` / 0 / 1.25, night `#3240ff` ×3.8 / `#2f00db` / `#10266f` / `#490a42` / −0.85 / 1, dawn `#ffa882` ×1.2 / `#db004f` / `#f885ff` / `#ff7d24` / 0.3 / 1.25, colours as linear [r, g, b] (what `THREE.Color('#…')` holds) lerped in linear; the year's stops a quarter apart from 0.125 with `leaves` 0.25/0/0.25/1; the override eased power1.out (gsap's default) from wherever its strength stood, a new override replacing the old one's values at once; `windOf(weather) → { strength: remapClamp(wind, 0, 1, 0.1, 1) }` for `createWind`; `leavesOf(weather) → { ratio: min(1, 2^(round(remap(leaves, 0.25, 1, 7, 11)) − 11)) }`, his leaf count over his 2048, for the leaves' budget.

- [ ] Step 1: Test: every output within its range over 10,000 samples; `at(0)` equals `at(day)`'s `dayProgress`; the day's colours at each stop equal his (`THREE.Color` of his hex); `override({ rain: 1 })` reaches rain 1 after 5 s (eased out), snows on a cold dry night, and `release()` returns to the function within 5 s; determinism by seed; `windOf` 0 → 0.1, 1 → 1.
- [ ] Step 2: Run (fail), implement, run (pass). Commit `feat(three): his weather and day, as one pure clock`.

---

## Phase 3: flora, and the Expanse drawn through pools (PR 3, branch `claude/natural-worlds-p3`)

Natural worlds Tasks 3.1–3.5 are already on `main` (#648), so this phase is the deltas below on top of them.

### Task 3.0: `src/lib/land/flora.js`; `makeCell` writes kit names

**Files:** Create `src/lib/land/flora.js`, `flora.test.js`. Modify `src/lib/land/spec.js` (type `forest` added; `kit.kinds` replaced by `flora` from `floraFor`), `src/lib/land/cell.js:182-215` (placement by species), `cell.test.js`.

**Interfaces (produces):**
- `floraFor(type) → { species: [{ kind, names: string[], weight, perCell, clump, slope: [min, max], on: 'grass' | 'bank' | 'any', shade, grass? }], cover: [same shape] }` with the spec's tables (§4) as the kit has them (green-leaved families for the green lands, Birch an autumn tenth of their trees at most; no palms and no snowy rocks in the kit), for the five types and a sixth, `forest` (GiantPine and Pine thick, CommonTree, a little Birch, bushes and rocks, 34 a cell; ferns, mushrooms, plants, clover, tufts and pebbles, 90 a cell: 40 species a cell drew more than high's 3M triangles in a whole world seen from above); `clump` is the perlin clumping amplitude (his `15` m at `0.02`); `shade` the crown radius painted into the mask (leafy trees 6, bushes 2, bare trees and the rest 0); `grass` the least mask `G` a row `on: 'grass'` stands on (0.5 unless it says). Every type keeps the crate, the physics toy, as a species row: kind `'crate'`, no names, weight 0, three a cell, on thick grass (`grass: 0.9`).
- `makeCell(spec, cx, cz, { shade = true } = {})` → `props: [{ kind, name, x, y, z, yaw, scale }]` with `name` from the species' `names` by seeded pick; placement by Poisson per species (spacing `max(2, 64 / sqrt(perCell × 2))`), each row from its own seeded sub-stream with every draw made before any test, moved by his clumping and, where a row clumps, thinned to woods and glades (a third channel of the clump noise, kept as often as its `smoothstep(−0.4, 0.2)`; the meadow's grass and flowers the other way about, into the glades); kept off the rows placed before it by a cross-species room (`ROOM`: tree 2 m, bush 1, rock 2.5, crate 1, the two kinds' summed; the cover keeps off them, nothing keeps off the cover); accepted when the mask's `G ≥ grass` (the row's `grass`, 0.5 unless it says) for `on: 'grass'`, within 6 m of a river's or a lake's edge (`surface(spec, rivers, x, z, h, s).near ≤ 6`) or on the beach (under 1.5 m above the sea) for `'bank'`, and the slope within range; the crowns' shade painted into the mask's G after placement, softly: `G × 0.75` at the trunk easing (smoothstep) to all of G at the crown's edge (`shade × scale` metres), the darkest crown's where crowns overlap, clipped at the cell's edge, and no colour channel (R stays 0; `shade: false` gives the mask before it); `scale` `0.8 + 0.4 × r^1.6` (the galaxy's rule).

- [ ] Step 1: `flora.test.js`: each type returns ≥ 3 species, every `names[i]` exists in `public/kit/naturemega/index.json` (read in the test), weights sum to 1; `cell.test.js` gains: a temperate cell's props have `name` set, every tree's `(x, z)` reads `G > 0.5` in the mask before shading, the mask under a tree is darker after than before, determinism by seed, and a cell at `cx 15` equals itself from `cx 16`'s region list (the existing determinism test extended).
- [ ] Step 2: Run (fail), implement, run (pass); `node scripts/land-preview.mjs 7` renders trees as green discs by `shade` (extend the preview to draw `props` by kind; add one PNG to the PR).
- [ ] Step 3: Commit `feat(land): the flora of a land, placed per cell by name`.

### Task 3.4′: cells into pools, the origin shift, the probe

**Files:** `src/components/expanse/surface/scene.js` (natural Task 3.4) draws a cell's props with `pools[name].set(cellKey, items)` / `free(cellKey)` from one `loadKit('naturemega', { house, wind: { time, dir }, puffWind: wind })` (the kit's `wind` is the clock and the direction, `wind.uniforms.uWindTime` and `uWindDir.value`; `puffWind` createWind's own, for the puffs); the pools are the `land` group's (world metres, at minus the origin) and band from the camera's world place, so an origin shift moves them with the land and calls no `pool.shift` (both would move them twice); the grass centre, the leaves and the tracks' focus shift in the one handler; `pack.js` lists the kit globs; `scripts/perf-probe.mjs` gains journey `expanseDrive` (as natural Task 3.5 says) and the budget assertion reads `budget(level).near/mid`.

- [ ] Step: `module.test.js` (fake `rt`, fake loader): after `ask` answers 9 cells the pools' `stats.total` equals the cells' prop count; after `drop` of one cell it falls by that cell's count; an origin shift of `(+50000, 0)` (the runtime's, as the car strays east) moves `land`, and so every pool's instances in the scene's frame, by `−50000` in x, leaves each item's world position as it was and re-bands nothing, and the stream, fed world metres, asks for the same cells (the chunk grid's cells are unchanged).
- [ ] Step: `node scripts/perf-probe.mjs expanseDrive` worst frame quoted in the PR; at high ≤ 3M triangles (`renderer.info`), draw calls ≤ 700.
- [ ] Step: Commit with Task 3.4's commit.

---

## Phase 4: planets as data (PR 4, branch `claude/planets-data`)

### Task 4.1: `planetSpecs.js` and a behaviour-pinning test, then the refactor

**Files:** Create `src/components/universe/planetSpecs.js`, `planetSpecs.test.js`. Modify `src/components/universe/planets.js` (`BUILDERS` → `SPECS` + `EXTRAS`), `planets.test.js`.

**Interfaces (produces):** `SPECS = { [id]: { maps: ('colour' | 'normal' | 'rough' | 'night' | 'glow' | 'clouds')[], material: 'standard' | 'physical', cloud: { r, seg: [w, h], small: [w, h], speed, alpha } | null, orbit: { r, tilt, speed, slot: string } | null, hooks: ('cel' | 'dither' | 'cybertron')[] } }` for the 11 fandom planets (the research note §1 table 2.2 has every constant); `EXTRAS = { [id]: (p, T, u) => void }` with the unique props moved verbatim from each builder; `buildFromSpec(id, T, u, tier) → p` does what the repeated 50–260 lines did.

- [ ] Step 1: Before touching `planets.js`, write `planetSpecs.test.js`'s `it('builds every fandom as before')`: with a fake texture set (every `MAPS` name → a 1×1 `DataTexture`) and the current `BUILDERS`, record for each id the sorted list of `[child.name, child.type, child.geometry?.type, material?.type]` three levels deep and the list of `onBeforeCompile` cache keys, into `src/components/universe/planetSpecs.fixture.json` (a step that writes the file once, kept in the test as `UPDATE=1`).
- [ ] Step 2: Implement `SPECS`, `EXTRAS`, `buildFromSpec`; rewire `buildPlanet` to them; the test now compares the new build against the fixture and passes (names, types, hook keys identical). `planets.test.js` (variants ≤ 24, files exist) green.
- [ ] Step 3: Commit `refactor(universe): the planets' shared shape as data`.

### Task 4.2: one bake pipeline and its manifest

**Files:** Create `scripts/planets/bake.mjs`, `scripts/planets/earth.mjs` (ports `scripts/build-universe-textures.py`'s Earth/sun/plates/hull/paper, fetching the same Solar System Scope and ambientCG sources into `node_modules/.cache/universe`), `scripts/planets/manifest.mjs` + test. Modify `scripts/planets/sphere.mjs` (`save()` appends to the manifest), `scripts/build-cybertron-planet.mjs` and `scripts/build-invincible-planet.mjs` (their `save` → `sphere.mjs`'s; moved to `scripts/planets/transformers.mjs`, `invincible.mjs`), `src/components/universe/planetMaps.js:30-37, 50-54, 84-87` (`MAPS` and `mapFile` read `public/textures/universe/index.json`), `planets.test.js:28-41`. Delete `scripts/build-universe-textures.py`, `scripts/build-fandom-planets.mjs` (folded into `bake.mjs`), `public/textures/universe/starwars*.webp`, `alderaan.webp`; move `sky.webp`, `sky-hq.webp`, `sky-glow*.webp` to `public/textures/earth/` and point their readers there (`grep -rn "universe/sky" src`).

**Interfaces (produces):** `index.json`: `{ [name]: { sizes: { sm?: [w, h], std: [w, h], hq?: [w, h], xl?: [w, h] }, xl: 'ktx2' | null, kind: 'colour' | 'normal' | 'rough' | 'night' | 'glow' | 'clouds' } }`; `mapFile(name, level)` picks `sm` for low/mid, `std` for high, `hq` then `xl` for ultra's near set, from the manifest; `MAPS` is `Object.keys(manifest)`.

- [ ] Step 1: `manifest.test.mjs`: `recordSave(manifest, name, sizes)` merges; `planetMaps.test.js`: `mapFile('music', 'ultra')` → `music-xl.ktx2`, `mapFile('transformers', 'high')` → `transformers.webp` (std 2048 by the manifest), `mapFile('earth-clouds', 'low')` → `earth-clouds-sm.webp`; every name in the manifest has a file for every listed size (`planets.test.js`'s existing check, now manifest-driven).
- [ ] Step 2: Run (fail), implement, run (pass). Run `node scripts/planets/bake.mjs --all` once (an hour on a laptop; `--only earth,transformers,invincible` first) and diff `public/textures/universe/` byte sizes against before in the PR body (±5 %; the Earth port must match the Python's night-map mean within 3 %, measured by a 20-line `sharp` script in the PR).
- [ ] Step 3: Commit `feat(planets): one bake, one manifest; the orphans gone`.

### Task 4.3: lazy maps: `-sm` first, a three-step near ladder

**Files:** Modify `src/components/universe/planetMaps.js:95-114` (`loadTextures({ small })` loads the `sm` size of every name; `nearSet(id, level)` returns `{ std, near }` sets), `src/components/universe/nearMaps.js` (`wanted(planets, camera)` yields `{ id, step: 1 | 2 }` by `12` and `6` radii, `evict` on leaving `15` and `7.5`; swap `std` at step 1, `hq`/`xl` + fine geometry at step 2), `nearMaps.test.js`, `src/components/universe/scene.js:693` (the near maps now on every tier, `small` included, with step 2 off on low/small as before).

- [ ] Step 1: `nearMaps.test.js`: a planet at 10 radii is wanted at step 1, at 5 radii step 2, both evicted past their hysteresis; two planets within 6 radii both at step 2, a third waits (the existing ≤ 2 rule).
- [ ] Step 2: Run (fail), implement, run (pass). Measure: in Chromium at `/universe` on high, bytes of `textures/universe/*` before the first frame ≤ 0.7 MB (perf-probe `universe` journey's `load` phase `texMB`); quote it in the PR.
- [ ] Step 3: Commit `perf(universe): the small maps first, the fine ones as you near`.

### Task 4.4: screen-size LOD for every body

**Files:** Create `src/components/universe/planetLod.js` (pure) + test. Modify `src/components/universe/planets.js:1215-1403` (`update(t, camera, live, px)`), `src/components/universe/scene.js:4601-4610, 4867-4874`.

**Interfaces (produces):** `pxOf(radius, distance, fovYDeg, viewportH) → number` (the body's height on screen); `lodOf(px) → 'full' | 'halo' | 'hidden'` at `24` and `6`; `segOf(level, small) → [w, h]` through `detail.seg` (base 64×40, small 44×28); `p.setLod(lod)`: `'halo'` hides the shell (halo shown), the cloud sphere, every orbit's models and slot ticks; `'hidden'` sets `group.visible = false` (and `mount` is not re-run on return: the slot keeps its child). `scene.js`: `px` from `pxOf` per body; sun vectors and the near sort for the two nearest every frame, the rest every fourth frame (`frame % 4 === i % 4`).

- [ ] Step 1: `planetLod.test.js`: `pxOf(50, 5000, 60, 900)` ≈ `2 × 50 / (2 × 5000 × tan(30°)) × 900` within 1 %; `lodOf(30) === 'full'`, `lodOf(10) === 'halo'`, `lodOf(5) === 'hidden'`; `planets.test.js` gains: `setLod('halo')` on a built middleearth leaves `body.visible` true, `clouds.visible` false, every orbit holder `visible` false; `setLod('hidden')` then `setLod('full')` leaves the model slot's child count unchanged.
- [ ] Step 2: Run (fail), implement, run (pass). `node scripts/universe-check.mjs` green; `lab/universe/baseline/high.json` regenerated with the three 2.4-radii poses (`middleearth`, `breakingbad`, `office`) added; overview calls at 1280×720 ≤ 150 (today's) and triangles ≤ 1.0M (today 1.20M), quoted in the PR.
- [ ] Step 3: Commit `perf(universe): a body draws for its size on screen`.

### Task 4.5: surface where there was none

**Files:** Modify `src/components/universe/planetShading.js` (a `gasHook(mat, { bands, speed })`: latitude bands scrolled by `uTime` at two speeds, from the galaxy's gas family's idea, 20 lines of GLSL), `planetSpecs.js` (`music`, `marvel` hooks `['gas']`), `scripts/planets/earth.mjs` (a normal map from the day map's land mask: land `normalMap(height = luma × 0.6)`, sea flat; written as `earth-normal` std/sm/hq). The stations keep their plates: only the two giants and Earth change.

- [ ] Step 1: `planetShading.test.js`: `gasHook` adds `uGasTime` and a `sin(` on `vMapUv.y` to the fragment; cache key gains `|gas`. `planets.test.js`'s variant count stays ≤ 24 (the gas hook replaces none; count it).
- [ ] Step 2: Run, implement, pass; `node scripts/planets/bake.mjs --only earth`; shots of Music and Marvel at 2.4 radii (`scripts/universe-check.mjs`'s poses) before/after in the PR.
- [ ] Step 3: Commit `feat(universe): bands on the giants, relief on Earth`. Open PR 4.

---

## Phase 5: crowds baked, kit creatures (PR 5, branch `claude/kit-rigging`)

### Task 5.1: `src/lib/three/vat.js` (pure parts first)

**Files:** Create `src/lib/three/vat.js`, `vat.test.js`, `vat.fixture.js` (a 2-bone chain skinned quad: positions, `JOINTS_0`, `WEIGHTS_0`, inverse binds, and two frames of bone matrices).

**Interfaces (produces):**
- `vatLayout(bones, frames) → { width: bones × 3, height: frames, texels: bones × 3 × frames }`.
- `packSkinMatrix(m: Float32Array(16), out: Float32Array, texel: number)`: the matrix's rows 0–2 (column-major elements `[0,4,8,12]`, `[1,5,9,13]`, `[2,6,10,14]`) into three RGBA texels at `texel × 4`.
- `vatFrame(anim: [start, length, phase, speed], time, fps) → { f0, f1, t }`: `f = start + mod((time × speed + phase) × fps, length)`, `f0 = floor(f)`, `f1 = start + mod(f0 − start + 1, length)`, `t = fract(f)`.
- `vatSample(data: Float32Array, layout, bone, frame) → Float32Array(16)` (the inverse of `packSkinMatrix`, row 3 = `[0,0,0,1]`).
- `skinVertex(pos, joints, weights, matricesByBone) → [x, y, z]` (CPU skinning, for the test).
- `vatShader(shader, { bones, frames }) → { vertexShader, fragmentShader, swapped }`: replaces `#include <skinbase_vertex>` and `#include <skinning_vertex>` with: `attribute vec4 aAnim; uniform sampler2D uVat; uniform float uVatTime, uVatFps; uniform vec2 uVatSize;` a `mat4 vatBone(float bone, float frame)` of three `texture2D` fetches, the frame pair from `vatFrame`'s maths in GLSL, `mat4 skin = w.x × mix(vatBone(j.x, f0), vatBone(j.x, f1), t) + …` for four joints, `transformed = (skin × vec4(transformed, 1)).xyz`, normals likewise (`mat3(skin)`); works under `USE_INSTANCING` (the instance matrix applies after). No `USE_SKINNING` define needed: the material is not a SkinnedMesh's.
- `vatSkin(material, { texture, bones, frames, fps, time }) → material` (the `onBeforeCompile` + cache key `|vat`).
- `createVatCrowd({ geometry, material, vat: { texture, bones, frames, fps, clips }, count }) → { mesh: InstancedMesh, set(i, { x, y, z, yaw, scale = 1 }, { clip, phase = Math.random(), speed = 1 }), free(i), update(dt), dispose() }`: `aAnim` an `InstancedBufferAttribute(count × 4)`; `update` advances the one `uVatTime`.

- [ ] Step 1: `vat.test.js`: `vatLayout(24, 60)` → width 72, height 60; `packSkinMatrix` then `vatSample` round-trips a random matrix within 1e-6; `vatFrame([10, 5, 0.999 × 5 / 24, 1], 0, 24)` → `f0 14, f1 10`; `vatFrame([10, 1, 7, 1], 3, 24)` → `f0 10, f1 10, t` in [0,1); on the fixture, `skinVertex` with matrices from `vatSample` at frame 1 equals `skinVertex` with the fixture's own frame-1 matrices within 1e-5; `vatShader` on a stub Lambert vertex shader contains `vatBone(`, `aAnim`, no `skinning_vertex` include, and `swapped.vat === true`; `createVatCrowd(... count 4)` `set(2, …, { clip: 'walk' })` writes `aAnim` row 2 = `[start, length, phase, speed]` from `clips.walk`, `free(2)` scales its matrix to 0.
- [ ] Step 2: Run (fail), implement, run (pass). Commit `feat(three): crowds skinned from a baked texture`.

### Task 5.2: `scripts/vat-bake.mjs`

**Files:** Create `scripts/vat-bake.mjs`, `scripts/vat-bake.test.mjs` (on the fixture body `scripts/fixtures/kit/tiny-rig.glb`: a 2-bone skinned quad with one 1-second clip, generated by a checked-in 40-line gltf-transform script).

**Interfaces (produces):** `node scripts/vat-bake.mjs <body.glb> --clips <a.glb,b.glb | own> [--fps 24] [--out <dir>]` → `<name>.vat.bin` (Uint16 half floats, `vatLayout` order, frame-major) and `<name>.vat.json` `{ bones, frames, fps, clips: { [name]: [start, length] }, bin: '<name>.vat.bin' }`; sampling in Node with three's `AnimationMixer` on the loaded skeleton (`GLTFLoader` in Node through `scripts/lib/`'s existing node-three helper if there is one, else `@gltf-transform` to read + a hand skeleton walk: say which in the header), skin matrix = `bone.matrixWorld × inverseBind` relative to the mesh's bind matrix; `toHalf(f) → uint16` pure in `vat.js`.

- [ ] Step 1: `vat-bake.test.mjs` runs the CLI on the fixture and asserts `frames === 24`, `clips.pose === [0, 24]`, and `vatSample(bin, layout, 1, 12)` matches the mixer's own bone matrix at `t = 0.5` within 1e-2 (half precision).
- [ ] Step 2: Run (fail), implement, run (pass). Commit `feat(scripts): bake a figure's clips into a vertex-animation texture`.

### Task 5.3: Edoras's host on the VAT; the farm horse

**Files:** Modify `src/components/middleearth/towns/edoras/folk.js:961-1035` (the host's `aRig` rig removed; `createVatCrowd` of two meshes: the kit `Horse` (Task 1.4; clip `Run`, `WalkSlow`) and a rider body (`public/models/middleearth/cast/rohirrim.glb` with the UAL `drive`/`sit.idle` clip as `ride`), same matrices), `scene.js:213-238`, `edoras/pack.js` (`/kit/farm/horse.glb`, the two `.vat.*` files), `scripts/edoras-vat.mjs` (bakes the two: `node scripts/vat-bake.mjs public/kit/farm/horse.glb --clips own` → `public/models/middleearth/host/horse.vat.*`; rider likewise with `--clips public/games/meshy/ual-sit.idle.glb`). Modify `scripts/perf-probe.mjs` (journey `edoras`).

- [ ] Step 1: Test (folk.test.js or scene.test.js, fake renderer): the host makes exactly 2 `InstancedMesh`es + the banners, `count === min(1000, round(1000 × many))`, both with `userData.vat`; no material has `aRig` in its shader (grep the rewritten vertex shader).
- [ ] Step 2: Browser: `node scripts/perf-probe.mjs edoras` draws ≤ today's and the `move` phase p95 no worse (quote both); a shot of the host at full gallop in the PR (`scripts/clip-shot.mjs` or the town's shots script).
- [ ] Step 3: Commit `feat(edoras): the host of Rohan rides the farm kit's horses, baked`.

### Task 5.4: the Citadel's crowd and the galaxy's far actors

**Files:** Modify `src/components/rickmorty/citadel/crowd.js` (still copies → one `createVatCrowd` per body with idle variants from `act-*` clips; `LIVE_N` promotion unchanged), `src/components/galaxy/surface/actors.js:455-458, 699-700` (`stepFigure` beyond `FAR` on a template that has a VAT hands the actor to `crowds.js`'s pool and hides its mixer figure; within `FAR` the reverse), create `src/components/galaxy/surface/crowds.js` + test (pools per template, `adopt(actor)`, `release(actor)`), `scripts/galaxy-vat.mjs` (bakes `stormtrooper`, `clone`, `rebel` with their own walk + `ual-idle.calm`).

- [ ] Step 1: `crowds.test.js`: `adopt` 3 actors of one template → one mesh with `count 3`; `release` one → 2; an actor without a VAT is refused (`false`). `actors.test.js` gains: an actor at 80 m with a VAT template is adopted (its figure `visible === false`); at 40 m released.
- [ ] Step 2: Run, implement, pass; `node scripts/anim-check.mjs --route '#/galaxy/tatooine'` and `--route '#/c-137/citadel'` within limits; `galaxy-check` to its row.
- [ ] Step 3: Commit `perf(crowds): far figures walk from a baked texture`.

### Task 5.5: kit creatures in the catalogs; the rest of the UAL

**Files:** Modify `src/components/middleearth/shire/` (sheep and dog: the kit `Sheep` and `Pug` with `createAnimator` on their own clips, replacing the built ones in `props.js`'s `sheep`/`dog` where `scene.js` places them), `src/components/galaxy/surface/catalog/kit.js` (new: rows for `kit:space/Astronaut_*`, `Mech_*` with `rig: true, anim: { idle: 'Idle', walk: 'Walk', run: 'Run' }`; merged last-but-one in `catalog/index.js`), `src/components/rickmorty/world/dimensions/` (two dimensions' `people` gain an astronaut and a mech through `stage`'s figure path), `scripts/ual-bake.mjs` (`--set all` = every clip not yet baked, short), `src/lib/three/clipLibrary.js` (the new names), `src/lib/three/locomotion.js` (the 8-direction set: `walk.fwd.left|right`, `walk.left|right`, `walk.back.*`, `jog.*` blended by strafe heading).

- [ ] Step 1: `locomotion.test.js` gains: heading 90° picks `walk.right` weight 1; 45° half `walk.fwd` half `walk.fwd.right`. `catalog.test.js` gains: every `kit:` row's name exists in `public/kit/space/index.json`.
- [ ] Step 2: Run, implement, pass; `node scripts/ual-bake.mjs --set all` (sizes in the PR; ≤ 3.5 MB added); `node scripts/anim-check.mjs --route '#/middle-earth/shire'` (sheep's toes within limit).
- [ ] Step 3: Commit `feat(rigging): the farm and space kits walk; every UAL clip baked`. Open PR 5.

---

## Phase 6: the worlds, one PR each (`claude/kit-world-<name>`)

Each world PR follows this template; the first (Yavin + Dagobah) is written out, the rest list only what differs.

### Task 6.1: Yavin and Dagobah

**Files:** Modify `src/components/galaxy/surface/sites/yavin.js:209-218` and `sites/forest.js` (Dagobah's rows), `src/components/galaxy/pack.js`.

- [ ] Step 1: Species: Yavin's `fern 2300` → `kit:naturemega/Fern_1|Fern_2` (half each), `plant 320` → `Plant_1..7` cycling, add `Clover_1|2 n 600`, `Mushroom_Common|Oyster n 120` under the built `jungletree`s (which stay). Dagobah: add `DeadTree_1..5 n 90 within [40, 400]`, `TwistedTree_1..5 n 60`, `Mushroom_RedCap|Laetiporus n 200`, `Fern_1|2 n 900`, ferns `above 0.1` of the water.
- [ ] Step 2: `node scripts/surface-shot.mjs yavin` and `dagobah` before (on `main`) and after; `node scripts/galaxy-check.mjs --only yavin,dagobah --level high` within the row (and `mid`); `node scripts/pack-check.mjs`.
- [ ] Step 3: Commit `feat(galaxy): Yavin's floor and Dagobah's swamp from the nature kit`. PR with the four shots.

### Task 6.2: Naboo and Sorgan
Rows: Naboo meadows `Flower_1..7_Group`, `Grass_Wide_*`, `CommonTree_*` and `CherryBlossom_*` groves by `grove()` near Theed's lake (`nabootree` stays by the city), `RockPath_*` along `places`; Sorgan `Birch_*` ×200 within [80, 500] beside its Sketchfab `sorganbirch` (which stays as the near hero), `Pine_*` ×120, `Mushroom_*`. Same steps.

### Task 6.3: the Shire and Lothlórien
Shire: a `loadKit('naturemega', { house: shire's house, wind })` and pools for `Flower_*_Group`, `Mushroom_*`, `Pebble_*`, `RockPath_*` along `ROADS`, `Fern_*` under the oaks (the oaks and the party tree stay); the Shire's `instances()` sites unchanged. Lothlórien: `TallThick_*` and `GiantPine_*` with `tint` gold (`kitMaterial` gains a per-pool `color` multiply) as the mallorn stand, replacing the town's far blobs only. Shots from `scripts/clip-shot.mjs` routes; `anim-check` on the Shire for the sheep (Task 5.5).

### Task 6.4: the Rick and Morty dimensions and moons
`loadKit('space')`: Gazorpazorp and the Purge planet's `extras` rows name `Tree_Spikes_*`, `Rock_Large_*`, `Base_Large`, `GeodesicDome`; the moons' orbit props on the universe map take `Planet_1..11` as toy satellites (`planetSpecs` `extras`); the universe foot scene's squads can be `Astronaut_*` (Task 5.5's catalog). Shots: `scripts/c137-shots.mjs`, `scripts/universe-check.mjs`.

### Task 6.5: Albuquerque and Invincible (last; the city kit import is in this PR)
`node scripts/kit/import.mjs city` (COLOR_0 dropped; nine PBR sets at 1024; `MI_Glass` given `opacity 0.35`); Albuquerque's downtown blocks (`albuquerque/world/scene.js`'s filler lots, not the White house, the car wash or Los Pollos) and Invincible's city blocks from `Brick_*`/`Metal_*` facades on a 3 m grid with `Street_*` tiles, under each world's house look; `scripts/abq-qa.mjs`, `scripts/inv-world-check.mjs`, `perf-probe abq`/`invincible` within today's numbers.

---

## Self-review (done at writing)

- Spec coverage: pieces 1 (Tasks 1.1–1.8), 2 (Tasks 1.5, 1.7), 3 (Phase 2 + 2.4′, 2.6), 4 (3.0, 3.4′), 5 planets (4.1–4.5), 5 crowds (5.1–5.5), 6 (6.1–6.5), budgets (1.5), credits/docs (1.8), QA (every task's browser step). Gap closed: the puff `tones` are read at import (1.3) so Phase 2 can build puffs without the texture at runtime.
- Types: `parts` `[{ geometry, material, local }]` is one shape in 1.5, 1.7, 2.4′, 3.4′; `items` `[{ x, y, z, yaw, scale }]` in 1.5, 3.0, 3.4′, 6.x; `vat` `{ texture, bones, frames, fps, clips }` in 5.1–5.4; `manifest.models[name].tones` in 1.1, 1.3, 2.4′.
- Review Focus 1–5 each has its test named in the owning task.
- Proportion: signatures, tests and values; no bodies except the two GLSL sketches (the wind weight, the VAT bone fetch) whose shape the tests do not determine.
