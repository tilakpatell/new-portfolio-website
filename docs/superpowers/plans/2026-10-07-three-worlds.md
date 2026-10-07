# Coruscant, Yavin 4 and Bespin made whole: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is executed inline (executing-plans): the user asked for no subagents, and for each PR section to be merged to main once CI is green before the next starts (merge commits, never rebase, never red).

**Goal:** The galaxy's surfaces draw through the house look, the ground map, Bruno's grass and the core kit; Coruscant, Yavin 4 and Bespin each get their look, their interiors, their models, their people with brains and dialogue, and their place in the three-era war, as the spec says.

**Architecture:** The surface engine (`src/components/galaxy/surface/`) adopts `src/lib/three/{house,groundmap,grass,wind,core}.js` the way the Shire did (`middleearth/shire/scene.js`), with two new pure modules (`look.js`, `groundPaint.js`) and a `tune.js` for `?debug`. Each of the three worlds moves into a site file of its own with its zones in a `props/inside*.js`. The people go onto `src/lib/ai/` through `hostiles.js`/`activity.js`/`actors.js` and a pure `talk.js`. The war's pure modules are the allegiance plan's; this plan adds the surface's side of it (`warEffects.js`'s `troopKind`/`garrisonAt`, three assault maps).

**Tech Stack:** JavaScript ES modules, React 19, three r186 (WebGL, `'glsl'`), vitest, Node 22, Playwright on SwiftShader for shots, Meshy and Sketchfab through the existing scripts.

**Spec:** `docs/superpowers/specs/2026-10-07-three-worlds-design.md` (with `2026-10-07-house-look-design.md`, `2026-10-07-npc-intelligence-design.md` §3, `2026-10-07-gcw-allegiance-design.md` rev 3a).

## Global Constraints

