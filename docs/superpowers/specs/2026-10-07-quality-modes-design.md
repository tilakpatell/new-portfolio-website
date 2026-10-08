# Quality modes and a polygon budget that follows the device

Date: 2026-10-07 · Status: approved by the brief (autonomous session) · Branch: `claude/dynamic-triangle-cap-star-wars-p7bqtb`

## The brief

> There is a hard cap of 2.5 million triangles for the Star Wars worlds.
> Remove this cap and make it dynamic based on mobile vs laptop and hardware
> acceleration. We should have quality modes (ultra, high, medium, low) used
> site-wide. Default for laptops is ultra, and ultra should not restrict the
> polygons. Add an insane amount of textures and make the planets very
> robust. Improve the planets and models with more polygons and accuracy
> through Meshy and our gen3d pipeline. Look at Bruno Simon's site for
> inspiration for the settings.

## Where the cap lives today

The 2.5M number is not a runtime limit. It is a QA gate, and the gate is
what has held the content down:

- `scripts/galaxy-check.mjs:168` holds every world to `min(2.5e6, baseline × 1.1)`
  triangles, `min(600, baseline × 1.1)` draw calls and 40 MB of models, at
  `QUALITY=high` only.
- `docs/superpowers/specs/2026-10-06-planets-overhaul-design.md` §Performance
  budget writes the same numbers down, and the per-model polygon table
  (props ≤ 15k, houses ≤ 40k, landmarks ≤ 90k) that every catalogue entry's
  `tris` was cut to by `scripts/meshy-import.mjs`.
- `scripts/gen3d/budget.mjs` `TIERS` caps the top cut of a made model at
  120k faces and 4096 maps; `src/lib/three/gen3d.js` `CUTS` loads `.hq` for
  both high and ultra, so ultra gets nothing more than high.
- `scripts/galaxy-surface-lod.mjs` gives every model over 20k triangles a
  quarter-size LOD1 that `placer.js` swaps in past three radii, at every
  level (ultra only stretches the distance by 1.5).

What already exists and stays:

- `src/lib/device.js`: the device **tier** (`low`/`mid`/`high`, for memory,
  data and whether a world asks before downloading) and the **detail**
  level (`low`/`mid`/`high`/`ultra`), which a desktop's graphics card grade
  (`lib/gpuGrade.js`) moves. Today a laptop defaults to `high`; only a card
  at or above an RTX 3060 Ti gets `ultra`.
- `src/lib/detail.js`: the one table every painted texture, built curve and
  loaded model scales by (`DETAIL` rows: texture scale and ceiling, segment
  scale, model map cap, LOD reach, clearcoat).
- `src/runtime/quality.js` and `lib/three/pace.js`: the per-frame watchdog
  that softens the pixel ratio when frames come late, and `strained()` that
  holds a struggling chip at `high` from then on (`capDetail`).
- `?quality=low|mid|high|ultra` and `localStorage['tp-quality']` pin the
  level. There is no settings UI for it anywhere on the site. The only
  settings panels are the universe's flight settings (`FlightSettings.jsx`,
  `O`) and the Avengers compound's (`CompoundWorld.jsx`, `O`).

## The design

### 1. Quality modes, site-wide

Five modes a visitor can pick: **Auto**, **Low**, **Medium**, **High**,
**Ultra**. Inside the code the levels keep their names (`low`, `mid`,
`high`, `ultra`); "Medium" is only the label for `mid`.

Auto resolves to a level from `classifyDevice`, with one change of policy:

| Device | Auto picks |
|---|---|
| No hardware acceleration (software WebGL, `gpu().software`) | `low` |
| Weak phone chip, ≤ 2 cores, very little memory (tier `low`) | `low` |
| Phone or tablet (tier `mid`) | `mid` |
| Laptop or desktop with a hardware WebGL context | **`ultra`** (was `high`) |
| Laptop or desktop whose chip grades `mid` (old built-in graphics) | `high` |
| Laptop or desktop whose chip can't be graded (Firefox, Safari) | `ultra` |

