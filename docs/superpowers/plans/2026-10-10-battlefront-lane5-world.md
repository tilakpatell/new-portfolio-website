# Battlefront lane 5: the world on screen. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/battlefront/hoth/galacticAssault` draws Hoth as the game does: the whole level from lane L's pack under the game's own sun, sky, fog, exposure, bloom, grading and placed lights, the player as a 2017 trooper on the game's skeleton moving with the game's clips through the game's third-person camera, the bots and the battle from the sim (lanes 1 and 2), and the game's HUD rebuilt from its widget data: deploy screen, heat bar, abilities, objective bar, markers, radar, kill log, damage indicator, Battle Points on death, scoreboard, end of round.

**Architecture:** One world module (`shading: 'nodes'`) on the runtime's node renderer, WebGPU where the browser has it. `assets.js` is the one door for files (dev backend over the local export; the bucket backend is the streaming session's). `map/` loads lane L's pack built with `--frame map --no-fit` and the `image` ground layer; `lighting.js` and `post.js` apply `maps/hoth.lighting.json` with TSL nodes (CSM sun, GTAO, bloom, LUT, SMAA) and the placed lights; `camera.js` is a pure pose from `cameras.json`, `cameraRig.js` places the camera; `figures/` drives walrus figures with `locomotion.js` over the game's clip names; `hud/` draws `ui.json`'s widgets as runtime kit parts with the game's icons and fonts. The page owns the sim and feeds it inputs; everything drawn is read from `sim.view()`.

**Tech Stack:** three `^0.186` (`three/webgpu`, `three/tsl`, `three/addons/tsl/display/{BloomNode,GTAONode,Lut3DNode,SMAANode}`, `three/addons/csm/CSMShadowNode.js`, `InstancedMesh`, `Data3DTexture`, `PMREMGenerator`), `src/runtime/` (`module.js`, `backend.js`, `gfx.js`, `webgpu.js`, `look.js`, `hud/*`, `chunkGrid.js`), `src/lib/three/walrus.js` (phase 1), lane L's `surface/level/*` and `src/lib/level/collision.js`, `src/lib/land/layers.js` (`image`), `@dimforge/rapier3d-compat` through `src/lib/physics/`, React 19, Vitest, Playwright (`scripts/battlefront-check.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-10-battlefront-game-design.md` (decisions 1, 5, 6, 8, 12, 13, 14, 15; section 7 the adapter; section 8 `lighting`, `cameras`, `ui`; the look table in "What the game files hold").

## Global Constraints