- No sequel-trilogy content anywhere (`HANDOFF-galaxy-surfaces.md`'s rule).
- Every new rules module is pure (no three.js, no DOM), seeded through a `rand` argument, tested in Node.
- `surface/module.js` stays `shading: 'glsl'`; nothing here adds a node material.
- Every texture goes through `lib/three/textures.js`'s `sharpen`; every model through `lib/three/gltf.js`.
- Meshy spend this session: at most about 400 credits; `MESHY_API_KEY` and `SKETCHFAB_API_TOKEN` are never printed or committed.
- Every Sketchfab model credited in `src/data/modelCredits.json` as `surface-<kind>`; every Meshy model listed in `public/cc0/README.md`'s `models/galaxy/surface/{…}.glb` line (`catalog.test.js` enforces both).
- Before every push: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`. Surface PRs also run `scripts/galaxy-check.mjs surface` on the worlds touched, against a baseline taken on main first (`OUT=lab/check JSON=1 node scripts/galaxy-check.mjs surface <ids>` → copy `lab/check/*.json` to `lab/baseline/surface-high.json`, git-ignored), never over 600 draw calls or 2.5M triangles, no page error.
- Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and the `Claude-Session:` line; no model names in code, comments or docs.
- Don't edit `shipModels.js, hulls.js, livery.js, modules.js, outfit.js, paint.js, Hangar.jsx`.

## Review Focus

1. A site with `noGround` (Bespin, Coruscant, Kamino) must draw with the look and no map, grass, or bounce; nothing may read `grid` there. Test in Task 3: `groundPieces(site)` (pure, in `look.js`) says `{ map: false, grass: false, bounce: false }` for a `noGround` site and the scene reads it.
2. A thing placed after `house.adopt(scene)` (a quest spawn, a zone's build, a late model) must be in the look, or it reads grey beside everything else. Test in Task 3: `adoptLater` counts materials patched for an object added after `ready`.
3. A world whose `site.grass` is missing must have no grass mesh and no wind error; one whose ground map paints only zero grass must still draw the floor. Test in Task 4: `groundPieces` gives `grass: false` without `site.grass`; `groundPainter` on a grassless site paints colour and 0 alpha.
4. The look's exposure change (ACES → Neutral ×1.4) must not blow out Mustafar's lava or Hoth's snow: `site.exposure` defaults keep each world's brightness. Checked by the sweep's sheet in Task 6; a per-world `exposure` goes in the site where it does.
5. `troopKind` must leave a site's own named figures (Greedo, Jabba, Lando) and non-trooper kinds untouched, map only the trooper family, and give back the same kind when `effects` is null (unsworn or offline). Test in Task 20.

---

## PR 1 — the look engine, every world

### Task 1: `surface/look.js`

**Files:**
- Create: `src/components/galaxy/surface/look.js`, `src/components/galaxy/surface/look.test.js`

**Interfaces:**
- Produces: `lookOf(site) → { shadow: number (hex int), edge: [a, b], mix, fogLow (hex int), fogHigh, fogBelow, halo, fogMix, exposure }` (the house's `LOOK` shape) and `exposureOf(site) → number`.

- [ ] **Step 1:** Write `look.test.js`: "defaults from the sky: no `look` gives `fogLow` = the sky's horizon, `fogHigh` = its zenith, and a shadow a third from zenith toward horizon darkened by 0.55"; "a site's `look` wins over the defaults, key by key" (`{ shadow: '#5a4a7a', fogBelow: 0.7 }` → those two, the rest defaulted); "nonsense is dropped" (`edge: 'x'`, `shadow: 12` → defaults); "`exposureOf` is `site.exposure ?? 1` times `LOOK.exposure`".
- [ ] **Step 2:** `npx vitest run src/components/galaxy/surface/look.test.js` — fails: module not found.
- [ ] **Step 3:** Implement. Colours in as `'#rrggbb'` strings or ints, out as ints (what `createHouse` takes); use `THREE.Color` for the mix (three is fine to import in a pure-ish module here; the Shire's `sky.js` does).
- [ ] **Step 4:** Run — pass. Commit: "look.js: a site's look for the house, defaulted from its sky".

### Task 2: `surface/groundPaint.js`

**Files:**
- Create: `src/components/galaxy/surface/groundPaint.js`, `groundPaint.test.js`
- Modify: `src/components/galaxy/surface/grass.js` (export `coverAt(grid, site, x, z, opts) → 0..1`, the one-point form of `coverMap`'s rule; `coverMap` calls it)

**Interfaces:**
- Produces: `groundPainter(site, grid, { shade = [] }) → { paint(x, z, out) → grass, height(x, z) }`, where `out` is `[r, g, b]` linear, `shade` is `[{ at: [x, z], r }]` (tree crowns: the colour darkened by 0.75 and the grass by 0.4 under one).
- Consumes: `grid.heightAt(x, z)`, `grid.normalAt(x, z)` (terrain.js), `site.ground.palette` (ground.js's fields), `site.water`, `site.grass`.

- [ ] **Step 1:** Write `groundPaint.test.js`: "height below hLow is `low`, above hHigh is `high`, between is a mix" (a flat grid at three heights); "a slope past rockAt is `rock`"; "under the water level the colour is `deep` and the grass 0"; "the landing flat and a place's flat have grass 0"; "a shade circle darkens the colour and thins the grass"; "a site without `grass` paints grass 0 everywhere".
- [ ] **Step 2:** Run — fail.
- [ ] **Step 3:** Implement the rule from `ground.js`'s `color_fragment` block in JS (height mix, slope rock, accent by `noise.js`'s `fbm` at the shader's `xz/70` scale with `accentCover`, `deep` below water, the `wet` band), and the grass from `grass.js`'s `coverAt`.
- [ ] **Step 4:** Run — pass; `npx vitest run src/components/galaxy/surface/grass.test.js` still passes. Commit: "groundPaint.js: the ground's colour and grass as one function, for the ground map".

### Task 3: the scene onto the house

**Files:**
- Modify: `src/components/galaxy/surface/scene.js:126-180` (lights, fog, exposure), `:2338-2390` (ready), `src/components/galaxy/surface/sky.js` (export `lightOf(sky, t) → { sunDir, horizon, zenith, below }` the dome's colours at `t`), `placer.js`, `actors.js`, `activity.js` (an `adopt` option called on every object they add), `src/components/galaxy/surface/scene.test.js` (new: the pure helpers)

**Interfaces:**
- Consumes: `createHouse(look)` → `{ uniforms, toneMapping, exposure, adopt(root), set, light({ sun, hemi }), sky({ low, high, below, sunDir, halo }), ground(map) }` (`lib/three/house.js`); Task 1's `lookOf`, `exposureOf`.
- Produces: `createPlacer({ …, adopt })`, `createActors({ …, adopt })`, `createActivity({ …, adopt })`: each calls `adopt(object)` after adding an object to the scene; `scene.js` passes `house.adopt`.

- [ ] **Step 1:** Write `scene.test.js` for two pure helpers in `look.js`: `adoptLater(house, object)` — "materials of an object adopted after the scene count as patched" (a stub house whose `adopt` records roots; the helper returns the count of lit materials under the root); `groundPieces(site) → { map, grass, bounce }` — "a `noGround` site gets none; a site without `grass` gets the map and the bounce but no grass". And in `sky.test.js`: "`lightOf` gives the sun's direction and the dome's horizon and zenith as the site's".
- [ ] **Step 2:** Run — fail.
- [ ] **Step 3:** Implement: `const house = createHouse(lookOf(site))`; `renderer.toneMapping = house.toneMapping`; `renderer.toneMappingExposure = exposureOf(site)` (where the post pass sets exposure, set it there instead); keep `scene.fog` (the house swaps its colour for the sky's). Each frame after `sky.update`: `house.light({ sun, hemi })`, `house.sky({ low: horizon, high: zenith, below: look.fogBelow, sunDir, halo })`. In `ready`, after `groundWorld` (or at once on `noGround`): `house.adopt(scene)`. Pass `adopt: house.adopt` into the placer, the actors and the activity; they call it on each added object (zones' builds included).
- [ ] **Step 4:** `npx vitest run src/components/galaxy` — pass. `npx vite --port 5188 --strictPort --host 127.0.0.1 &` then `OUT=lab/shots node scripts/surface-shot.mjs tatooine "0,0,30,200,land"` and the same for `bespin` and `yavin`: a shot each, no page error, shade visibly tinted.
- [ ] **Step 5:** Commit: "The galaxy's surfaces draw through the house look".

### Task 4: the ground map, Bruno's grass and one wind

**Files:**
- Modify: `scene.js:208-246` (ground, grass), `ground.js` (accept a `map`: `groundMaterial(site, { small, map })` applies `map.paint(material)` and mixes the map's colour in under the grain within the map's area), `kit.js` (`sway` on parts: `wind.sway(material, { strength, height })` for `fronds`, `leaves`, `broad`, `cloth`, `strands`, `blades`; `createKit({ …, wind })`), `props/*.js` (nothing: they use the kit's materials)
- Delete: `src/components/galaxy/surface/grass.js`'s `createGrass` and its shader (keep `coverAt`/`coverMap` + tests); `grass.test.js` keeps the cover tests only

**Interfaces:**
- Consumes: `createGroundMap({ area, size, heightSize, paint, height })` (`lib/three/groundmap.js`), `createGrass({ ground, wind, side, size, height, width, root })` → `{ mesh, material, uniforms, update(centre), set, dispose }` (`lib/three/grass.js`), `createWind({ strength, angle })` (`lib/three/wind.js`), Task 2's `groundPainter`.

- [ ] **Step 1:** Tests in `groundPaint.test.js`: "`mapAreaOf(site)` is the walkable square `±HALF` round the landing"; "a site without `grass` paints colour and alpha 0"; in `kit.test.js` (new): "a kit made with a wind sways its fronds (the material's `onBeforeCompile` is set) and not its stone".
- [ ] **Step 2:** Run — fail.
- [ ] **Step 3:** Implement: when `!site.noGround`: `const painter = groundPainter(site, grid, { shade: treeCrowns })` where `treeCrowns` are the scatter items of kinds whose `SCATTER` entry has `canopy: true` (`jungletree`, `redwood`, `wroshyr`, `gnarl`: set the flag in `props/forest.js`); `const map = createGroundMap({ area, size: small ? 256 : 512, heightSize: 128, paint: painter.paint, height: grid.heightAt })`; `house.ground(map)`; `groundMaterial(site, { small, map })`. `const wind = createWind({ strength: site.grass?.wind ?? 0.4, angle: site.ground.wind ?? 0 })`; `createKit({ seed: 31, wind })`. Grass: `site.grass && !site.noGround ? createGrass({ ground: map, wind, side: tier side, size: 44, height: site.grass.h[1], width: site.grass.w ?? 0.05, root: 0.35 })`; `grass.update(me)` each frame; `floorShadow(grass.material, lit.mask)` as before; `house.adopt` covers it. `wind.update(dt)` each frame.
- [ ] **Step 4:** Tests pass; shots of `yavin`, `naboo`, `endor`, `sorgan` (grass worlds) and `hoth` (none): grass on the first four, blades the ground's colour, moving; none on Hoth; no page error.
- [ ] **Step 5:** Commit: "The ground map, Bruno's grass and one wind on every world".

### Task 5: the core kit on every built surface

**Files:**
- Modify: `kit.js:317-336, 408-432` (`LOOKS` → core roles; `dress` → `wear`), `placer.js` (`spec.wear`: a role laid over a loaded model with `wear` on each lit material), `detail.js` (keep for `catalog` `detail` on models; it already re-exports)

**Interfaces:**
- Consumes: `wear(material, scan, { metres, strength, normal, mean })`, `loadCore(role)` (`lib/three/core.js`).
- Produces: `KIT_ROLES = { paint: 'paint', metal: 'metal', stone: 'stone', rock: 'rock', adobe: 'adobe', bark: 'bark', wood: 'wood', concrete: 'concrete', tiles: 'tiles', deck: 'deck', sand: 'sand', snow: 'snow', mud: 'mud' }` exported from `kit.js`; a thing spec's `wear: role`.

- [ ] **Step 1:** `kit.test.js`: "every LOOKS role is a core role with a scan in `public/cc0/galaxy/index.json`"; `placer.test.js`: "a spec with `wear` is laid over (a stub `wear` is called once per lit material of a stub model)".
- [ ] **Step 2:** Run — fail.
- [ ] **Step 3:** Implement: in `createKit.ready`, for each owned material with a role, `wear(m, scan, { metres: scanOf(role).metres, strength: LOOKS[role].strength ?? 0.55, normal: LOOKS[role].normal, mean: scanOf(role).mean })` and keep the roughness/metalness from `LOOKS` (set before `wear`). Drop `m.map = scan.map` (the triplanar path replaces the UV one). `placer.put` with `spec.wear`: after the model loads, `loadCore(role).then((scan) => traverse lit materials → wear)`.
- [ ] **Step 4:** Tests pass; shots: `tatooine` (adobe), `scarif` (concrete/metal), `naboo` (stone/tiles): grain at the same density on walls of different sizes.
- [ ] **Step 5:** Commit: "Every built surface wears the core kit's scans at real scale".

### Task 6: `?debug` tuning, the sweep, the PR

**Files:**
- Create: `src/components/galaxy/surface/tune.js` (`surfaceTuning({ house, grass, wind, look }) → panel groups`, the Shire's `tune.js` shape; the copy button prints `look: { … }` as a site block)
- Modify: `scene.js` (mount the panel when `lib/debugPanel`'s `debugOn()`), `docs/superpowers/HANDOFF-galaxy-surfaces.md` (a "The house look" section), `docs/architecture.md` (the galaxy's surfaces on the house pieces, one sentence)

- [ ] **Step 1:** `tune.test.js`: "the copy text is a valid site `look` block" (`toCode(values)` parses as an object with `shadow`, `edge`, `fogBelow`, `halo`, `exposure`).
- [ ] **Step 2:** Run — fail; implement; pass.
- [ ] **Step 3:** Baseline on main (`git stash` not needed: use a worktree of `origin/main` at `/tmp/main` with `npm ci`, dev server on 5189, `BASE=http://127.0.0.1:5189 OUT=lab/baseline JSON=1 node scripts/galaxy-check.mjs surface <all 17 ids>`), then on the branch `OUT=lab/check JSON=1 BUDGET=lab/baseline/surface-high.json node scripts/galaxy-check.mjs surface <all 17>`: no breach, no page error. Before/after sheet: `scripts/surface-shot.mjs` per world at its landing into `lab/shots/{before,after}`; a montage with `sharp` (a scratch script in `lab/`) attached to the PR.
- [ ] **Step 4:** lint, test, build, health. Commit: "A ?debug panel for a world's look; the handoff and the architecture note". Push, open the PR ("The galaxy's worlds, through the house look"), wait for CI, merge.

---

## PR 2 — Coruscant

### Task 7: `sites/coruscant.js` and the look

**Files:**
- Create: `src/components/galaxy/surface/sites/coruscant.js` (the `coruscant` entry moved out of `core.js:341-583`, with `look`, `exposure`)
- Modify: `sites/core.js` (entry removed; the `span`/`tower` helpers exported or copied), `sites/index.js` (`import { SITE as coruscant } from './coruscant'`, spread in)

- [ ] **Step 1:** `sites.test.js` already covers every site; add in `look.test.js`: "Coruscant's look is `{ shadow: '#5a4a7a', edge: [0.12, 0.8], fogBelow: 0.7, halo: '#ff9a50' }`".
- [ ] **Step 2:** Run — fail. Move the entry; add the look. Run — pass (every site test, `LANDABLE` unchanged).
- [ ] **Step 3:** Commit: "Coruscant in a site file of its own, with its look".

### Task 8: lit windows, lane ribbons, warning lights

**Files:**
- Create: `src/components/galaxy/surface/props/windows.js` (`windowShader(shader, { seed }) → { vertexShader, fragmentShader, swapped }`, pure; `litWindows(material, { seed, density, warm })` applies it), `windows.test.js`
- Modify: `props/core.js:728-806, 1048` (`skyscraper`, `corutower` materials get `litWindows`; `airlane` adds a ribbon mesh: two additive strips 0.6 m wide along the lane at ±1.5 m, colours `#ffd9a0` and `#8fd0ff`, opacity 0.35; `tower()` adds a blinking red point sprite at the top, `update(t)` toggling at 1.2 s)

- [ ] **Step 1:** `windows.test.js`: "the rewrite inserts the window grid before `#include <emissivemap_fragment>` and leaves a shader without it untouched"; "the grid's cell count comes from the material's `uWindowGrid`" (the GLSL string contains `uWindowGrid`).
- [ ] **Step 2:** Run — fail; implement (world-space grid on the tower's own xz-yaw frame: cells 3 m × 4 m, a hash per cell against `density` lit, two tints by a second hash, emissive added `× (1 − daylight)` where daylight is the house's `uLookRef` luma); pass.
- [ ] **Step 3:** Shot: `OUT=lab/shots node scripts/surface-shot.mjs coruscant "0,0,60,160,platform" "0,150,80,20,processional"`: windows lit on the far towers, ribbons glowing in the lanes.
- [ ] **Step 4:** Commit: "Coruscant's towers light their windows; the skylanes glow".

### Task 9: Dex's, the Outlander Club and the Jedi Temple as zones

**Files:**
- Create: `src/components/galaxy/surface/props/insideCore.js` (`dexinside`, `clubinside`, `templeinside` builders; each `{ object, solids, floors, signal? }`), `insideCore.test.js`
- Modify: `props/index.js` (spread `insideCore`), `sites/coruscant.js` (three `zones`, the `training` and `dart` quests' steps given `zone`, Dex and Elan and Jocasta moved into the zones' `life`), `sites/quests.js` (Coruscant's entry removed: its quests live in the site now)

**Interfaces:**
- Produces: zone ids `dex`, `club`, `temple`; signals: `templeinside` answers `'remotes'` (the training room's door opens).

- [ ] **Step 1:** `insideCore.test.js`: each builder "returns an object with inward-facing walls (every solid is inside `bounds`), at least one floor, and no NaN in its positions"; `sites.test.js` passes with the quests moved (giver inside a zone offers them).
- [ ] **Step 2:** Run — fail; build them (the `cantinainside` pattern: `inward` walls, `rooms` for the camera, `lamps` per zone: Dex's warm `#ffb070`, the club magenta `#ff6ad0` and cyan `#6ad0ff`, the Temple cool `#cfd8ff`); the dejarik table is the `dejarik` kind placed in the club; WA-7 is a built figure kind `wa7` in `figures.js` (a wheel, a torso, a head) until a Sketchfab one passes.
- [ ] **Step 3:** Dev hook check: `window.__surfaceDo('zone', 'dex')` etc. in a headless run (`scripts/surface-shot.mjs` with a `ZONE=` env that calls the hook before the shot): three shots, lamps lit, nothing of the outdoors seen.
- [ ] **Step 4:** Commit: "Dex's Diner, the Outlander Club and the Jedi Temple, inside".

### Task 10: the airspeeder race and Order 66

**Files:**
- Modify: `rides.js` (`airspeeder: { name, top: 40, boost: 58, accel: 14, brake: 22, turn: 1.4, hover: 0, fly: { alt: 6, climb: 8 }, bank: 0.5, radius: 2, grip: 0.8, seat: [-0.5, 0.5, 0.2], cam: [10, 3.6], hum: 'speeder' }`), `walker.js:298-360` (`ride`: with `spec.fly`, `input.jump` climbs at `fly.climb` m/s up to `fly.alt` over the ground or floor, and it sinks at half that otherwise; never below the floor), `walker.test.js`, `sites/coruscant.js` (rides: an airspeeder on the platform; quests `speederchase` (giver: Obi-Wan `kenobi` at the platform, `ride: 'airspeeder'`, `race` through eight gates laid along the `airlane` paths at their `y`, `time: 60`) and `order66` (giver: Jocasta in the Temple; `shoot` tag `clones66`, `n: 8`, spawn eight `clone` with `hostile: { range: 40, every: 2, damage: 8, burst: { n: 3, gap: 0.1 } }` at the Processional's foot and one `clone` with `hostile.guard: 3, blade: { color: '#4aa8ff' }` as the commander))
- Modify: `src/components/Achievements.jsx` (`coruscantrace`, `order66`)

- [ ] **Step 1:** `walker.test.js`: "a flying ride climbs while jump is held and holds `fly.alt`"; "it never goes below the floor under it". `sites.test.js` passes (the ride kind exists; `airspeeder` is a model kind).
- [ ] **Step 2:** Run — fail; implement; pass. Browser: `window.__surfaceDo('advance')` through the race in a headless run; the clones spawn at Order 66 and fire bursts.
- [ ] **Step 3:** lint, test, build, health; `galaxy-check.mjs surface coruscant` within budget. Commit: "The assassin's airspeeder, and Order 66 on the Temple steps". Push, PR ("Coruscant, made whole"), CI, merge.

---

## PR 3 — Yavin 4

### Task 11: `sites/yavin.js`, the look, the canopy on the map

**Files:**
- Create: `sites/yavin.js` (moved from `forest.js:706-935`, with `look: { shadow: '#3a4a3a', edge: [0.18, 0.85], halo: '#fff0c0' }`, `grass: { h: [0.18, 0.5], w: 0.05, cover: 0.55, wind: 0.5, root: '#2e3a22', mid: '#4a5a30', tip: '#7a8a46', dry: '#8a8450' }`)
- Modify: `sites/forest.js`, `sites/index.js`, `props/forest.js` (`canopy: true` on `jungletree`'s SCATTER entry if Task 4 didn't), `sites/quests.js` (Yavin's entry moved into the site)

- [ ] **Step 1:** `look.test.js`: Yavin's look; `groundPaint.test.js`: "with Yavin's scatter as shade, the grass under a jungle tree is under half the clearing's".
- [ ] **Step 2:** Move; run — pass. Shot at the landing and at the river: grass in the clearings, litter under the canopy, fronds swaying. Commit: "Yavin 4 in its own file: its look, its grass under the canopy".

### Task 12: the war room, the ceremony hall and the inner stair

**Files:**
- Create: `props/insideForest.js` (`warroom` (the briefing hall: rows of benches, a lectern, a hologram of the Death Star and its trench as an additive wireframe, `signal('brief', on)` plays it: a `update(t)` that scrolls the trench), `ceremonyhall` (the dais, banners, instanced rows of `rebel` figures as a scatter of still figures), `templestair` (three rooms joined by flights, `floors` tagged per landing)), `insideForest.test.js`
- Modify: `props/index.js`, `sites/yavin.js` (zones `warroom` (door in the hangar's back wall), `stair` (door beside it; its exits at the war room's and the summit's), `ceremony` (door at the summit); quests `briefing` (giver Dodonna, moved into the war room: `reach` the lectern, `talk dodonna`, `use` id `brief` → `end: [{ signal: 'brief' }]`, lines Gold Leader's question), `scramble` (giver Red Leader in the war room: `race` on foot, gates from the war room door through the hangar's taxi line to the X-wing bay, `time: 40`, then `end: [{ leave: true }, { to: '/deathstar' }]`), `ceremony` (giver: Leia in the ceremony hall, `after: ['briefing', 'scramble']`; `reach` the dais; done: the cheer)), `quests.js` (`after: [quest ids]`: a quest offered only once those are done; `questsOf(site, done)` filters), `quests.test.js`, `scene.js:862` (an `end` effect `to: '/path'` navigates: `emit({ type: 'leave', to })`; `GalaxySurface.jsx` follows it), `Achievements.jsx` (`yavinbriefing`, `yavinscramble`, `yavinceremony`)

- [ ] **Step 1:** `quests.test.js`: "a quest with `after` is not offered until its quests are done"; `insideForest.test.js` as Task 9's shape; `sites.test.js` passes.
- [ ] **Step 2:** Run — fail; build; pass. Headless: the three zones' shots; `advance` through `scramble` lands on `/deathstar`.
- [ ] **Step 3:** lint, test, build, health; `galaxy-check.mjs surface yavin` within budget (the ceremony's rows instanced). Commit: "Yavin's war room, its ceremony hall and the stair between". Push, PR ("Yavin 4, made whole"), CI, merge.

---

## PR 4 — Bespin

### Task 13: `sites/bespin.js`, the look, the cloud sea, the deck

**Files:**
- Create: `sites/bespin.js` (moved from `edge.js:571-793`, `look: { shadow: '#c07a8a', edge: [0.1, 0.78], halo: '#ffb070', fogBelow: 0.95 }`), `props/bespin.js` (the Bespin builders moved out of `edge.js:1104-1355, 1495-1560`; `bespindeck`, `bespinplatform`, `bespinbridge` parts `to: 'deck'`/`'tiles'`, a rail (`rod`s at 1.1 m) along every bridge edge and platform rim gap)
- Modify: `water.js:80-100` (`clouds`: a second layer `uWaves2` scrolling at −0.6 of the first's speed at 2.3× its scale, and a glint term along `sunDir`'s azimuth: `pow(max(dot(reflect(view, n), sunDir), 0), 48) × 0.8`), `water.test.js` (the clouds kind's uniforms), `props/edge.js`, `props/index.js`, `sites/edge.js`, `sites/index.js`

- [ ] **Step 1:** `look.test.js`: Bespin's look; `water.test.js`: "the clouds kind has two layers and a glint". `sites.test.js` passes.
- [ ] **Step 2:** Run — fail; implement; pass. Shots at Platform 327 and the plaza: cream deck with grain, rails, the sea with depth. Commit: "Bespin in its own file: its look, its rails, a cloud sea with depth".

### Task 14: the dining room, the chamber, the gantry and the way out, as zones

**Files:**
- Create: `props/insideBespin.js` (`dininginside` (the curved white corridor, the long table, Vader at the head and Fett beside him as the zone's `life`, still), `carboninside` (red lamps, steam vents as `weather` sprites, the platform floor tagged `freezeplatform` that lowers 2.4 m over 3 s on `signal('freeze')`, the carbonite slab), `reactorinside` (the shaft: a ring gantry, the control room, the window; a `fall: -30` zone level; its exit at the vane's platform via `back`), `corridorinside` (Lando's corridor to the platform: two doors tagged `door1`, `door2` opened by signals `lobot1`, `lobot2`)), `insideBespin.test.js`
- Modify: `props/index.js`, `sites/bespin.js` (zones `dining`, `carbon`, `reactor`, `corridor`; the `dining`/`carbon`/`reactor` places keep their outdoor props as doors; `respawn` for the reactor at the vane), `scene.js` (a zone's `inside.fall`: below it you're put at the zone's `respawn`, the `fell` event as outdoors)

- [ ] **Step 1:** `insideBespin.test.js` (Task 9's shape, plus "the carbon platform's floor moves down on the signal and back up when it's off"); `sites.test.js`.
- [ ] **Step 2:** Run — fail; build; pass. Headless shots of the four zones.
- [ ] **Step 3:** Commit: "Cloud City, inside: the dining room, the freezing chamber, the reactor gantry and the way out".

### Task 15: the freezing, the duel, Lobot's codes

**Files:**
- Modify: `sites/bespin.js` (quests: `freezing` (giver Lando at the chamber door; `enter carbon`; `shoot` tag `chamberguard` n 6: four `ugnaught` melee `{ melee: true, reach: 1.6, damage: 10, chase: 2.4 }` and two `stormtrooper` `{ range: 20, every: 1.8, damage: 9 }`; `use` id `freeze` on the platform → `end: [{ signal: 'freeze' }, { sound: 'crash' }, { say: … }]`; done: Fett's line), `duel` (giver Luke at the reactor door, `after: ['freezing']`; `enter reactor`; `shoot` tag `vader` n 1: `vader` with `hostile: { range: 16, chase: 2, melee: true, reach: 2.8, every: 1.5, damage: 16, delay: 1, parry: 0.8, guard: 4, blade: { color: '#ff3b3b' }, force: { every: 7, push: 9 } }`; `respawn` the vane), `lobot` (giver Lobot at the plaza, `after: ['freezing']`; `use` `lobot1` → `end: [{ signal: 'lobot1' }]`; `shoot` tag `escort` n 4 stormtroopers in the corridor with `spawn.side: 'yours'` Wing Guards ×3 `{ range: 20, every: 1.6, damage: 9 }` fighting beside you; `use` `lobot2`; `race` to Platform 327, `time: 40`)), `activity.js` (`hostile.force`: every `force.every` s within 8 m, `pushVelocity` from `combatRules.js`'s `forceAt` on you with `push` m/s, the push's sound; `spawn.side: 'yours'`: the target fires at the nearest hostile target instead of you, and hostiles may fire at it: `shooters` carries `at: [x, y, z]`), `activity.test.js` (new, pure parts: `nextForce(t, hostile, dYou)`), `scene.js` (a bolt with `at` goes there), `Achievements.jsx` (`bespinfreezing`, `bespinduel`, `bespinlobot`)

- [ ] **Step 1:** `activity.test.js`: "a force push falls due every `force.every` seconds within 8 m and never beyond"; "a friendly spawn's shot is at the nearest hostile, not you". `sites.test.js`.
- [ ] **Step 2:** Run — fail; implement; pass. Headless: `advance` through the three; Vader pushes (the debug `you` moves), the Wing Guards fire at troopers.
- [ ] **Step 3:** lint, test, build, health; `galaxy-check.mjs surface bespin` within budget. Commit: "The freezing, the duel on the gantry, and Lobot's codes". Push, PR ("Bespin, made whole"), CI, merge.

---

## PR 5 — models

Generated in the background from PR 2 on (the Meshy steps take minutes each); wired and gated in this one PR.

### Task 16: Meshy buildings from stills

**Files:**
- Create: `scripts/meshy-galaxy-three.mjs` (the `BUILDINGS` table for `cloudtower`, `cloudtower2`, `cloudplaza`, `dexdiner`, `club`, `republica`, in `meshy-galaxy-buildings-fill.mjs`'s format: `ref` a Wookieepedia file, `crop`, `lift`, `metres`, `along`, `tris`, `tex`; run through `MESHY_TASKS=scripts/meshy-galaxy-three-tasks.json node scripts/meshy-galaxy-buildings.mjs <step> <kind …>`), `scripts/meshy-galaxy-three-tasks.json`
- Modify: `catalog/made.js` (the six kinds, `made: 'meshy'`, with `solids: 'built'` where the built one's floors stay: `dexdiner`, `club`), `public/cc0/README.md` (the kinds listed), `sites/coruscant.js`, `sites/bespin.js` (the `cloudcity` scatter replaced by `cloudtower`/`cloudtower2` ×46 `sink: -40`; the plaza façade placed)

- [ ] **Step 1:** `lift` then `models` for the six (≈ 6 × (3 + 30) + 2 × 10 retexture allowance ≈ 220 credits); `fetch`; `sheet` each; look at every sheet; a wrong one is remade once from another crop or dropped (the built prop stays).
- [ ] **Step 2:** `npx vitest run src/components/galaxy/surface/catalog` — pass (files exist, sizes under the cap, README lists them).
- [ ] **Step 3:** Shots of Bespin's skyline and Coruscant's three fronts. Commit: "Cloud City's towers and plaza, Dex's, the Outlander and 500 Republica, from the films' pictures".

### Task 17: Meshy rigged figures; Sketchfab set

**Files:**
- Modify: `scripts/meshy-galaxy.mjs` (rows for `lando`, `lobot`, `ugnaught`, `wingguard`; `dex` as a creature-style still model), `scripts/meshy-galaxy-tasks.json`, `surface/crew.js` (the four walking kinds wired as crew figures; `dex` through `modelFigure` still), `public/models/galaxy/crew/`, `catalog/three.js` (new group: `wa7`, `jocasta`, `carbonplatform`, `senatepod`, `policespeeder`, each gated), `catalog/index.js`, `src/data/modelCredits.json`, `figures.js` (the built `lando`/`lobot`/`ugnaught`/`wingguard` kept as the fallback)

- [ ] **Step 1:** `images`, `models`, `rig`, `fetch` for the four (≈ 176); `dex` images + models (39). Look at `scripts/preview/crew.html` through the dev server; a refused likeness is retried once with `SOFT`, then left built.
- [ ] **Step 2:** `node scripts/sketchfab-surface.mjs three`; the contact sheet (`scripts/glb-shot.mjs` per model); delete the ones that fail the gate and their catalogue rows.
- [ ] **Step 3:** `npx vitest run src/components/galaxy src/data` — pass (credits, files). Shots at Platform 327 (Lando, Lobot walking) and Dex's.
- [ ] **Step 4:** lint, test, build, health. Commit: "Lando, Lobot, an Ugnaught, a Wing Guard and Dex as models; the three worlds' Sketchfab set". Push, PR ("The three worlds' models"), CI, merge.

---

## PR 6 — the people

Prerequisite: the NPC intelligence plan's Tasks 15–16 (hostiles with beliefs and a search; squad tokens and posture on the surface) are built first, in this PR, as that plan writes them; the tasks below add what this spec says beyond them.

### Task 18: needs and relations in the ambient life

**Files:**
- Create: `src/components/galaxy/surface/needs.js` (`pickWant(spec, wants, b, t, rand) → want | null`: a `utility.pick` over the site's `wants` of the kinds in `spec.needs`: distance (`curve.inverse` over 0–120 m), time since last visit (`cooldown`), a little `rand`; never the same want twice running), `needs.test.js`
- Modify: `actors.js:46-80` (`think`: with `spec.needs`, `b.to` comes from `pickWant`; at the want it waits `want.pause ?? 6` s; with `spec.relations`, a sensed `fears` kind within 18 m makes it flee at 1.6× for 6 s, a `chases` kind within 25 m makes it go after it at 1.3×, through `perception.sense` with the actors' `sightClear`), `sites/{coruscant,yavin,bespin}.js` (`wants` and `needs`/`relations` on the commuters, techs, Ugnaughts, Wing Guards, Senate Guards, Elan)

- [ ] **Step 1:** `needs.test.js`: "a want is not picked twice running"; "a nearer want of the same kind wins when nothing else differs"; "a kind not in `needs` is never picked"; `actors.test.js`: "a wanderer with `fears` runs from a kind it has seen and not one behind a wall".
- [ ] **Step 2:** Run — fail; implement; pass. Headless on Coruscant: commuters seen at the diner, the platform and a lane across 60 s of held clock.
- [ ] **Step 3:** Commit: "The worlds' people want things and know whom to run from".

### Task 19: dialogue trees

**Files:**
- Create: `src/components/galaxy/surface/talk.js` (`talkFor(says, ctx) → string[]`: `says` a list, or a tree `{ when: { era?, owner?, side?, hero?, done?: [ids], rank? }, lines, else }` nested; every `when` key present must match; `else` is the fallback; `talkTree(says)` validates: every branch has `lines` or `else`, every leaf reachable), `talk.test.js`
- Modify: `actors.js:330-336` (lines come from `talkFor(a.spec.says, ctx())`), `scene.js` (`ctx()` = `{ era: ctx.era, owner: effects?.owner ?? null, side: allegiance side ?? null, hero: ctx.hero?.id, done: ctx.done, rank }`; `createActors({ …, talk: ctx })`), `sites/{coruscant,yavin,bespin}.js` (trees for Lando, Lobot, Boba Fett, Vader, Dex, Elan, Jocasta, Padmé, C-3PO, Dodonna, Red Leader, Wedge, Leia, the sentry, Yoda), `sites.test.js` ("every `says` that is a tree validates")

- [ ] **Step 1:** `talk.test.js`: "a list is itself"; "a branch picks by every key of `when`"; "`done` matches when every id is done"; "a tree without `else` at a leaf fails validation"; "the deepest matching branch wins".
- [ ] **Step 2:** Run — fail; implement; pass. The trees written: Lando by `owner` (empire: bitter; rebel: running it again) × `side` × `done: ['han']`; Vader by `hero` (luke: "I am your father"; else: "The Force is strong with this one"); Dodonna by `done: ['briefing']`; Dex by `side`; the rest at least one branch.
- [ ] **Step 3:** lint, test, build, health. Commit: "The three worlds' people say different things by era, holder, side and what you've done". Push, PR ("The three worlds' people"), CI, merge.

---

## PR 7–8 — the war, pure; the table, the panel, the lines

Execute the allegiance plan's PR 2–6 (`docs/superpowers/plans/2026-10-07-gcw-allegiance.md`, Tasks 2–12, with its "Revision 3a" section winning) as written. No task of it is cut. Each PR merged in turn.

---

## PR 9 — the war on the ground

### Task 20: `effects` on the surface: `troopKind`, `garrisonAt`

**Files:**
- Modify: `src/components/galaxy/warEffects.js` (add `troopKind(kind, effects) → kind`: `TROOP_FAMILY = ['stormtrooper', 'sandtrooper', 'snowtrooper', 'scouttrooper', 'shoretrooper', 'deathtrooper', 'clone', 'rebel', 'hothtrooper', 'battledroid', 'superdroid', 'remnanttrooper']` mapped to `SIDES[effects.owner].troops` by site flavour (a snow world keeps `snowtrooper` for the Empire); anything else unchanged; `effects` null → unchanged; and `garrisonAt(site, effects) → life[]`: six to ten actors of the owner's `troops` round `site.land.at` on paths and posts, plus a `probe` droid for an Imperial search party on a world whose `faction` static is not the owner's), `warEffects.test.js`, `travel.js:24` (`surfaceProps` takes `effects`), `scene.js` (`ctx.effects`; `life` is `[...site.life, ...garrisonAt(site, effects)]` with each kind through `troopKind`; quest spawns through `troopKind`; flyovers from `effects.traffic` when present), `pages/GalaxySurface.jsx` (works out `effects` from `warNow`/allegiance as `Galaxy.jsx` does)

- [ ] **Step 1:** `warEffects.test.js`: "a trooper kind maps to the owner's and back, snow kept on Hoth"; "a named figure and a Jawa are untouched"; "null effects change nothing"; "`garrisonAt` gives the owner's troops at the landing, a search party when the owner isn't the world's own faction".
- [ ] **Step 2:** Run — fail; implement; pass. Headless: `window.__galaxyDebug.war.swear('empire')` then land on Yavin: stormtroopers and a probe droid at the field.
- [ ] **Step 3:** Commit: "Who holds a world decides who meets you at the landing".

### Task 21: three ground battles

**Files:**
- Modify: `missions/assaults.js` (`coruscant`: posts `platform` (fixed attack), `processional`, `templedoor`, `temple` (fixed defend); phases "The platform", "The Processional", "The Temple door"; sides by era from `SIDES`: `sidesFor(war)` so the attacker/defender are the theatre's; `yavin`: `field` (fixed attack), `hangar`, `summit`, `warroom` (fixed defend); `bespin`: `platform327` (fixed attack), `plaza`, `east` (fixed defend); `hideLife` the trooper kinds; `lines`, `barks`, `ends` per world), `missions/index.js`, `systems.js` (`game.also` with `to: '/galaxy/<id>/surface?mission=assault'` for the three), `assault.test.js` ("every assault's posts are on a flat or a floor of its site within reach"; "sidesFor gives the theatre's two sides")

- [ ] **Step 1:** Tests — fail; write the maps; pass. Headless: `OUT=lab/check node scripts/assault-check.mjs coruscant` (and yavin, bespin): a battle runs ten seconds, the choose card shows the theatre's sides, a win writes a `win:` key to `tp-gcw` (the allegiance plan's Task 13 wiring).
- [ ] **Step 2:** `galaxy-check.mjs surface coruscant,yavin,bespin` with `?mission=assault` within budget.
- [ ] **Step 3:** Commit: "The Temple steps, the temple perimeter and the platforms: three battles for the war".

### Task 22: docs, handoff, the backlog

**Files:**
- Modify: `docs/superpowers/HANDOFF-galaxy-surfaces.md` (a "The three worlds" section: done, left, checking it), `docs/architecture.md` (the surface on the house pieces, the talk trees, the garrison), `README.md` (the galaxy paragraph: the three worlds), `docs/autopilot/backlog.md`

- [ ] **Step 1:** Write them from the code as it landed. Open issues: `gen3d` for any Meshy model turned down; `voices` listing the new named lines.
- [ ] **Step 2:** lint, build, health. Commit: "Docs and handoff for the three worlds". Push, PR, CI, merge.
