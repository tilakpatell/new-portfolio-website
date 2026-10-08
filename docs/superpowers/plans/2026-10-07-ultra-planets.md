# Ultra planets and surfaces (Lane B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Star Wars surfaces and the universe's planets draw far more at `ultra` (finer terrain, layered scanned ground, denser grass and props, finer water, richer sky), read from one budget table, while `high` stays as it is.

**Architecture:** `src/lib/budgets.js` (Lane A's table, stubbed here until it lands) gives the per-level factors; a pure `surface/amounts.js` turns a level (and whether the screen is small) into every count the surface scene reads, with `high` returning exactly today's numbers. Each scene part (terrain, ground shader, grass, placer, water, sky, bodies, nearMaps) takes its counts from there, and the ultra-only shader work sits behind its own `#define` and program cache key, so `high` compiles the same programs as before.

**Tech Stack:** three.js 0.186, Vitest, sharp + basisu (scripts/ktx2.mjs), Playwright (scripts/galaxy-check.mjs).

**Spec:** `docs/superpowers/specs/2026-10-07-quality-modes-design.md` §2 (budget table), §4 Lane B.

## Global Constraints

- Budget rows, verbatim: triangles low 0.8M / mid 1.5M / high 3M / ultra none; prop density 0.5/0.75/1/1.5; lod1 on except ultra; grass 0.25/0.5/1/2; terrain 0.5/0.75/1/2; water 0.5/0.75/1/2.
- Nothing at `high` gets heavier than its baseline +10% (calls, triangles); ultra is additive.
- Downloads are lazy and per level: no `-xl`/8192 file is ever requested below `ultra`, nor on a phone.
- Do not touch the settings panel, device classification or model GLBs (Lanes A and C).
- `npm run lint` and `npm test` green; plain full-sentence commit messages.

## Review Focus

- A site without a scan for a splat role (the role missing from `public/cc0/galaxy/index.json`): the splat drops that layer, never a 404 or a black ground. Test in Task 4.
- An `-xl` scan not yet generated (index has no `xl`): ultra loads the 1K webp. Test in Task 5.
- Ultra relief on a flat (landing pad, a place's built ground): the flat stays level, so ships and buildings do not sink. Test in Task 3.
- A scattered prop on a slope: seated on the lowest ground under its footprint, never floating; a prop on flat ground does not move. Test in Task 6.
- The universe's 8192 maps absent: nearSet at ultra still falls back to `-xl` then `-hq`. Test in Task 9.

---

### Task 1: The budget table (stub of Lane A's)

**Files:** Create `src/lib/budgets.js`, `src/lib/budgets.test.js`

**Produces:** `BUDGETS` and `budget(level)`, Lane A's file taken verbatim once their branch was up (`tris`, `calls`, `modelsMB`, `props`, `lod1`, `grass`, `terrain`, `cut`, `water`) (unknown level → high's row).

- [ ] Test: every level has every column; `budget('ultra').triangles === null`; `budget('high').triangles === 3e6`; props/grass/terrain/water rise low→ultra; `lod1` false only at ultra.
- [ ] Implement; run `npx vitest run src/lib/budgets.test.js`; commit.

### Task 2: The surface's amounts

**Files:** Create `src/components/galaxy/surface/amounts.js`, `amounts.test.js`

**Produces:** `amountsFor({ level, small }) → { grid: { n, grow }, scatter, grass: { side, size }, map, marks, rings: { small?, scale }, depthN, relief, splat, clouds }`.

- [ ] Test: `amountsFor({ level: 'high', small: false })` equals today's numbers (grid 256 / 1.08, scatter 1, grass 280 × 44 m, map 512, marks 512, rings [160, 1.25, 48, 1.05], depth 512, relief 0, splat false, clouds 0); small keeps today's phone numbers (160/1.13, 0.6, 120, 256, 256, rings [96, 2.5, 40, 1.09], 256); ultra: grid 512, scatter 1.5, grass blades ×2 (side ≈ 396, size ≈ 55 m), rings with twice the vertices, depth 1024, relief 1, splat true, clouds 1. (LOD1 off at ultra is Lane A's, in the placer's `wantsLod`.)
- [ ] Implement from `budget(level)`; commit.

### Task 3: Terrain at ultra

**Files:** Modify `terrain.js` (`makeRaw(ground, { relief })`, `makeHeight(ground, { relief })`), `terrain.test.js`; `scene.js` (grid from amounts).

- [ ] Tests: `relief: 0` equals today's height everywhere sampled; with `relief: 1` heights differ off the flats by ≤ 0.6 m and a flat's centre and inside its radius equal the relief-0 height; `heightGrid` at n 512 is continuous across ±HALF (|h(HALF−ε) − h(HALF+ε)| small).
- [ ] Implement: two extra fbm octaves of fine relief (a few metres and ~0.7 m wavelengths), scaled by `relief`, added in `makeRaw` before flats and pits.
- [ ] Wire `scene.js`: `heightGrid(height, amounts.grid)`; commit.

### Task 4: Layered ground splat at ultra; scans never stretched

**Files:** Create `surface/splat.js` + test; modify `ground.js`.

**Produces:** `splatOf(site, has = scanOf) → { base, macro, steep, decal } | null`, roles by biome (desert: sand/redsoil/rock/gravel; ice: snow/gravel/rock/…; forest: needles|leaves/mossrock/mud; lava: ash/redrock/gravel; city: concrete/tiles/metal; swamp: mud/leaves/mossrock), each dropped when `has(role)` is null.

- [ ] Tests: Tatooine's splat has base 'sand' and a steep 'rock'; a missing role is dropped; a site with no `ground.detail` → null.
- [ ] `groundMaterial(site, { small, map, level })`: at ultra a `SPLAT` define: base scan at two scales (anti-tiling), macro scan blended by broad noise, steep scan triplanar on slopes, decal blotches in cells, wetness (darker, smoother) by water and in hollows; cache key `galaxy-ground:splat`. At every level the xz-projected scan fades out on steep slopes (no stretch on cliffs). Commit.

### Task 5: The 8192 `-xl` scan set

**Files:** Modify `scripts/galaxy-textures.mjs` (`--ultra`: 8192 colour/normal from Poly Haven's 8k, KTX2 when `ktx2.mjs`'s numbers say so, `xl` in index.json; more roles per biome), `src/lib/three/core.js` (`coreFiles(role, { xl })`, `loadCore(role, { xl })`).

- [ ] Test (`core.test.js`): `coreFiles('sand', { xl: true })` → webp files when index has no `xl`; → `color-xl.ktx2`/`normal-xl.ktx2` when it has `xl: 'ktx2'`; never xl without the flag.
- [ ] Implement; commit.

### Task 6: Grass, props, LOD and seating

**Files:** Modify `scene.js` (scatter count, grass), `placer.js`; create `surface/seat.js` + test.

**Produces:** `seatY(heightAt, x, z, r) → number` (the lowest of the centre and eight points at r).

- [ ] Tests: flat ground → centre height; a 1-in-2 slope with r 2 → centre − 1; r 0 → centre.
- [ ] Scatter items seated by their model's footprint radius before instancing; models put without `y`/`abs` seated by their box. Commit.

### Task 7: Water at ultra

**Files:** Modify `ocean.js` (`discRings({ small, scale })`), `water.js`, `ocean.test.js`.

- [ ] Test: `discRings({ scale: 2 })` has about twice the vertices of `discRings({})`, same far radius; default unchanged.
- [ ] Ultra: rings and depth bake from amounts; `FOAM_DETAIL` define (a finer foam lace and shore blend). Commit.

### Task 8: Sky, atmosphere and the galaxy's bodies at ultra

**Files:** Modify `sky.js` (`createSky(site, { clouds })`), `lib/three/atmosphere.js` (`stepsFor(level, base)`), `galaxy/bodies.js`, `universe/planets.js`.

- [ ] Tests: `stepsFor('high', 8) === 8`, `stepsFor('ultra', 8) === 16`, `stepsFor('mid', 8) === 5`; bodies' `segmentsFor(level)` ultra twice high; `nearOctaves({ tier: 'ultra', pxTall: 400 }) === 4`, high stays 2.
- [ ] Ultra sky: `CLOUDS_HQ` define (a second layer and more octaves, lit toward the sun). Commit.

### Task 9: The universe's planets at 8192

**Files:** Modify `universe/planets.js` (`NEAR_SEG.ultra = [320, 200]`), `planetMaps.js` (`k8` flag; `nearSet` at ultra: `-8k.ktx2` → `-xl.ktx2` → `-hq.webp`), `scripts/planets/sphere.mjs` (`-8k` size), `scripts/build-fandom-planets.mjs --ultra`, `scripts/build-universe-textures.py --ultra`.

- [ ] Tests: ultra nearSet for 'middleearth' with `k8` asks for `middleearth-8k.ktx2` with fallbacks; without `k8` unchanged; `nearSegments('ultra')` is [320, 200].
- [ ] Commit.

### Task 10: Evidence and docs

- [ ] `scripts/galaxy-check.mjs surface` at QUALITY=high and ultra for tatooine, hoth, endor, mustafar, coruscant, dagobah, scarif; high within baseline +10%; screenshots as small webp under `docs/superpowers/evidence/ultra-planets/`.
- [ ] `docs/architecture.md` lines for budgets/amounts/splat; lint, test; push; PR.
