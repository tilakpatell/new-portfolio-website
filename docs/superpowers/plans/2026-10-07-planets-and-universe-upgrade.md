# The planets and the universe, upgraded: the plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, one lane per session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The fandom planets sharp and accurate from the ship, the galaxy's worlds sharp from orbit, three more universe events, and a landing's ground matching where on the map you came down.

**Architecture:** Three lanes on disjoint files, each its own worktree and PRs. Lane 1 is `src/components/universe/planets.js`, `planetShading.js`, `scripts/planets/`, `scripts/build-fandom-planets.mjs` (since folded into `scripts/planets/bake.mjs`), `src/components/universe/poses.js` and `public/textures/universe/`. Lane 2 is `src/components/galaxy/bodies.js`, `bodyShaders.js`, `src/components/universe/director.js`, `scene.js` and the `claude/universe-ship-pace` branch's files. Lane 3 is `src/components/universe/landings/` and `footScene.js`'s one `furnish` call. A lane never edits another lane's files; if it must, it says so in its PR and merges main first.

**Tech Stack:** three r186 (WebGL 2), vitest, eslint, sharp (bakes), basisu through `scripts/ktx2.mjs`, headless Chromium through `scripts/universe-check.mjs`, `scripts/galaxy-check.mjs` and `scripts/landing-check.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-07-planets-and-universe-upgrade-design.md`

## Global Constraints

