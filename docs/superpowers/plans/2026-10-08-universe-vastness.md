# The universe made vast — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. (The owner chose inline execution: superpowers:executing-plans, no workflows.)

**Goal:** The shared sky kept as it looks but sharper, far worlds drawn as stars, the big wonders as landmarks, the hyperlanes removed, and the galaxy's aim-and-jump on the universe map.

**Architecture:** `galaxy/sky.js` (already every universe's sky) keeps its look and gains fidelity: a bake sized by detail level, screen-resolution grain and more stars. `farStars.js` replaces `farPlaces.js` and `beacons.js` (every non-landmark place is a star past `realAt`); `landmarks.js` draws the Maw, the nebulae and the big stars on the sky at a least size. The lane modules are deleted, their nodes kept as `waypoints.js`; the jump gains the galaxy's align phase and an aim.

**Tech Stack:** Three.js r186 (GLSL ShaderMaterial, Points, instanced quads, cube render target), React 19, Vitest 5, Vite 8.

**Spec:** `docs/superpowers/specs/2026-10-08-universe-vastness-design.md`

## Global Constraints

- The sky must not change in look anywhere (the owner's word: "keep it like that, improve only fidelity"): bake uniforms and the first 4,200 stars equal today's for every system and Kashyyyk's borrowed view (pinned from a fixture captured before the change). No images fetched or added.
- Bake face: 2048 `ultra`, 1536 `high`, 1024 `mid` (and when no level is given), 512 `low` or small; no mipmaps.
- Stars: 12,000 `high`/`ultra`, 7,000 `mid`, 3,000 `low` or small.
- `realAt(place) = max(1500, reach × 20)`; crossfade over the last fifth; star `k = clamp(realAt × 4 / dist, 0.12, 1)`, size `7 + 13·k` px, colour × `(1.1 + 2·k)`, swatch lerped 0.25 to white; stations real within 2,500 of the sun, nothing past.
- Landmark least sizes across: Maw 4°, nebulae 14°, stars' glare 1.5°, the Lantern 1°; real within: Maw and nebulae where true size meets least, stars 40 × radius, Lantern 20 × reach.
- Aim cone 0.06 rad; names show within 8° of the nose; align ends at `aligned > 0.996` or 4.5 s; `HYPER.recharge` 5.
- Drives in order `hyper`, `super`, `cruise`; `parseDrive` of `lanes` or nothing is `hyper`.
- Waypoint ids and positions identical to today's `NODES` (`beacon:<region>`, `ramp:<place>`): the fleet war is shared online by these ids.
- Every new `onBeforeCompile` needs a `customProgramCacheKey`; throwaway tests go inside `src/` (`vitest --root /` hangs).
- Commit after each task with the session's attribution lines; push at the end of each task.

## Review Focus

1. **Crossing sectors** (portal or Rick's portal gun, both ways): the other sector's far stars vanish and no landmark of the other sector shows. Test in Task 2 (`sector` filter) and Task 3.
2. **A jump asked for while one is aligning, while interdicted, or charging**: no second jump starts, interdiction refuses as today, a charging drive falls back to super speed with the note. Test in Task 6.
3. **Stick input during align**: the jump is cancelled and the pilot has the ship. Test in Task 6 (`jumpPhase` rule).
4. **The place you're at, and a place in the other sector**: never the aim. Test in Task 6.
5. **A stored `tp-universe-drive` of `lanes`** from before this change: reads as `hyper`, the nav map shows Jump picked. Test in Task 5.

---

### Task 1: The sky, sharper

**Files:**
- Create: `src/components/galaxy/__fixtures__/sky.json`
- Modify: `src/components/galaxy/sky.js`, `src/components/galaxy/scene.js`, `src/components/universe/scene.js`, `src/components/rickmorty/GalaxyBackdrop.jsx` (each passes `level: device().detail`)
- Test: `src/components/galaxy/sky.test.js` (today's tests unchanged, new ones added)

**Interfaces:**
- Produces: `createSky({ small, level = null, renderer, beacons })` (today's API plus `level`); `bakeSize({ small, level }) → number`; `starCount({ small, level }) → number`.

- [ ] **Step 1: Capture today's sky as a fixture.** A throwaway test in `src/__scratch/` on today's `galaxy/sky.js`: `createSky({})`, `setSystem` for `hoth`, `tatooine` and `{ ...kashyyyk, suns: [] }`; write `{ [id]: { uniforms: { uCore, uNear, uSide, uSeed, uNebDir, uNebCol, uNebShape }, stars: first 4200 × [x,y,z,size,r,g,b] rounded to 1e-4 } }` to `src/components/galaxy/__fixtures__/sky.json`. Delete the scratch test.

- [ ] **Step 2: Write the failing tests** in `sky.test.js`:

```js
it('sizes the bake by level', () => {
  expect(bakeSize({ small: true, level: 'ultra' })).toBe(512);
  expect(bakeSize({ level: 'ultra' })).toBe(2048); expect(bakeSize({ level: 'high' })).toBe(1536);
  expect(bakeSize({ level: 'mid' })).toBe(1024); expect(bakeSize({ level: 'low' })).toBe(512);
  expect(bakeSize({ small: false })).toBe(1024); expect(bakeSize({ small: true })).toBe(512);
});
it('counts the stars by level', () => {
  expect(starCount({ level: 'ultra' })).toBe(12000); expect(starCount({ level: 'high' })).toBe(12000);
  expect(starCount({ level: 'mid' })).toBe(7000); expect(starCount({ level: 'low' })).toBe(3000); expect(starCount({ small: true, level: 'high' })).toBe(3000);
});
it('looks as it did', () => { /* for each fixture id, createSky({ level: 'high' }).setSystem(sys): the bake uniforms equal the fixture's; the star attributes' first 4200 equal it within 1e-4 */ });
it('bakes without mipmaps', () => { /* after bake(fakeRenderer): the cube texture's generateMipmaps false, minFilter THREE.LinearFilter */ });
it('draws the extra stars fainter', () => { /* createSky({ level: 'high' }).setSystem(hoth): mean brightness (colour sum) of stars 4200… under that of 0…4199 */ });
```

- [ ] **Step 3: Run** `npx vitest run src/components/galaxy/sky.test.js` — expected FAIL (no `starCount`, no `level`).

- [ ] **Step 4: Implement in `galaxy/sky.js`.** `bakeSize`/`starCount` by level; the cube target `generateMipmaps: false`, `minFilter: THREE.LinearFilter`; the star buffers sized `starCount`, filled by today's loop from today's stream, stars past 4,200 with their brightness × 0.7. The look-up shader's grain: a 256 `tileFbm(11, { base: 8 })` `DataTexture` (made once per module, `RepeatWrapping`, linear), read on three sides as `skyShader.js`'s `cloud()` reads its clouds, at 40 and 110 a radian; `c *= 1.0 + (g - 0.5) * 0.4 * smoothstep(0.004, 0.05, dot(c, vec3(0.2126, 0.7152, 0.0722)))`. Nothing else in the bake changes.

- [ ] **Step 5: Pass the level** from `galaxy/scene.js`, `universe/scene.js` and `GalaxyBackdrop.jsx` (`device().detail`).

- [ ] **Step 6: Run** `npx vitest run src/components/galaxy src/components/universe src/components/rickmorty` and `npx eslint src/components/galaxy src/components/universe/scene.js src/components/rickmorty` — expected PASS, clean.

- [ ] **Step 7: Commit** `feat(sky): the same sky, sharper: a bake by level, fine grain, more stars`.

### Task 2: Far stars

**Files:**
- Create: `src/components/universe/farStars.js`, `farStars.test.js`
- Delete: `farPlaces.js`, `farPlaces.test.js`, `beacons.js`
- Modify: `scene.js` (make/update/dispose; `placeLabels`' rule), `deepspace.js` (`update`'s `names` may be a function), `expanse/scene/starfield.js` (import swap), `expanse/scene/starfield.test.js` if it names farPlaces

**Interfaces:**
- Consumes: `SKY_FAR` (deepspace.js), `POSITIONS`, `REACH`, `SECTOR_OF`, `SUN` (layout.js), `WONDERS`, `reachOf` (deep.js), `byId`, `UNIVERSES`, `MOONS` (universes.js), `LANDMARK_IDS` (Task 3 — until then an empty set; Task 3 fills it).
- Produces: `realAt({ reach, r }) → number`; `starK(dist, real) → 0…1` (0 real, 1 star); `brightness(dist, real) → k`; `starPx(k) → px`; `FAR_STARS: [{ id, at, reach, color, sector, station? }]`; `createFarStars(parent, { places, skyFar }) → { points, update(camera, dt, { focus, sector }), kOf(id) → number, dispose() }` (Expanse calls `update(camera, dt)`: no sector filter).

- [ ] **Step 1: Write the failing tests** in `farStars.test.js`:

```js
it('is real within twenty reaches, never under 1500', () => { expect(realAt({ reach: 100 })).toBe(2000); expect(realAt({ reach: 322 })).toBe(6440); expect(realAt({ reach: 10 })).toBe(1500); });
it('crossfades over the last fifth', () => { expect(starK(1500, 2000)).toBe(0); expect(starK(2000, 2000)).toBe(1); expect(starK(1800, 2000)).toBeCloseTo(0.5, 1); });
it('is brighter and bigger nearer', () => { expect(brightness(8000, 2000)).toBe(1); expect(brightness(40000, 2000)).toBeCloseTo(0.2); expect(brightness(1e6, 2000)).toBe(0.12); expect(starPx(1)).toBe(20); expect(starPx(0)).toBe(7); });
it('lists every non-landmark place with its sector', () => { /* every fandom world and moon is in FAR_STARS; moons' sector 'rickmorty'; stations flagged station; no id in LANDMARK_IDS */ });
it('hides the other sector', () => { /* createFarStars with a main and a rickmorty place, a camera in main far from both: update(cam, 1/60, { sector: 'main' }) → the rickmorty point's k is 0 and its group hidden; the main point's k 1 */ });
it('folds the stations into home', () => { /* a station place 3000 from the camera: kOf 0 and its group hidden (no star); at 2000: real */ });
```

- [ ] **Step 2: Run** `npx vitest run src/components/universe/farStars.test.js` — expected FAIL.

- [ ] **Step 3: Implement `farStars.js`.** One `Points` (as farPlaces: additive, opaque list, depth test off, renderOrder −9, at `skyFar` along the true direction), fragment as galaxy's `BEACON_FRAG` (core, glow, spikes scaled by k, focus pulse). Per point: size `starPx(brightness)` × dpr, colour = `color.lerp(white, 0.25) × (1.1 + 2k)`, alpha = `starK` (0 for another sector, and for a station past 2,500 of the sun). A place's group is hidden when its `starK` is 1, or it's in another sector, and shown otherwise (only undoing what it did, as farPlaces).

- [ ] **Step 4: Wire it.** `scene.js`: replace `createFarPlaces` and `createBeacons` with `createFarStars(map, { places: FAR_STARS.map(p => ({ ...p, group })), skyFar: SKY_FAR })`; update with `{ focus: state.aim ?? state.jump?.id ?? state.auto?.id ?? null, sector: mapSectorOf(camLocal) }`. `placeLabels`: while flying and not in the map view, a name is `off` unless `farStars.kOf(id) < 1`, it's `state.sel`, the destination, or within 8° of the nose (`angleTo(nose, dir) < 0.14`). `deepspace.update(…, { names: (id) => sameRule(id) })`. `starfield.js` imports `createFarStars`.

- [ ] **Step 5: Run** `npx vitest run src/components/universe src/components/expanse` and `npx eslint src/components/universe src/components/expanse` — expected PASS.

- [ ] **Step 6: Commit** `feat(universe): far worlds are stars, names only where you look`.

### Task 3: Landmarks

**Files:**
- Create: `src/components/universe/landmarks.js`, `landmarks.test.js`
- Modify: `farStars.js` (`LANDMARK_IDS` from landmarks.js), `scene.js` (make/update/dispose)

**Interfaces:**
- Consumes: `WONDERS`, `binaryAt`, `reachOf` (deep.js), `SUN`, `SECTOR_OF`/wonder `sector`, `TILT` (maw.js), `SKY_FAR`.
- Produces: `LANDMARKS: [{ id, kind: 'hole'|'nebula'|'star'|'pulsar', group: wonder id or 'sun', r, least (radians, across), real, colors, sector, part? }]`; `LANDMARK_IDS: Set`; `drawnAngle(r, dist, least) → radians across`; `landK(dist, real) → 0…1`; `createLandmarks(parent, { renderer, small, level }) → { mesh, update(camera, t, { sector, groups }), dispose() }` where `groups` is `(id) → THREE.Object3D | null`.

- [ ] **Step 1: Write the failing tests** in `landmarks.test.js`:

```js
it('lists the big things', () => { expect([...LANDMARK_IDS].sort()).toEqual(['cradle', 'curvesun', 'ember', 'halcyon', 'lantern', 'maw', 'sun', 'twins', 'veil']); });
it('draws at least the least size, then the true size', () => {
  const least = (4 * Math.PI) / 180;
  expect(drawnAngle(500, 100000, least)).toBeCloseTo(least);
  expect(drawnAngle(500, 5000, least)).toBeCloseTo(2 * Math.atan(500 / 5000));
});
it('hands over where the true size meets the least', () => {
  const maw = LANDMARKS.find((l) => l.id === 'maw'); expect(maw.real).toBeCloseTo(500 / Math.tan((2 * Math.PI) / 180), -1);
  const veil = LANDMARKS.find((l) => l.id === 'veil'); expect(veil.real).toBeCloseTo(700 / Math.tan((7 * Math.PI) / 180), -1);
  const ember = LANDMARKS.find((l) => l.id === 'ember'); expect(ember.real).toBe(180 * 40);
  const lantern = LANDMARKS.find((l) => l.id === 'lantern'); expect(lantern.real).toBeCloseTo(168 * 20, 0);
});
it('crossfades over a fifth either side', () => { expect(landK(0.79 * 1e4, 1e4)).toBe(0); expect(landK(1.21 * 1e4, 1e4)).toBe(1); expect(landK(1e4, 1e4)).toBeCloseTo(0.5); });
it('puts the Twins in two parts, each where binaryAt has it', () => { /* two LANDMARKS entries with group 'twins' and part 0 / 1 */ });
it('keeps the curve\'s sun to its sector', () => { expect(LANDMARKS.find((l) => l.id === 'curvesun').sector).toBe('rickmorty'); expect(LANDMARKS.find((l) => l.id === 'maw').sector).toBe('main'); });
```

- [ ] **Step 2: Run** `npx vitest run src/components/universe/landmarks.test.js` — expected FAIL.

- [ ] **Step 3: Implement `landmarks.js`.** One `InstancedBufferGeometry` quad, per-instance `aDir` (unit, updated per frame), `aSize` (radians across, from `drawnAngle`), `aKind`, `aCol0/aCol1`, `aK` (`landK`, 0 when in another sector), `aCell` (nebula atlas cell), `aAxis` (the Maw's disk normal in world space, from `TILT` turned with the map). Vertex: a camera-facing quad at `skyFar` along `aDir`, half-width `skyFar · tan(aSize/2)`. Fragment by kind: star (galaxy's `SUN_FRAG`), pulsar (core, glare, two beams turning at 1.6 rad/s), hole (black disc 0.3 of the size, an ellipse ring 0.45–1.0 squashed by `|axis·view|` along the projected axis, white-blue to red outward, brighter on one side, a lensed arc 0.36 over the top, a thin photon ring at 0.32), nebula (the atlas cell, × k). The nebula atlas: two cells painted once by a shader into a render target (1024 a cell on `high`/`ultra`, 512 below): warped fbm in its two colours, dust lanes, a few young stars. Additive, opaque list, depth test off, renderOrder −8. Each frame: a landmark's group (by `groups(group)`) hidden when its `landK` is 1 (both parts for the Twins), shown otherwise, only undoing its own.

- [ ] **Step 4: Wire it** in `scene.js` (groups: `deep.groupOf(id) ?? (id === 'sun' ? sun.group : null)`), and `farStars.js`'s `FAR_STARS` drops `LANDMARK_IDS`.

- [ ] **Step 5: Run** `npx vitest run src/components/universe` and lint — expected PASS.

- [ ] **Step 6: Commit** `feat(universe): the Maw, the nebulae and the big stars as landmarks on the sky`.

### Task 4: Waypoints

**Files:**
- Create: `src/components/universe/waypoints.js`, `waypoints.test.js`, `src/components/universe/__fixtures__/nodes.json`
- Modify: `front.js`, `farFights.js` (import `NODES` from `./waypoints`)

**Interfaces:**
- Produces: `NODES` (same objects as today's `hyperlanes.js` `NODES`: `{ id, kind: 'beacon'|'ramp', at, region, name, place? }`), `KEEP_OUT`, `HOME_BEACONS`, `nodeById(id)`, `rampOf(placeId)`.

- [ ] **Step 1: Capture today's nodes** (throwaway scratch test on today's `hyperlanes.js`): `NODES` as `[{ id, kind, at (rounded 1e-6), region, name, place }]` into `__fixtures__/nodes.json`.
- [ ] **Step 2: Write the failing test**: `waypoints.test.js` — `NODES` deep-equals the fixture (positions within 1e-6); `nodeById('beacon:home').at` equals the fixture's; every `ramp:` has a `place`.
- [ ] **Step 3: Run** — expected FAIL.
- [ ] **Step 4: Implement** `waypoints.js`: move the node half of `hyperlanes.js` (KEEP_OUT, HOME_BEACONS, BEACONS, `rampFor`, RAMPS, NODES, `nodeById`, `rampOf`) unchanged, with `RING` (12) and `CLEAR` (2) as its own constants. `front.js` and `farFights.js` import from it.
- [ ] **Step 5: Run** `npx vitest run src/components/universe/waypoints.test.js src/components/universe/front.test.js src/components/universe/farFights.test.js` — expected PASS.
- [ ] **Step 6: Commit** `refactor(universe): the lane nodes as waypoints, ids and all`.

### Task 5: The hyperlanes go

**Files:**
- Delete: `src/components/universe/hyperlanes.js`, `laneFlow.js`, `laneLook.js`, `laneRibbons.js`, `laneStreaks.js`, `laneTraffic.js`, `lanePilot.js`, `laneEvents.js`, `ride.js` and their `*.test.js`; `src/components/expanse/gen/lanes.js` and its test
- Modify: `scene.js`, `nav.js`, `nav.test.js`, `NavMap.jsx`, `UniverseMap.jsx`, `director.js`, `director.test.js`, `mines.js`, `minefield.test.js` (if it uses `across`), `online/pilots.js`, `online/pilotsRules.js`, `online/pilotsRules.test.js`, `poses.js`, `poses.test.js`, `scripts/universe-check.mjs`, `expanse/scene/expanse.js`, `expanse/scene/sectors.js`, `sectors.test.js`, `crews.test.js`, `skirmish.test.js`, `universe.css`, `navmap.css`

**Interfaces:**
- Produces: `DRIVES` = `hyper`, `super`, `cruise`; `parseDrive(v) → 'hyper' | 'super' | 'cruise'`; `ZONES = ['place', 'void']`; `zoneOf(s, { regionAt })`; `howToDraw(pose, me) → 'ship' | 'blip'`.

- [ ] **Step 1: Write the failing tests**: `nav.test.js` — `expect(DRIVES.map((d) => d.id)).toEqual(['hyper', 'super', 'cruise'])`, `expect(parseDrive('lanes')).toBe('hyper')`, `expect(parseDrive(undefined)).toBe('hyper')`, `expect(parseDrive('cruise')).toBe('cruise')`; `director.test.js` — `expect(ZONES).toEqual(['place', 'void'])`, no event lists `'lane'`, `zoneOf({ x: 1e6, z: 0 }, { regionAt: () => null })` is `'void'`; `pilotsRules.test.js` — a far pilot with `lane: true` is `'blip'`.
- [ ] **Step 2: Run** those three — expected FAIL.
- [ ] **Step 3: Remove the lanes** from each file listed: scene.js (imports; `state.ride`, `rode`, `laneLook` and its hits/fov/busy/dispose; `laneFrame`/`laneAim`/`lanePlan`; the `interdiction`/`lanejam`/`ambush` branches of `happen` and `state.ambush`; `zone` from `zoneOf(live, { regionAt })`; `net.pose`'s `lane` bit false; the DEV hooks `ride`, `lanes`; `drive: 'lanes'` in `where()`), nav.js (`lanes` drive, `laneTrip`, the lanes branch of `tripTime`, comments), NavMap.jsx (lanes and route lines, the `lanes` icon and time label, the header comment), UniverseMap.jsx (`ride` state and its line), director.js (zones, `interdiction`, `lanejam`, `ambush`, `ON_LANE`, `playAs`; `CAPITAL` and `convoy` to `['place', 'void']`), mines.js (`across`), pilots (streaks), poses (`lane-ride`), universe-check (`lane-ride`), the Expanse (`lanesOf`, `sectorLanes`, `trunkBetween`, ribbons), the CSS selectors for `.universe-lane*` and `.navmap-lane*`/`.navmap-route`. Fix every test that imported a deleted module.
- [ ] **Step 4: Run** `grep -rn "hyperlanes\|laneFlow\|laneLook\|laneRibbons\|laneStreaks\|laneTraffic\|lanePilot\|laneEvents\|from './ride'\|gen/lanes\|state.ride" src scripts` — expected nothing; then `npx vitest run` — expected all PASS; `npx eslint .` — clean.
- [ ] **Step 5: Commit** `feat(universe): the hyperlanes go`.

### Task 6: The jump, the galaxy's way

**Files:**
- Create: `src/components/universe/aim.js`, `aim.test.js`
- Modify: `nav.js` (`HYPER.recharge` 5; the `hyper` drive's `about`), `scene.js` (aim, `J`, phases, prompt key, `__universe().aim`), `UniverseMap.jsx` (the Jump button, the `aim` event), `universe.css`, `Universe.jsx` (only if the `jump` event's timing needs it: it fires at spool now)

**Interfaces:**
- Consumes: `starAhead` (galaxy/systems.js, with `dirs`), `steerToward`, `aligned` (galaxy/space.js), `FAR_STARS` (Task 2), `LANDMARKS` (Task 3).
- Produces: `aimTargets(sector, at) → [{ id, at }]` (far stars and landmarks of the sector, the twins once, never `at`); `aimFrom(from, nose, targets, keep) → { id, angle } | null` (cone 0.06, sticky 0.012); `JUMP = { align: 4.5, aligned: 0.996 }`; `jumpPhase(jump, { aligned, age, input }) → 'align' | 'spool' | 'cancel'`.

- [ ] **Step 1: Write the failing tests** in `aim.test.js`:

```js
it('aims at the place nearest the nose within the cone', () => { /* from home, nose straight at middleearth: aimFrom(...).id === 'middleearth'; nose 0.1 rad off every place: null */ });
it('sticks to the one it had', () => { /* two targets 0.005 apart in angle, keep the farther: it stays */ });
it('never aims at where you are, nor the other sector', () => {
  expect(aimTargets('main', 'middleearth').some((t) => t.id === 'middleearth')).toBe(false);
  expect(aimTargets('main', null).some((t) => t.id === 'gazorpazorp')).toBe(false);
  expect(aimTargets('rickmorty', null).some((t) => t.id === 'gazorpazorp')).toBe(true);
});
it('aligns, then spools, and the stick cancels it', () => {
  expect(jumpPhase({ phase: 'align' }, { aligned: 0.9, age: 1, input: false })).toBe('align');
  expect(jumpPhase({ phase: 'align' }, { aligned: 0.997, age: 1, input: false })).toBe('spool');
  expect(jumpPhase({ phase: 'align' }, { aligned: 0.5, age: 4.6, input: false })).toBe('spool');
  expect(jumpPhase({ phase: 'align' }, { aligned: 0.9, age: 1, input: true })).toBe('cancel');
});
it('recharges in five seconds', () => { expect(HYPER.recharge).toBe(5); expect(hyperState({ last: 0, now: 4 }).ready).toBe(false); expect(hyperState({ last: 0, now: 5 }).ready).toBe(true); });
```

- [ ] **Step 2: Run** `npx vitest run src/components/universe/aim.test.js` — expected FAIL.
- [ ] **Step 3: Implement** `aim.js` and `HYPER.recharge = 5`.
- [ ] **Step 4: Wire it in `scene.js`.** Each frame while flying (not on foot, not in the map view, no jump past align): `state.aim = aimFrom(camera-eye-through-reticle dir as the galaxy's `aimAt`, …)?.id ?? null`; emit `{ type: 'aim', id, name }` on change; the first time, `{ type: 'event', id: 'course' }`. `travel(id, 'hyper')` when ready (reduced motion keeps its own straight-there branch, untouched) sets `state.jump = { id, park, phase: 'align', age: 0, dir, name }` (dir: unit vector ship → park); `fly`: in `align`, input `{ throttle: speed > SHIP.cruise ? 0 : 0.35, ...steerToward(ship, dir) }` and `jumpPhase` each frame: `spool` sets `at = wall() + HYPER.flash`, `hyperAt = wall()`, emits `{ type: 'jump', id }`; `cancel` (stick input: `takeover`) clears it with `{ type: 'jump', phase: 'cancel' }`; the flash check and the flat-out input only in `spool`. `J`: `state.aim ?? (state.sel !== state.at ? state.sel : null)` jumps, else the map. `placePrompt`: with an aim and nothing else to say, the key cap `J` and `Jump · <name>`. `__universe().aim()` (DEV) returns `state.aim`.
- [ ] **Step 5: The HUD.** `UniverseMap.jsx`: hears `aim`; while there is one and the ship's flying, a button `.universe-jump` ("Jump to <name>", `J` cap) over the HUD calls `handle.current.travel(id, 'hyper')`; touch-sized (44 px), hidden on foot.
- [ ] **Step 6: Run** `npx vitest run src/components/universe` and lint — expected PASS.
- [ ] **Step 7: Commit** `feat(universe): aim at a star and jump, the galaxy's way`.

### Task 7: Docs, shots and the whole check

**Files:**
- Modify: `README.md` (the universe section's lanes paragraph, the keys table's `J` and `M` rows, the nav map row's drives), `docs/architecture.md` (the universe entries for the lanes, the far places, the sky)
- Shots: `lab/` (ignored) only

- [ ] **Step 1: Docs.** Replace the lanes paragraph with the vastness (far stars, landmarks, the jump: aim and `J`); the drives are Jump, super speed and cruise; architecture: one paragraph each for the sky's fidelity, `farStars.js`, `landmarks.js`, `waypoints.js`, `aim.js`, and drop the lanes' entries.
- [ ] **Step 2: Whole check.** `npx vitest run` (all PASS), `npm run lint` (clean), `npm run build` (succeeds).
- [ ] **Step 3: Shots.** With the dev server, `lab/shot-tmp.mjs` at `overview`, `maw`, `far-rim`, `middleearth-limb`, and `eval:` a Rick and Morty sector pose (`window.__universeDebug.travel('citadel','hyper')` then frames), on `high`; compare with the before shots side by side. Then the galaxy at Hoth (`#/galaxy/hoth`) to check it looks as it did. Then a jump in the browser: aim (`__universe().aim()` non-null with the nose on a world), `J`, align, spool, out parked.
- [ ] **Step 4: Commit and push** `docs: the universe made vast`.