- Starts from `main` after lane 0 and #810's lane L have merged (the pack builder and `surface/level/*`); phase 1 (`walrus.js`) for Task 5; lanes 1 and 2 for a battle on screen (until they merge, Task 7 runs the page over `createSim` with `bots: 0` and the player alone).
- **Files this lane owns**: `src/components/battlefront/**`, `src/pages/Battlefront.jsx`, the route in `App.jsx`, `scripts/battlefront-check.mjs`, `public/battlefront/**` (icons and fonts from lane 0's copy), `vite.config.js` (the `/bf2/` dev alias only), `src/runtime/webgpu.js` and `webgl.js` (the `ao`, `lut`, `smaa` passes, additive), lane L's `scripts/bf2017-level.mjs` (`--frame map`, `--no-fit`: additive, with their tests). It does not touch the galaxy, the universe, `actors.js`, `crew*.js`, `walrus*.js`.
- **No budget rows** (decision 5): no `budgets.js` row, no `WORLD_MB`, no `galaxy-check` gate for this world. The gates that do hold: `big-files` (under 800 lines), the layer rules, `looks.test.js` (this world's `look.js` says `own`, with its why: the game's records), `feel.test.js` if it reaches new worlds, `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /battlefront/hoth/galacticAssault`.
- **The frame is the export's**: metres, +Y up, +Z forward; nothing rebased. The player's start is a team 2 spawn from `maps/hoth.json`.
- **Numbers from the rulebooks** (`lightingOf`, `camerasOf`, `uiOf`, `mapOf`); a rendering constant the records lack is named with a comment (`CSM_CASCADES = 4`, `CSM_MAX_FAR = 600`, `PROBE_SIZE = 128`, `LIGHT_BUDGET = 64` lights lit at once, nearest first).
- The node renderer refuses `ShaderMaterial`, `onBeforeCompile` and `EffectComposer`; everything here is TSL or a stock node material.
- Copy: British spelling, curly quotes, the game's strings for in-game text; HUD text never under 0.7 rem; text over 3D on glass; commits one plain sentence with the session's attribution lines; merge commits.

## Review Focus

1. **The browser has no WebGPU** (Safari, an older Chrome): `pickBackend` gives the node renderer on WebGL 2 and the same TSL post must build; the check runs with `?gpu=webgl` and `?gpu=webgpu` and both draw the same scene (a pixel diff of the first frame under 2 percent of pixels). Task 3's test and Task 7's check.
2. **A placed light with `Intensity 65500`** (the records are in physical units against `EV 10`): the exposure must bring it to a sane value or the hangar is white. `lighting.js`'s `physicalToScene(intensity, ev)` is tested against two records and the sun (the sun's `SunScale 0.5` and the records' EV give the mapping; the test asserts the hangar's brightest light lands between 0.5 and 4 in scene units after exposure).
3. **The camera inside a wall**: the arm must shorten with `CollisionWidthPadding 0.17` and blend in over `5` s and out over `3` s as the record says, never clip through. Task 4's `camera.js` test with a wall at 0.6 m.
4. **A clip the body lacks** (a B1 has its own rig; a hero clip named for Luke on a trooper): `locomotion.js` resolves through `walrusRig.js`'s `CLIP_FALLBACK` and the skeleton's own set, never freezes at bind pose; `anim-check.mjs` at `--limit 0.15` on the route. Task 5.
5. **The deploy screen over the 3D while the sim runs**: the player is `deploying`, inputs are swallowed, the overview camera frames the live objective from `maps/hoth.json`'s `cameras`, and Enter deploys; Esc never leaves the world (the kit's one way out is the Menu). Task 6's HUD test and Task 7's check.

---

## File structure

| File | Responsibility |
| --- | --- |
| `index.js`, `module.js` | the world module: `shading: 'nodes'`, `mount`, `look` |
| `assets.js` (+ test) | the adapter, `dev` and `bucket` backends |
| `map/level.js` (+ test) | lane L's pack on the whole map: cells round the player, far ring, collision, the image ground |
| `lighting.js` (+ test), `post.js` (+ test), `look.js` | the visual environment, the placed lights, the post chain |
| `camera.js` (+ test), `cameraRig.js` | poses from `cameras.json`; three's camera |
| `input.js` (+ test) | keys, mouse through `runtime/look.js`, touch; to sim inputs |
| `figures/locomotion.js` (+ test), `figures/figures.js`, `figures/ragdolls.js`, `figures/held.js` | clip state machine; walrus figures per entity; falls; weapons in `Wep_Root` |
| `fx/bolts.js`, `fx/impacts.js`, `fx/saber.js` | bolts as the sim says, impacts, blades |
| `hud/*.jsx`, `hud/icons.js`, `hud/widgets.js` (+ test), `hud/battlefront.css` | the widgets from `ui.json` on the kit |
| `BattlefrontWorld.jsx`, `src/pages/Battlefront.jsx` | the page: sim, frame loop, HUD |
| `scripts/battlefront-check.mjs` | Playwright: deploy, advance, screenshots |

---

### Task 1: The adapter and the dev backend

**Files:**
- Create: `src/components/battlefront/assets.js`, `assets.test.js`
- Modify: `vite.config.js` (when `BF2_ROOT` is set: `server.fs.allow` gains it and `/bf2/` is served from `<BF2_ROOT>/web_opt`; nothing when unset), `.env.example` (`BF2_ROOT=`, `VITE_BF2_BACKEND=dev`)

