# Foliage, trees and landscapes — implementation plan

> **For agentic workers:** execute with superpowers:executing-plans (or
> subagent-driven-development where the orchestrator allows), in order,
> one checkpoint at a time. Steps use checkbox (`- [ ]`) syntax. Each
> checkpoint ships on its own.

**Goal:** Film-accurate plants, trees and landscapes on all 17 galaxy
worlds, lit with one cohesive Bruno-style look, within the budget gate, with
missions and races untouched.

**Architecture:**
- Shared GLSL `onBeforeCompile` hooks (`lib/three/foliage.js`, `leaves.js`,
  `grounding.js`) and new surface modules (`skyfog.js`, `cover.js`,
  `plan.js`, `grass.js`, `flora/*`).
- Per-world values in `flora/palette.js` (`FLORA[id]`), read by `scene.js`
  with `site.*` as the fallback. `sites/*.js` edited only in a world's own
  checkpoint.
- Budget paid first (camera-relative cull, pooling, rings), then ground,
  grass and patches, then cards, then the far tier, then one checkpoint per
  world.

**Tech Stack:** three r186 (WebGL2, GLSL), React 19, Vite, Vitest,
playwright-core (`scripts/galaxy-check.mjs`, `scripts/surface-shot.mjs`),
`@gltf-transform` + meshoptimizer (`scripts/galaxy-surface-lod.mjs`),
ImageMagick for colour checks.

**Spec:** `docs/superpowers/specs/2026-10-06-foliage-landscape-design.md`
(§ numbers below refer to it).

## Global Constraints

- Work only in `/home/user/new-portfolio-website` (never `lab/before`,
  `lab/assets`, `lab/base`: other worktrees).
- Don't touch `shipModels.js`, `hulls.js`, `livery.js`, `modules.js`,
  `outfit.js`, `paint.js`, `Hangar.jsx`. No sequel-trilogy content.
- Never change Tatooine's palette, sky, haze or grade (wf_62561f47 owns
  them). Tatooine gets only F1's fog conversion and F17's scatter and rock.
- `sites/*.js`: only in that world's checkpoint, and only after its planets
  overhaul checkpoint (CP3–CP11) has merged:
  `git log origin/main --oneline -- src/components/galaxy/surface/sites/<file>.js`.
  If it hasn't, put the change in `FLORA[id]` (`scatter.retire`,
  `scatter.add`, `places` text override) instead.
- Comments: plain prose, parenthetical "(…)" for why, as in the
  neighbouring code. No JSDoc, no emojis.
- Renders are software GL and slow; the machine has 4 CPUs and another
  render job. **Never run more than one render command at a time.** Never
  start a dev server on 5188 or kill the one there.
- Gate (owner decision 1): `lab/baseline/surface-merged.json` +10% per world
  (calls and tris), never over 600 calls / 2.5M tris. Goal: Lothal, Dagobah,
  Yavin, Mandalore, Nevarro under `lab/baseline/surface-high.json` +10%.
- No git commit, push, stash, reset or checkout unless the run's own
  instructions say so. When committing, end the message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01Wmw65yyvV2Td5cUTKwLG3j`.

## Commands

```bash
cd /home/user/new-portfolio-website
ALL=tatooine,naboo,hoth,endor,kashyyyk,dagobah,yavin,coruscant,kamino,geonosis,mustafar,scarif,bespin,nevarro,mandalore,lothal,sorgan

# tests and lint
npx vitest run <files>
npx vitest run
npm run lint

# shots (views from lab/foliage/views.txt; before-shots are in lab/foliage/before/)
OUT=lab/foliage/<cp> lab/foliage/shots.sh <world> [<world>…]
QUALITY=low OUT=lab/foliage/<cp>-low lab/foliage/shots.sh <world> [<world>…]

# budget against the gate (prints calls/tris and pass/FAIL per world; exit 1 on FAIL or page errors)
BUDGET=lab/baseline/surface-merged.json OUT=lab/foliage/<cp> JSON=1 node scripts/galaxy-check.mjs surface <worlds,comma,separated>
# the original caps (the five-world goal)
BUDGET=lab/baseline/surface-high.json OUT=lab/foliage/<cp>-orig JSON=1 node scripts/galaxy-check.mjs surface lothal,dagobah,yavin,mandalore,nevarro
# a worst spot (from F0 on)
AT=<x>,<z> BUDGET=lab/baseline/surface-merged.json OUT=lab/foliage/<cp>-worst JSON=1 node scripts/galaxy-check.mjs surface <world>

