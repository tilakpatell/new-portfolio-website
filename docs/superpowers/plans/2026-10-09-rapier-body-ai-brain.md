# Rapier as the body, the AI as the brain: implementation plan (lane one, the galaxy surface)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every figure on the galaxy surface (the player, the quests’ hostiles, the duellists) moves on a Rapier kinematic character controller, sees through Rapier scene queries, and is hit through Rapier shape casts against bone-mapped hurtboxes, with a brain that outputs only an intent.

**Architecture:** New pure modules in `src/lib/physics/` (budget, groups, queries, character, hurtbox, zones), `src/lib/ai/mind.js` (the combat state machine) and `src/lib/combat/` (strike, damage), each tested in Node against the real engine; one three.js glue file (`src/lib/three/combat/hitboxRig.js`) that reads bones into hurtboxes; the surface’s wiring in three new files beside `scene.js` (`surfacePhysics.js`, `playerBody.js`, `hostileBodies.js`). Existing pure modules keep their APIs and gain Rapier-backed callers. The frame order is the spec’s section 3.

**Tech Stack:** `@dimforge/rapier3d-compat@0.21.0` (pinned; reached only through the handle `createPhysics` returns), three.js, vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-rapier-body-ai-brain-design.md`

## Global Constraints

- Rapier is imported only in `src/lib/physics/world.js`, dynamically; every new physics module takes `phys` (the handle) and uses `phys.RAPIER` and `phys.world`.
- `src/lib/physics/`, `src/lib/ai/`, `src/lib/combat/` stay pure: no three.js, no DOM; plain `[x, y, z]` arrays or `{ x, y, z }` objects as the neighbouring file already uses.
- Layers: `src/lib` ← `src/lib/three` ← `src/runtime` ← `src/components/<world>`; a world imports another world only through its `index.js` or `shared/`.
- A file stays under 800 lines. `scene.js` (3,653 lines) grows by wiring calls only; new logic goes in the new files beside it.
- The fixed step is `STEP = 1 / 60` with at most 4 substeps a call (`world.js`); nothing moves a figure outside `onSubstep`.
- British spelling, curly quotes in prose, comments that say why. No model names in code, commits or docs.
- Before a task is done: `npm run lint`, `npx vitest run <the task’s tests>`; before the lane is done: `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /galaxy/tatooine/surface`.
- The ground war’s soldiers (`surface/ground/`), the Battlefront armies (`missions/assault.js`), the chase and the mate stay as they are in this lane; they meet the new world only as bolt solids (Task 14).
- Commits end with the harness’s attribution lines.

## Review Focus

1. A figure spawned inside a wall or under the ground (a quest spawn on a slope’s wrong side): the controller must push it out on its first move and `character.test.js` pins it (Task 6).
2. A query asked before the world’s first step sees nothing: `surfacePhysics.js` steps once after building and `queries.test.js` asserts a ray before any step returns null, not a throw (Task 3).
3. The budget runs out mid-frame with a line-of-sight ray still owed: the belief must keep its last answer, never flip to “seen” (Task 3, Task 13).
4. A strike whose window spans a frame where the animator gave the same bone pose twice (a paused clip, hit-stop): a zero-length sweep must still test overlap at rest, not skip (Task 9).
5. A rigged figure missing a bone (a Meshy model whose `neck` is absent, an unrigged built figure): the rig must fall back to one capsule, never throw (Task 8).

---

### Task 1: the query budget and the counters

**Files:**
- Create: `src/lib/physics/budget.js`
- Test: `src/lib/physics/budget.test.js`

**Interfaces:**
- Produces: `createBudget({ rays = 24, sweeps = 8, overlaps = 4 }) → { take(kind) → bool, frame(), stats() → { rays: { used, refused, cap }, sweeps: …, overlaps: … } }`. `take` spends one of `kind` and answers whether it was granted; `frame()` resets the used counts and keeps the refused counts for `stats()` until the next `frame()`.

- [ ] **Step 1: Write the failing tests** in `budget.test.js`: `grants up to the cap then refuses` (24 rays granted, the 25th false), `frame() resets the spend` (after `frame()`, `take('rays')` is true again), `stats() counts used and refused` (`{ used: 24, refused: 1, cap: 24 }` after 25 takes), `an unknown kind is refused and counted nowhere`.
- [ ] **Step 2: Run** `npx vitest run src/lib/physics/budget.test.js`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `createBudget` in `budget.js`. Plain counters in a `Map`; no allocation in `take`.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(physics): a per-frame query budget`.

### Task 2: the collision groups

**Files:**
- Create: `src/lib/physics/groups.js`
- Modify: `src/lib/physics/world.js:80-88` (move `GROUPS` out, import it, re-export it)
- Test: `src/lib/physics/groups.test.js`, `src/lib/physics/world.test.js` (the existing assertions on `GROUPS` must still pass)

**Interfaces:**
- Produces: `GROUPS` with the three old names unchanged in value (`floor: (1 << 16) | 1`, `object: (3 << 16) | 5`, `bumper: (4 << 16) | 2`) and five new ones: `character` (member 8; meets floor, object, character), `hurtbox` (member 16; meets nothing by contact; found only by queries that name it), `zone` (member 32; a sensor; meets character), `projectile` (member 64; a query-only group used as a filter: floor | object | hurtbox), `sight` (member 128; query-only: floor | object | character). Also `filterOf(...names) → number` (a query filter of those memberships, all memberships set in the high word) and `MEMBERS` (the raw bits by name).
- `world.js`’s `add` accepts the new names through the same `group` field; nothing else changes.

