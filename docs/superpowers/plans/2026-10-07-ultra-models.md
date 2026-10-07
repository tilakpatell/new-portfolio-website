# Ultra models (Lane C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The twenty most-seen Star Wars surface kinds can carry a `<kind>.ultra.glb` (up to 4× the catalogue's triangles, 8192 maps, ≤ 24 MB) that the placer loads at ultra only, with the scripts that make those files and the requests that ask for them.

**Architecture:** A pure helper (`catalog/ultra.js`) says which file a kind loads at a level and whether far copies (LOD1) are used; `placer.js` reads it. The build scripts (`meshy-galaxy-buildings.mjs`, `meshy-import.mjs`, `sketchfab-surface.mjs`, gen3d's `budget.mjs`/`web.mjs`/`make.mjs`/`runner.mjs`) learn `--ultra` / `ultra: yes` and write the `.ultra` file beside the plain one. Nothing at high changes: high loads the same files and keeps its LOD1.

**Tech Stack:** three.js, gltf-transform, meshoptimizer, vitest, Playwright (glb-shot, galaxy-check).

**Spec:** `docs/superpowers/specs/2026-10-07-quality-modes-design.md` §2 (ultra cut numbers), §4 Lane C.

## Global Constraints

- Ultra cut: 300k faces, 8192 maps, 24 MB (gen3d `ultra` tier); a surface kind's ultra keeps up to 4× its catalogue `tris`.
- The catalogue's `tris` stays the high cut; a kind gains optional `ultra: { tris, tex }` and `<kind>.ultra.glb` beside it.
- At ultra the placer loads `.ultra.glb` where the entry has one, and draws the full model at every distance (no LOD1). At every other level nothing changes.
- Until Lane A's `budget(level)` lands, the level is `detailLevel()` and "LOD1 at this level" is `level !== 'ultra'`.
- Do not touch terrain, textures, the settings panel or device classification.
- `npm run lint` and `npm test` stay green.

## Review Focus

- An entry says `ultra` but its file is missing or fails to load in the browser → the placer falls back to the plain file (test: `ultraUrl` fallback in `loadModel`).
- A `.ultra.glb` on disk with no `ultra` entry, or over 24 MB → `catalog.test.js` fails.
- `galaxy-surface-lod.mjs` or the credit audit treating `foo.ultra.glb` as a kind of its own → the audit's `stem` strips `.ultra`; the LOD script skips `.ultra` files.
- gen3d asked for 300000 faces without `ultra: yes` → only the three usual cuts (hq capped at 120k), exactly as today.
- gen3d `ultra: yes` → four cuts, and `x-wing` (no ultra file) still passes the shipped-model tests.

---

### Task 1: The ultra rule for surface kinds

**Files:** Create `src/components/galaxy/surface/catalog/ultra.js`, test `ultra.test.js`; modify `catalog/index.js` (export `surfaceUltraUrl`), `catalog/catalog.test.js`.

**Interfaces — Produces:**
- `ULTRA = { factor: 4, tex: 8192, bytes: 24 * 1024 * 1024 }`
- `ultraCut(entry) → { tris, tex }` (entry.ultra, else `{ tris: 4 × entry.tris, tex: 8192 }`)
- `usesUltra(entry, level) → boolean` (level === 'ultra' && Boolean(entry?.ultra))
- `farCopies(level) → boolean` (level !== 'ultra')
- `surfaceUltraUrl(kind) → '/models/galaxy/surface/<kind>.ultra.glb'`

- [x] Tests: `usesUltra({ultra:{tris:1,tex:1}}, 'ultra') === true`, `false` at 'high' and for an entry without `ultra`; `farCopies('ultra') === false`, `true` for low/mid/high; `ultraCut({tris: 20000})` → `{ tris: 80000, tex: 8192 }`.
- [x] catalog.test: each entry with `ultra` has its file, under `ULTRA.bytes`, `ultra.tris ≤ 4 × tris` where `tris` is set, `ultra.tex ≤ 8192`; every `*.ultra.glb` in the folder has an entry with `ultra`.
- [x] Implement, run `npx vitest run src/components/galaxy/surface/catalog`, commit.

### Task 2: The placer at ultra

**Files:** Modify `src/components/galaxy/surface/placer.js`; test `placer.test.js`.

- [x] Export `modelUrl(kind, level = detailLevel())` → ultra url when `usesUltra`, else `surfaceUrl(kind)`; `loadModel(kind, url)` falls back to the plain url when an ultra url loads null.
- [x] `put` and `scatter` skip the LOD1 when `!farCopies(detailLevel())`.
- [x] Tests for `modelUrl` at ultra/high with and without an entry's `ultra`.
- [x] Run placer tests, commit.

### Task 3: gen3d's ultra tier

**Files:** `scripts/gen3d/budget.mjs`, `web.mjs`, `make.mjs`, `runner.mjs`, `src/lib/three/gen3d.js`, tests in `scripts/gen3d/gen3d.test.mjs`, `scripts/ai-e2e/assets/gen3d.test.mjs`, `src/lib/three/gen3d.test.js`, `scripts/ai-e2e/assets/credits.mjs` (stem strips `.ultra`).

- [x] `ULTRA = { suffix: '.ultra', faces: 300000, tex: 8192, bytes: 24 MB, detail: ['ultra'] }`; `TIERS` stays the three cuts made for every model (hq's detail becomes `['high']`); `cutsFor(faces, tex, { ultra })` adds `ultra` scaled by the same share; `fileFor(name, 'ultra', { ultra })`.
- [x] `publish(…, { ultra })`, `make(…, { ultra })` bakes at the ultra cut's faces and maps; `make.mjs --ultra`; the runner reads `ultra: yes` and passes `--ultra`, and commits the `.ultra` cut.
- [x] `CUTS.ultra = '.ultra'`, with `ULTRA_CUTS` (a set of names that have one) and `.hq` for the rest.
- [x] Tests, commit.

### Task 4: Meshy and Sketchfab `--ultra`

**Files:** `scripts/meshy-galaxy-buildings.mjs` (models: target_polycount 300000 under `s[n].ultra`; fetch: `raw/<n>.ultra.glb` → `<kind>.ultra.glb`, 4× tris, 8192, ≤ 24 MB, no LOD), `scripts/meshy-galaxy-library.mjs` (runnable, forwarding with its tasks file), `scripts/meshy-import.mjs` (`--ultra`), `scripts/sketchfab-surface.mjs` (`--ultra`), `scripts/galaxy-surface-lod.mjs` (skip `.ultra`).

- [x] Pure `takeUltra(argv)` / `ultraSpec(a)` / `checkUltra` with tests in `scripts/ultra/cut.test.mjs`; commit.

### Task 5: The picks, the requests, the sheets, the evidence

- [x] `scripts/ultra/counts.mjs` (placements), `scripts/ultra/kinds.mjs` (the twenty, with source and the owner's command for each; `commands.mjs` folded into it).
- [x] `docs/superpowers/evidence/ultra-models/plan.md`: the counts, the twenty, sources, commands, desktop issue links.
- [x] Judge sheets `docs/gen3d/ultra/<kind>.webp` (four views of the plain model; no reference tile: `lab/refs/` is empty here and Wookieepedia is denied by the network policy, so the comparison is the Meshy lane's `sheet --ultra` on the owner's machine).
- [x] Desktop gen3d issues for the remakes (one per model, not polled): none of the twenty is gen3d-made; the galaxy's X-wing (#552) and TIE interceptor (#553) were asked for.
- [x] galaxy-check screenshots at QUALITY=ultra and high, small webp.
- [x] lint, test, push, PR.
