# Cybertron World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the Cybertron page on a walkable, drivable 3D world. It has two linked areas: Iacon at war (Fall of Cybertron look) and Team Prime's base with Jasper outside it (Prime look). You play Optimus Prime: walk, run, jump, shoot, and transform part by part into his truck. You talk to the Autobots, fight the Decepticons, and play missions.

**Architecture:**
- **Pure simulation.** A tested `rules.js` holds walking, driving, transforming, shots, enemies, pickups and missions.
- **Areas as data.** `areas/*.js` is read by both the rules and the renderer.
- **Renderer.** `scene.js` draws each area with a stage module per area (`stage/*.js`).
- **Robots.** The Sketchfab models are loaded by `bots.js`. Static ones get limbs from `autorig.js`, a rigid auto-rig that `lib/three/rig.js` can pose. `chunks.js` cuts robot and vehicle into chunks and swaps one for the other.
- **React wrapper.** `GameWorld.jsx` holds input, the HUD and the area switch.

**Tech Stack:** React 19, three r186 (GLTFLoader + meshopt, EffectComposer, UnrealBloom), Vitest, ESLint.

**Spec:** `docs/superpowers/specs/2026-10-05-cybertron-world-design.md`

## Global Constraints

- Units are metres. y is up.
- `yaw` 0 faces +z, and positive yaw turns toward +x. So forward = `(sin yaw, 0, cos yaw)`.
- Every model is stood on y = 0 and faces +z, sized in metres (`scripts/sketchfab-cybertron.mjs`).
- Robots are about 9.5 m tall (Optimus). The world is built at that scale: doors at least 16 m, streets at least 30 m.
- Models come from `src/components/cybertron/game/catalog.js`, `MODELS[kind]`, with `{ file, role, era, rig: { skinned, clips, pose } }`. Never hard-code a path that isn't in the catalogue.
- Nothing calls an asset service at runtime. Everything loads from `public/`.
- Device tiers come from `src/lib/device.js` `budget()`: ratio, samples, shadows, bloom. On a low tier: no shadows, no bloom, fewer chunks (30, not 60), fewer enemies.
- Comments are plain English in the site's voice, as in the files around them. No TypeScript. `npx eslint` clean.
- `rules.js` and `areas/*.js` import nothing from three.
- Commits end with the two attribution lines from the session reminder.

## Review Focus

1. **Transforming in awkward places:**
   - in the air
   - while already transforming
   - against a wall, where the truck's longer body would overlap a solid

   The expected behaviour: refused in the air and mid-transform. Next to a wall, the truck is pushed clear rather than stuck inside.
   Tests: `rules.test.js` "transform refused in the air", "transform refused while shifting", "truck pushed clear of a wall after transforming".
2. **Huge `dt`.** A tab comes back after minutes and passes `dt` = 30 s. Nothing should tunnel through walls or explode: `stepPlayer` clamps dt to 0.05 s and sub-steps at 1/120 s.
   Test: "big dt doesn't pass through a wall".
3. **Leaving an area mid-mission.** Using an exit mid-mission keeps the mission's progress. Coming back resumes it, and enemies from a `clear` step respawn.
   Test: "mission progress survives an area switch".
4. **Models that fail to load.** A 404 or a decode error gives a code-built stand-in figure, and the game still plays.
   Test: `bots.js` `makeFigure` with a bad file resolves to a stand-in. A unit test mocks the loader.
5. **Phone and keyboard focus.** Typing in a page input (`typing()` from `games/pad.js`) never moves Optimus. Losing window focus releases all keys.
   This is checked in `GameWorld.jsx`, so there is no unit test. The QA task checks it by script.

---

### Task 1: Rules: player, world, collisions, transform

**Files:**
- Create: `src/components/cybertron/game/rules.js`
- Test: `src/components/cybertron/game/rules.test.js`