- [ ] **Step 1: Write the failing tests** in `groups.test.js`: `the old three keep their values`, `a character meets the floor and another character, not a hurtbox` (bitwise: `(GROUPS.character >>> 16) & (GROUPS.hurtbox & 0xffff)` is 0), `filterOf('floor', 'object', 'hurtbox') sets those three bits in the filter word`, `every name is unique in its membership bit`.
- [ ] **Step 2: Run** `npx vitest run src/lib/physics/groups.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `groups.js`; in `world.js` replace the local `GROUPS` with `import { GROUPS } from './groups'` and `export { GROUPS }`.
- [ ] **Step 4: Run** `npx vitest run src/lib/physics`. Expected: PASS (world.test.js’s group assertions included).
- [ ] **Step 5: Commit** `feat(physics): collision groups for figures, hurtboxes, zones and sight`.

### Task 3: the eyes (`queries.js`)

**Files:**
- Create: `src/lib/physics/queries.js`
- Test: `src/lib/physics/queries.test.js`

**Interfaces:**
- Consumes: `createPhysics` (world.js), `GROUPS`, `filterOf` (Task 2), `createBudget` (Task 1).
- Produces: `createQueries(phys, { budget = createBudget() }) → q`:
  - `q.ray(from, dir, max, { groups = filterOf('floor','object','character'), exclude = null, solid = true }) → { dist, at: [x,y,z], normal: [x,y,z], body, tag } | null | undefined` (`undefined` means refused by the budget: the caller keeps its last answer; `null` means nothing hit). `exclude` is a Body handle (its rigid body is excluded). `body` is the `Body` handle from `world.js` (`collider.parent().userData`), `tag` the collider’s tag if it has one (Task 4).
  - `q.sweep(shape, from, to, { groups, exclude }) → { toi (0…1 of the motion), at, normal, body, tag } | null | undefined`; `shape: { shape: 'capsule' | 'ball', args, rotation? }` as `world.js`’s collider descs name them; `from`, `to` are the shape’s centre positions.
  - `q.overlap(shape, at, { groups, exclude }) → [{ body, tag }]` (an empty array when refused).
  - `q.floorAt(x, z, { from = 3, down = 6, groups = filterOf('floor','object') }) → { y, normal } | null | undefined`: a ray down from `y = from` above the highest hit, `down` metres.
  - `q.project(point, { groups }) → { at, inside } | null`: `world.projectPoint`, never budgeted (the ragdoll’s floor).
  - `q.frame()` → calls `budget.frame()`; `q.stats()`.
  - Every call passes `QueryFilterFlags.EXCLUDE_SENSORS` unless `groups` names `zone`. Shapes for `sweep`/`overlap` are built once per distinct `(shape, args)` and cached in a `Map` keyed by `JSON.stringify`.
  - Check `node_modules/@dimforge/rapier3d-compat/rapier.d.ts` for the exact argument order of `castRayAndGetNormal`, `castShape`, `intersectionsWithShape` and `projectPoint` at 0.21.0 before writing the calls.

- [ ] **Step 1: Write the failing tests** in `queries.test.js` (a `beforeAll` that `createPhysics()`es; a `scene()` helper adding a `floor` cuboid at y = −0.5 of half-size 20, a `character` capsule body at `[3, 1, 0]` (`type: 'kinematicPositionBased'`, args `[0.6, 0.4]`), a `object` cuboid wall at `[1.5, 1, 0]` half-size `[0.1, 2, 2]`, then `p.step(1/60)` once): `a ray before any step returns null, not a throw`; `a ray from the origin along +x stops at the wall before the figure` (`dist ≈ 1.4`, `body` is the wall’s handle); `a ray that excludes the wall’s body reaches the figure`; `a ray with the sight filter ignores a sensor zone in the way`; `a capsule sweep from [−2, 1, 0] to [4, 1, 0] reports toi ≈ (1.4 − 0.4) / 6 onto the wall`; `an overlap of a ball r 1 at the figure finds it and not the wall`; `floorAt(10, 10) is y ≈ 0 with normal [0, 1, 0]`; `the 25th ray in a frame is undefined and the 1st after frame() is a hit again`; `project([3, 5, 0]) onto the floor is y ≈ 0`.
- [ ] **Step 2: Run** `npx vitest run src/lib/physics/queries.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `createQueries` in `queries.js`. One `RAPIER.Ray` reused; results written into fresh small arrays (callers keep them).
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(physics): scene queries with a budget: ray, sweep, overlap, floorAt, project`.

### Task 4: sensors, tags and collision events in `world.js`

**Files:**
- Modify: `src/lib/physics/world.js` (the header, `add`, the step’s event drain, `free`)
- Test: `src/lib/physics/world.test.js` (new cases appended), `src/lib/physics/robust.test.js` (unchanged, must pass)

**Interfaces:**
- Produces: a collider desc gains `sensor: bool` and `tag: string`; a body desc gains `onEnter(other, tag, otherTag)` and `onLeave(other, tag, otherTag)` (`other` a Body handle). A collider with `sensor` is `setSensor(true)`, `setActiveEvents(COLLISION_EVENTS)` and `setActiveCollisionTypes(DEFAULT | KINEMATIC_FIXED | KINEMATIC_KINEMATIC)`. The step drains `drainCollisionEvents` after each `world.step` beside the contact-force drain and calls `onEnter`/`onLeave` on both bodies that have them, after Rapier’s loop, with the same throw-to-`onError` guard `hit` has. `owners` keeps `{ body: handle, tag }` per collider handle, and `Body.tagOf(collider) → tag | null` is exported on the handle for `queries.js`.
- A kinematic body’s desc gains nothing new; `setActiveCollisionTypes` on a non-sensor collider stays Rapier’s default.

- [ ] **Step 1: Write the failing tests** appended to `world.test.js`: `a sensor zone reports a kinematic capsule entering and leaving` (zone: fixed, `group: 'zone'`, collider `{ shape: 'ball', args: [1], sensor: true, tag: 'bite' }`, `onEnter` and `onLeave` spies; a `character` kinematic capsule moved by `setNextKinematicTranslation` through it over 20 steps: `onEnter` once with `(capsuleHandle, 'bite', null)`, then `onLeave` once); `a throwing onEnter goes to onError and the step finishes`; `a body removed from inside onEnter is gone after the step`; `tagOf gives a collider’s tag`.
- [ ] **Step 2: Run** `npx vitest run src/lib/physics/world.test.js`. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement** in `world.js`; update the header’s desc shape (`sensor`, `tag`, `onEnter`, `onLeave`).
- [ ] **Step 4: Run** `npx vitest run src/lib/physics`. Expected: PASS, every file.
- [ ] **Step 5: Commit** `feat(physics): sensor colliders with enter and leave events, collider tags`.

### Task 5: zones

**Files:**
- Create: `src/lib/physics/zones.js`
- Test: `src/lib/physics/zones.test.js`

**Interfaces:**
- Consumes: Task 4’s `sensor`, `onEnter`, `onLeave`.
- Produces: `createZone(phys, { position, shape = 'ball', args, rotation, tag, follow = null, onEnter, onLeave }) → { body, inside() → [Body…], move(position, rotation?), remove() }`. `follow` is a `Body` handle: `move` is then called by the caller each frame with that body’s pose (a bite reach that rides a rancor). The zone body is `kinematicPositionBased` (so `move` is `setNextKinematicTranslation`); `inside()` is the set kept from the events.

- [ ] **Step 1: Write the failing tests**: `a figure walking through a fixed zone is inside() during and not after`; `a moved zone catches a standing figure`; `remove() empties inside() and fires no more`.
- [ ] **Step 2: Run** `npx vitest run src/lib/physics/zones.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `zones.js`.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(physics): zones: sensor volumes with enter and leave`.

### Task 6: the character

**Files:**
- Create: `src/lib/physics/character.js`
- Test: `src/lib/physics/character.test.js`

**Interfaces:**
- Consumes: `createPhysics`, `GROUPS` (`character`), `filterOf`.
- Produces: `CHARACTER = { offset: 0.02, step: { height: 0.35, minWidth: 0.2 }, slope: { climb: 50, slide: 60 } (degrees), snap: 0.3, gravity: 15.5, knockDecay: 6 }` (gravity matches the walker’s `WALK.gravity` so the feel is unchanged) and
  `createCharacter(phys, { position, radius = 0.38, halfHeight = 0.5, mass = 70, group = 'character', pushes = true, turn = 11, ...CHARACTER overrides, tag = null }) → c`:
  - `c.body` (the `Body` handle), `c.collider`, `c.radius`, `c.halfHeight`.
  - `c.move(intent, dt)`: `intent: { vel: { x, z } (m/s), face: yaw (radians; `null` keeps the facing), jump?: number (an upward speed set this call, only when grounded) }`. Builds the displacement (`vel × dt` + the kept vertical speed × dt + `knock × dt`), calls `computeColliderMovement(collider, desired, QueryFilterFlags.EXCLUDE_SENSORS, filterOf('floor','object','character'), predicate excluding its own collider)`, sets the next kinematic translation and rotation (yaw turned toward `face` by at most `turn × dt`), reads `computedGrounded()`. Zeroes the vertical speed on the ground; decays `knock` by `exp(−knockDecay × dt)`. Must be called from the physics `onSubstep` hook; the world’s wiring does that (Task 12).
  - `c.knock(v: [x, y, z])`: adds to the knock velocity (m/s).
  - `c.grounded` (bool), `c.blocked` (bool: the asked horizontal move and the computed one differ by more than 0.3 of the ask, when the ask is over 0.01 m), `c.yaw`, `c.vy`.
  - `c.position(out)`, `c.quaternion(out)`, `c.prev(out)` (the translation before the last `move`), `c.teleport(position)` (sets both, clears knock and vy), `c.enable(on)`, `c.remove()`.
  - The controller is `phys.world.createCharacterController(offset)` with `enableAutostep(step.height, step.minWidth, true)`, `enableSnapToGround(snap)`, `setMaxSlopeClimbAngle`, `setMinSlopeSlideAngle`, `setApplyImpulsesToDynamicBodies(pushes)`, `setCharacterMass(mass)`; freed in `remove()`.

- [ ] **Step 1: Write the failing tests** (a `beforeAll` world with a flat `floor` cuboid at y = −0.5 half-size 50, stepped once; a helper `run(c, intent, seconds)` that registers `phys.onSubstep((dt) => c.move(intent, dt))`, steps `seconds` at 1/60, then unregisters): `stands on the ground within a second` (`grounded` true, y ≈ halfHeight + radius + offset within 0.05); `walks at the asked speed` (vel `{ x: 2, z: 0 }` for 1 s: x advances ≈ 2 within 0.1); `is stopped by a wall and blocked says so` (an `object` cuboid at x = 2; after 2 s x < 1.7 and `blocked` true); `steps a 0.3 m kerb and not a 0.5 m one` (two cuboids; y rises onto the first, x stops at the second); `climbs 40° and slides on 65°` (two ramps as rotated cuboids: on the first x advances with y rising; on the second x stays within 0.2 after 1 s); `a jump leaves the ground and lands` (`jump: 5.4`: `grounded` false within 3 steps, true again within 1.5 s, apex y over 1.2 m above the stand); `a knock decays and slides along a wall` (`knock([6, 0, 0])` against a wall along x at 1 m with the wall’s face turned 30°: after 1 s the figure moved along z, x never past the wall, and the knock’s magnitude is under 0.1); `a figure placed inside a wall is pushed out on its first move`; `prev and position differ by one substep’s motion`; `face turns at most turn × dt a step`; `a walker pushes a dynamic crate` (a 10 kg `object` cuboid ahead moves after 1 s of walking into it); `remove() leaves no body and no controller` (`phys.world.bodies.len()` back to the floor’s count).
- [ ] **Step 2: Run** `npx vitest run src/lib/physics/character.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `character.js`. No allocation in `move`: one `{ x, y, z }` for the desired translation, one for the next position, one quaternion object, all reused.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(physics): the character: a kinematic capsule on Rapier’s controller`.

### Task 7: hurtboxes on a character

**Files:**
- Create: `src/lib/physics/hurtbox.js`
- Test: `src/lib/physics/hurtbox.test.js`

**Interfaces:**
- Consumes: Task 6’s character (its `body`), Task 4’s `tag`, `GROUPS.hurtbox`.
- Produces:
  - `REGIONS = { head: { bones: ['neck', 'head_end'], r: 0.11 }, chest: { bones: ['Hips', 'neck'], r: 0.16 }, upperArmL: { bones: ['LeftArm', 'LeftForeArm'], r: 0.07 }, foreArmL: { bones: ['LeftForeArm', 'LeftHand'], r: 0.06 }, upperArmR: …, foreArmR: …, thighL: { bones: ['LeftUpLeg', 'LeftLeg'], r: 0.09 }, shinL: { bones: ['LeftLeg', 'LeftFoot'], r: 0.07 }, thighR: …, shinR: … }` (the radii are `ragdollPhysics.js`’s `RADIUS`, the bones its `AIM` chain: the Meshy skeleton’s names).
  - `createHurtboxes(phys, character, { regions = REGIONS, single = false }) → h`: adds one capsule collider per region to the character’s body, `sensor: true` so they never push anything, `group: 'hurtbox'`, `tag: region`; with `single: true` one capsule `whole` sized as the character (`capsuleOf`’s rule: `r = max(0.4, tall × 0.25)`), for an unrigged figure.
  - `h.set(region, a: [x,y,z], b: [x,y,z])`: world-space segment ends → the collider’s `setTranslationWrtParent` and `setRotationWrtParent` so the capsule lies on the segment given the body’s current translation and rotation (`capsuleBetween(a, b, bodyPos, bodyQuat) → { translation, rotation, halfHeight }`, exported and pure); a region not in `regions` is ignored.
  - `h.regions` (the names), `h.remove()`.

- [ ] **Step 1: Write the failing tests**: `capsuleBetween puts the capsule’s centre at the midpoint and its axis along the segment` (pure: a = [0, 1, 0], b = [0, 2, 0], body at [5, 0, 0] facing +z → translation [−5, 1.5, 0], rotation ≈ identity (Rapier’s capsule is along y), halfHeight 0.5); `a yawed body undoes its yaw in the wrt-parent translation` (body yaw 90°); `every region exists as a sensor collider tagged by its name` (`phys.world.colliders.len()` grew by 10; each `isSensor()`); `a ray against the hurtbox group hits the head where it was set` (set head to [0, 1.6, 0]→[0, 1.8, 0], ray from [2, 1.7, 0] along −x: `tag === 'head'`); `single: true makes one capsule tagged whole`; `set on an unknown region does nothing`.
- [ ] **Step 2: Run** `npx vitest run src/lib/physics/hurtbox.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `hurtbox.js`.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(physics): hurtboxes by region on a character’s body`.

### Task 8: the rig that maps bones to hurtboxes (`hitboxRig.js`)

**Files:**
- Create: `src/lib/three/combat/hitboxRig.js`
- Test: `src/lib/three/combat/hitboxRig.test.js`

**Interfaces:**
- Consumes: Task 7’s `h.set(region, a, b)` and `REGIONS`.
- Produces: `createHitboxRig(root: Object3D, hurtboxes, { regions = REGIONS, blade = null }) → rig`:
  - On creation, finds each region’s two bones by `root.getObjectByName`; a region with a bone missing is dropped; if fewer than 4 regions resolve, `rig.single` is true and the caller makes the hurtboxes with `single: true` (so the rig is created before the hurtboxes: `createHitboxRig(root, null)` first, then `rig.attach(hurtboxes)`).
  - `rig.update()`: for each kept region, reads both bones’ world positions (`getWorldPosition` into two reused `Vector3`s) and calls `set(region, a, b)` with them as arrays; for `single`, sets `whole` from the root’s position up `tall`.
  - `rig.blade()` → `{ base: [x,y,z], tip: [x,y,z] } | null` from `blade: { bone: 'RightHand', length, offset }` for strike.js (the hilt bone’s world position and its local y axis).
  - `rig.debug(parent)` → a `Group` of wire capsules that `update()` keeps in place (`?debug` only; `rig.debug(null)` removes it).
  - `rig.regions` (the kept names), `rig.single`.

- [ ] **Step 1: Write the failing tests** (build a fake Meshy skeleton: `Bone`s named `Hips`, `Spine`, `neck`, `Head`, `head_end`, `LeftArm`, `LeftForeArm`, `LeftHand`, `LeftUpLeg`, `LeftLeg`, `LeftFoot` and the right side, parented in that chain, positioned so the figure stands 1.8 m; a `hurtboxes` spy with `set` recording calls): `every region’s segment ends land on its bones within 1 cm` (after `update()`, each recorded `a`/`b` equals the bones’ `getWorldPosition` within 0.01); `a posed arm moves its hurtbox` (rotate `LeftArm` by 90° about z, `update()`, the `upperArmL` segment’s `b` moved with the forearm bone); `a missing neck drops the head and the chest and keeps the limbs`; `fewer than four regions is single`; `blade() follows the hand bone`.
- [ ] **Step 2: Run** `npx vitest run src/lib/three/combat/hitboxRig.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `hitboxRig.js`.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(three/combat): the rig that maps a figure’s bones onto its hurtboxes`.

### Task 9: the strike

**Files:**
- Create: `src/lib/combat/strike.js`
- Test: `src/lib/combat/strike.test.js`

**Interfaces:**
- Consumes: Task 3’s `q.sweep` (shape `{ shape: 'capsule', args: [halfHeight, r] }`), `blade.js`’s `createBlade` (for clashes).
- Produces:
  - `createStrike({ id, owner (a Body handle), r = 0.12, damage, kind = 'light', window: [t0, t1], groups = filterOf('hurtbox') }) → s` with `s.hits` (a `Set` of victim Body handles), `s.t`, `s.done`.
  - `stepStrike(s, q, pose, dt) → [{ victim, tag, at, dir, toi }]`: `pose: { prev: { base, tip }, now: { base, tip } }` (world arrays); advances `s.t += dt`; outside the window returns `[]`; inside, sweeps the blade capsule (centre and axis from `now`, rotation from the segment) from `prev`’s centre to `now`’s centre, excluding `owner`; a victim already in `s.hits` is skipped; a zero-length motion still calls `sweep` with `from === to` (Rapier tests the resting overlap); `dir` is the unit motion of the tip (or the blade’s axis when the motion is under 1 mm).
  - `clashOf(s, other: { base, tip })` → `{ at } | null` through `blade.js`’s `clash` on two blades’ latest segments.

- [ ] **Step 1: Write the failing tests** (a real `createPhysics` with a `character` + `createHurtboxes` single capsule at `[2, 0, 0]`, stepped once): `a sweep across the figure inside the window hits once with tag whole`; `the same victim is not hit twice in one strike`; `outside the window nothing is swept`; `a zero-length pose overlapping the figure still hits`; `the owner is never a victim`; `dir is the tip’s motion`.
- [ ] **Step 2: Run** `npx vitest run src/lib/combat/strike.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `strike.js`.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(combat): the strike: a blade swept as a Rapier shape cast`.

### Task 10: damage

**Files:**
- Create: `src/lib/combat/damage.js`
- Test: `src/lib/combat/damage.test.js`

**Interfaces:**
- Produces:
  - `KNOCK = { light: 2.5, heavy: 6, lethal: 8 }` (m/s), `STUN = { light: 0.3, heavy: 1.2, broken: 2 }` (s; `duel.js`’s `DUEL.stagger` numbers), `WHERE = { head: 2, chest: 1, upperArmL: 0.6, foreArmL: 0.5, thighL: 0.7, shinL: 0.5, …R the same, whole: 1 }` (damage multipliers).
  - `resolve(hit: { victim, tag, at, dir }, attack: { damage, kind }, victim: { hp, guard?: number, blocking?: bool }) → { damage, hp, dir: [x, y, z], force, kind: 'light' | 'heavy' | 'lethal' | 'blocked', where, stun }`: `damage × WHERE[tag]`, rounded to one decimal; `hp` after; `kind` is `lethal` when `hp ≤ 0`, `blocked` when `victim.blocking` (damage 0, `force` halved, `stun` 0), else `attack.kind`; `force = KNOCK[kind]` (`lethal` for a kill), `stun = STUN[kind]` (0 for lethal: the body goes to `dead`); `dir` is the hit’s `dir` flattened to the ground and re-normalised, with `y = 0.25` for a heavy or lethal (a lift).

- [ ] **Step 1: Write the failing tests**: `a head hit doubles the damage`, `a blocked hit does no damage, half the force, no stun`, `a kill is lethal with KNOCK.lethal and no stun`, `a light hit on the chest is 1× damage, 2.5 force, 0.3 stun`, `dir is flat and unit for a light hit and lifted for a heavy`.
- [ ] **Step 2: Run** `npx vitest run src/lib/combat/damage.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `damage.js`.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(combat): damage: one resolver for every hit`.

### Task 11: the mind

**Files:**
- Create: `src/lib/ai/mind.js`, `src/lib/ai/states.js`
- Modify: `src/lib/ai/index.js` (export `mind`, `states`)
- Test: `src/lib/ai/mind.test.js`

**Interfaces:**
- Consumes: nothing new (the toolkit’s `utility`, `tree`, `spatial` may be used inside a state).
- Produces:
  - `createMind(STATES, { start = 'patrol', seed = 1, rate = 10 (Hz), phase = rand }) → m` with `m.state`, `m.intent` (the held one), `m.bb` (the blackboard, with `bb.clock`), `m.timer`.
  - `mindStep(m, bb, w, dt) → intent`: queues’ interrupts first (`m.on(event, ctx)` pushes to `m.events`; each state table row may have `on: { [event]: (bb, ctx) → nextStateName | null }`; a row’s absent `on` means the default: `struck → 'stunned'` unless the state is `dead`; `dead → 'dead'`; `lost → 'search'` from `chase` or `attack`; `found → 'chase'` from `patrol`, `search`, `suspicious`); then, when `m.timer` is due (every `1 / rate` s with the phase offset), runs the state’s `tick(bb, w, dt) → intent | { to: name, intent? }`; transitions run `exit(bb, w)` then `enter(bb, w)` and tick the new state at once; the returned intent is held in `m.intent` until the next due tick.
  - `intent: { vel: { x, z }, face: number | null, jump?: number, act?: 'strike' | 'block' | 'shoot' | null, clip?: string | null, mode: string }`; `IDLE = { vel: { x: 0, z: 0 }, face: null, act: null, clip: null, mode: 'hold' }`.
  - `states.js`: `STATES` with the seven rows of the spec, generic: `patrol` walks `bb.route` (a list of `{ x, z }`, index in `bb.at`) at `bb.pace.walk`; `search` goes to `bb.lastSeen` then back to `patrol` after `bb.searchFor` s; `chase` seeks `bb.target.at` at `bb.pace.run` and goes to `attack` when `bb.inReach(bb)` is true; `attack` returns `bb.attack(bb, w, dt)` (the world’s own: `duelStep` or a shooter’s hold) and back to `chase` when out of reach; `stunned` enters with `bb.stun` seconds, returns `IDLE` with `mode: 'stunned'`, exits to `bb.after ?? 'chase'`; `flee` runs from `bb.target.at` and returns to `chase` once `bb.hp > bb.fleeUntil`; `dead` enters once and ticks `IDLE` with `mode: 'dead'`. Each uses `w.seesThrough`, `w.tokens` only through `bb` callbacks so the file stays pure.
  - `m.on('struck', { stun, kind })` sets `bb.stun = ctx.stun` before the transition.

- [ ] **Step 1: Write the failing tests**: `ticks at its rate and holds the intent between` (rate 10, dt 1/60: the state’s tick runs 6 times in a second, `m.intent` is the same object between); `struck interrupts every state but dead`; `exit runs before enter on a transition` (spies in order); `found moves patrol to chase, lost moves chase to search`; `stunned leaves on its timer to bb.after`; `the same seed gives the same transitions over 10 s of a scripted world`; `dead never leaves`.
- [ ] **Step 2: Run** `npx vitest run src/lib/ai/mind.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `mind.js` and `states.js`; add both to `index.js`.
- [ ] **Step 4: Run** `npx vitest run src/lib/ai`. Expected: PASS, every file.
- [ ] **Step 5: Commit** `feat(ai): the mind: a combat state machine that outputs an intent`.