# colour check on a named rect (rects in views.txt); ΔE is CIEDE2000 ≤ 8
magick lab/foliage/<cp>/<world>-<label>-high.png -crop WxH+X+Y -resize 1x1 txt:
```

**Checkpoint close** (every checkpoint):
1. `npx vitest run` and `npm run lint` green.
2. Budget run on the checkpoint's worlds (all 17 for F1–F5, F7–F9): exit 0.
3. Shots at high and low for the checkpoint's worlds, side by side with
   `lab/foliage/before/`.
4. Update `lab/foliage/ledger.json` (the draw ledger) and write the
   checkpoint's ledger line (below each checkpoint) with measured numbers.
5. p50 ≤ F0's p50 × 1.1 per world; `loaded` ≤ F0's + 1 s.

## Review Focus

1. **Walking 590 m out** on Dagobah and Endor: vegetation is still round
   the player (no static clip at d98). Shots at (500, 0).
2. **Missions and races**: the Endor chase plans with `laneHits === 0`, every
   race gate stays reachable, the Dagobah run's walk stays within +10%.
3. **The floor bake**: leaf cards cast their own channel's shape; grass,
   patches and the far tier are not baked (`noBake`).
4. **Program count** stays flat after frame 1 (no late recompiles).
5. **Leaving and landing again** on another world: GLB materials are per-
   world clones; no hook or uniform from the previous world.
6. **Phones**: the owner's check on a Pixel 6a or iPhone 12 (mid tier, 1.5
   DPR) at F5, F6 and F7, ≥ 30 fps.

---

## F0: gate, views and draw ledger

**Files:**
- Modify: `scripts/galaxy-check.mjs` (`AT=x,z` teleports before measuring,
  result id `<world>@x,z`, compared with the world's cap; `LEDGER=1` writes
  `<out>/ledger-<quality>.json` from `__surfaceDo('draws')`).
- Create: `src/components/galaxy/surface/ledger.js` (`drawsByKind(objects)`:
  for each visible mesh with `count > 0`, `userData.kind ?? 'other'` →
  draws = material count).
- Create: `src/components/galaxy/surface/ledger.test.js`.
- Modify: `placer.js` (tag every mesh it makes with `userData.kind`),
  `scene.js` (`__surfaceDo('draws')` → `drawsByKind` over the scene).
- Modify (untracked): `lab/foliage/views.txt` (add yavin
  `0,200,456,180,summit`; `rect=<name>:x,y,w,h` entries per view for crown
  lit, crown shadow, ground, far land, sky).

- [ ] **Step 1: Write the failing test.** `ledger.test.js`: three fake
  meshes (an InstancedMesh count 0, one with two materials, an invisible one)
  give `{ kind: 2 }` for the visible two-material mesh only.
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/surface/ledger.test.js`. Expect FAIL (no module).
- [ ] **Step 3: Implement** `ledger.js`, the placer tag, `__surfaceDo('draws')`, `AT=` and `LEDGER=1`.
- [ ] **Step 4: Run** the test, then `npm run lint`. PASS.
- [ ] **Step 5: Baselines.** One at a time:
  `LEDGER=1 BUDGET=lab/baseline/surface-merged.json OUT=lab/foliage/F0 JSON=1 node scripts/galaxy-check.mjs surface $ALL`,
  then `QUALITY=mid OUT=lab/baseline JSON=1 node scripts/galaxy-check.mjs surface $ALL`
  (rename to `surface-mid.json`), then the same with `QUALITY=low`
  (`surface-low.json`).
- [ ] **Step 6: Ledger.** Build `lab/foliage/ledger.json`: per world, calls,
  tris, today's vegetation draws by kind (from the ledger dump), and the
  planned draws from spec §2.12.