The safety net for a laptop that can't keep up stays as it is: the pace
watchdog softens the pixel ratio first, and `strained()` caps that chip at
`high` for the next scene (`tp-detail-cap`, keyed by the chip's name).
A visitor who picks a level by hand is never capped: a hand-picked level
turns the strain cap off, and the panel says so.

Add to `lib/device.js`:

- `classifyDevice` takes `override` as it does, and resolves `detail` to
  `ultra` for any non-phone, non-software device unless its grade is `mid`.
- `quality()` → `{ mode, level, auto }`: the mode the visitor chose
  (`'auto'` or a level), the level in force, and what Auto would pick.
- `setQuality(mode)`: writes `tp-quality` (`'auto'` removes the key),
  clears the cache, dispatches `tp:quality` on `window` with the new
  level. The `?quality=` address override still wins for the page.

### 2. One budget table per level

The 2.5M, 600 and 40 MB numbers move out of the check script and the spec
into `src/lib/budgets.js` (pure, no three.js, importable from Node scripts
and tests), one row per level, alongside the `DETAIL` rows:

| level | triangles | draw calls | models (MB) | prop density | LOD1 | grass | terrain | gen3d cut | water |
|---|---|---|---|---|---|---|---|---|---|
| low | 0.8M | 350 | 20 | 0.5 | yes | 0.25 | 0.5 | `.lo` | 0.5 |
| mid | 1.5M | 500 | 40 | 0.75 | yes | 0.5 | 0.75 | plain | 0.75 |
| high | 3M | 700 | 60 | 1 | yes | 1 | 1 | `.hq` | 1 |
| ultra | **none** | 1500 | 240 | 1.5 | **no** (full model at every distance) | 2 | 2 | `.ultra` | 2 |

Rules:

- **Ultra has no triangle ceiling.** `galaxy-check.mjs` at `QUALITY=ultra`
  reports triangles and holds the world only to the draw-call and download
  rows and to a frame-time test: on a real graphics chip (`ANGLE=d3d11` or
  `metal`, the owner's desktop) p95 ≤ 16.7 ms at 1440p. In software GL the
  ultra run only reports.
- Each level has its own baseline file, `lab/baseline/surface-<level>.json`,
  made by the same script; a world is held to its level's baseline +10%
  under the row's ceiling, as now.
- Every number a scene reads about *how much* to draw comes from this
  table through one call, `budget(level)`; nothing in a scene hard-codes a
  count or a `tier !== 'high'` branch to decide amount. (`tier` keeps
  deciding memory and data questions only.)
- `scripts/gen3d/budget.mjs` gains an `ultra` tier: 300k faces (the raw
  TRELLIS/Hunyuan mesh, baked, not simplified), 8192 maps, 24 MB; the
  `.ultra` file is made only for kinds asked for it (`--ultra`). `CUTS` in
  `lib/three/gen3d.js` maps `ultra → '.ultra'` and falls back to `.hq` where
  no ultra file exists (a HEAD request once, cached per name).
- The catalogue's `tris` stays the high cut. A kind gets an optional
  `ultra: { tris, tex }` and a `<kind>.ultra.glb` beside it; the placer loads
  it at ultra, the plain file otherwise. `catalog.test.js` checks each ultra
  file exists exactly where the entry says and is under the ultra row's size.

### 3. The settings panel

One panel for the whole site, in the spirit of Bruno Simon's folio: a small
gear in a corner, a sheet that opens over everything with a few plain
controls and a live readout of what the machine is doing, never a wall of
sliders. Files under `src/components/settings/`:

- `settings.js` (pure, tested): the settings shape, defaults, `read()`,
  `write(patch)`, `subscribe(fn)`, migration from the keys that already
  exist (`tp-quality`, `tp-3d`, `tp-detail-cap`, the audio keys). Kept as
  `localStorage['tp-settings']` (`{ v: 1, ... }`); the legacy keys are
  written too, so nothing that reads them today changes.
- `Settings.jsx`: the sheet. Opened by the gear beside the colour picker in
  the nav and the phone menu, by ⌘K "Settings", and by `openSettings()` in
  `lib/palette.js` so any world's own panel can link to it. `Esc` closes.
  A dialog with a focus trap on a desktop; a bottom sheet on a phone.
- `DeviceReadout.jsx`: what Auto sees (the chip's name and grade, tier,
  memory, whether hardware acceleration is on) and, while a world is up,
  the live frame time, draw calls and triangles from the runtime (`rt.gfx`
  exposes `renderer.info`), so a visitor can see what a mode costs.

Sections, in order:

1. **Graphics** — Quality: Auto · Low · Medium · High · Ultra, as a
   segmented control, Auto labelled with what it picks here ("Auto · Ultra
   on this machine"). 3D: Auto · On · Off (today's `lib/gpu` setting).
   Sharpness: a pixel-ratio scale 0.5–2 under the level's ceiling. Motion:
   full / reduced (today's `prefers-reduced-motion` respected as the
   default).
2. **Sound** — master, music, voices (today's `lib/audio` keys).
3. **Controls** — links to the world panels that exist (flight settings,
   the compound's), each saying its own key.
4. **Data** — "Ask before a big download" (today's `worldCheck` rule, now a
   choice), with the room left in storage.
5. **About this device** — the readout.

Changing the quality while a world is up: the runtime hears `tp:quality`
and calls the module's `onQuality(level)` where it has one (the galaxy
surface, the universe map and the worlds that can re-tune without
rebuilding: pixel ratio, shadows, grass density, LOD reach); otherwise it
asks "Reload the world at Ultra?" and reloads the module. The pages that
are not worlds (the feed, the ambience) re-read the level on their next
mount.

### 4. The planets and models at ultra (the content lanes)

Lane B, **planets and surfaces**:

- Terrain: the galaxy surfaces' terrain mesh at ultra is built at twice the
  resolution (`terrain.js` from the table's `terrain` scale), the ground
  splat and detail scans get a `-xl` set at 8192 (`scripts/galaxy-textures.mjs
  --ultra`, KTX2 where `ktx2.mjs report` says it's worth it), grass density
  and draw distance follow the table, the ocean's mesh and normal maps
  double, the sky's atmosphere steps rise.
- The universe's planets: the `-xl` 4096 KTX2 colour maps get an 8192
  companion for the seven baked planets and the Star Wars ones
  (`scripts/build-fandom-planets.mjs --ultra`, `build-universe-textures.py
  --ultra`), loaded by `nearMaps.js` at ultra within six radii; the near
  sphere goes to 320 × 200 segments.
- Every surface's landing site gets a "robustness" pass: no seam, no
  stretched map, no floating prop, checked by `scripts/galaxy-check.mjs`
  screenshots at `QUALITY=ultra` and `high`.

Lane C, **models**:

- The twenty most-seen Star Wars kinds (each world's landmark and its two
  most-placed buildings: `placer.js`'s counts say which) get an ultra cut:
  re-asked from Meshy at the highest polygon setting where the source is
  Meshy (`scripts/meshy-galaxy-library.mjs --ultra`), or remade through
  gen3d at `--faces 300000 --tex 8192 --ultra` where the site made it
  (`scripts/desktop/ask.mjs gen3d <name> --ultra`, a desktop job per model;
  see `.claude/skills/desktop-jobs`). The judge sheet for each goes in
  `docs/gen3d/`.
- Accuracy: each hero model is compared with its reference image on the
  judge sheet; a model whose shape is wrong is remade from a better
  reference, not just up-polyed.
- Credits: `scripts/credits.mjs` picks up the new files as it does.

### 5. Testing

- `lib/device.test.js`: Auto picks `ultra` for a laptop with hardware
  WebGL, `high` for a `mid`-grade chip, `mid` for a phone, `low` for
  software GL; a hand-picked level ignores the strain cap.
- `lib/budgets.test.js`: every level has every column; ultra has no
  triangle ceiling; the rows rise monotonically.
- `settings.test.js`: defaults, migration from the legacy keys, round trip,
  `subscribe` fires on `write`.
- `catalog.test.js`: ultra files match entries.
- `scripts/galaxy-check.mjs` grows `QUALITY=ultra` and a baseline per level;
  the planets-overhaul spec's budget section is replaced by a pointer here.
- A browser pass at each level on the owner's desktop
  (`ANGLE=d3d11`), screenshots kept under the lane's evidence folder.

### 6. Lanes and branches

Three sessions run at once, each on its own branch from this one:

| Lane | Branch | Owns |
|---|---|---|
| A · Settings and budgets | `claude/quality-settings` | §1, §2 (table, check script, gen3d cuts loader), §3, §5 tests |
| B · Planets and surfaces | `claude/ultra-planets` | §4 lane B, terrain/texture build scripts, surface scene reads of `budget(level)` |
| C · Models | `claude/ultra-models` | §4 lane C, Meshy and gen3d ultra cuts, catalogue `ultra` entries |

Lane A lands first (the table and `budget(level)` are what B and C read).
B and C may stub a local `budget()` with the table above until A merges,
then rebase. Each lane opens its own pull request to `main` and keeps the
existing checks green at `QUALITY=high` (nothing at high may get heavier
than its baseline +10%: ultra is additive, never a tax on high).