**Interfaces:**
- Produces:
  - `ROBOT = { radius: 1.2, height: 9.5, walk: 7, run: 15, accel: 40, jump: 13, gravity: 32, step: 1.4 }`
  - `VEHICLE = { radius: 2.6, length: 9, top: 40, boost: 62, accel: 16, brake: 34, reverse: 12, grip: 9, turn: 1.7, steerRate: 3.2, boostDrain: 0.35, boostFill: 0.12 }`
  - `TRANSFORM = { time: 0.9 }`
  - `buildWorld(area) → World`, where World is:
    - `{ id, bounds, heightAt(x,z), solids, near(x,z,r), floorAt(x,z,y,step) }`
    - Solid is either `{ kind:'box', x, z, hw, hd, yaw, base, top, tag }` or `{ kind:'circle', x, z, r, base, top, tag }`.
    - `near` is a spatial hash of 32 m cells.
  - `newPlayer(area, at = area.spawn) → Player`, where Player is:
    - `{ mode:'robot'|'vehicle', shifting, shiftTo, x, y, z, yaw, vx, vz, vy, grounded, speed, slide, steer, hp:100, maxHp:100, energon:0, boost:1, cooldown:0, dead:false, hurt:0 }`
  - `stepPlayer(p, input, dt, world) → Event[]`. It mutates p.
    - Input: `{ moveX, moveZ, run, jump, throttle, steer, boost, fire, transform, use, aimYaw, aimPitch }`. `moveX`/`moveZ` are a world-space direction, length 0..1. `transform`/`use`/`jump` are edges.
    - Events: `{ type:'jump'|'land'|'bump'|'transform'|'transformed'|'hurt'|'dead', ... }`. `transform` carries `{ to }`. `bump` carries `{ speed }`.
  - `canTransform(p) → boolean`
  - `damage(p, amount) → Event[]`
  - `segmentClear(world, ax, ay, az, bx, by, bz) → boolean`. This is line of sight: false if a solid's box or circle, between its base and top, crosses the segment.

- [ ] **Step 1: Write failing tests** in `rules.test.js`. Use a tiny inline area: bounds ±100, flat ground, one box wall at x = 10 (hw 1, hd 20, top 30) and one low platform box at x = -10 (top 1.0).
  - Robot walks +x into the wall and stops with `p.x <= 10 - 1 - ROBOT.radius + 1e-6`.
  - It steps onto the low platform: after walking -x across it, `p.y` is close to 1.0.
  - Jump: `stepPlayer` with `jump:true` on the ground gives a `jump` event, `p.vy > 0`, then a `land` within 2 s.
  - "transform refused in the air": `canTransform` is false while `!p.grounded`.
  - "transform refused while shifting".
  - After transforming, `p.mode` flips once `TRANSFORM.time` has passed, with a `transformed` event.
  - Vehicle at full throttle approaches `VEHICLE.top` within 6 s and doesn't exceed it. Boost raises the cap to `VEHICLE.boost` and drains `p.boost`.
  - The vehicle hits the wall: `bump` event, speed reduced, never past the wall.
  - "truck pushed clear of a wall after transforming": a robot standing 1.5 m from the wall transforms. Afterwards no solid overlaps a circle of `VEHICLE.radius` round it.
  - "big dt doesn't pass through a wall": `dt` = 30 with full input toward the wall.
  - Health: `damage` to 0 gives `dead`.
  - `segmentClear` is blocked by the wall and clear over it (y above top).