### Task 12: the surface’s physics world (`surfacePhysics.js`)

**Files:**
- Create: `src/components/galaxy/surface/surfacePhysics.js`
- Test: `src/components/galaxy/surface/surfacePhysics.test.js`

**Interfaces:**
- Consumes: `createPhysics`, `preload`, `addHeightfield` (`lib/physics/heightfield.js`), Task 3’s `createQueries`, the surface’s `world` (`{ heightAt, normalAt, solids: createSolids(), floors, reach, water }`).
- Produces: `createSurfacePhysics(world, { reach = world.reach ?? 160, spacing = 2, tier }) → Promise<sp>`:
  - Builds `phys = await createPhysics({ gravity: -CHARACTER.gravity, maxSubsteps: 4, lost: (p) => p[1] < world.heightAt(p[0], p[2]) - 50 })`; the ground as `addHeightfield` tiles of 64 m (`n = 33` at 2 m spacing) over `[−reach, reach]²` sampled from `world.heightAt`; each solid of `world.solids.all` as a fixed body: a circle → `cylinder` `args: [halfHeight, r]` standing from `base ?? ground` to `top ?? ground + 50`; a box → `cuboid` `[hw, halfHeight, hd]` turned by its yaw (quaternion from `s.c`, `s.s`); a floor disc → a `cylinder` 0.1 m thick at `y`; a floor box → a `cuboid`. Every solid’s body is `group: 'object'` with `friction 0.6`; the heightfield `friction 0.6`. `tag`ged solids and floors keep their handle in `sp.byTag: Map<tag, Body[]>` so `sp.toggle(tag, on)` can `enable(on)` them (a gate that lifts, a trapdoor: the walker’s `off`).
  - After building, `phys.step(1 / 60)` once (Review Focus 2).
  - `sp.phys`, `sp.q` (`createQueries(phys, { budget: budgetFor(tier) })` where `budgetFor` gives `{ rays: 24, sweeps: 8, overlaps: 4 }` on `high`, `{ 16, 6, 3 }` on `mid`, `{ 10, 4, 2 }` on `low`), `sp.step(dt)` (calls `q.frame()` then `phys.step(dt)`), `sp.addSolid(s)` (for solids added after building: `placer` adds some late; returns the handle), `sp.dispose()`.
  - `sp.seesThrough(a: { x, y?, z }, b) → bool`: a sight ray from `a` (y + 1.5 when absent) to `b` (y + 1.1), `groups: filterOf('floor', 'object')`, true when nothing is hit or the budget refused and the last answer for the same pair key was true (a `Map` of the last 256 answers keyed by rounded endpoints).

