# Battlefront 2017 pipeline, lane K: the planet skins. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** From orbit and from the galaxy map, every planet the game painted wears the game's skin (its colour, its normal relief, its clouds drifting, its atmosphere's colour, its rings), while the ground you fly down to stays the site's procedural relief and scans; sequel worlds excluded; under the quality tiers' texture caps.

**Architecture:** An import script fetches the game's planet textures from the bucket (`web/textures/**/planet*`, the `levels/space/*/planet/` sets, `objects/planets/`, the front end's `_CA` globes), converts them to the site's sizes and formats under `public/textures/galaxy/planets/<id>/`, and writes a `src/data/planetSkins.json` naming each site planet's maps. `bodies.js`'s `LOOKS[id]` gains `skin`; `bodyShaders.js`'s surface shader gains the skin's samplers and a mix by altitude; `buildBody` loads them when the tier allows and the asset host serves them. The galaxy map's discs read the same maps.

**Tech Stack:** phase 0's fetch, `sharp`, `scripts/ktx2.mjs` (UASTC for the ultra 4096 set, from the bucket's KTX2 as it is), three.js (`TextureLoader`, the KTX2 path in `lib/three/gltf.js`/`textures.js`), Vitest, `scripts/glb-shot.mjs`-style shots of `#/galaxy/<id>` from orbit.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-levels-lighting-sabers-design.md` ("The planet skins"); the texture list: `web/textures.jsonl` names containing `Planet`, `GasGiant`, `Moon_`, `Cluster_`, `DebrisRing`, `Asteroids_`, or under `/Planet/`, `/Planets/` (102 on 2026-10-10, encoded as KTX2 at up to 4096 and linked raw as PNG, both queued; check the bucket for what has landed and say so in the PR).

## Global Constraints

- Phase 0's Global Constraints (keys, `lab/assets/bf2017/`, the sequel list, the credit text, the gates).
- **Files this lane owns**: `scripts/bf2017-planets.mjs`, `scripts/lib/bf2017-planets.mjs` (+ test), `src/data/planetSkins.json`, `src/components/galaxy/bodies.js` (`skin` on a look; `buildBody` loading it: additive), `src/components/galaxy/bodySkin.js` (+ test: the samplers and mix behind `#ifdef SKIN`, spliced into the surface shader only for a skinned body, since `bodyShaders.js` was already 803 lines; its shield moved to `bodyShield.js`, re-exported), `src/components/galaxy/HoloMap.jsx` and `universe/paint.js` only if the map's discs take the colour map (optional task), `public/textures/galaxy/planets/`, `scripts/assets-upload.mjs` (`REMOTE` gains `textures/galaxy/planets`). It does not touch `atmosphere.js`'s maths, `world.js`, or any surface file.
- **Sizes**: 1024 WebP (mid), 2048 WebP (high), 4096 KTX2 UASTC (ultra, the colour and normal only); low draws no skin, so there is no 512 set (as built: `sizesFor('color', 'low')` is null); never larger than the game drew it; a skin's set under 3 MB at high, 12 MB at ultra; the cloud and ring maps at half the colour's size; the atmosphere map is read once at import as its colour (`atmo: '#rrggbb'`), eased in with the skin so the close sky is unchanged.
- **The mapping** is data (`planetSkins.json`), never a guess in code: `{ "<site planet id>": { color?, normal?, clouds?, atmo?, rings?, tiles?, cloudTiles?, cloudCut?, seas?, ringsAt?, from: { <kind>: "<game texture name>" } } }` (as built: each map a path stem, the tier's `-<tier>.webp|ktx2` added at load), keys sorted, written by the script from a table in `scripts/lib/bf2017-planets.mjs` (`SKINS`: site id → a list of globs over the game names per map, best first; a glob matching two names is reported, never guessed between), reviewed in the PR.
- **Sequel worlds** (jakku, starkiller, takodana, crait, dqar, resurgent, hosnian) are refused by phase 0's `isSequel` and never in the table.
- **Nothing a visitor can do is lost**: a planet without a skin draws exactly as before (the test renders the shader source with `SKIN` undefined and asserts it is byte-identical to today's); the close ground is unchanged (`uSkinMix` 0 within the atmosphere's `top`).
- Files under 800 lines; pure logic tested; the gates.

## Review Focus

1. **The game's planet maps are equirectangular, stored square** (as built, looked at on 2026-10-10): the game's planet meshes wrap them once round and pole to pole once, the seam sits round the back of the visible face and the maps are seamless across it, so the shader works out three's sphere UVs on the unit sphere and no `seamShift` is needed; the `_CA` globes are pictures of a disc and are left out (`PICTURES`).
2. **`_CS` carries smoothness in alpha and `_NI` a normal with something in blue**: the import drops alpha from colour (or keeps it as the ocean mask where the planet has seas: a flag in the table), and rebuilds the normal's z from x and y (phase 0's `normalPng`). A planet lit with a wrong normal shows inverted relief at the limb; the shot at a grazing sun catches it.
3. **Clouds at 2048 and the atmosphere shell**: the site's cloud layer is a noise function in the surface shader; the game's cloud map replaces its coverage, not its lighting; drift keeps the site's `clouds.drift`. A cloud map with its own alpha (`_CA`) is coverage; a `_C` without alpha is luminance as coverage.
4. **Memory at ultra**: 4096² colour plus normal is 16 MB of UASTC per planet; the system view holds one planet and its moons. `buildBody`'s `setDetail` and `dispose` must free the skin with the body; the test asserts `dispose` disposes every skin texture.
5. **The front end's `_CA` globes (1024², the whole planet with its atmosphere drawn in)** are the only skin for Hoth, Tatooine, Kashyyyk, Yavin 4, Scarif, Kessel, Felucia and the Death Star II: they include the atmosphere glow in the pixels, so for those the site's atmosphere shell is drawn at half strength (`atmoScale` in the table) and the shot decides; a globe that fights the shell ships as colour only with `atmo: null`.