- [ ] **Step 2:** Run `npx vitest run src/components/cybertron/game/rules.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement.**
  - The robot accelerates toward `moveX/moveZ × (run ? run : walk)` with `accel`. Its yaw turns toward its move direction; when firing, it faces `aimYaw`.
  - Gravity applies. Floor comes from `floorAt` (ground or the tops of solids within `step`).
  - Push out of solids that overlap `[y, y + height]` and whose top is above `y + step`.
  - The vehicle uses the Albuquerque model, simplified: forward speed, lateral `slide` gripped back at `grip`, and `steer` eased toward the input at `steerRate`. The yaw rate is `steer × turn × min(1, |speed| / 8)`, lower at top speed.
  - On wall contact the vehicle loses its speed along the wall's normal and emits `bump`.
  - Transforming sets `shifting = TRANSFORM.time` and `shiftTo`. Movement input is ignored while shifting. At the end `mode = shiftTo`.
    - Vehicle to robot: the robot's `vx, vz` take half the vehicle's velocity.
    - Robot to vehicle: `speed` takes the robot's forward speed.
  - After the switch, resolve overlap at the new radius.
  - Clamp `dt` to 0.05 and sub-step at 1/120.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: "Cybertron world: the rules for walking, driving and transforming".

### Task 2: Rules: shots, enemies, pickups, use, missions

**Files:**
- Modify: `src/components/cybertron/game/rules.js` (append)
- Test: `src/components/cybertron/game/rules.test.js` (append)

**Interfaces:**
- Consumes: Task 1's `World`, `Player`, `segmentClear`, `damage`.
- Produces:
  - `SHOT = { speed: 140, ttl: 1.2, robotDamage: 12, vehicleDamage: 7, cooldownRobot: 0.18, cooldownVehicle: 0.09 }`
  - `fire(p, targets, aim) → Shot[]`
    - Shot: `{ from:'player'|'enemy', x, y, z, vx, vy, vz, ttl, damage }`
    - Auto-aim: the nearest live target within 12° of the aim direction and 120 m.
    - The robot fires from `y + 7.5`. The vehicle fires twin shots from its nose at `y + 1.5`.
  - `stepShots(shots, dt, world, targets) → Hit[]`. It removes spent shots in place.
    - Hit: `{ shot, target }`. Targets are cylinders: `{ id, x, y, z, r, h, hp, dead }`.
  - `ENEMY_KINDS`:
    - `trooper: { hp: 40, speed: 6, range: 55, cooldown: 1.3, damage: 5, r: 1.2, h: 7 }`
    - `vehicon: { hp: 40, speed: 6, range: 55, cooldown: 1.2, damage: 5, r: 1.2, h: 7 }`
    - `megatron: { hp: 700, speed: 5, range: 70, cooldown: 0.5, damage: 9, r: 1.8, h: 10.5, boss: true }`
  - `newEnemy(kind, x, z, { id, model }) → Enemy`
    - Enemy: `{ id, kind, model, x, y, z, yaw, hp, maxHp, r, h, state:'advance'|'strafe'|'dead', t, cooldown, dir, dead }`
  - `stepEnemies(enemies, player, dt, world, rand) → { shots: Shot[], events: Event[] }`. Events: `{ type:'enemyFire', id }` and `{ type:'kill', id, kind }`.
  - `stepPickups(pickups, p) → string[]`, the ids collected within 4 m (5 m in the vehicle).
  - `useNear(p, area, state) → { type:'talk'|'exit', id, label } | null`. Reach is 10 m, robot mode only. Exits are also driven into: a vehicle inside an exit's `r` returns it.
  - `newMissions() → MissionState`: `{ active:null, step:0, count:0, timer:0, done:[] }`.
  - `startMission(ms, mission) → Step`
  - `feedMission(ms, area, event) → { advanced: boolean, step: Step|null, completed: string|null }`
    - Step types: `talk` (target id), `reach` (`at:{x,z,r}`), `collect` (`count`, `kind`), `clear` (`count` kills; `spawn` list), `drive` (`gates:[{x,z,r}]` in order, robot or vehicle, `within` s optional), `defeat` (target enemy id), `exit` (`to` area), `transform` (`to` mode).
    - Mission: `{ id, title, giver, area, achievement, steps }`.
- [ ] **Step 1: Write failing tests:**
  - A shot fired at a target 50 m ahead hits within 0.5 s.
  - A shot is stopped by a wall in between (no hit).
  - Auto-aim picks a target 8° off the aim line but not one 20° off.
  - A trooper 100 m away advances, and at 40 m strafes and fires (shots > 0 within 3 s).
  - A dead enemy doesn't fire.
  - A pickup is collected within 4 m only.
  - `useNear` returns `talk` for a person 6 m away in robot mode and null in vehicle mode.
  - Mission walk-through: the `talk` step advances on a talk event; `collect` with `count: 3` advances on the third pickup; `drive` gates must be taken in order; `within` runs out and resets the step to its start.
  - "mission progress survives an area switch": `feedMission` with `{type:'exit'}` for another area doesn't reset `ms`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Enemy movement uses the same push-out as the robot, with radius `r`. Fire only with `segmentClear`, with ±3° spread from `rand`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: "Cybertron world: shots, Decepticons, pickups and missions".

### Task 3: Areas as data

**Files:**
- Create: `src/components/cybertron/game/areas/index.js`, `areas/iacon.js`, `areas/base.js`, `areas/jasper.js`
- Test: `src/components/cybertron/game/areas/areas.test.js`

**Interfaces:**
- Consumes: Solid and Mission shapes (Tasks 1–2). Catalogue kinds from `game/catalog.js`.
- Produces: `AREAS = { iacon, base, jasper }` and `areaOf(id)`. Each area is:
  - `{ id, name, era, player: { robot, vehicle }, bounds, spawn, spawns, solids, people, pickups, exits, missions, look, stage }`
  - `look`:
    - `{ sky: 'iacon'|'base'|'desert', fog: [color, near, far], sun: { dir:[x,y,z], color, intensity }, ambient, exposure, bloom }`
    - The colours: Iacon is the night city under fire, with cold blue light, orange fires and cyan energon. The base is interior fluorescent teal-green light, with Teletraan's screens green. The desert is hot noon.
  - `stage` is free-form decorative data for that area's stage module: towers, energon gutters, the console, mesas.

**Iacon** (bounds ±420):
- **Boulevard.** It runs along z from the south gate (z = +400) to the Hall of Records plaza (centre z = −300, r 110). The Hall itself is a box at z −390 (hw 70, hd 40, top 95), with Autobot HQ east of the plaza.
- **Streets.** Side streets cross at z = +150 and z = −60. Tower blocks between the streets are solids, 40–90 m wide and 80–300 m tall, so they can't be climbed.
- **Barricades.** Low walls (top 2.5) and crates (top 6) give cover near the gate.
- **The west pad.** It sits at (−300, −150), r 60, a solid platform with top 1.0, holding the space bridge, which is `exits[0]` to `base`.
- **Metroplex** is decoration in `stage`, at (+900, −400), outside the bounds.
- **People:**
  - `bumblebee-wfc` by HQ, giving *Energon run*
  - `jazz` on the boulevard
  - `grimlock` at the gate barricade, giving *Hold the gates*
  - `jetfire` at the pad, giving *Wake Metroplex*
  - `zeta-prime` in the Hall plaza
  - `soundwave-foc` on a roof, unreachable: `y` 120, no `lines`
- **Pickups:** 12 energon cubes.
- **Missions:** *Hold the gates* (`clear` 3 waves of 4 troopers), *Energon run* (`collect` 8 within 120 s), *Wake Metroplex* (`drive` 6 gates), *Defend the Pad* (`defeat` megatron after the other three are done).

**Base** (Omega One, bounds ±70 × ±45, ceiling 48):
- Walls are solids round the edge.
- Teletraan-1's console sits on the north wall.
- The ground bridge tunnel is in the east wall: `exits` to `jasper`.
- The space bridge console is on the west side: `exits` to `iacon`.
- Ratchet's bay is in the NE corner.
- **People:** `ratchet` (giving *Report to Ratchet*), `bulkhead`, `arcee`, `bumblebee-tfp`.
- **Missions:** *Report to Ratchet* (talk to Ratchet, Bulkhead, Arcee and Bumblebee in turn).

**Jasper** (bounds ±600):
- Mesas are circle solids with tops 40–140. A road runs east–west at z = 0.
- The energon mine entrance is at (300, −250).
- The ground bridge portal is at (−450, 0): `exits` to `base`.
- The edge of Jasper town is at (500, 200): low boxes, top 8–14.
- Pickups: energon crystals at the mine.
- **Missions:** *Energon mine* (`reach` the mine, `clear` 2 waves of 4 vehicons, `collect` 5), *An Iacon relic* (`reach` a mesa top spot, then `collect` the relic).

**Ordering:**
- Missions in an area are offered in order, by `giver`.
- *Defend the Pad* needs `done` to include the other three Iacon missions.

- [ ] **Step 1: Write failing tests** in `areas.test.js`. For every area:
  - Spawn and every `spawns` entry are clear of solids at `ROBOT.radius` and at `VEHICLE.radius`.
  - Every exit's `to` exists, and the target area has an exit back.
  - Every person's `kind` and each area's `player.robot`/`player.vehicle` are keys of `MODELS`. If `MODELS` lacks a kind, the test names it.
  - Every mission's `giver` is a person in that area, and every `talk` target exists.
  - Every `drive` gate is inside the bounds and reachable: no solid covers its centre.
  - Pickup ids are unique across all areas.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Write the three areas to the layouts above. The people's lines are short, in character and in the site's own words, never quoted dialogue: two or three each.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: "Cybertron world: Iacon, the base and Jasper as data".

### Task 4: Robots: loading, auto-rig, stand-ins

**Files:**
- Create: `src/components/cybertron/game/autorig.js`, `src/components/cybertron/game/bots.js`
- Test: `src/components/cybertron/game/bots.test.js` (loader mocked)
- Lab: `lab/autorig.html`, gitignored, used for screenshots.

**Interfaces:**
- Consumes:
  - `MODELS` (catalog)
  - `src/lib/three/rig.js`: `figure(tpl, { h })` and `POSES`
  - `avengers/world/people.js`: `clipsFor`
- Produces:
  - `loadModel(kind) → Promise<{ scene, animations, spec }>`. It is cached and uses the meshopt decoder.
  - `autorig(scene, { pose }) → THREE.Object3D`. It returns a skinned copy with bones named the way rig.js knows: Hips, Spine, Spine1, Neck, Head, LeftShoulder, LeftArm, LeftForeArm, LeftHand, the same on the right, LeftUpLeg, LeftLeg, LeftFoot, and the right side. Each vertex is weighted rigidly to one bone.
    - Landmarks come from the mesh's width profile along y: the crotch, the shoulders' height and half-width, the neck and the knees.
    - Arms are found by `|x|` beyond the torso's half-width above the waist. They are split at the elbow, half-way out.
    - Legs are below the crotch, split by the sign of x and at the knee.
    - For `pose: 'posed'` (not T or A), the rig is built anyway. Then `walkable: false`, and the figure only bobs.
  - `makeFigure(kind, { shadows }) → Promise<Figure>`. Figure is:
    - `{ group, height, kind, skinned, play(state, { speed }), update(dt), setTint(hex, k), dispose }`
    - States: `'idle'|'walk'|'run'|'jump'|'fall'|'fire'|'hurt'|'dead'|'drive'`.
    - Clips are used where the model has them. Otherwise rig.js `POSES` (`stride(phase, amount, run)`, `stand`, `leap`, `punch` for fire, `hurt`, `fall`) drive it.
    - A static vehicle's `drive` spins wheel-like meshes if any are found (meshes whose name matches /wheel|tire|tyre/i). Otherwise it does nothing.
  - `standIn(kind) → THREE.Group`. A code-built robot or vehicle silhouette in the catalogue entry's colours (role-based), used while loading or on failure.
- [ ] **Step 1: Write failing tests:**
  - `autorig` on a synthetic T-pose built from boxes (torso, head, two arms, two legs) assigns the arm boxes' vertices to arm bones and the leg boxes' vertices to leg bones. Every vertex has exactly one weight of 1.
  - `makeFigure('nope')` resolves to a stand-in Figure, with `skinned` false and a group with children.
  - `loadModel` caches: a second call returns the same promise.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Then check every catalogue robot in `lab/autorig.html`:
  - The page shows each robot at stride phases 0, 0.25 and 0.5, using rig.js's `stride`.
  - Screenshot it with `shot.mjs` and fix whatever looks wrong (arms tearing, legs swapped).
- [ ] **Step 4:** Run the tests. Expected: PASS. Then look at the screenshots.
- [ ] **Step 5:** Commit: "Cybertron world: the robots, rigged where they came without bones".

### Task 5: The transformation

**Files:**
- Create: `src/components/cybertron/game/chunks.js`
- Test: `src/components/cybertron/game/chunks.test.js`
- Lab: `lab/transform.html`

**Interfaces:**
- Consumes: Figure (Task 4). The vehicle's scene from `loadModel`.
- Produces:
  - `chunkGeometry(geometry, count, seed) → { geometry, centroids: Float32Array }`. Triangles are clustered by k-means on their centroids (4 iterations, seeded), and the triangles are un-indexed.
    - New attributes: `aCentre` (vec3) and `aChunk` (float index).
  - `makeTransformer(robotFigure, vehicleScene, { chunks: 60 | 30 }) → Transformer`. Transformer is:
    - `{ group, start(to:'robot'|'vehicle'), update(dt) → boolean (still running), progress, dispose }`
    - Both forms are pre-chunked once.
    - On `start`, the robot's current skinned pose is baked into static geometry.
    - Pairing: chunks are sorted by (height band, then z), and robot chunk i pairs with vehicle chunk ⌊i × Nv / Nr⌋.
    - Motion: each outgoing chunk moves toward its partner's centre along an arc that lifts 1.5 m, spins about a hashed axis by up to 270°, and shrinks to 0. Each incoming chunk does the reverse.
    - Order: top-down for robot to vehicle, bottom-up for the reverse.
    - The whole run lasts `TRANSFORM.time` (0.9 s). Each chunk's own move takes 0.35 s, staggered across it.
    - It is one material clone per source material, patched in `onBeforeCompile` with the uniforms `uT` (0..1), `uDir`, `uDur` and `uStagger`, keeping the material's maps.
  - The transformer emits `'spark'` points (centres of chunks mid-flight) through `onSpark(cb)` for effects.
- [ ] **Step 1: Write failing tests:**
  - `chunkGeometry` on a 2000-triangle sphere with `count` 40 gives 40 distinct `aChunk` values. Every triangle's three vertices share one `aChunk`. The centroids lie inside the bounding box.
  - Same seed, same result.
  - The pairing function `pairChunks(nR, nV)` maps every incoming chunk to some outgoing one and is monotonic.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Then check in `lab/transform.html` with `optimus-foc` ↔ `cybertruck`. Take screenshots at t = 0, 0.3, 0.6 and 1.0 and look at them.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: "Cybertron world: Optimus transforms, piece by piece".

### Task 6: Iacon's stage

**Files:**
- Create: `src/components/cybertron/game/stage/iacon.js`, `stage/common.js`

**Interfaces:**
- Consumes:
  - `AREAS.iacon` (its `solids`, `stage`, `look`)
  - `lib/cc0.js` `createLibrary(renderer)`, using the `plate-deck` and `plate-road` sets
  - the tower kit ideas from `world/CybertronBackdrop3D.js`: `prism`, `tower` styles, `cityMaterial`. Copy what's needed into `stage/common.js`; don't import from the backdrop module.
- Produces:
  - `buildStage(area, { renderer, tier }) → Promise<Stage>`. Stage is:
    - `{ group, env: Texture|null, update(t, dt, camera), dispose }`
    - Every solid in `area.solids` is drawn as what its `tag` says: `tower`, `hall`, `hq`, `wall`, `crate`, `pad`, `barricade`.
    - Towers are instanced or merged per style, at most about 40 draws for the city.
    - Decoration comes from `area.stage`:
      - glowing energon gutters along the boulevard
      - Metroplex (the catalogue's `metroplex`) standing on the skyline
      - Trypticon far off
      - the space bridge model on the pad
      - fires as animated billboards
      - flak and searchlights in the sky
      - Seekers flying over: the `dreadwing-jet` or code-built
      - the planet's moons
    - `common.js` exports:
      - `makeSky(look)`
      - `makeFires(points)`
      - `makeEnergonStrips(lines)`
      - `cityMaterial(lib, { tile })`
- [ ] **Step 1:** Write `lab/stage.html`, mounting the stage with a free camera at the plaza, the gate and the pad.
- [ ] **Step 2:** Implement until the screenshots read as Fall of Cybertron's Iacon at night under siege: plated towers with lit edges, energon in the streets, fires, and Metroplex on the skyline.
- [ ] **Step 3:** Check that `npx eslint` is clean on the new files.
- [ ] **Step 4:** Commit: "Cybertron world: Iacon, drawn".

### Task 7: The base's and Jasper's stages

**Files:**
- Create: `src/components/cybertron/game/stage/base.js`, `stage/jasper.js`

**Interfaces:**
- Consumes: `AREAS.base` and `AREAS.jasper`, plus `stage/common.js` from Task 6. If Task 6 is not done, write `common.js`'s `makeSky` here and Task 6 reuses it.
- Produces: `buildStage(area, ctx) → Promise<Stage>`, the same contract as Task 6.
  - **Base:**
    - the silo interior: concrete and steel, catwalks
    - Teletraan-1's wall of green screens (canvas textures with scrolling Cybertronian glyphs; the site has a Cybertronian font, `scripts/build-cybertron-script.py`)
    - the ground bridge tunnel with a green swirling vortex shader when active
    - Ratchet's bay
    - lights
  - **Jasper:**
    - the desert heightfield (mesas as tall rock solids with eroded sides)
    - the road and the town edge
    - the mine entrance with energon crystals (the catalogue's `energon`)
    - the ground bridge portal (the same vortex)
    - a noon sky
- [ ] **Steps:** Lab screenshots as in Task 6, then eslint, then commit "Cybertron world: Team Prime's base and Jasper, drawn".

### Task 8: Effects and sound

**Files:**
- Create: `src/components/cybertron/game/effects.js`, `src/components/cybertron/game/sounds.js`

**Interfaces:**
- Produces:
  - `createEffects(scene, { tier }) → { bolt(shot), hit(x,y,z,color), boom(x,y,z,size), sparks(x,y,z,n), pickupGlow(id, x,y,z, on), muzzle(x,y,z,yaw), update(dt, shots), dispose }`
    - Pools only, so nothing is allocated per frame.
    - Player bolts are blue-white. Decepticon bolts are red-violet.
  - `createSounds() → { engine: { set({ speed, robot, boost, on }) }, blaster(from), boom(size), transform(), pickup(), step(), hurt(), ambience(area), dispose }`
    - Built on `lib/audio.audioContext()` and `components/games/gameAudio.js` `engine({ diesel: true })`.
    - `transform()` plays `lib/clips` `playClip('transform')`.
- [ ] **Steps:** A lab page that fires each effect, screenshots, eslint, then commit "Cybertron world: bolts, booms and the sound of it".

### Task 9: The scene and the React world

**Files:**
- Create: `src/components/cybertron/game/scene.js`, `GameWorld.jsx`, `game.css`
- Modify:
  - `src/pages/Cybertron.jsx`: the world becomes the first section, and the old hero moves below it
  - `src/components/worlds/worlds.js`: `WORLD_MB['/cybertron']` becomes the real total
  - `src/components/Achievements.jsx`: the missions' achievements

**Interfaces:**
- Consumes: everything above.
- Produces: `createGame(canvas, { tier, onLost }) → Promise<Api>`. Api is:
  - `{ setArea(id, spawnId) → Promise, render(state, dt), resize(w,h), precompile() → Promise, info(), dispose }`
  - The renderer gets a HalfFloat target with MSAA samples from `budget()`, then bloom (`look.bloom`), then an output and grade pass, with pacing from `lib/three/pace`.
  - The camera:
    - **Robot:** a chase camera 18 m back and 8 m up, looking over the shoulder at aim.
    - **Vehicle:** 22 m back and 7 m up, swinging behind the direction of travel.
    - Drag, or the mouse when pointer-locked, turns it. Wheel zooms.
    - It never goes through solids (raycast against solids from `World`) or above an interior's ceiling.
  - Figures: the player (robot Figure plus vehicle scene plus Transformer), people (Figures in idle that turn to face Optimus when near), and enemies (Figures, pooled per kind).
  - In dev, `window.__CY__ = { api, sim }`, with `api.teleport(x, z)` and `api.peek(camPos, look)`.
- `GameWorld.jsx`:
  - It is mounted like `avengers/world/CompoundWorld.jsx`: `use3D`, `useInView` and a frame loop.
  - Keys:

    | Key | Action |
    | --- | --- |
    | `WASD` / arrows | Move |
    | `Shift` | Run or boost |
    | `Space` | Jump |
    | `F` / left click | Fire |
    | `Q` | Transform |
    | `E` | Use |
    | `M` | Mission list |

  - It uses `typing()` and releases keys on blur. The gamepad comes through `readPad()`. Phones get a touch stick and buttons.
  - The HUD shows:
    - health and boost bars
    - energon count
    - the current mission and step text
    - a compass pointing at the step's target
    - the talk bubble
    - the area name on entering
    - a transform prompt
  - Exits fade to black (with the space-bridge or ground-bridge swirl) and then call `setArea`.
  - Without WebGL, it renders the old hero: `Planet` plus the copy.
- [ ] **Step 1:** Write `scene.js` and `GameWorld.jsx`. Mount the world in `Cybertron.jsx` above the existing sections.
- [ ] **Step 2:** Check in the dev server (`/#/cybertron?quality=high`) using `shot.mjs`:
  - spawn
  - walking (use `window.__CY__` to step the sim)
  - the truck
  - a transform in progress
  - a fight
  - each area through its exits
- [ ] **Step 3:** Run `npx eslint .`, `npx vitest run` and `npx vite build`. All must be clean.
- [ ] **Step 4:** Commit: "Cybertron opens on Iacon at war: walk it, drive it, fight for it".

### Task 10: QA, docs, PR

**Files:**
- Modify:
  - `README.md`: the worlds table row for Cybertron
  - `docs/architecture.md`: a `cybertron/game/` entry
- Create: `docs/superpowers/HANDOFF-cybertron-world.md`

- [ ] **Step 1: QA pass.**
  - Two critics compare screenshots against the spec: one on the look (WFC/FOC/Prime fidelity), one on play (controls, camera, missions completable). Fix what they find.
  - Check Review Focus item 5 (typing in an input doesn't move Optimus) by script.
- [ ] **Step 2:** Update the docs and write the handoff (what's done, what's next, how to check).
- [ ] **Step 3:** Run lint, tests and build. Push the branch. Open a PR to main and merge it.
