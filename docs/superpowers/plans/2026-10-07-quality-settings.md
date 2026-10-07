# Quality modes, budgets and the settings panel (Lane A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto picks Ultra on laptops, one `budget(level)` table decides how much every scene draws, the galaxy QA gate reads that table per level, and one settings panel serves the whole site.

**Architecture:** `src/lib/budgets.js` is a pure table (no three.js) that lib/device, the galaxy surface, `scripts/galaxy-check.mjs` and Lanes B and C all read. `lib/device.js` gains the mode the visitor chose (`quality()`, `setQuality()`), which the settings store (`components/settings/settings.js`, pure) mirrors into the legacy keys. The runtime hears `tp:quality` and retunes a live world or offers to reload it.

**Tech Stack:** React 19, Vite, Vitest, three.js r186, Playwright-core (headless Chromium) for the QA script.

**Spec:** `docs/superpowers/specs/2026-10-07-quality-modes-design.md` (§1, §2, §3, §5; Lane A of §6).

## Global Constraints

- Levels keep their code names `low`, `mid`, `high`, `ultra`; "Medium" is only the label for `mid`. Modes are `auto` plus a level.
- Table (spec §2): triangles 0.8M / 1.5M / 3M / none (Infinity); draw calls 350 / 500 / 700 / 1500; models MB 20 / 40 / 60 / 240; prop density 0.5 / 0.75 / 1 / 1.5; lod1 yes / yes / yes / no; grass 0.25 / 0.5 / 1 / 2; terrain 0.5 / 0.75 / 1 / 2; gen3d cut `.lo` / plain / `.hq` / `.ultra`; water 0.5 / 0.75 / 1 / 2.
- `budgets.js` imports nothing (Node-importable from scripts).
- Nothing at `QUALITY=high` may get heavier than its baseline +10%; ultra is additive.
- Do not touch galaxy surface content (terrain, textures, models) beyond the loader hooks.
- `npm run lint` and `npm test` stay green. Commit messages in plain full sentences.

## Review Focus

1. Storage unavailable (private mode, blocked site data): every read/write in device/settings falls back to defaults without throwing — tested in `settings.test.js` with a throwing storage.
2. A corrupt `tp-settings` value (bad JSON, wrong `v`, out-of-range sharpness): read() falls back to defaults/migration and clamps — tested.
3. `?quality=` in the address still wins over the stored mode, and `quality().mode` reports it — tested in `device.test.js`.
4. A world that is mid-load (`rt.loading`) when the quality changes: `requality` reports `'idle'` and does nothing — tested in `runtime.test.js`.
5. A gen3d `.ultra` file that 404s: the URL resolves to `.hq` and the miss is remembered — tested in `gen3d.test.js` with a fake fetch.

---

### Task 1: The budget table

**Files:** Create `src/lib/budgets.js`, `src/lib/budgets.test.js`.