---

### Task 1: The import and the table

**Files:**
- Create: `scripts/bf2017-planets.mjs`, `scripts/lib/bf2017-planets.mjs` (+ test), `src/data/planetSkins.json` (`{}` until the first run), `scripts/fixtures/bf2017/web/textures/planets/` (two 32² PNGs: a colour with alpha, a normal)

**Interfaces:**
- Produces:
  - `SKINS`: `{ endor: { color: 'Levels/Space/SB_Endor_01/Planet/T_Planet_Endor_01_CS', normal: '…_N', clouds: '…_Cloudes_01_C', atmo: '…_Atmosphere_01_C', seamShift: 0, seas: false }, 'endor-giant': { color: '…T_GasGiant_Endor_01_C' }, naboo: {…}, naboomoon: {…}, bespin: {…}, kamino: {…}, sullust: {…}, hoth: { color: 'S2/Objects/Planets/Hoth/T_PlanetFrontenHoth_01_CA', atmoScale: 0.5 }, tatooine: {…}, kashyyyk: {…}, yavin: { color: 'Levels/Lighting/Yavin/Sunset_01/T_Yavin_01_Planet_C' }, yavin4: {…}, geonosis: { …, rings: 'S5_1/Objects/Planets/Geonosis/T_PlanetFrontendGeonosisRings_01_CA' }, scarif, kessel, felucia, deathstar2, ryloth, rylothmoon, fondor, fondormoon, athulla, pillio, vardos }` (site ids as `bodies.js`'s `LOOKS` and `systems.js` name them; a game name that is not a site planet is left out with a note). As built: Endor, Naboo, Kamino, Bespin and Geonosis's rings; the globes are pictures, not maps (`PICTURES`).
  - `sizesFor(kind, tier) → { w, format }`; `planFor(skin, available: Set<name>) → { fetch: [], missing: [] }`.
  - CLI `node scripts/bf2017-planets.mjs [--only endor,naboo] [--dry]`: lists the bucket for each name (PNG first, KTX2 else, as phase 0's `textureSources`), fetches, converts (`sharp` resize, WebP q82 colour / q80 others; the ultra KTX2 from the bucket's KTX2 by `--drop-mips` or `scripts/ktx2.mjs` from the PNG), writes the files and `planetSkins.json`, prints a table (planet, maps, bytes per tier, missing).

- [ ] **Step 1: Failing tests**: `SKINS` has no sequel id and every id is in `LOOKS`; `sizesFor('color', 'ultra')` is `{ 4096, 'ktx2' }`; `planFor` lists a missing name under `missing`, never throws; the import of the fixture writes four files at the asked sizes and a manifest entry.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Try it** (keys in the environment): `--dry`, then for real on what the bucket has; the table in the PR; what is still `missing` listed (the upload may still be running: say the bucket's count of `planet` objects at the time).
- [ ] **Step 6: Commit** `The game's planet skins imported: colour, relief, clouds, atmosphere and rings per world`.

### Task 2: The skin on the body

**Files:**
- Modify: `src/components/galaxy/bodyShaders.js` and the new `bodySkin.js` (`#ifdef SKIN`: `uSkinColor`, `uSkinNormal`, `uSkinClouds`, `uSkinMix`, `uSeamShift`; the colour mixed over the procedural ground by `uSkinMix`; the normal perturbing the lighting normal; the clouds' coverage from the map where it exists), `src/components/galaxy/bodies.js` (`LOOKS[id].skin = planetSkins[id]`; `buildBody` loads the maps through `lib/three/textures.js` (the asset host, the tier's size) when `tier !== 'low'`, sets `SKIN` on the material, sets `uSkinMix` from the camera's altitude in `update` (1 above `atmo.top × 1.5` radii, 0 at `atmo.top`), disposes them in `dispose`), `src/components/galaxy/bodySkin.test.js` (the shader source without `SKIN` is byte-identical to `main`'s: a snapshot test). The site ids are `LOOKS`'s: Sullust, Kessel, Felucia, the Death Star II, Ryloth, Fondor, Athulla, Pillio, Vardos and Naboo's moon have no body on the site and are listed in `UNPLACED`, not `SKINS`; low and small bodies draw no skin

- [ ] **Step 1: Failing tests**: the snapshot; `skinMixAt(altitude, atmoTop)` is 1 far, 0 inside; `buildBody` with a fake loader loads the skin's maps on high and none on low, and `dispose` disposes each.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: See it**: `#/galaxy/endor`, `#/galaxy/naboo`, `#/galaxy/bespin` from orbit, each before and after, at high and ultra; fly down to the ground and back (the mix); a grazing-sun shot for the normal; into `docs/superpowers/evidence/bf2017-planets/`. `galaxy-check.mjs space <id>` under its row.
- [ ] **Step 6: Commit** `The planets wear the game's skins from orbit, and the site's ground up close`.

### Task 3: The rest, the map, the PR

- [ ] Every planet in `SKINS` wired (the front-end globes with `atmoScale`); optional: `HoloMap.jsx`'s discs tinted from the colour map's mean (a 1 × 1 read at import, written to `planetSkins.json` as `swatch`), replacing `LOOKS`'s swatch where a skin exists.
- [ ] The gates, the regenerated files restored, `assets-upload.mjs --dry` in the PR, the lane's section in `docs/superpowers/HANDOFF-bf2017.md` (Done; Left: skins still missing from the bucket; Checking it), merge `origin/main`, push, PR `The planets wear the game's skins`. MERGE per the slot.