- [ ] **Step 1: Write the failing tests** (a fixture `world`: `heightAt = (x, z) => 0.1 × x`, `createSolids()` with a circle r 1 at (5, 0) and a box 2 × 0.5 yawed 0.3 at (0, 5) with `top: 1`, a floor disc r 3 at y 4 over (10, 10), `reach: 32`): `the ground is where heightAt says` (`q.floorAt(8, 0).y ≈ 0.8` within 0.15); `a ray meets the circle and the box`; `a bolt over the low box passes` (ray at y 1.5 across the box: null); `the floor disc is a floor at y 4`; `seesThrough is false across the circle and true beside it`; `toggle('gate', false) lets a ray through a tagged box`; `a refused sight ray keeps its last answer` (set the budget to `{ rays: 1 }`, ask twice).
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/surface/surfacePhysics.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `surfacePhysics.js`.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(surface): the surface’s solids and ground as a Rapier world`.

### Task 13: the player on the controller (`playerBody.js`)

**Files:**
- Create: `src/components/galaxy/surface/playerBody.js`
- Modify: `src/components/galaxy/surface/walker.js` (extract `walkIntent` from `walk`; `walk` keeps its API and calls it), `src/components/galaxy/surface/scene.js` (make `sp` in `create` after `world`; the walk phase steps the player body; `?body=walker` keeps the old path)
- Test: `src/components/galaxy/surface/playerBody.test.js`, `src/components/galaxy/surface/walker.test.js` (unchanged, must pass)

**Interfaces:**
- Consumes: Task 6’s `createCharacter`, Task 12’s `sp`, the walker’s `WALK`, `walker(x, z, y, yaw)` state shape.
- Produces:
  - `walker.js`: `walkIntent(s, input, dt, rules = WALK) → { vel: { x, z }, face, jump }`: the camera-relative stick, the walk/run speed with `accel`, the turn to face travel, Shift to run, the jump press (`true` or a `createPress`) → `jump: rules.jump` when asked; pure; `walk` is now `walkIntent` + the old ground and solid code (no behaviour change: `walker.test.js` passes unchanged).
  - `createPlayerBody(sp, st, { rules = WALK }) → pb`: `pb.c` (a character of `radius: rules.radius`, `halfHeight: 0.5`, placed at `st`), `pb.step(input, dt)` (holds the intent for the substep hook: `walkIntent(st, input, dt)`, with the hook registered on `sp.phys.onSubstep` in `create` and removed in `dispose`), `pb.sync(st)` (writes `c.position` interpolated by `sp.phys.alpha` between `c.prev` and now into `st.x/y/z`, `c.yaw` into `st.yaw`, `c.grounded` into `st.grounded`, `c.vy` into `st.vy`, so everything downstream that reads the walker state is unchanged), `pb.teleport(x, y, z, yaw)`, `pb.knock(v)`, `pb.dispose()`.
  - `scene.js`: in `create`, `const sp = new URLSearchParams(location.search).get('body') === 'walker' ? null : await createSurfacePhysics(world, { tier })` after the solids are built (after `placer` has placed; `placer`’s late solids go through `sp.addSolid` by a `world.solids.onAdd` hook added in `createSolids`: `onAdd(fn)`, called from `put`); in the `walk` phase, where `walk(me().st, input, dt, world)` is called: `sp ? (pb.step(input, dt), sp.step(dt), pb.sync(me().st)) : walk(...)`; respawn and landing go through `pb.teleport`. `preload()` is called where the surface starts loading.

- [ ] **Step 1: Write the failing tests** in `playerBody.test.js` (the fixture world of Task 12): `walking forward for a second moves the state 3.3 m` (within 0.2); `the state stops at the circle` ; `a jump leaves the ground and lands`; `sync interpolates: two syncs a frame apart differ by at most one substep’s motion`; `teleport places and clears the knock`.
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/surface/playerBody.test.js src/components/galaxy/surface/walker.test.js`. Expected: FAIL on the new file.
- [ ] **Step 3: Implement** `walkIntent`, `playerBody.js`, the `onAdd` hook in `createSolids`, and the `scene.js` wiring.
- [ ] **Step 4: Run** the two tests and `npx vitest run src/components/galaxy/surface`. Expected: PASS.
- [ ] **Step 5: Walk it.** `npx vite --port 5188`, then `scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /galaxy/tatooine/surface` and in a browser `?quality=mid#/galaxy/tatooine/surface`: walk into a hut, jump a crate, fall off a ledge; then `?body=walker` for the old path; both must feel the same. Note what differs in the handoff.
- [ ] **Step 6: Commit** `feat(surface): the player walks on the Rapier character`.