**Interfaces:**
- Produces: `createAssets({ backend = import.meta.env.VITE_BF2_BACKEND ?? 'dev', base = '/bf2/', renderer }) → { loadModel(name, { lod = 0 }), loadClip(name), loadMap(level), loadTerrain(level), loadPhysics(name), loadStrings(), dispose() }` as spec section 7; `dev` resolves `models/<name>.glb` (`_lod<n>` for `lod > 0`), `anims/<skeleton>/<clip>.glb` through `anims.jsonl`'s `file` (fetched once), `maps/<level>.json` + `.bin`, `terrain/<level>/*_height.png` decoded to `Uint16Array` with a 16-bit PNG reader (`fflate` inflate plus a minimal PNG parser in `src/lib/png16.js`, pure, tested on a 2 × 2 fixture), `physics/<name>.glb`; GLBs through `src/lib/three/gltf.js` (meshopt and KTX2 already); `bucket` throws `not here yet` until the streaming session fills it (one function, one place). A per-session cache by name; `dispose` frees textures and geometries.

- [ ] **Step 1: Failing tests**: `loadMap` on the fixture (`scripts/fixtures/bf2017/web/maps/fixture_01/`) returns a manifest with `groups` and a `bin` of `20 × count` bytes; `loadTerrain` on a 2 × 2 16-bit PNG fixture gives `[0, 65535, 32768, 1]`; `loadClip('x')` asks `anims/<skeleton>/x.glb` by the jsonl row; `bucket` rejects with `not here yet`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `npx vite --port 5188` with `BF2_ROOT` set serves `/bf2/maps/index.json`.
- [ ] **Step 5: Commit** `The Battlefront assets adapter, with a dev backend over the local export`.

### Task 2: The whole map from lane L's pack

**Files:**
- Modify: `scripts/bf2017-level.mjs`, `scripts/lib/bf2017-level.mjs` (+ test): `--frame map` (skip `rebase`; `level.json.frame = 'map'`), `--no-fit` (skip `fitTo`; `level.json.fit = false`), `--out <dir>` (default stays lane L's), `--nav` (write `nav.bin` with lane 1's `buildNav` over the heightmap and the shapes' footprints at cell 2)
- Create: `src/components/battlefront/map/level.js`, `level.test.js`; by running: `public/battlefront/levels/hoth/` (the pack: `level.json`, cells, meshes, textures, `nav.bin`; its size written in the PR; served by `assetBase.js` when uploaded by hash, else local)

**Interfaces:**
- Consumes: lane L's `levelPack.js` (`readInstances`, the cell list for a position), `levelScene.js` (`InstancedMesh` draws), `levelStream.js` (fetch, abort), `src/lib/level/collision.js` (`solidsOf`, `rapierShapes`), `layers.js` `image`.
- Produces: `createLevel({ assets, pack, tier, scene, renderer }) → { ready, update(at: [x, y, z]), heightAt(x, z), solids, nav, bounds, dispose }`: a stream policy for a whole map (the far list first so the world is walkable, then cells within `NEAR = 256` m of `at` nearest first, `lod1` to `MID = 640`, `far` beyond; no drop on leave; `UPLOADS_PER_FRAME` by tier), the Rapier world from `rapierShapes` for the player's capsule and the camera's rays, `nav` from `nav.bin` for the sim.

- [ ] **Step 1: Failing tests**: the builder's `--frame map` leaves the fixture's first instance at its map position; `--no-fit` keeps every instance; `--nav` writes a `nav.bin` whose header says `cell 2`; `createLevel` with a fake stream asks the far list before any cell and asks the player's cell first among the near ones; `heightAt` reads the image layer.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; build Hoth: `node scripts/bf2017-level.mjs Levels/MP/Hoth_01/Hoth_01 --frame map --no-fit --nav --subs Hoth_01,Hoth_012,Content,FantasyBattle --out public/battlefront/levels/hoth` (the `FantasyBattle` sub holds the mode's own dressing: the trenches' barricades and the walkers' start). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** in two: `Lane L's level builder learns the map's frame and an unfitted pack` and `Hoth, whole, for the Battlefront world`.

### Task 3: The look: the visual environment, the placed lights, the post