**Interfaces:** Produces `BUDGET_ROWS` (object keyed by level, columns `tris, calls, modelsMB, props, lod1, grass, terrain, cut, water`) and `budget(level) → row` (unknown level → high's row).

- [x] Test: every level has every column; `budget('ultra').tris === Infinity`; numeric columns rise monotonically low→ultra; `budget('nope')` is high's row; ultra `lod1 === false`, others true; cuts `['.lo', '', '.hq', '.ultra']`.
- [x] Run, see it fail; implement; run, see it pass; commit ("The quality levels get one budget table …").

### Task 2: Auto picks Ultra; quality() and setQuality()

**Files:** Modify `src/lib/device.js`, `src/lib/device.test.js`.

**Interfaces:** Produces `quality() → { mode: 'auto'|level, level, auto }`, `setQuality(mode)` (writes/removes `tp-quality`, clears cache, dispatches `CustomEvent('tp:quality', { detail: level })`), `sharpness() → number in [0.5, 2]` (reads `tp-sharpness`), and `classifyDevice` returning `auto` (what Auto would pick) beside `detail`.

- [x] Tests: tier-high laptop with graded-`high`/ungraded chip → `detail: 'ultra'`; grade `mid` → `'high'`; phone → `'mid'`; software → `'low'`; tier-`mid`/`low` computers keep their tier; with `override` set the strain `cap` is ignored; with no override the cap still holds an ultra chip at high; `auto` field equals the un-overridden pick.
- [x] Implement in `detailOf`; `pixelRatio` multiplies by `sharpness()`. Update the header comment and the architecture doc entry. Commit.

### Task 3: galaxy-check reads the table; baselines per level

**Files:** Modify `scripts/galaxy-check.mjs`; create `lab/baseline/surface-high.json`, `lab/baseline/surface-mid.json`; modify `docs/superpowers/specs/2026-10-06-planets-overhaul-design.md` §Performance budget.

- [x] Gate: `row = budget(QUALITY)`; calls ≤ min(row.calls, base×1.1); tris ≤ min(row.tris, base×1.1) except ultra (reported only); models ≤ row.modelsMB; `BUDGET` defaults to `lab/baseline/surface-<QUALITY>.json` when `BUDGET=1`. Ultra frame-time test p95 ≤ 16.7 ms only when `ANGLE` is not swiftshader.
- [x] Run the dev server and generate high and mid baselines (`JSON=1`), copy into `lab/baseline/`; re-run with the gate, see "pass". Ultra baseline left as a TODO in the header. Commit.

### Task 4: gen3d ultra cut

**Files:** Modify `scripts/gen3d/budget.mjs`, `scripts/gen3d/gen3d.test.mjs`, `src/lib/three/gen3d.js`; create `src/lib/three/gen3d.test.js`.

**Interfaces:** `ULTRA = { suffix: '.ultra', faces: 300000, tex: 8192, bytes: 24 MB, detail: ['ultra'] }` (kept out of `TIERS`, so the three standard cuts and their tests stay as they are); `CUTS.ultra = '.ultra'`; `gen3dUrl(name, detail)` stays sync (returns `.hq` at ultra until the ultra file is known); `gen3dUrlChecked(name, detail, fetchFn) → Promise<url>` does one HEAD per name, cached, and falls back to `.hq`.

- [x] Tests: `ULTRA` values; `fileFor(name,'ultra', { ultra: true })` → `.ultra.glb`; checked URL resolves `.ultra` on 200, `.hq` on 404, HEAD called once per name.
- [x] Implement; commit.

### Task 5: Surface catalogue `ultra` and the placer

**Files:** Modify `src/components/galaxy/surface/catalog/index.js`, `catalog.test.js`, `placer.js`.

**Interfaces:** `surfaceUltraUrl(kind)`, `modelUrlFor(kind, level) → url` (ultra file when `level === 'ultra'` and the entry has `ultra`), `wantsLod(kind, level) → bool` (`entry.lod && budget(level).lod1`).

- [x] Tests: entries with `ultra` have `{ tris, tex }` numbers, the `.ultra.glb` exists and is under the ultra row's size; `modelUrlFor`/`wantsLod` cases using a fake entry.
- [x] Placer: `loadModel(kind)` default URL `modelUrlFor(kind, detailLevel())`; both LOD branches use `wantsLod`. Commit.

### Task 6: The settings store

**Files:** Create `src/components/settings/settings.js`, `settings.test.js`.

**Interfaces:** `DEFAULTS = { v: 1, quality: 'auto', three: 'auto', sharpness: 1, motion: 'auto', sound: true, volume: 1, voices: 1, askBigDownload: true }`; `read(store?)`, `write(patch, store?)`, `subscribe(fn) → undo`; `migrate(store)`. `write` mirrors legacy keys: `tp-quality` (removed for auto), `tp-3d` (removed for auto), `tp-sound` ('on'/'off'), `tp-sharpness`, `tp-volume`, `tp-ask-download`. Strain cap `tp-detail-cap` is read for the panel only (`capped`), cleared when a level is hand-picked.

- [x] Tests: defaults on empty storage; migration from legacy keys; round trip; subscribe fires on write; throwing storage → defaults, no throw; corrupt JSON → migration; sharpness clamped.
- [x] Implement; commit.

### Task 7: Runtime hears tp:quality

**Files:** Modify `src/runtime/runtime.js`, `src/runtime/quality.js`, `src/runtime/index.js`, `src/runtime/runtime.test.js` (and `quality.test.js`).

**Interfaces:** `quality.retune(level)` swaps the budget row; `quality.setSharpness(s)`; `rt.requality(level) → 'tuned' | 'reload' | 'idle'` (world/module `onQuality` called → tuned; current without one → reload; nothing up or still loading → idle); `rt.reload() → Promise<bool>` remounts current module/props/host. `index.js` listens for `tp:quality` and dispatches `tp:quality-reload` `{ level }` when the answer is reload; listens for `tp:world-reload`.

- [x] Tests for each branch; implement; commit.

### Task 8: The panel

**Files:** Create `src/components/settings/Settings.jsx`, `SettingsHost.jsx`, `DeviceReadout.jsx`, `src/styles/lazy/settings.css`; modify `src/lib/palette.js` (`openSettings`), `src/components/Nav.jsx` (gear), `src/components/CommandPalette.jsx` ("Settings"), `src/App.jsx` (host), `src/lib/audio.js` (volume, voices gain), `src/index.css` (`html[data-motion='reduced']`).

- [x] Panel sections per spec §3 with segmented controls; Esc closes; focus trap; bottom sheet under 640px; live readout polls `runtime().gfx.renderer.info` once a second only when the runtime module is already loaded (`window.__tpRuntime`-free: imported lazily from `../../runtime`).
- [x] Browser check in headless Chromium: open via gear and ⌘K, switch to High, see `tp-quality` = high; screenshot desktop and phone. Lint, test, commit.

### Task 9: Finish

- [x] `npm run lint`, `npm test`, `npm run build`; architecture doc entry for `components/settings/` and `lib/budgets.js`; push; open the PR with what was verified.