### Task 14: hostiles on characters, with minds and hurtboxes (`hostileBodies.js`)

**Files:**
- Create: `src/components/galaxy/surface/hostileBodies.js`
- Modify: `src/components/galaxy/surface/activity.js` (a target gains `hb` (its body, hurtboxes, rig and mind in one); the per-frame move at lines ~787–830 reads the body; `stagger` and `knock` go through the mind and the body), `src/components/galaxy/surface/duellists.js` (`stun` → `mind.on('struck')`), `src/components/galaxy/surface/hostiles.js` (`hostileStep` unchanged; `walkTo` unchanged)
- Test: `src/components/galaxy/surface/hostileBodies.test.js`, `activity.test.js`, `duellists.test.js` (must pass)

**Interfaces:**
- Consumes: Task 6, 7, 8, 11, 12; `hostileStep(t, world, dt, r) → { x, z, yaw, mode, moving, aim }`; `duelStep`.
- Produces:
  - `createHostileBody(sp, t, { rigged: root | null, tall }) → hb`: a character (`radius: 0.38 × scale`, `halfHeight` from `tall`), a rig (`createHitboxRig(root, null)` when rigged, then hurtboxes `single: rig.single`, `rig.attach`), a mind (`createMind(STATES, { start: t.spec.still ? 'patrol' : 'patrol', seed, rate: rateFor(dist) })`) whose `bb` carries `t` and the callbacks: `bb.inReach` (Task 3’s reach sweep of the blade or a 1.2 m ball for melee; for a shooter, `hostile.range`), `bb.attack(bb, w, dt)` → an intent from `hostileStep`’s result (`vel` = `(x − b.x, z − b.z) / dt` clamped to the pace, `face: yaw`, `mode`) for a shooter, from `duelStep`’s `move` and `face` for a duellist; `chase` and `search` likewise map `hostileStep`’s `close`/`look`/`search` modes (`hostileStep` stays the planner inside the states, so nothing it does is lost).
  - `hb.step(dt, w)`: `rig.update()` (bones from the last animator update), `mind` ticked (`mindStep`), the intent held for the substep hook (`sp.phys.onSubstep` registered once for all hostiles in `activity.js`: `for (const t of targets) t.hb?.move(dt)`), `hb.sync()` → writes `t.b.x/z/yaw` from the character (interpolated) so `activity.js`’s drawing reads them as before.
  - `hb.struck({ dir, force, kind, stun })`: `c.knock(dir × force)`, `mind.on('struck', { stun, kind })`, and for `lethal` `mind.on('dead')`; `activity.js`’s `stagger(t, secs)` and `stun(t, …)` call it; `t.stagger` is read from `mind.state === 'stunned'` for the posture code; `t.knock` from `c.knock`’s magnitude over 1.
  - `rateFor(dist)`: 10 Hz under 25 m, 4 Hz under 60 m, 1 Hz beyond (the spec’s rings), re-read every second.
  - `hb.dispose()`.
  - `activity.js`’s `world` for `hostileStep` gets `seesThrough: sp.seesThrough` (the Rapier ray) in place of `lineClear`.

