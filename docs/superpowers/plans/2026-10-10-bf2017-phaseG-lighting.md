# Battlefront 2017 pipeline, lane G: the worlds under the game's light. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Every Star Wars world the game has is lit as the game lights it: its sun, sky, ground bounce, fog, exposure, bloom, grading and wind derived from the level's VisualEnvironment records for each weather the level has, its reflections from the level's probes, its far ground shaded by the game's baked sun shadow; calibrated once, then data for every world.

**Architecture:** A script fetches a level's VisualEnvironment records (named in the map's `sky[]`) and writes one JSON per world under `src/data/bf2017/light/`; a pure, tested `src/lib/three/gameLight.js` turns an entry into the site's `site.sky`, `site.light`, fog, exposure, bloom and wind shapes with one calibration factor; `scene.js` reads them where it reads the site's today; the level's outdoor and indoor probes become the scene's environment through PMREM; the distant shadow cache is sampled by the ground material and the far instances. The site's weather states pick the level's weather entry.

**Tech Stack:** Node 22 (`fetch`, gzip through `node:zlib`), `sharp`, three.js (`HDRCubeTextureLoader` or `RGBELoader` × 6, `PMREMGenerator`, `LUTPass` from `three/examples/jsm/postprocessing` if the grading LUT reads as 32³), Vitest, `scripts/surface-shot.mjs`, `scripts/galaxy-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-levels-lighting-sabers-design.md` ("The light"); the record's fields are listed there; `docs/superpowers/evidence/bf2017-assets/inventory.md` ("Update, 2026-10-10 00:20": the probes and shadow caches).

## Global Constraints