- [ ] **Step 7: Yavin summit shot:** `OUT=lab/foliage/before lab/foliage/shots.sh yavin` (if the before tree can't serve it, take it at F0 and treat it as the before).

**Exit criteria:** all 17 pass the merged gate (unchanged tree); ledger has
17 worlds and Σ ledger draws ≤ calls for each; mid/low baselines exist;
views and rects in place; the owner decisions are recorded in the spec
(done).

**Ledger line:** every world: veg draws measured (Endor ≈16, Yavin ≈22
expected), no change.

---

## F1: sky fog and the grade hook (identity)

No per-world sky, palette or grade change. Fog is converted so d50 and d95
equal today's (spec §2.2 table).

**Files:**
- Create: `src/components/galaxy/surface/skyfog.js`, `skyfog.test.js`
- Create: `src/components/galaxy/surface/flora/palette.js`,
  `flora/palette.test.js`
- Create: `src/components/universe/post.test.js`
- Modify: `sky.js` (export `SKY_FN`; the dome uses it), `scene.js` (air
  from `floraOf`, `skyFogScene` before the first `warm`, zones set
  `uSkyFog 0` in `lighting()`, `fogCut` to actors), `kit.js` (`std` installs
  skyFog), `placer.js` (`prepared` installs skyFog), `water.js`,
  `weather.js`, `actors.js`, `figures.js`, `crew.js`, `blaster.js` (install at
  creation), `universe/post.js` (FINAL `uShadeTint`, `uLightTint`),
  `scripts/galaxy-check.mjs` (record programs right after ready and at the
  end; FAIL on growth, surface only).

### Task 1.1: fog maths
- [ ] **Step 1: Failing tests** (`skyfog.test.js`):
  - `fogFor({ d50: 140, start: 20 })`: k = ln2/120, d95 = 20 + ln20/k,
    d97 = 20 + ln(33.3)/k, d98 = 20 + 3.912/k, density = 0.8326/140.
  - `fogFromExp2(ρ)` for every site's `fog.density`: start = 0.5622/ρ;
    resulting d50 within 0.5% of `0.8326/ρ` and d95 within 0.5% of
    `1.7308/ρ` (never past it).
  - Endor: start 134, d50 198, d95 412, d98 497 (±1 m).
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/surface/skyfog.test.js`. FAIL.
- [ ] **Step 3: Implement** `fogFor`, `fogFromExp2`, `FOG_EDGE = FAR`.
- [ ] **Step 4: Run.** PASS.

### Task 1.2: the chunk
- [ ] **Step 1: Failing tests:** `skyFog(material, air)` on a
  `MeshStandardMaterial` and on a `ShaderMaterial` that includes the fog
  chunks (as water does): after `onBeforeCompile` on a stub shader the four
  fog includes are gone, the source has `uSkyFog`, `skyColour(`,
  `smoothstep(0.55 *` (edge clamp), `uFogEye`, and the exp² `else` branch;
  `customProgramCacheKey()` ends with `|skyfog`; calling it twice is a no-op;
  `SKY_FN` is a string defining `vec3 skyColour(vec3 rd)`.
- [ ] **Step 2: Run.** FAIL.
- [ ] **Step 3: Implement** `skyFog`, `skyFogScene`, and `SKY_FN` moved out
  of the dome shader (the dome now uses it; same maths).
- [ ] **Step 4: Run.** PASS.

### Task 1.3: install at creation, zones, actors
- [ ] **Step 1: Failing tests:**
  - `actors.test.js`: `fogCutoff` given a distance (d97) hides an actor
    beyond it and keeps one inside; the density form still works for zones.
  - `palette.test.js`: `floraOf(id, site)` for all 17 worlds returns
    `air` from `fogFromExp2(site.fog.density)`, `grade` (1,1,1)/(1,1,1);
    `authored(hex, grade)` round-trips through the forward FINAL maths
    (shoulder, sat 1.06, contrast 0.07, grade) within 1/255 for 50 random
    hexes.
  - `post.test.js`: FINAL has `uShadeTint`/`uLightTint` defaulting to
    (1,1,1) and applies them before sat/contrast.
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/surface/actors.test.js src/components/galaxy/surface/flora/palette.test.js src/components/universe/post.test.js`. FAIL.
- [ ] **Step 3: Implement** the installs (kit `std`, `placer.prepared`,
  water, weather, actors, figures, crew, blaster), `skyFogScene` before the
  first `warm`, `lighting()` toggling `uSkyFog`, `createActors({ fogCut })`,
  `palette.js` skeleton (`FLORA = {}`, `floraOf`, `authored`), the post
  uniforms.
- [ ] **Step 4: Run** the tests and `npm run lint`. PASS.

### Task 1.4: verify
- [ ] Budget all 17 (`OUT=lab/foliage/F1`). Programs must not grow.
- [ ] Shots all 17 (high), then low for endor, dagobah, naboo.
- [ ] Seam: in each land shot, the linear-RGB Δ between the sky pixel just
  above the far land and the land just below is < 0.02 (a lab script,
  `lab/foliage/seam.mjs`, finds the boundary on the middle column).
- [ ] Tatooine: only the far fog differs (ground crop ΔE ≤ 2 vs before).

**Exit criteria:** seam < 0.02 on all 17; calls ±0 and tris within ±0.5%;
p50 ≤ +3%; programs flat after frame 1; no ring at the terrain edge in the
far views (Scarif lastbeach, Naboo battle, Tatooine canyon); zones (Tatooine
cantina) still use exp².

**Ledger line:** every world ±0 draws.

---

## F2: plant material core (no geometry change)

**Files:**
- Modify: `src/lib/three/foliage.js` (+ `faceless`, `foliageLook`,
  translucency in `wrapShader`, `WIND_GLSL` world space, `windShader` v2),
  `foliage.test.js`
- Create: `src/lib/three/leaves.js` (`leafAtlas`, `coverageMips`,
  `leafDepth`), `leaves.test.js`
- Modify: `src/lib/three/grounding.js` (+ `understory`,
  `setUnderstoryMask`), `grounding.test.js`
- Create: `flora/materials.js` (`createFlora`: card, bark, proxy materials;
  `update(t, dt)` with the `reduced` hold; `measureLookBand`),
  `flora/materials.test.js`
- Modify: `flora/palette.js` (ramps for every world in spec §3, guardrail
  data), `palette.test.js`
- Modify: `kit.js` (split `leaf` → `plant`), `placer.js` (per-world GLB
  material clones; MASK → A2C; sorganfern BLEND → MASK; instance tint and
  lean), `placer.test.js`, `props/forest.js`, `props/edge.js`,
  `props/core.js` as needed (plants use `plant`; `spherifyNormals` on
  `canopy()`/`spray()`/fern geometry, core lightened to ×0.8), `scene.js`
  (flora clock, `__surfaceDo('floraTime')`, `setUnderstoryMask` after the
  bake), `scripts/galaxy-textures.mjs` (offline coverage mips for GLB leaf
  textures, ≤ 1024²).

### Task 2.1: look, faceless, translucency
- [ ] **Failing tests** (`foliage.test.js`): `faceless` strips `normal *=
  faceDirection`; `foliageLook` injects its block before `#include
  <opaque_fragment>` and adds `|look` to the cache key; `uLookHue` default
  0.35; `wrapShader` with `trans` adds the `uTransDistort` term inside
  `RE_Direct_Lambert`; hooks applied in the spec §2.1 order produce the
  expected order of markers and are idempotent.
- [ ] Run `npx vitest run src/lib/three/foliage.test.js` (FAIL), implement, run (PASS).

### Task 2.2: wind v2 in world space
- [ ] **Failing tests:** `WIND_GLSL` declares `float wPhase, wGust,
  wRegion;` at global scope and defines `windAt`; `windShader` v2 applies it
  after `modelMatrix * instanceMatrix` (string check); a JS mirror
  `windAtJs(base, p, tip, uniforms)` gives the same displacement for a
  trunk-top vertex and a crown-card centre at the same world point and the
  same instance.
- [ ] Run, implement, run.

### Task 2.3: leaf atlas and depth
- [ ] **Failing tests** (`leaves.test.js`): `leafAtlas()` is a
  `DataTexture` 256², `NoColorSpace`, `premultiplyAlpha === false`,
  `generateMipmaps === false`, `LinearMipmapLinearFilter`; coverage at 0.4
  per channel in R 0.30–0.36, G 0.20–0.30, B 0.35–0.45, A 0.15–0.25; the 4-px
  border < 0.1; every mip level within ±0.05 of level-0 coverage; R, G, B
  are non-zero where A is 0 (no premultiply loss); `leafDepth(atlas)`'s
  fragment uses `dot(` with `vChan`, the uv sentinel and `alphaTest 0.4`.
- [ ] Run `npx vitest run src/lib/three/leaves.test.js`, implement, run.

### Task 2.4: understory and the kit split
- [ ] **Failing tests:** `grounding.test.js`: `understory` vertex code has
  the root under `#ifdef USE_INSTANCING` with the `#else` model origin; the
  fragment multiplies `directDiffuse` and `indirectDiffuse` after
  `lights_fragment_end`; `setUnderstoryMask` sets the texture and rect.
  `placer.test.js`: two worlds preparing the same cached GLB get different
  material objects; MASK leaf materials get `alphaToCoverage`; sorganfern's
  BLEND becomes MASK with A2C; same-kind instances get `setColorAt` tints.
  A kit test: creatures' material is `leaf` with no flora hooks, plants
  use `plant`.
- [ ] Run `npx vitest run src/lib/three/grounding.test.js src/components/galaxy/surface/placer.test.js`, implement, run.

### Task 2.5: palette and guardrail
- [ ] **Failing tests** (`palette.test.js`): the spec §1.4 caps per world and
  species (forest S ≤ 0.58, V ≤ 0.63; forest rims V ≤ 0.71; open S ≤ 0.65,
  V ≤ 0.72, rims ≤ 0.82; Lothal straw S ≤ 0.45, V ≤ 0.88 except golden lit;
  dark-barked lit V ≤ 0.40; forest fog/horizon V ≥ 0.45 for the `air`
  values that later checkpoints set); hue bands per §1.5 (Naboo 50–92°,
  Scarif 100–130°); far ramp = crown × 0.85–0.9.
- [ ] Run, implement the ramps, run.

### Task 2.6: wire and verify
- [ ] `createFlora` per world in `scene.js`; look on `needles`, `foliage`,
  `plant` and restyled GLB leaves; `flora.update` in the frame loop;
  `__surfaceDo('floraTime')`; `setUnderstoryMask(flora, lit)` after the bake.
- [ ] Budget all 17; shots all 17.
- [ ] Motion: `floraTime` read twice 1 s apart differs; with `reduced` it
  doesn't.
- [ ] Creatures: Naboo shaak and bongo crops ΔE ≤ 2 vs F1.

**Exit criteria:** calls ±0, tris ±0; Endor, Kashyyyk and Yavin crowns
show one soft terminator (no dark back-face tiles) in the land shots;
creatures unchanged; foliage clock moves and `reduced` freezes it; programs
flat; guardrail green.

**Ledger line:** every world ±0 draws.

---

## F3: budget reclaim

**Files:**
- Create: `src/components/galaxy/surface/plan.js` (only
  `staticExtent(within, d98)` and `scaledCount(n, r0, r1, r1Clipped)` for
  now), `plan.test.js`
- Modify: `scene.js` (clip each scatter's `within[1]` to `REACH + d98` and
  scale `n` by the area ratio so density stays; `flora.sort(landAt)` before
  `groundWorld`), `placer.js` (pooled InstancedMesh sets per kind and
  variant; `createLodSet` rings for built kinds with `bands: [Dnear, Dmid,
  d98]`, mid = the same geometry for now; placed `grove()` stands into the
  pools; 3-way `fillSplit`), `src/lib/three/lod.js` (per-band `move`, near 8 /
  mid and far 30; species staggered across frames; `addUpdateRange`),
  `lod.test.js`, `near.js`/`near.test.js` (the 3-way split helper),
  `placer.test.js`
- Modify: `scripts/galaxy-surface-lod.mjs` (foliage path: decimate only
  opaque primitives; MASK primitives drop ≈50% of connected components and
  scale survivors ×1.41 about their centroids; `over: 0` for listed kinds),
  create `scripts/galaxy-surface-lod.test.mjs`
- Modify: `catalog/*.js` (`lod: true` for dagoroots, lavarock, glassshard
  only; retired GLBs get none)

### Task 3.1: extent and splits
- [ ] **Failing tests:** `plan.test.js`: `staticExtent([20, 1000], 199) =
  [20, 789]`; `[20, 400]` unchanged; `scaledCount` keeps density.
  `near.test.js`: `splitThree(d, lodD, d98)` → full / lod1 / hidden, with
  hysteresis. `lod.test.js`: the near band re-sorts after 8 m, mid and far
  after 30 m; two sets on the same frame don't both sort (stagger).
- [ ] Run `npx vitest run src/components/galaxy/surface/plan.test.js src/components/galaxy/surface/near.test.js src/lib/three/lod.test.js`, implement, run.

### Task 3.2: pooling and rings
- [ ] **Failing tests** (`placer.test.js`): two scatter entries of the same
  kind share one mesh set; instance count = the sum; entry colours become
  instance colours; a placed grove's trees join the pool; level counts are
  0 for band 3.
- [ ] Run, implement, run.

### Task 3.3: foliage lod1
- [ ] **Failing test** (`galaxy-surface-lod.test.mjs`): on a fixture GLB with
  one opaque primitive and one MASK primitive of 40 cards, the MASK output
  has 18–22 cards, each survivor's area ×2 (±5%), and the opaque one is
  decimated; a retired kind is skipped.
- [ ] Run `npx vitest run scripts/galaxy-surface-lod.test.mjs`, implement, run.
- [ ] Generate: `node scripts/galaxy-surface-lod.mjs dagoroots lavarock glassshard`.

### Task 3.4: verify
- [ ] Budget all 17; then the original caps run.
- [ ] Shots all 17; plus Dagobah and Endor from (500, 0):
  `OUT=lab/foliage/F3 node scripts/surface-shot.mjs dagobah 520,0,20,270,edge`
  and the same for endor. Vegetation is round the player.
- [ ] Worst spot per forest world (Endor, Kashyyyk, Dagobah, Yavin,
  Sorgan): a densest grove picked by eye from the ledger dump, with `AT=`.

**Exit criteria:** landing shots unchanged at a glance; calls ≤ F0 per
world; tris down, **measured with the camera-relative cull** (expected
large on Dagobah, then Yavin, Scarif, Sorgan); all 17 pass the merged gate;
Dagobah expected under its original cap (calls ≤ 83.6, tris ≤ 1,465,380),
Yavin under its original tris (≤ 1,691,089), or the shortfall recorded and
carried to F12/F13; vegetation round the player at 500 m out.

**Ledger line:** Dagobah and Naboo down by the pooled grove draws (each
2–7 today); others ±0 or down.

---

## F4: ground and placement

**Files:**
- Modify: `ground.js` (`groundColour()` chunk; cover read bounded; cavity;
  `heightBlend` in the common block; hollow, crest, dry and litter tints
  defaulting to identity; canopy shade in `floorShadow`'s path; triplanar
  mechanism with `textureGrad`, off by default; lava emissive from cover G
  on lava worlds, off until F17)
- Modify: `terrain.js` (`aCav` at 1-cell and 3-cell rings), `terrain.test.js`
- Create: `cover.js` (`coverMask`, `paintDab`, `canopyShade`), `cover.test.js`
- Modify: `plan.js` (patterns `uniform`, `cluster`, `rows`, `edge`, `ring`,
  `satellite`; `corridorsOf(site, missions)`; `solidsOf`; `worstSpot`),
  `plan.test.js`
- Modify: `src/lib/three/grounding.js` / `groundwork.js` (canopy shade read
  outside the mask rects and when `!canBake`), their tests
- Modify: `scene.js` (scatter through `plan.js`; cover and canopy shade baked
  after the grid and places; corridors)

### Task 4.1: the refactor (pixel-identical, its own commit if committing)
- [ ] Move the ground colour block into `groundColour()`; nothing else.
- [ ] Shots of naboo, endor, mandalore (land views) vs F3:
  `magick compare -metric AE a.png b.png null:` ≤ 0.1% of pixels.

### Task 4.2: cavity, cover, bounded read, heightBlend
- [ ] **Failing tests:** `terrain.test.js`: `aCav` > 0 in a pit, < 0 on a
  peak, 0 on growing outer cells; ring sizes are cells (n 256 and 160).
  `cover.test.js`: steep, under water and on flats → R 0; a dab falls off
  radially; RGB survive where A = 0 (typed array, not canvas); on a lava
  world, G = 1 on `channels` beds and 0 off them; B never drives lava.
  A ground shader test: the cover fetch is clamped and mixed with
  `uCoverFar` by `smoothstep(600.0, 640.0, …)`; `heightBlend` is defined
  outside `main()`.
- [ ] Run `npx vitest run src/components/galaxy/surface/terrain.test.js src/components/galaxy/surface/cover.test.js`, implement, run.

### Task 4.3: canopy shade and triplanar
- [ ] **Failing tests:** `canopyShade` offsets a crown footprint along
  −sunXZ by `h · cot(el)` and its radius equals the crown radius; the
  grounding read uses it outside every rect; the triplanar block computes
  `dFdx`/`dFdy` before the branch and uses `textureGrad` inside (no
  `texture2D` in the branch).
- [ ] Run, implement, run.

### Task 4.4: plan.js patterns, corridors, solids
- [ ] **Failing tests** (`plan.test.js`):
  - `uniform` reproduces today's `scene.js` scatter output for every site,
    same seed, exactly (regression).
  - `cluster` count within ±10% of expected (spacing `100/√peak`, accept
    probability `smoothstep(1−cover, 1−cover+0.18, fbm)`); scale rises with
    the accept value.
  - `rows` 7–9 m apart; `edge` sits on the `cover.R = 0.5` iso-line;
    `ring` 3–7 trunks on 5–15 m; satellites biased downhill (mean dot > 0).
  - avoid, water and flats respected; same seed → same output.
  - Corridors: no solid within 6 m of any mission waypoint line or race
    gate line; half-widths 10 (speeders), 8 (kaadu), 5 (on foot).
  - `laneHits(planRoute(endor.chase.waypoints, solidsOf(endorPlaced)), [-1.3, 1.1, -0.4, 0.8], solids) === 0`;
    route length ≤ 1.1× today's; Dagobah gate-to-gate
    `planRoute(gates, solids, { margin: 0.6 })` length ≤ today's +10%.
  - Solids are trunk radius at 1 m only.
  - Max load: for each forest world, max over a 20 m grid of Σ(ring count ×
    triangles) ≤ gate − non-vegetation triangles (from the F0 ledger).
- [ ] Run `npx vitest run src/components/galaxy/surface/plan.test.js src/components/galaxy/surface/missions`, implement, run.
- [ ] Print `worstSpot` per forest world and add `worst` views to
  `lab/foliage/views.txt`.

### Task 4.5: verify
- [ ] Budget all 17, landing and worst spots; shots all 17.
- [ ] Endor from (300, 0): the floor under crowns is darker than open ground
  (crop luminance ratio ≤ 0.7).
- [ ] No cover streaks toward the horizon (Naboo battle, Lothal tower far
  crops).
- [ ] `loaded` ≤ F3 + 0.3 s.

**Exit criteria:** refactor pixel-identical; calls +0, tris ±10k; canopy
shade visible beyond 170 m on forest worlds; route tests green; `loaded`
≤ +0.3 s.

**Ledger line:** every world ±0 draws.

---

## F5: grass field and understory patches

**Files:**
- Create: `grass.js`, `grass.test.js`; `flora/patch.js`, `flora/patch.test.js`
- Modify: `ground.js` (ground under grass darkened toward the root colour),
  `scene.js` (grass and patches from `FLORA[id].grass` / `.under`;
  `FLORA[id].scatter.retire`), `flora/palette.js` (Naboo and Scarif grass;
  Endor fern `under` densities with today's fern geometry; retire Naboo
  `grass`, Scarif `grass`/`tuft`, Endor fern scatter)

### Task 5.1: grass
- [ ] **Failing tests** (`grass.test.js`): the blade geometry has 3
  vertices and 1 triangle; `userData.noBake === true`, `castShadow === false`;
  the height texture is `FloatType` `RedFormat` with `NearestFilter`, 257² on
  high and 161² on small, read with `texelFetch`; a JS mirror of `groundY`
  equals `heightAt` at 200 random points (≤ 1e-4 m); counts per world from
  FLORA (Naboo 80k, Scarif 40k) and 16k on small; R2 thinning stays even
  (nearest-neighbour spread within 20%); flower share 1.5–3%.
- [ ] Run `npx vitest run src/components/galaxy/surface/grass.test.js`, implement, run.

### Task 5.2: patches
- [ ] **Failing tests** (`patch.test.js`): a slot keeps its world position
  and plant when the patch centre moves by one cell (world-locked); accept
  by `cover.R × clusterNoise`, else scale 0; LOD0 40 m and LOD1 100 m squares
  with the spec fades; `noBake` and `castShadow = false`; one InstancedMesh
  per patch; Endor at 0.12 slots/m² gives 192 LOD0 and 1,200 LOD1 slots.
- [ ] Run `npx vitest run src/components/galaxy/surface/flora/patch.test.js`, implement, run.

### Task 5.3: verify
- [ ] Budget all 17 (naboo, scarif and endor worst too); shots naboo,
  scarif, endor (high and low).
- [ ] Patch edge: crops at 28 m and 56 m from the player show no line.
- [ ] Owner phone check on Endor (mid tier) ≥ 30 fps.

**Exit criteria:** Naboo meadow reads dense; no visible patch edge; tris ≤
gate (Endor ferns ≈ −190k, Naboo ≈ −36k, Scarif ≈ +6k est.); p50 ≤ +10%;
phone check recorded.

**Ledger line:** naboo −cone grass +1 grass; scarif −tuft −grass +1 grass;
endor fern 2 → 2 patches.

---

## F6: Lothal

**Preconditions:** F4, F5. The Lothal CP has merged before any
`sites/outer.js` edit; otherwise `FLORA.lothal.scatter` carries the changes.

**Files:**
- Modify: `flora/palette.js` (`FLORA.lothal`: air golden afternoon with d50
  1.2 km, start 40, spire mist; grade; ground; straw grass 80k in 64 m;
  wind 1.0 and Lothal gusts; retire grass cones and `lothtemple` as spires),
  `flora/trees.js` (create: `spire`), `ground.js` (wave tint), `grass.js`
  (far cross cards on high, tuft cards on small), `scene.js`,
  `sites/outer.js` (spire scatter, only after the CP)
- Tests: `flora/trees.test.js` (create), `palette.test.js`, `grass.test.js`,
  `plan.test.js`

- [ ] **Failing tests:** `spire` 200–600 triangles, strata stripe in world
  Y; straw caps (S ≤ 0.45, V ≤ 0.88, golden lit exempt); small tier gives
  6k tuft cards of 4 triangles in a 60 m patch on the A channel; no spire
  within 12 m of the star-map gate line; far cards 2,000 at 30–150 m, high
  only.
- [ ] Run `npx vitest run src/components/galaxy/surface/flora src/components/galaxy/surface/grass.test.js src/components/galaxy/surface/plan.test.js`, implement, run.
- [ ] Budget lothal (merged and original caps); shots lothal high and low;
  owner phone check (small) ≥ 30 fps.
- [ ] Star-map race: ride it in the dev build or by `__surfaceDo` teleports
  through the gates; every gate reachable.

**Exit criteria:** Lothal under its original cap (calls ≤ 79.2, tris ≤
565,566); the straw sea moves in bands (floraTime and a gust crop); colour
checks within ΔE 8 of `#C6AF79` (body) and `#B3998A` (clearing).

**Ledger line:** lothal −cone grass −lothtemple copies +grass +far cards +spire kit +shrubs (≈72 → ≈71).

---

## F7: card crowns and bushes

**Files:**
- Create: `flora/cards.js` (`blobCards` with core, `crownNormals`,
  `crownAO`), `flora/cards.test.js`; `flora/under.js` (`bush`)
- Modify: `flora/materials.js` (one card material per world: `aChan`,
  sentinel, `cards()` hook, see-through; `leafDepth` on every flora mesh),
  `props/forest.js` (`canopy()` internals rebuilt on `blobCards` with a
  core, so wroshyr, jungletree and Kachirho change together), `scene.js`
  (`__surfaceDo('floraFade', near, mid)`)

- [ ] **Failing tests** (`cards.test.js`): 4 vertices and 2 triangles per
  card; `aCentre` equal within a card; normals unit with dot(normal,
  radial) ≥ 0.8; lod flag share 0.5 ± 0.05; card size = min(2.5, 0.35 R)
  (bush 0.8 R); L = n·s²·0.33/(πR²) in 1.0–1.4; overdraw ≤ 6 (≤ 4 small);
  core triangles first in the index, with uv (−1, −1); every part carries
  `aCentre`, `aCard`, `aChan`; the hook's fade uses `distance(base.xz,
  uCamXZ)` and keepers grow by 0.414 (a JS mirror keeps total area within
  1% across the fade); wind is added after `modelMatrix * im`.
- [ ] Run `npx vitest run src/components/galaxy/surface/flora/cards.test.js`, implement, run.
- [ ] Budget all 17; shots kashyyyk, yavin, endor, naboo (high and low).
- [ ] No pop: hold the camera at Kashyyyk land, `floraFade` 58 → 62 m,
  crown crop diff < 2% of pixels.
- [ ] Bake: the floor mask under a Kashyyyk crown shows leaf cut-outs, not
  strand stripes (`__surfaceDo` mask dump or a top-down shot).
- [ ] Owner phone check on Endor and Yavin ≥ 30 fps.

**Exit criteria:** no "lily pad" plates in Kashyyyk or Yavin shots; leaves
≤ 0.35 m on screen at 10 m; no pop; calls ±2 per world; tris ≤ gate.

**Ledger line:** kashyyyk, yavin ±0 (the core is in the card draw).

---

## F8: fronds, sprays, strands, lianas, big leaves

**Files:** `flora/cards.js` (`frondStrip`, `cutSpray`, `crossStrips`,
`vineCurtain`, `liana`, `bigLeaf`), `flora/under.js` (`swordfern` LOD0/LOD1),
`flora/patch.js` (Endor patches switch to `swordfern`), `props/forest.js`,
`props/edge.js` (retire solid fern, plant paddles, 3-sided reeds, 4-sided
moss cones, `rod()` lianas), `cards.test.js`

- [ ] **Failing tests:** `aWind` 0 at the base and 1 at the tip; triangle
  counts: fern frond 16, palm frond 24, moss tuft 16, liana tube 64,
  `bigLeaf` 8, `cutSpray` 4–6; sword fern LOD0 240–400, LOD1 48; `bigLeaf`
  hinge keeps its base vertex fixed under any phase; lianas and moss merge
  into the host geometry (one geometry, same attribute set).
- [ ] Run `npx vitest run src/components/galaxy/surface/flora/cards.test.js`, implement, run.
- [ ] Budget all 17; shots endor, dagobah, yavin, kashyyyk.

**Exit criteria:** Endor ferns read as pinnate fountains; Dagobah hanging
strands read as curtains; tris ≤ gate.

**Ledger line:** yavin and dagobah −rod liana and moss-cone draws where they
were separate; others ±0.

---

## F9: far tier, canopy shell, real mid geometry

**Files:** create `flora/far.js`, `flora/far.test.js`, `flora/shell.js`,
`flora/shell.test.js`; modify `flora/trees.js` and `props/forest.js` (mid
geometry per built kind: trunk 8 segments, flagged cards gone), `placer.js`
(far rings replaced by the far tier), `scene.js`

- [ ] **Failing tests:** `far.test.js`: the lathe has 24 triangles; a JS
  mirror of the `aShape` reshape reproduces column, cone, umbrella, round,
  palm and spire profiles; one InstancedMesh per world; collapse between
  0.8·d95 and d98 is deterministic per instance and uses `uFogEye` (no
  `cameraPosition` in the source); `noBake`, `castShadow = false`; colours =
  crown ramp × 0.85–0.9. `shell.test.js`: vertices on the terrain grid lines
  in the annulus; y within ground + 22–40 m; cells under cover-mask gaps
  sink below ground; 60–120k triangles on high, 8 m cells on small.
- [ ] Run `npx vitest run src/components/galaxy/surface/flora/far.test.js src/components/galaxy/surface/flora/shell.test.js`, implement, run.
- [ ] Budget all 17; shots endor bunker, kashyyyk lagoon, yavin summit
  (shell enabled only behind `FLORA.yavin.shell` for this check; it ships on
  in F13).

**Exit criteria:** far vistas show stepped value planes toward the fog and
no bald horizon; far-crop colour checks within ΔE 8 of the hazed film
samples (Endor `#2C4145`/`#4B643F`); per world, calls net ≤ 0 (far rings
out, one far tier in).

**Ledger line:** each tree world: far rings (1–3 each) → 1 far tier.

---

## World checkpoints F10–F16 (common steps)

Each world checkpoint:
1. **Precondition:** that world's CP merged (see Global Constraints) before
   any `sites/*.js` edit.
2. `FLORA[id]` complete: air (sky colours; fog lengthened to the spec §3
   d50 and start, height fog), grade, ground (with cover tints), grass,
   under, scatter (patterns, retirements), wind, ramps.
3. Builders in `flora/trees.js` / `flora/under.js` with triangle-count tests
   in `flora/trees.test.js` / `flora/under.test.js`.
4. Placed heroes and composites through the same builders and pools.
5. GLB side-by-side where decision 2 applies: the same view built vs GLB,
   kept in `lab/foliage/<cp>/sidebyside-*.png`; the choice recorded below.
6. Tests: `npx vitest run src/components/galaxy/surface/flora src/components/galaxy/surface/plan.test.js src/components/galaxy/surface/missions src/components/galaxy/surface/sites`.
   Corridor and route tests, the max-load test and the palette guardrail
   re-run with the world's new values.
7. Budget at the landing and the worst spot; original caps where they apply.
8. Shots high and low; colour checks on the named rects (ΔE ≤ 8).

### F10: Endor
- `redwood2` (2 variants; LOD0 ≤ 2.5k, mid ≈500), fairy rings, `conifer`
  (≈10% near), swordfern and bush patches at spec densities, `log2`,
  stumps, sorrel mottle (cover R), conifer ridges in the far tier, light
  shafts, gas giant smaller and higher.
- Rebuilt: 5 `ewoktree` (`forest.js:642`), placed `TREES` redwoods
  (`forest.js:481`).
- Remove: near `spruce`, the `lo` ring, fern rings beyond 90 m, green fern
  colours, the bare accent floor.
- Tests: `redwood2` 1.4–2.5k, mid 400–600; ring of 3–7 on 5–15 m; chase and
  `bikechase` corridors clear.
- **Exit:** trunks every 10–30 m in the land shot; canopy closes overhead;
  the floor reads duff and ferns; crown crops within ΔE 8 of `#6a7a3a`
  (derived) / `#272E2D`; ewoktrees match the forest; tris ≤ 1,238,380 at the
  landing and the worst spot.
- **Ledger:** endor ≈16 → ≈20 veg draws; calls ≈85 / 89.1.

### F11: Naboo
- `cypress`, `plane`, `holmoak`, `gungan` (placed 10–20), `beech`; zones
  from cover and places; boulders; lake water and falls pools; meadow grass
  with flowers; reeds and lily pads at `paonga`; triplanar on Theed's cliff.
- Remove: `nabootree`, `grove` lumps, flower spheres, uniform scatter, the 24
  placed-grove draws.
- Tests: builder counts; hue band 50–92°; open-world caps on the Sacred
  Place; kaadu run corridor clear.
- **Exit:** Varykino shows spindles and umbrellas; no ball canopies; Theed
  cliff without streaks.
- **Ledger:** naboo groves and lumps → ≈22 veg draws; calls ≈315 / 356.4.

### F12: Dagobah
- `gnarl2` tangle (14–18 m, trunk 0.6–1.0 m, root mass 6–10 m), vine
  curtains and moss in the strand cards, young shoots, `reeds2`, bog leaves,
  fungus, half-sunk logs, floating weed, edge grass (20k), motes `#fff8e0`,
  dry-ice layer, mirror water `#7f8f98`, grade (decision 3).
- Rebuilt: `cavetree` (`forest.js:1462`), Yoda's hut gnarltree, X-wing weed
  cones.
- GLBs: dagocypress leaves scatter (≤ 12 restyled silhouettes only if the
  side-by-side prefers); dagoroots restyled with lod1.
- Tests: `gnarl2` ≈2.2k (mid ≈400); "Do or Do Not" walk ≤ +10%.
- **Exit:** visibility 30–60 m; no leafy crowns; the ground fog band
  visible at the hut; under the original cap (calls ≤ 83.6, tris ≤
  1,465,380).
- **Ledger:** dagobah ≈18–20 veg draws.

### F13: Yavin 4
- `jungle2` with card crowns (near/mid), the canopy shell on, `ceiba` (1 per
  2–3 ha, lianas and epiphytes merged), `cohune`, `xate`, ferns,
  philodendron, saplings, clearing grass (30k), ANH dawn air, `sky.mood:
  'mist'` option.
- Rebuilt: the `ruin` jungletree (`forest.js:1694`), temple vines
  (`tiers()`, `forest.js:1600`).
- GLBs: yavintree leaves scatter (≤ 2 restyled heroes if preferred).
- Tests: ceiba ≈1.6k; carpet cover from the summit ≥ 75% (shell + crowns
  over a 400 m disc, computed from the plan); max load at the summit.
- **Exit:** the summit shot shows the broccoli sea with emergent umbrellas;
  under the original cap (calls ≤ 62.7, tris ≤ 1,691,089) at the landing and
  the summit.
- **Ledger:** yavin ≈22 → ≈19 veg draws; calls ≈56.

### F14: Kashyyyk
- `wroshyr2` (80–140 m; pads of G needle/scale cards; aerial roots and moss
  strands on A; bridge rods), optional 300 m backdrop hero, `karst2` layers
  with mangroves at the waterline, sand ground, milky water, shore grass,
  bigLeaf and fern patches.
- Rebuilt: placed wroshyr heroes in `TREES`, Kachirho's crowns, pod vines.
- Tests: `wroshyr2` ≈2.1k (hero ≤ 4k); pads use G; hue 112–147°, S ≤ 0.35.
- **Exit:** the lagoon shot shows bonsai silhouettes and vegetated towers
  fading in layers; Kachirho matches the forest.
- **Ledger:** kashyyyk ≈17 veg draws; calls ≤ 100.1.

### F15: Scarif
- `coconut` in rows 7–9 m on the big islands plus leaning shore singles,
  `pandanus`, `beachscrub` fringe, creepers, dune grass (40k), sand ground,
  milky sky.
- GLBs: palm leaves scatter (near hero only if the side-by-side prefers).
- Tests: `rows` spacing; coconut ≈620; hue 100–130°.
- **Exit:** the beach place reads as white sand with a scrub fringe; the
  palm side-by-side recorded.
- **Ledger:** scarif −palm −sorganfern −tufts → ≈8 veg draws.

### F16: Sorgan
- `conifer` wall (`edge` 4–8 m), optional pine and broadleaf filler if the
  ledger allows, swordfern under the edge, meadow grass (60k), logs, mossy
  boulders, mist air.
- **Pond field:** a levelled flat at pond level −0.3 m round the village
  (180, 120), a raised dry flat for the huts, one water plane
  (`site.waters[]` in `water.js`), dykes as built berms (≈20 tris), reeds on
  30% of edges, krill specks. Place text: huts on dry ground ringed by ponds.
- GLBs: sorganbirch, sorganfir, sorganfern leave scatter (sorganfir hero if
  preferred).
- Tests: a `water.js` local-plane test (one mesh, the field's rect); pond
  flats don't move other places' flats; berm count and tris.
- **Exit:** the village shot shows ponds round dry huts and a forest wall;
  calls ≤ 63.8.
- **Ledger:** sorgan → 12–20 veg draws.

---

## F17: worlds without vegetation

Tatooine (scatter and rock only: nebkhas 1–3 per 1,000 m², ≤ 40, on the salt
flat within 150 m of the homestead; melons near `tuskens`; boulder
satellites; triplanar `mesa-rock`), Hoth (lee drifts, blue ice tint, cream
overcast air and grade), Mandalore (shard and plate kit ≈8/ha, cavity dust,
triplanar), Mustafar (lava rivers from the existing `channels` beds in cover
G, lava planes, the 900 `lavacrack` dashes retired), Geonosis (spire and rock
clusters, triplanar), Coruscant (optional planters, no outdoor gold trees),
Kamino (bigger waves, spray), Bespin (cloud-sea height fog), Nevarro
(palette, basalt slabs, `lavarock` lod1; no river yet).

- [ ] **Failing tests:** `plan.test.js` satellite case; nebkha count ≤ 40
  and only inside the salt-flat disc; Mustafar cover G only on channel beds;
  Tatooine `FLORA.tatooine` has no `air`, `ground` or `grade` keys
  (only `scatter`).
- [ ] Run, implement, run; budget all eight; original caps for Mandalore
  and Nevarro.

**Exit:** Mandalore shows no cliff streaks and is under its original cap
(calls ≤ 116.6, tris ≤ 515,764); Mustafar shows rivers, not dashes; Nevarro
reads cool blue-black and is under its original tris (≤ 515,184) if
`lavarock` is fully replaced by slabs, else the shortfall is recorded for
F18; Tatooine's palette untouched (ground crop ΔE ≤ 2 vs F1).

**Ledger line:** mustafar +1 (lava planes); mandalore −shard GLB draws
+1 kit; others ±0–2.

## F18: Nevarro lava river

A new `channels` (or `pits`) layer at `lava` (300, 260) in `terrain.js`
(heights change), lava mask in cover G, a local lava plane, emissive cracks
`#DF852F`/`#9B331F`, steam.

- [ ] **Failing tests** (`terrain.test.js`): the layer is deterministic;
  heights change only within its extent; every place flat stays level;
  corridors unaffected.
- [ ] Run, implement, run; budget nevarro (merged and original).

**Exit:** the lava shot shows a glowing river; calls ≤ 49.5.
**Ledger line:** nevarro +1 (lava plane).

## F19: optional polish (each behind its own flag)

`erode` terrain layer (Naboo hills, Endor ridges, Lothal plains,
mountains); a second coarse floor-bake area (±590 m at 1024²); 3-triangle
hero grass blades within 10 m; dithered LOD cross-fade on high; far-mesh
refinement; optional film touches (Lothal inland sea, Sorgan river and
oxbows, Varykino terraces, Dagobah fungus shelves).

- [ ] Per item: `terrain.test.js` determinism (erode), places stay level,
  routes unchanged.

**Exit:** each item ships only if its shots win and `loaded` stays ≤ +1 s.