- [ ] **Step 1: Write the failing tests** in `hostileBodies.test.js` (the fixture world, an unrigged target `t` as `activity.js` makes one, `hostile: { range: 20, chase: 4, melee: true, reach: 1.6 }`): `a hostile that cannot see you patrols` (`w.you` behind the circle: after 2 s the mind is `patrol`); `one that sees you chases and closes to reach` (you 8 m away in the open: `chase` within 1 s, `attack` once within 1.6 m, never inside the circle solid); `struck light stuns for 0.3 s and knocks back` (`mind.state === 'stunned'`, the body moved along `dir`, back to chase after); `a lethal strike makes it dead and it stops moving`; `rateFor`’s rings.
- [ ] **Step 2: Run** `npx vitest run src/components/galaxy/surface/hostileBodies.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `hostileBodies.js` and the `activity.js` / `duellists.js` wiring (behind `sp`: with `sp` null every target runs the old path).
- [ ] **Step 4: Run** `npx vitest run src/components/galaxy/surface`. Expected: PASS, every file.
- [ ] **Step 5: Watch it.** The dev hook `window.__SURFACE__`’s `activity.debug()` shows `mode` and `body`; on Tatooine’s trooper quest, a trooper loses you behind a hut, searches, finds you. Note what differs.
- [ ] **Step 6: Commit** `feat(surface): the hostiles move on Rapier characters with minds and bone-mapped hurtboxes`.

### Task 15: strikes, bolts and the aim through Rapier

**Files:**
- Modify: `src/components/galaxy/surface/saber.js` (the sweep at ~line 402: a `strike` per stroke against `hurtbox` with `stepStrike`, the blade’s pose from `rig.blade()` or the hilt as now), `src/components/galaxy/surface/solids.js` (`boltSolids(world, { sp })`: when `sp`, `(a, b) => sp.q.ray(...)` against `filterOf('floor','object')`), `src/components/galaxy/surface/boltPlay.js` (the bodies list gains `tag`: a capsule per hurtbox region from `t.hurt` for the rigged, `capsuleOf` for the rest; bolt.js is unchanged), `src/components/galaxy/surface/activity.js` (`struckBy`/`hurt` → `damage.resolve` → `hb.struck`), `src/components/galaxy/surface/aimShot.js` (the camera ray through `sp.q.ray` when `sp`)
- Test: `saber.test.js`, `solids.test.js`, `boltPlay.test.js`, `aimShot.test.js` (existing; the `sp` path added as cases with the fixture world)

**Interfaces:**
- Consumes: Tasks 3, 9, 10, 14.
- Produces: one damage path: every hit on a hostile (`saber`, a bolt, a Force push) becomes `resolve(hit, attack, t)` and `t.hb.struck(result)`; the HUD’s `combat` event carries `where` (the region) so a headshot can read as one later.

- [ ] **Step 1: Add the failing cases**: `solids.test.js`: `with sp, a bolt stops at the circle at the same point as without` (within 0.1); `boltPlay.test.js`: `a bolt through a rigged figure’s head reports tag head`; `saber.test.js`: `a stroke through a hostile’s chest lands once with where chest`; `aimShot.test.js`: `with sp the aim point on the hut matches the old solids within 0.1`.
- [ ] **Step 2: Run** them. Expected: FAIL on the new cases.
- [ ] **Step 3: Implement** the wiring.
- [ ] **Step 4: Run** `npx vitest run src/components/galaxy/surface src/lib/combat`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(surface): strikes, bolts and the aim through Rapier`.