- Branch from `origin/main`, never the local `main`. Merge `origin/main` again right before `gh pr merge N --merge`. Main is unprotected: merge only after `npx eslint .`, `npx vitest run` (heavy tests re-run alone if they time out) and `npx vite build` are green locally. `npm run build` rewrites `public/github.json`: never `git add -A` after it.
- Commit messages and PR bodies in plain prose, as the repo's are (what changed and why, no bullet soup), ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and the PR body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Nothing new on `low`: a weak device gets today's picture and today's cost.
- Every picture change is looked at in a browser before it's called done (preview pages under `scripts/preview/`, the dev server `npx vite --port 5188 --strictPort --host 127.0.0.1`), and a screenshot goes in the PR.
- Pure rules in their own file with a `*.test.js` beside them; drawing code reads the rules.
- On Windows, `src/runtime/shading.test.js` and `src/data/changes.test.js` fail on `URL.pathname` and are not this plan's; `npm ci --ignore-scripts` in a fresh worktree.
- Models and textures are accurate to their source (Tolkien's map, New Mexico's geography, the real Antilles, Dunder Mifflin's letterhead). A recoloured stand-in doesn't count.

## Review Focus

1. A planet's near set arrives after the ship has already left (a fast fly-by): the swap must not install maps on a planet now out of range, nor leak them. Lane 1 Task 1's "late arrival" test.
2. Two planets in range at once (C-137 and its moons, the Twins): the resident budget must drop the furthest, not the one you're looking at. Lane 1 Task 1's "resident" test.
3. A `-xl` KTX2 that fails to load (an old browser without the transcoder): the `-hq` WebP must stay. Lane 1 Task 2's fallback test through `mapFile`.
4. An entry spot over the sea on the Caribbean or Middle-earth: the landing must come down on land. Lane 3 Task 2's "toward land" test.
5. The eclipse event while the ship is at a station or in the galaxy's gate: it must not fire where there is no sun to cross. Lane 2 Task 4's `canHave` test.

---

## Lane 1: the fandom planets, sharp and accurate

### Task 1: maps by distance (`nearMaps`)

**Files:**
- Create: `src/components/universe/nearMaps.js`, `src/components/universe/nearMaps.test.js`
- Modify: `src/components/universe/planets.js` (`loadTextures`, `buildPlanet`: the returned `p` gains `swapMaps(T2)`), `src/components/universe/scene.js` (one call a frame after the planets' `tick`: `near.update(ship, planets, dt)`; this is the only scene.js line Lane 1 touches, and Lane 2 must leave it alone)

**Interfaces:**
- Produces: `createNearMaps({ level, load = loadTexture, resident = 2, near = 6 }) -> { update(shipAt: [x,y,z], planets: { id, at, r, swapMaps }[]), dispose() }` in `nearMaps.js`, and the pure `wanted(shipAt, planets, { near }) -> id[]` (the planets within `near` radii, nearest first) and `evict(resident: id[], wanted: id[], max) -> { keep: id[], drop: id[] }`.
- Produces: `p.swapMaps(T2)` on `buildPlanet`'s return: installs `T2[name]` for each of the planet's map slots (`map`, `normalMap`, `roughnessMap`, `emissiveMap`, the cloud mesh's `map`/`alphaMap`) wherever `T[name]` was, copying `wrapS`, `wrapT`, `repeat`, `offset`, `colorSpace` and `anisotropy` from the old texture; `swapMaps(null)` puts the standard set back.
- Consumes: `mapFile(name, level)` from planets.js; `MAPS`' per-planet names follow `${id}`, `${id}-normal`, `${id}-rough`, `${id}-night`, `${id}-glow`, `${id}-clouds`. Export `mapsOf(id) -> name[]` from planets.js (the names in `MAPS` that start with `id`).

- [ ] **Step 1: Write the failing tests** in `nearMaps.test.js`:

```js
it('wants the planets within six radii, nearest first', () => {
  expect(wanted([0, 0, 0], [{ id: 'a', at: [10, 0, 0], r: 1 }, { id: 'b', at: [3, 0, 0], r: 1 }, { id: 'c', at: [5, 0, 0], r: 1 }], { near: 6 })).toEqual(['b', 'c']);
});
it('keeps the two nearest wanted and drops the rest', () => {
  expect(evict(['a', 'b'], ['c', 'b'], 2)).toEqual({ keep: ['c', 'b'], drop: ['a'] });
});
it('does not install a set that arrives after the planet left', async () => { /* a load that resolves after update() moved the ship away: swapMaps never called, dispose called on the arrived textures */ });
it('disposes a dropped planet's near set', async () => { /* three planets come near in turn; the first's textures get dispose() */ });
```

- [ ] **Step 2: Run** `npx vitest run src/components/universe/nearMaps.test.js` **and see it fail** (module missing).
- [ ] **Step 3: Implement** `wanted`, `evict` and `createNearMaps` in `nearMaps.js`. `update` runs `wanted`, then `evict` against what's resident or loading, cancels nothing (a load in flight finishes, then is kept or disposed by whether its id is still wanted at arrival), loads a wanted planet's names through `load(BASE + mapFile(name, levelUp))` where `levelUp` is `'ultra'` on `ultra` and `'ultra'` on `high` too (the `-hq` set: 2048 on both; Task 2 adds `-xl`), and calls `swapMaps(T2)` on arrival. On `low` and on `small` it returns a no-op.
- [ ] **Step 4: Add `swapMaps` to `buildPlanet`** and `mapsOf` to planets.js. A test in `planets.test.js`: `mapsOf('middleearth')` includes `'middleearth'`, `'middleearth-normal'`, `'middleearth-clouds'` and not `'marvel'`.
- [ ] **Step 5: Wire** `near.update` into `scene.js` once a frame after the planets tick, created with the scene's `level` and `small`, disposed in the scene's `dispose`.
- [ ] **Step 6: Look.** Fly the Falcon to Middle-earth (`/#/universe`, M, Middle-earth, Jump). Within a second of parking the coasts sharpen. `window.__universe()` DEV hook: add `near()` returning the resident ids for the check script. Screenshot before and after.
- [ ] **Step 7: Run** `npx vitest run src/components/universe` and `npx eslint src/components/universe`; **commit.**

### Task 2: 4096 for `ultra`, as KTX2 (`-xl`)

**Files:**
- Modify: `scripts/planets/sphere.mjs` (`save` takes a size row `[4096, '-xl']` and writes `.ktx2` for it through `scripts/ktx2.mjs`'s converter, WebP otherwise), the seven bakers' colour-map `save` calls, `src/components/universe/planets.js` (`MAPS` gains `xl: true` for the seven colour maps; `mapFile(name, 'ultra')` returns `${name}-xl.ktx2` where `xl`), `planets.test.js`.

**Interfaces:**
- Produces: `public/textures/universe/<id>-xl.ktx2` for middleearth, breakingbad, caribbean, rickmorty, office, music, marvel. `mapFile(name, 'ultra') === `${name}-xl.ktx2`` when `MAPS[name].xl`, else as today.
- Consumes: `loadTexture` already routes `.ktx2`; Task 1's `createNearMaps` loads `levelUp = 'ultra'` on `ultra`, with `mapFile(name, 'high')` as its fallback when the load rejects (the `get` pattern already in `loadTextures`).

- [ ] **Step 1: Test** in `planets.test.js`: `mapFile('middleearth', 'ultra')` is `'middleearth-xl.ktx2'`; `mapFile('middleearth-normal', 'ultra')` is unchanged; `mapFile('transformers', 'ultra')` is unchanged. Run, see it fail.
- [ ] **Step 2: Implement** the `xl` flag and `mapFile`.
- [ ] **Step 3: Bake.** `node scripts/build-fandom-planets.mjs` (now `node scripts/planets/bake.mjs --all`) after the `save` change. UASTC through `node scripts/ktx2.mjs convert` (read its header for the flags). If any `-xl.ktx2` is over 6 MB, drop to ETC1S for that one and note it in the handoff.
- [ ] **Step 4: Test the fallback** in `nearMaps.test.js`: a `load` that rejects the `.ktx2` URL resolves the `-hq.webp` one; `swapMaps` receives the WebP textures.
- [ ] **Step 5: Look** on a strong card (`?detail=ultra` if the DEV query exists in `lib/detail`; else `localStorage` cap off) at Middle-earth parked: the rivers are lines, not smears. Screenshot.
- [ ] **Step 6: Commit.** Keep the bake deterministic (seeded) so a rebake is a no-op diff.

### Task 3: the sphere's segments by distance

**Files:**
- Modify: `src/components/universe/planets.js` (`buildPlanet`: `p.nearGeometry(on: boolean)`), `src/components/universe/nearMaps.js` (calls `nearGeometry(true)` with the swap and `false` with the drop), `planets.test.js`.

**Interfaces:**
- Produces: `NEAR_SEG = { high: [160, 100], ultra: [160, 100], mid: [96, 60] }` exported from planets.js; `p.nearGeometry(on)` swaps `body.geometry` between the far sphere and a lazily made `SphereGeometry(u.size, ...NEAR_SEG[level])`, keeping the far one (never disposed while the planet lives).

- [ ] **Step 1: Test**: `NEAR_SEG.low` is undefined; `nearGeometry(true)` on a built planet (the `planets.test.js` fake-three pattern, if there is one; else a pure `nearSegments(level) -> [w, h] | null` tested alone) gives a geometry with the near counts, `nearGeometry(false)` the far one, and the near geometry is made once.
- [ ] **Step 2: Implement**, run, **look** at `middleearth-limb` (`scripts/preview/planets.html?id=middleearth&dist=1.75`): the limb against the air is a curve, no chords. Screenshot.
- [ ] **Step 3: Commit.**

### Task 4: Breaking Bad's map, New Mexico

**Files:**
- Create: `scripts/planets/breakingbad-geo.mjs` (authored data: the Rio Grande's course as a polyline of about 40 points, the ranges as ridged strokes, the city's footprint, White Sands, the Jemez caldera, the Llano's edge; coordinates on a 1000 × 1000 sheet centred on Albuquerque, the sheet laid on the globe by the azimuthal projection Middle-earth uses)
- Modify: `scripts/planets/breakingbad.mjs`, `public/textures/universe/breakingbad*.webp` (rebaked)

- [ ] **Step 1: Author** `breakingbad-geo.mjs`: `RIVER`, `RANGES` (Sandia, Manzano, Sangre de Cristo, Jemez, Sacramento, Gila: each `{ name, stroke: [[x, y]...], width, height }`), `CITY` (the grid polygon at the river bend, the Big I at its middle), `SANDS`, `LLANO`, `DESERT` colour regions. Export `bounds`.
- [ ] **Step 2: Bake** the colour map from the data: a tan-to-red desert ramp by latitude and noise, the valley's green strip (cottonwoods) along the river, the ranges' ridged relief into the height field (the normal map and a shaded colour), White Sands near-white, the Llano pale and flat, the city as grey-tan blocks with the Big I's cross by day; the night map the city's grid lit, the Big I brightest, Santa Fe and Las Cruces as smaller clusters. Contrast: the valley against the mesa at least 0.18 in luminance.
- [ ] **Step 3: Look** at `scripts/preview/planets.html?id=breakingbad&dist=2.4&turn=<the city facing the key light>`: the river, the ranges and the city read at parking distance. Screenshot by day and with `?night=1` if the preview has it (else at `turn` on the night side).
- [ ] **Step 4: Commit.**

### Task 5: the Caribbean's map, the real Antilles

**Files:**
- Create: `scripts/planets/caribbean-geo.mjs` (hand-traced polygons: Cuba, Hispaniola, Jamaica, Puerto Rico, the Lesser Antilles as an arc of about 20 islands, Trinidad, Florida's tip, the Yucatán, the Bahamas' banks as shallow polygons; Tortuga, Port Royal and Isla de Muerta's marks)
- Modify: `scripts/planets/caribbean.mjs`, `public/textures/universe/caribbean*.webp`

- [ ] **Step 1: Author** the polygons on a 1000 × 700 sheet (the real map's proportions, 10°–30° N, 60°–90° W), each `{ name, pts, kind: 'island' | 'bank' | 'mainland' }`.
- [ ] **Step 2: Bake**: deep sea navy, the banks' shallows turquoise (`#3fc6c9`-ish) inside `bank` polygons and a 12-pixel rim round every island, reefs as light lines, islands green with a sand rim, the mainlands' coasts, the hurricane and the maelstrom kept from today's bake, Tortuga's lights in the night map. The roughness map: sea 0.22, land 0.9.
- [ ] **Step 3: Look** at `dist=2.4`: the arc reads as the Caribbean. Screenshot.
- [ ] **Step 4: Commit.**

### Task 6: the Office's letterhead, readable

**Files:**
- Modify: `scripts/planets/office.mjs`, `public/textures/universe/office*.webp`; the facet count in `src/components/universe/planets.js`'s `office` builder if the crumples are made there (keep the facets inside the sphere).

- [ ] **Step 1: Bake** the sheet with the title "Dunder Mifflin Paper Company, Inc." in the brand's serif at a sixth of the sphere's height, "1725 Slough Avenue, Scranton, PA" under it, 14 ruled lines, one coffee ring, a mug stain, and 6 to 10 large crumple folds (the normal map's creases long, not a crackle). The paper off-white `#f1ead8`, the ink navy `#1f2d5a`.
- [ ] **Step 2: Look** at `dist=2.4`: the title is legible. Screenshot.
- [ ] **Step 3: Commit.**

### Task 7: Middle-earth's ranges and forests

**Files:**
- Modify: `scripts/planets/middleearth-geo.mjs` (`RANGES`: Harad's as 2–3 offset strokes each; `LANDS.mordor` with 6 more points along Ephel Dúath), `scripts/planets/middleearth.mjs` (forests as a canopy: `cells` at 3 scales, dark green with a lighter edge; the `-hq` normal strength ×2), `public/textures/universe/middleearth*.webp`

- [ ] **Step 1: Edit the data and the bake.** **Look** at `dist=2.4&turn=-2.07`: Harad's ranges are broken ridges, Mordor's wall bends, Mirkwood and Fangorn have texture. Screenshot.
- [ ] **Step 2: Commit.**

### Task 8: evidence and the handoff

**Files:**
- Modify: `src/components/universe/poses.js` (poses `middleearth`, `breakingbad`, `office` at `dist: 2.4, off: 0`), `docs/superpowers/HANDOFF-fandom-planets.md` (what landed, what's left), `docs/architecture.md` (the `planets.js` line: maps by distance, `-xl` on ultra).

- [ ] **Step 1: Run** `node scripts/universe-check.mjs --quality all --poses middleearth,breakingbad,office,caribbean,rickmorty,middleearth-limb` against `lab/universe/baseline/`. Budget: `high` at a planet pose at most +40 calls and +0.35 M triangles; `low` +0.
- [ ] **Step 2: Write** the handoff and the architecture line. **Commit, PR, merge.** (Tasks 1–3 can be one PR and Tasks 4–7 one each: merge often.)

---

## Lane 2: the galaxy's worlds from orbit, and the universe alive

### Task 1: finish `claude/universe-ship-pace`

**Files:** the branch's 26 files (`git diff --stat origin/main...claude/universe-ship-pace`), mostly `universe/ship.js`, `hunterRules.js`, `npcs/brains/*`, `traffic.js`, `wingRules.js`, `galaxy/hunted.js`.

- [ ] **Step 1:** `git checkout -b claude/universe-ship-pace-2 origin/main && git merge claude/universe-ship-pace` (the local branch exists in the main checkout; fetch it with `git fetch . claude/universe-ship-pace` from the main worktree if the new worktree can't see it, or `git push origin claude/universe-ship-pace` first). Resolve against PR #474's `ship.js` (the `settle` and `driveOpen` changes stay).
- [ ] **Step 2:** `npx vitest run src/components/universe src/components/galaxy` green; read `ship.test.js` and `hunterRules.test.js` to see what the WIP intended (the pace of hunters, NPCs and traffic following `SHIP`'s new numbers) and finish what's half done.
- [ ] **Step 3: Look:** a hunt in a browser (`/#/universe`, fly till the director sends a pack): hunters keep up and overshoot less; traffic doesn't crawl. **Commit, PR, merge.**

### Task 2: the galaxy's planets, sharp from orbit

**Files:**
- Modify: `src/components/galaxy/bodyShaders.js` (`octs`: `uMaxOct` raised by `uNearOct` when `gFoot` is under the near band; a `grad` from two more fbm taps in that band), `src/components/galaxy/bodies.js` (the `uNearOct` uniform: `2.0` on `high` and `ultra`, `0.0` on `mid` and `low`; the near band: the body over 300 pixels tall on screen, from the camera's distance and the viewport height, set per frame), `bodies.test.js`.

**Interfaces:**
- Produces: `nearOctaves({ tier, pxTall }) -> number` pure in `bodies.js`: `2` when `tier` is `high` or `ultra` and `pxTall > 300`, else `0`. A test with the four tiers and two heights.

- [ ] **Step 1: Test** `nearOctaves`; **implement**; the shader reads `uNearOct` into `octs`'s cap; the extra gradient taps only inside `#ifdef DETAIL` and only where `uNearOct > 0.5`.
- [ ] **Step 2: Look** at Tatooine, Hoth and Endor parked (`/#/galaxy/tatooine`, E lands; stay in orbit): dunes, ice ridges and forest carry grain and catch the light. `OUT=lab/check JSON=1 node scripts/galaxy-check.mjs <ids>`: frame time within 1 ms of `origin/main` on `high`.
- [ ] **Step 3: Commit, PR, merge.**

### Task 3: a minefield and an escort

**Files:**
- Create: `src/components/universe/minefield.js` (+ test): `layMines({ lane, n = 14, seed }) -> { at: [x,y,z], r }[]` across a lane's width; `mineHit(ship, mines, dt)`; pure. `src/components/universe/escort.js` (+ test): `escortPlan({ from, to, speed }) -> { path, pirates: { at: t }[] }`.
- Modify: `src/components/universe/director.js` (`EVENTS.minefield: { needs: null, weight: 1.0, heat: 0.3 }`, `EVENTS.escort: { needs: 'pirates', weight: 1.1, heat: 0.4 }`), `src/components/universe/scene.js` (`happen('minefield')`, `happen('escort')`: the mines drawn with `belt.js`'s rock material at `r = 0.35`, shot like a hunter with one hit, a blast on the ship if it flies through one; the freighter from `traffic.js`'s models, its line in `Comms.jsx` through the crew's existing `say`).

- [ ] **Step 1: Tests** for the rules (mines across the lane within its width and never inside a planet; an escort's pirates arrive at two points of the path). Run, fail, **implement**.
- [ ] **Step 2: Wire** both into `director.js` and `scene.js`'s `happen`. `director.test.js`: both can happen for a side with pirates; the minefield for any side.
- [ ] **Step 3: Look:** `window.__universe().happen('minefield')` and `('escort')` in DEV. Screenshot each. **Commit, PR, merge.**

### Task 4: an eclipse, and the rift's exit

**Files:**
- Create: `src/components/universe/eclipse.js` (+ test): `eclipseAt({ ship, sun, planets }) -> { planet, k } | null`: the planet that would cross the sun from the ship's place within 20 s at its orbit's speed, and `k` the cover 0..1 at a time.
- Modify: `director.js` (`EVENTS.eclipse: { needs: null, weight: 0.8, heat: 0 }`, `canHave` false when the ship is in the galaxy's gate or parked at a station: add `where` to the side's `has`), `scene.js` (the key light's intensity and the flare's weight scaled by `1 - 0.85 k`; the crew's line), `nav.js` (`riftExit(fromId, saw)` prefers ids not in `saw`), `nav.test.js`, `scene.js`'s leviathan `busy` dropped once the pod's lead is past the ship (`director.js`'s `busy` takes `until: () => boolean`).

- [ ] **Step 1: Tests** for `eclipseAt`, `riftExit`'s preference, `canHave('eclipse')` false at a station. Run, fail, **implement**.
- [ ] **Step 2: Look:** `happen('eclipse')` in DEV: the light dims and comes back over a planet's crossing. **Commit, PR, merge.** Update `HANDOFF-universe-expansion.md`'s "Steps left".

---

## Lane 3: the landings match the maps

### Task 1: `biomeAt`, the rules

**Files:**
- Create: `src/components/universe/landings/biomes.js`, `biomes.test.js`
- Modify: `src/components/universe/landings/landings.js` (each planet gains `biomes: [{ id, match, ground, sky, scatter }]`; `ground`, `sky` and `scatter` optional, falling back to the planet's own)

**Interfaces:**
- Produces: `classify(rgb: [r,g,b] 0..1) -> { h, s, l }`; `biomeAt(landing, rgb) -> biome` (the first biome whose `match(hsl)` holds; `landing.biomes` empty or missing gives a `{ id: 'default', ground: landing.ground, sky: landing.sky, scatter: landing.scatter }`); `uvOf(n: [x,y,z]) -> [u, v]` (the same as `scripts/planets/sphere.mjs`'s `toUv`, copied with a comment saying so); `sampleMap(image: ImageBitmap | HTMLImageElement, uv) -> rgb` through a 256 × 128 canvas made once per planet.
- Consumes: `entrySpot`'s `n` (the unit vector where the ship comes down, in the planet's frame) from `entry.js`.

- [ ] **Step 1: Tests**: Middle-earth's biomes pick `shire` for `#5a8a3a`, `mordor` for `#3a3030`, `harad` for `#c8a86a`, `mountains` for `#9a9a9a`, `sea` for `#2a4a8a`; a landing with no `biomes` gives `default` with its own ground; `uvOf([0, 1, 0])[1]` is `0`. Run, fail.
- [ ] **Step 2: Implement** `biomes.js` and write the biomes for middleearth, breakingbad, caribbean, invincible, rickmorty, travel in `landings.js` (the grounds from `ground.js`'s `STYLES`: `grass`, `sand`, `tiles`, `plating`, `pixel`, `asphalt`; Mordor ash is `sand` in `['#3a3330', '#4a403a', '#241e1c']` with the sky `{ zenith: '#3a2420', horizon: '#8a3a20', sun: '#ff6a30' }`). Tests pass. **Commit.**

### Task 2: the spot moves toward land

**Files:**
- Modify: `src/components/universe/landings/biomes.js` (`towardLand(n, sample, isSea, { steps = 24, stride = 0.02 }) -> n'`: walks the great circle away from the sea along the entry's track until `isSea(sample(uvOf(n)))` is false, else returns `n`), `biomes.test.js`.
- Consumes: `entrySpot` stays pure and untouched (Lane 2 may touch `entry.js`'s neighbours); `footScene.js` calls `towardLand` on the spot before `furnish`.

- [ ] **Step 1: Test**: a stub sampler that is sea for `u < 0.5` and land after; `towardLand` from `u = 0.45` lands at `u >= 0.5`; from land returns the same `n`; from a world that is all sea returns `n` after `steps`.
- [ ] **Step 2: Implement; commit.**

### Task 3: the landing takes the biome

**Files:**
- Modify: `src/components/universe/footScene.js` (around line 1787: before `furnish`, sample the planet's `-sm` colour map at the spot (`loadTexture`'s cached image, or fetch `BASE + mapFile(id, 'mid')` as an `ImageBitmap`), `biomeAt`, `towardLand`, then `furnish({ ..., landing: { ...landing, ground: biome.ground, sky: biome.sky, scatter: biome.scatter } })`; the name card's `sub` gets the biome's name if it has one), `src/components/universe/landings/furnish.js` only if it reads `landing.ground` somewhere other than through its argument.

- [ ] **Step 1: A DEV query** `?spot=lat,lon` on `/#/universe/<id>` that forces the entry spot (read in `footScene.js` where `entrySpot` is called; DEV only).
- [ ] **Step 2: Look:** `node scripts/landing-check.mjs middleearth` with `?spot=` at the Shire (`52,-3` on the sheet's projection; find the numbers by `window.__universe().spot()` after landing by hand), Mordor and Harad. Three screenshots: green, ash under red, sand.
- [ ] **Step 3: Commit, PR, merge.** Update `HANDOFF-fandom-planets.md` item 4 and `docs/architecture.md`'s `landings/` line.

---

## Self-review notes

- Spec coverage: 1a–1e are Lane 1 Tasks 1–8; 2a–2c Lane 2 Tasks 1–4; 3a–3c Lane 3 Tasks 1–3. "Not in this round" has no tasks, on purpose.
- Shared files: `scene.js` is touched by Lane 1 (one line, Task 1 Step 5) and Lane 2 (events). Lane 1 merges that line first and small; Lane 2 merges main before its `happen` work. `footScene.js` is Lane 3's alone. `entry.js` is nobody's.
- Names: `createNearMaps`, `wanted`, `evict`, `swapMaps`, `mapsOf`, `nearGeometry`, `NEAR_SEG`, `nearOctaves`, `biomeAt`, `uvOf`, `towardLand`, `sampleMap` are used with the same spelling throughout.