- Phase 0's Global Constraints (keys, `lab/assets/bf2017/`, the gates).
- **Files this lane owns**: `scripts/bf2017-light.mjs`, `scripts/bf2017-probe.mjs`, `scripts/lib/bf2017-light.mjs` (+ test), `src/lib/three/gameLight.js` (+ test), `src/data/bf2017/light/*.json`, `src/components/galaxy/surface/sky.js` (accepts a derived sky: additive), `surface/scene.js` (the light setup `:247-285` reads `siteLightFrom` when `site.gameLight` names an entry; the zone swap `:1527` takes a probe), `lib/three/groundLook.js` (the shadow cache sample: additive, off when no texture), `surface/weather.js` (the weather → entry map), `universe/post.js` (exposure, bloom and the LUT pass: additive), `public/textures/galaxy/bf2017/light/<world>/` (probes, the shadow cache, the LUT). It does not touch lane L's `level/*`, the sites' `life`, or `levelSky.js` (lane W's, superseded: do not create it).
- **One calibration**: `GAME_TO_SITE` in `gameLight.js`, set on Hoth Sunny so the derived sun, sky and exposure match the site's Hoth within the before/after shot's mean luminance (±10%), then held for every world. The PR shows both shots and says the factor.
- **A world without a record** (nevarro, mandalore, sorgan, lothal, coruscant, dagobah, mustafar) keeps its site's sky and light exactly; the test asserts `siteLightFrom(undefined)` is `null` and `scene.js` falls through.
- **Probes**: the outdoor one of the main arena and one per indoor zone the site marks; 128² HDR, six faces, under 400 KB a world; loaded once, the previous world's disposed before the next; never two environments alive.
- Files under 800 lines; pure logic tested beside it; no network in tests; the gates.

## Review Focus

1. **Which VE is the level's**: the map's `sky[]` lists several (Hoth: `VE_Sky_Arctic_Sunny_01`, a spot-meter, `VE_PV_Hoth_Sunset_01`, `VE_HighEnd_01`, a death-screen desaturation). The main sky is the one whose name starts `VE_Sky_` for the level's folder; `VE_PV_*` are weather or zone overrides blended on top (`Priority`, `BlendMode`); `VE_HighEnd`, spot meters and UI effects are ignored. `pickEntries` is tested on Hoth's list.
2. **The sun's direction** is not in `OutdoorLightComponentData`; the record has colour and illuminance. Task 1 reads the level's sun entity when `data/` has one for the level (grep the level's objects for `SunEntityData` or a `Transform` on the outdoor light component), else measures the direction from the outdoor probe's brightest texel (`sunFromProbe`, tested on a synthetic cube with one bright texel). Say in the PR which path each world took.
3. **Units**: `FinalSunIlluminance` is lux-like (Hoth's sun near 100,000), `EV` is a photographic exposure value, colours are linear floats possibly over 1. `siteLightFrom` converts all of it to the site's 0…10 intensities and sRGB hex through one factor and `EV`; the test pins Hoth's output to the calibrated numbers so a drift in the conversion fails loudly.
4. **The far shadow's frame**: the shadow cache's bounds are not in its file. Task 3 measures them by correlating the cache against a shadow rendered from the heightmap with the derived sun (a one-off script that tries the terrain's bounds first and reports the match); the bounds go into the world's light JSON; a world whose match is poor ships without the cache and says so.
5. **The grading LUT**: `T_CC_<World>_<Weather>` may be a 32³ volume stored as a strip, a 16³, or a 1D ramp. Task 4 reads its dimensions from `textures.jsonl`; a 1024 × 32 or 32 × 1024 strip is a 32³ LUT; anything else means brightness, contrast and saturation only, said in the PR.

---

### Task 1: The records to the site's light

**Files:**
- Create: `scripts/bf2017-light.mjs`, `scripts/lib/bf2017-light.mjs` (+ test), `src/lib/three/gameLight.js` (+ test), `src/data/bf2017/light/hoth.json`, `scripts/fixtures/bf2017/data/ve_sky_fixture.json` (one record, trimmed to the components the lane reads, under 8 KB)

**Interfaces:**
- Produces:
  - `pickEntries(skyNames) → { main, overrides: [] }` (pure).
  - `readVE(record) → { sun: { color, illuminance }, sky: { color, ground, rayleigh, mie, cloudColors }, fog: { color, start, end, colorStart, colorEnd }, tonemap: { ev, compensation, bloom }, grading: { brightness, contrast, saturation, lut }, wind: { dir, strength }, enlighten: { bounce, skyColor, groundColor } }` (pure; every field optional).
  - CLI `node scripts/bf2017-light.mjs <world> [--map levels/mp/hoth_01]`: reads the map's `sky[]`, fetches each record (`data/<name>.json.gz`), writes `src/data/bf2017/light/<world>.json` as `{ world, weathers: { sunny: entry, sunset: entry, cloudy: entry, blizzard: entry, interior: entry }, probes: {…}, shadowCache: {…} }` (the weather key from the record's folder name, lower case).
  - `siteLightFrom(entry, { factor = GAME_TO_SITE } = {}) → { sky, light, fog, exposure, bloom, wind } | null` in the site's shapes (`sky.js`'s header, `scene.js:247-285`'s fields, `look.js`'s `exposureOf`).
  - `sunFromProbe(faces: { px, nx, py, ny, pz, nz: Float32Array }, size) → unit vector` (pure).

- [ ] **Step 1: Failing tests**: `pickEntries` on Hoth's five names; `readVE` on the fixture; `siteLightFrom` on the fixture gives the calibrated Hoth numbers (write them after step 5's calibration, then pin); `siteLightFrom(undefined) === null`; `sunFromProbe` on a synthetic cube finds the bright texel's direction within 2°.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Calibrate**: `node scripts/bf2017-light.mjs hoth`; wire Hoth (`hoth.gameLight = 'hoth'` in `sites/ice.js`; `scene.js` reads `siteLightFrom` for sun colour and intensity, hemisphere colours, fog colour and density, `scene.environmentIntensity`, exposure); `surface-shot.mjs` Hoth before and after; adjust `GAME_TO_SITE` until the mean luminance of the after shot is within 10% of the before and the sun's colour is the record's; pin the numbers in the test.
- [ ] **Step 6: Commit** `A world lit by the game's VisualEnvironment: sun, sky, fog, exposure and wind from its records`.

### Task 2: The probes

**Files:**
- Create: `scripts/bf2017-probe.mjs` (fetches a reflection volume's six faces, writes `public/textures/galaxy/bf2017/light/<world>/<zone>.{px,nx,py,ny,pz,nz}.hdr`), `src/lib/three/probeEnv.js` (+ test with a fake loader: `loadProbe(urls, { renderer }) → { env, dispose }`, the previous disposed on the next load)
- Modify: `surface/scene.js` (`scene.environment` from the outdoor probe; the zone swap loads the zone's probe; the dome's PMREM stays the fallback), `scripts/assets-upload.mjs` (`REMOTE` gains `textures/galaxy/bf2017` if lane L has not)

- [ ] **Step 1: Failing tests**: `loadProbe` returns an env and disposes the previous on a second call (the fake's `dispose` called once); the zone map picks the indoor probe for the hangar zone and the outdoor one elsewhere.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; pick Hoth's probes: list `textures/levels/mp/hoth_01/reflectionvolumetexture/*` (the folder per weather variant), choose the outdoor one nearest the arena's middle (the map's instances say where the hangar is; the probe's own position is not in the file: take the one whose faces show the most sky in `+y`, say which in the PR) and the hangar's (the most ceiling). **Step 4: Run** → PASS.
- [ ] **Step 5: Shots**: a stormtrooper's armour and the snowspeeder's canopy on Hoth before and after (the reflections); into the evidence.
- [ ] **Step 6: Commit** `The game's reflection probes as the world's environment, outdoors and in the hangar`.

### Task 3: The far shadow

**Files:**
- Create: `scripts/bf2017-shadowcache.mjs` (fetches the cache, converts the 16-bit PNG to an 8-bit WebP shadow mask at 1024 for high, 2048 ultra, 512 below; measures its bounds against the heightmap: renders the heightmap's sun shadow with the derived sun direction at 2 m a pixel, correlates, reports the best bounds and the match), `src/lib/three/shadowMask.js` (+ test: `maskUv(x, z, bounds)`)
- Modify: `lib/three/groundLook.js` (a `shadowMask` uniform and bounds; multiplies the sun's term beyond `SHADOW.extent`; off when null), `surface/level/levelScene.js`'s far draws' material (lane L's file: one hook, agreed in the PR; if lane L is not merged, the ground only)

- [ ] **Step 1: Failing tests**: `maskUv` maps the bounds' corners to 0 and 1; a point outside reads 1 (no shadow).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; run the measure on Hoth; if the match is under 0.8 correlation, ship without and say so. **Step 4: Run** → PASS.
- [ ] **Step 5: Shots**: the ridge's shadow across the snow from the hangar mouth, before and after. **Step 6: Commit** `The game's baked sun shadow on the far ground`.

### Task 4: Tone, grading, weather

**Files:**
- Modify: `universe/post.js` (exposure and bloom scale from the entry; a `LUTPass` on high and ultra when the LUT reads as 32³), `surface/weather.js` (state → weather entry; crossfade the derived light over 20 s as the site crossfades its own), `surface/sky.js` (takes the derived suns, haze and cloud colours)
- Create: `scripts/bf2017-lut.mjs` (fetches `T_CC_*`, writes the LUT as the pass wants it, or reports it is not a 32³)

- [ ] **Step 1: Failing tests**: the weather map covers every `weather.js` state and falls back to `sunny`; `lutShape(width, height) → 32 | 16 | null`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `galaxy-check.mjs surface hoth` under budget at high (the LUT pass costs one full-screen draw; measured in the PR).
- [ ] **Step 5: Shots**: Hoth sunny, sunset, blizzard (`weather` forced through `__surfaceDo`), before and after. **Step 6: Commit** `The game's exposure, bloom and grading, and its weather's light`.

### Task 5: Every other world the game has, and the PR

- [ ] `node scripts/bf2017-light.mjs <world>` for endor, tatooine, yavin, kashyyyk, naboo, kamino, geonosis, scarif, bespin, deathstar (the interior's `Levels/MP/DeathStar02_01` records for the space outside; the interior keeps its lamps), each wired with `gameLight`, each with a before/after shot; a world whose records are missing in the bucket is listed as left.
- [ ] The gates, the regenerated files restored, the lane's section in `docs/superpowers/HANDOFF-bf2017.md` (Done; Left: the placed lights when `bf2export lights` exists, worlds without records; Checking it), merge `origin/main`, push, PR `The worlds under the game's light: its records, probes, baked shadow and grading`. MERGE per the slot.