**Files:**
- Create: `lighting.js`, `lighting.test.js`, `post.js`, `post.test.js`, `look.js`
- Modify: `src/runtime/webgpu.js` and `webgl.js` (`buildPostProcessing` gains `ao` (GTAO with `{ radius, bias, power }`), `lut` (`Lut3DNode` with a `Data3DTexture`), `smaa`; data in, nodes out), `src/runtime/gfx.test.js` or the backends' tests for the new pass names

**Interfaces:**
- Consumes: `lightingOf(rb, 'hoth')` (`weathers`, `lights`, `volumetrics`, `probes`, `prefabs`), the probe cubes through `assets.loadTexture` (added to the adapter: `textures/<path>` KTX2 or HDR), the LUT texture.
- Produces:
  - `applyEnvironment(scene, renderer, weather) → env` with `env.sun` (a `DirectionalLight` with `CSMShadowNode` of `CSM_CASCADES` cascades to `CSM_MAX_FAR`, colour the record's `SunColor`, direction from the level's `ShadowExtrusionLightDirectionEntityData` where present else the weather's name's hour), `env.sky` (a TSL sky from the Rayleigh coefficients and the cloud colours, drawn on the background and baked once into a PMREM for the environment), `env.fog` (a TSL fog node evaluating the record's `Curve` cubic over distance with the height media), `env.exposure` (`renderer.toneMappingExposure` from `EV` through `physicalToScene`), `env.wind` (a uniform the figures' cloth and the foliage read), `env.update(dt)`.
  - `physicalToScene(value, ev) → number` (pure): `value / 2^ev × EXPOSURE_K`, `EXPOSURE_K` chosen once so the sun at `SunScale 0.5` lands at 3.0 scene units (the galaxy's own daylight), with the comment.
  - `placeLights(scene, lights, { budget = LIGHT_BUDGET, ev }) → { update(cameraAt) }`: `PointLight` and `SpotLight` from the rows (`decay 2`, `distance radius`, `angle outer`, `penumbra 1 − inner / outer`, intensity through `physicalToScene`), the nearest `budget` lit each frame and the rest off, culled by the record's `CullScreenArea`; shadows on the `shadow.near > 0` spots within 40 m, at most 4 at once; volumetrics as additive cone meshes with the record's emission and exponent; probes as `CubeTexture` environments on the meshes inside each probe's box (nearest box wins, blended over `blend`).
  - `buildPost(gfx, weather) → passes` for `gfx.post`: `render`, `ao` (`HbaoRadius`, `HbaoAngleBias`, `HbaoPowerExponent`), `bloom` (`BloomScale` as strength, threshold from `ColorGradingMaxHdrValue`, the five Gaussian colours as the mip tints where the node allows, else the mean), `lut` (the weather's `T_CC_*`), `smaa`, `output`; `motionBlur` and `dof` behind `?post=full`.
  - `look.js`: `{ art: 'own', why: 'the game's own lighting records, applied', toneMapper: 'aces', bloom: fromWeather }` for `looks.test.js`.

- [ ] **Step 1: Failing tests**: `physicalToScene(55000, 10)` between 0.5 and 4; `physicalToScene` of the sun's `SunScale 0.5` is 3.0; `placeLights` with 100 rows and `budget 64` lights the 64 nearest to the camera and switches as the camera moves; a spot row gives `angle` `outer` in radians and `penumbra` `(90 − 70) / 90`; `buildPost` lists `['render', 'ao', 'bloom', 'lut', 'smaa', 'output']` with the record's numbers; the fog curve at distance 0 is near 0 and rises monotonically to the far plane on the Hoth sunny record; `look.js` passes `looks.test.js`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; the runtime's new passes on both backends with a test each that the pass is built from its data. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** in two: `The runtime's post learns ambient occlusion, a LUT and SMAA` and `Hoth under the game's sun, sky, fog, exposure, bloom, grading and placed lights`.

### Task 4: The cameras and the input

**Files:**
- Create: `camera.js`, `camera.test.js`, `cameraRig.js`, `input.js`, `input.test.js`

**Interfaces:**
- Consumes: `camerasOf(rb)`, `runtime/look.js` (`createLook`), `lib/combat/aim.js` (`aimPoint`, `assist`, `coneFor`), the Rapier world's ray cast.
- Produces:
  - `soldierPose(state, cam, { yaw, pitch, stance, aiming, weaponId, dt, castArm(from, dir, len) → hit }) → { at, lookAt, fov }` (pure): the pivot at the hips plus the stance's height, the arm `cam.soldier.arm` on the shoulder side, shortened by `reducedArm` between its pitches, pitch clamped to `±maxPitch`, the arm shortened to the cast hit minus `collision.padding` with blend in `collision.blendIn` and out `collision.blendOut` as rates per second, `fov` `aim[weaponId][level].fov` when aiming (eased at `zoomIn`/`zoomOut`) else `FOV_DEFAULT = 70` (hand: the game's base FOV option default; a comment).
  - `vehiclePose(state, cam.vehicles[id].seats[seat], input, dt)`: pitch within `pitch`, yaw and pitch with `inertia`, the velocity redirect blend.
  - `overviewPose(map, objectiveId) → { at, lookAt, fov }` from `maps/hoth.json`'s `cameras` (35 mm on a 36 mm frame: `fov = 2 atan(18 / 35)`), the one whose `forward` points nearest the objective's centre.
  - `createCameraRig(camera, { recoil: { spring, damping } }) → { set(pose), kick(radians), update(dt) }`: the recoil as a damped spring on pitch.
  - `createInput({ host, look, touch }) → { read() → sim input, attach, detach }`: WASD, Shift sprint, Ctrl crouch, Space jump or roll (double tap), 1 2 3 abilities, R vent, E interact, Tab scoreboard, the mouse through `createLook` (lock mode), left fire, right aim, Enter deploy; touch sticks and buttons from the kit.

- [ ] **Step 1: Failing tests**: `soldierPose` at pitch 0 puts the camera `arm` behind the pivot; at pitch 60 the arm is between `0.5 × arm` and `arm`; a wall at 0.6 m shortens the arm to `0.6 − 0.17` over time with `blendIn 5` (after 0.1 s the arm has moved toward it by about `5 × 0.1` of the gap, not all); aiming eases `fov` to 55; `overviewPose` picks the camera facing the objective; `createInput` maps `KeyW` to `move [0, 1]` and a double `Space` within 0.3 s to `roll`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The game's cameras and the player's hands`.

### Task 5: Figures on the game's clips

**Files:**
- Create: `figures/locomotion.js`, `locomotion.test.js`, `figures/figures.js`, `figures/held.js`, `figures/ragdolls.js`

**Interfaces:**
- Consumes: `walrus.js`'s `loadWalrusFigure` and `clipsFor`, `walrusRig.js`'s `SOCKETS` and `CLIP_FALLBACK`, `assets.loadClip`, `anims.jsonl` names, `sim.view().entities`, `lib/three/ragdollPhysics`, `lib/three/animBudget`.
- Produces:
  - `locomotion.js` (pure): `CLIPS = { idle: 'C_HM_Stand_Idle*', walk: 'C_HM_Stand_Walk_Fwd*', run: 'C_HM_Stand_Run_Fwd*', sprint: 'C_HM_Stand_Sprint_Fwd*', crouchIdle, crouchWalk, aim: 'A_HM_Aim*', fire: 'A_HM_Fire*', roll: 'A_HM_Roll*', vault: 'A_HM_Vault*', coverLeft: 'Cover_Left_*', coverRight: 'Cover_Right_*', coverPose: 'Cover_Pose_*', hit: 'A_HM_Hit*', death: 'Death_*', patrol: 'AI_<Role>_<Faction>_Patrol*', search: 'AI_<Role>_<Faction>_Search*' }` as glob families resolved once against `anims.jsonl` (`resolveFamilies(names) → { [state]: clipName[] }`, a family with no match falling to the next in `FALLBACK_CHAIN`); `stateFor(entity) → { state, speed, dir8 }` from the sim's `state`, `moving`, `aim`, `firing`, `stance`, `vel` (`dir8` the movement direction relative to facing, for the strafes); `transition(from, to) → { clip, fade }` (`T_HM_*` where one exists, else a `0.15` s crossfade); root motion from `AITrajectory` stripped (`rootHips` as `ual-bake` marks it) so the sim moves the body.
  - `figures.js`: `createFigures({ scene, assets, rulebook, tier }) → { update(view, dt), dispose }`: one walrus figure per soldier entity (kit by `teams.json`'s class kits per map: the `Kit_L_Assault_Orig_HO` body parts through phase 2's catalogue when it exists, else phase 1's heroes and a trooper per side), pooled by kit, driven by `locomotion`, the animator's rate by `animBudget`; heroes by their rows; B1 and B2 on their own rigs and clip families (`C_B1_*`, `A_B2_*`).
  - `held.js`: the entity's weapon model in `Wep_Root` by `weapons.json`'s `model`, the muzzle at `Wep_Muzzle` for the bolt's start.
  - `ragdolls.js`: a `down` entity's figure handed to `rigRagdoll` with the game's 15 bodies by bone name, the hit's impulse, within 40 m, at most 6 at once.

- [ ] **Step 1: Failing tests**: `resolveFamilies` over a names list with `C_HM_Stand_Run_Fwd_01` and no sprint gives `sprint` the run clips; `stateFor` of a moving, aiming soldier is `{ state: 'aim', dir8 }`; `transition('idle', 'run')` names a `T_HM_*` when the list has one; a death state picks a `Death_*` by the hit direction.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `node scripts/anim-check.mjs --route /battlefront/hoth/galacticAssault --limit 0.15` passes with the dev server up.
- [ ] **Step 5: Commit** `Figures on the game's skeleton, moving with the game's clips`.

### Task 6: The HUD from the game's widgets

**Files:**
- Create: `hud/widgets.js` (+ test), `hud/icons.js`, `hud/DeployScreen.jsx`, `hud/ObjectiveBar.jsx`, `hud/Tickets.jsx`, `hud/Heat.jsx`, `hud/Abilities.jsx`, `hud/Health.jsx`, `hud/Markers.jsx`, `hud/Radar.jsx`, `hud/KillLog.jsx`, `hud/KillMessage.jsx`, `hud/DamageIndicator.jsx`, `hud/SquadList.jsx`, `hud/DeathPoints.jsx`, `hud/Scoreboard.jsx`, `hud/EndOfRound.jsx`, `hud/BattlefrontHud.jsx`, `hud/battlefront.css`, `hud/parts.test.jsx`

**Interfaces:**
- Consumes: `uiOf(rb)` (`widgets`, `icons`, `fonts`, `colours`), `stringOf`, `sim.view()` (`mode`, `deploy`, `points`, `entities`, `oob`), `src/runtime/hud` (`Hud`, `Menu`, `Prompt`, `Toast`, `Objective`, `MiniMap`, `TouchButton`, `Stick`, `layoutRows`, `fitCanvas`).
- Produces: `widgets.js` (pure): `placeWidget(widget, viewport) → { x, y, w, h }` from the widget's `anchor` and `size` on the game's 1920 × 1080 reference scaled to the viewport's shorter side; `heatColour(heat, colours)`, `meterThirds(meter) → [0 | 1 | 2 | 3 filled]` (the capture thirds at `0.33`, `0.66`); `offerRows(offers, points)` for the deploy screen; `markerProjection(at, camera, viewport) → { x, y, onScreen, edgeAngle }`. Each `.jsx` is a kit part skinned `.bf-*`: the deploy screen as an aria-modal over the overview camera (the class row with icon, name, weapon, abilities; reinforcements and heroes with their Battle Point cost, greyed when unaffordable, the squad spawn list, the spawn map from the radar); the heat bar as the game's arc under the reticle, red past `warning`, the cooling window drawn while overheated; abilities as three slots with recharge rings and charge pips; the objective bar with the stage name (the game's string), each objective's icon and meter in thirds; tickets; in-world markers for objectives, squadmates and the escort; the radar from `MiniMap` with the level's heightmap as its ground; the kill log and the kill message (the game's `KillMessage` layout: who, weapon icon, Battle Points); the damage indicator's arc by hit direction; the squad list; Battle Points on death; the scoreboard on Tab; the end-of-round outcome declaration then the scoreboard. Fonts from `public/battlefront/fonts/` by `@font-face` in `battlefront.css` (`--bf-font-label: 'LinotypeUnivers-520CnMedium'`, `--bf-font-number: 'RaxusPrimeNumericalMonospace_Regular'`); icons inline from `public/battlefront/icons/` through `icons.js` (`<use>` of a symbol sheet built at load).

- [ ] **Step 1: Failing tests**: `placeWidget` anchors a bottom-right widget to the viewport's bottom right at 1280 × 720 scaled by `720 / 1080`; `meterThirds(0.5)` is `[1, 1, 0]`; `offerRows` sorts classes, then reinforcements, then heroes and marks `affordable`; `parts.test.jsx` renders `DeployScreen` with two offers and finds the hero's cost text; renders `Heat` at 0.9 with the warning class; renders `ObjectiveBar` with a stage string from `stringOf`; `BattlefrontHud` with `view.deploy.open` has `role="dialog"` and `aria-modal`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `kbd-styles` unchanged (the deploy screen's keys use `.kbd`).
- [ ] **Step 5: Commit** `The game's HUD, rebuilt on the kit from its widget data`.

### Task 7: The page, the route and the check

**Files:**
- Create: `BattlefrontWorld.jsx`, `index.js`, `module.js`, `src/pages/Battlefront.jsx`, `scripts/battlefront-check.mjs`, `docs/superpowers/evidence/battlefront-lane5/` (screenshots, the frame times)
- Modify: `src/App.jsx` (the lazy route `/battlefront/:level?/:mode?`), `src/components/worlds/looks.js` (the folder's row), `docs/architecture.md`, `README.md` (one line), `src/components/galaxy/index.js` only if the systems page link is wanted now (a `battlefront` link on Hoth's panel; optional)

**Interfaces:**
- Produces: the world module `{ shading: 'nodes', mount(host, rt, { level, mode }), look }`; `BattlefrontWorld.jsx` makes `createSim` (lanes 1 and 2) with the player on team 2 (or the deploy screen's side), the level, the environment, the figures, the cameras, the input, the HUD; the frame loop accumulates `dt` into `STEP`s, steps the sim, interpolates figures, updates lights, camera and HUD; `window.__battlefront = { view, do(action, arg) }` with `do('deploy', { classId })`, `do('advance', seconds)`, `do('win')`, `do('lose')`, `do('weather', name)`, `do('gpu')` for the check. `scripts/battlefront-check.mjs [--gpu webgl|webgpu] [--out dir]`: headless Chromium on `/battlefront/hoth/galacticAssault`, waits for `ready`, screenshots the deploy screen, deploys, advances 30 s, screenshots the field and the HUD, forces a win, screenshots the end card; records frame time over 10 s at 1600 × 900; fails on a console error or a frame time over 33 ms at high on the desktop in the owner's run (the headless run records, does not gate, on SwiftShader).

- [ ] **Step 1: Wire the page**; `npx vite --port 5188` with `BF2_ROOT`; open the route; fix until it draws.
- [ ] **Step 2: The check** both ways: `node scripts/battlefront-check.mjs --gpu webgpu` and `--gpu webgl` (the pixel diff of the field shot under 2 percent); the shots and the frame times into the evidence folder; the owner's desktop numbers in the PR.
- [ ] **Step 3: Docs**: `HANDOFF-battlefront.md` lane 5 done with the numbers; the spec's "Departures"; `docs/architecture.md`.
- [ ] **Step 4: Commit** `Battlefront on screen: Hoth, the game's light, camera and HUD`; lint, test, build, health, smoke; PR titled `Battlefront lane 5: the world on screen`.