### Task 16: the sheet, the counters, the docs, and the flag goes

**Files:**
- Create: `scripts/hurtbox-sheet.mjs` (headless Chromium on `?debug&quality=mid#/galaxy/tatooine/surface`, `rig.debug` on for every hostile, a screenshot to `docs/superpowers/evidence/rapier-body/hurtboxes.png`), `docs/decisions/2026-10-09-rapier-as-the-body.md`, `docs/superpowers/HANDOFF-rapier-body.md`, `docs/superpowers/evidence/rapier-body/README.md`
- Modify: `src/components/galaxy/surface/scene.js` (`tune()` gains a `physics` group: `sp.q.stats()`, the substeps a frame, the think rates; the `?body=walker` branch removed), `docs/stack/physics-rapier.md` (“Where it is used”, the new modules, the gotchas learned), `docs/architecture.md` (one paragraph under the galaxy surface), `docs/health/budgets.json` only if `health.mjs` reports a budget crossed
- Test: `src/components/galaxy/surface/scene.test.js` if one exists for `tune`; `docs/stack/stack.test.js` (must pass)

- [ ] **Step 1: Write the decision entry** in the format of `docs/decisions/2026-10-09-ship-contact.md` (Context, Decision, Consequences, Revisit when) from the spec’s Decisions.
- [ ] **Step 2: Remove the flag** and the old walk path on the surface (`walk` stays exported for the universe’s foot); run `npx vitest run src/components/galaxy/surface`.
- [ ] **Step 3: Run the sheet** and `node scripts/perf-probe.mjs` on the surface with the trooper quest up; put the numbers in the evidence README against the spec’s table.
- [ ] **Step 4: Update the stack page, the architecture page, the handoff** (what was done, what differs in feel, what is left: the ground war, the armies, the chase, the mate, the next worlds).
- [ ] **Step 5: The lane’s checks**: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build && node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /galaxy/tatooine/surface,/galaxy/hoth/surface`. Expected: all pass.
- [ ] **Step 6: Commit** `docs: Rapier as the body: decision, handoff, evidence; the surface’s old walk path goes`.
