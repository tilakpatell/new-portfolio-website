# Battlefront 2017 physics, lane P2: bolts, blasts, hit zones and ragdolls. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** Everything that flies, explodes, hits a body or falls dead on a galaxy surface takes its numbers from the game: a projectile’s speed, gravity, drag and life; a blast’s radii and impulses; a figure’s hit capsules by bone; the fifteen-body ragdoll; all as pure libraries the surface and the Battlefront game both call.

**Architecture:** Three rulebooks (`projectiles.json`, `bones.json`, `ragdoll.json`) built by named exports in `scripts/lib/bf2017-physics-rules.mjs`. `lib/combat/ballistics.js` advances a bolt by its row; `bolt.js` gains an optional `ballistic` and otherwise flies as today. `lib/physics/blast.js` impulses bodies and kicks ragdolls. `lib/physics/boneCapsules.js` reads the game’s capsules off a figure that carries the game’s bone names (lane 1’s); `hurtbox.js` returns for Meshy figures. `lib/three/ragdoll2017.js` builds `ragdollPhysics.js`’s points and sticks from the fifteen bodies.

**Tech Stack:** Node 22, Vitest (the engine in Node for `blast`), `src/lib/combat/bolt.js`, `src/lib/three/ragdollPhysics.js`, `src/lib/physics/world.js`, lane 0’s parser when on `main`.

**Spec:** `docs/superpowers/specs/2026-10-10-bf2017-physics-design.md` (§3, §6, §7, §8).

## Global Constraints

- Phase 0’s, P0’s and P1’s Global Constraints (the records at the bucket root as `data/<Name>.json.gz`; sources on every leaf; the library pure).
- **Files this lane owns**: the builders `projectileRow`, `projectileRulebook`, `boneSetRow`, `ragdollRow` in `scripts/lib/bf2017-physics-rules.mjs` (named exports; P1 creates the file: if P1 is not on `main` yet, create it with your exports and merge theirs after), `src/data/bf2017/physics/{projectiles,bones,ragdoll}.json`, `src/lib/combat/ballistics.js` (+ test), `src/lib/physics/blast.js` (+ test), `src/lib/physics/boneCapsules.js` (+ test), `src/lib/physics/hurtbox.js` (+ test, from `origin/claude/wizardly-franklin-ws9uza`), `src/lib/three/ragdoll2017.js` (+ test), `scripts/fixtures/bf2017/data/Gameplay/Equipment/**` (two projectile cuts), `.../Characters/DefaultSoldierBoneCollision.json` (cut), `.../Characters/StormTrooperShared.json` (cut to the physics component). It changes `bolt.js` by the optional `ballistic` only (its tests stay green), and `blaster.js`/`boltPlay.js` by the ray when a physics world exists (a dozen lines); it does not touch `walker.js`, the figures, the saber, or any site file.
- Sequel-era projectiles and bone sets (`isSequel`) are refused and counted.
- Files under 800 lines; British spelling and curly quotes in prose; commits one plain sentence with the session’s attribution lines; merge commits, never force-push. Before the PR: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Review Focus

1. **A bolt with gravity 0 flies exactly as before**: `ballistics.flight` with `gravity 0, drag 0` must give the same positions as `bolt.js`’s `speed · dt`; `bolt.test.js` is untouched and green, and `ballistics.test.js` compares the two over 60 steps to 1e-9.
2. **Drag is per second, applied over `dt`**: `v *= Math.exp(-drag · dt)`, not `v *= 1 - drag` once a frame; the test runs the same flight at 1/30 and 1/120 and asserts the landing point within 1 cm.
3. **A blast through a wall**: `applyBlast` checks a line of sight to each body (the world’s ray) when `occlusion` is on, as `ExplosionEntityData.MaxOcclusionRaycastRadius` means; a body behind a solid takes nothing; the test puts a box between.
4. **Capsule axis**: `BoneAxis` says which bone axis the capsule lies along, and `CapsuleOffset` is in the bone’s frame; the head capsule must sit on the head, not beside it; `boneCapsules.test.js` builds a two-bone skeleton with known matrices and asserts the ends.
5. **The ragdoll’s impulse cap**: a blast of 500 N·s on a 70 kg body is capped by `maxImpulse` 1000 and decays over `impulseLifetime`; a figure kicked twice in a frame does not fly; the test kicks and asserts the first step’s displacement under a bound.

---

### Task 1: The projectile rulebook and `ballistics.js`

**Files:**
- Create: fixtures (cut) `BlasterProjectile_Pistol_Sidearm_StunAltFire.json`, `Grenades/Impact/Impact_Projectile.json`; the builders; `src/data/bf2017/physics/projectiles.json`; `src/lib/combat/ballistics.js`, `ballistics.test.js`
- Modify: `src/lib/combat/bolt.js` (`spec.ballistic?: row`; when set, `step` moves the bolt by `flight` and keeps the segment test; `events` unchanged), `src/data/bf2017/physics/NOTES.md`

**Interfaces:**
- Produces: `projectileRow(asset) → { id, kind, speed (InitialSpeed), maxSpeed, gravity, drag, ttl (TimeToLive), engineTtl, damping (ExtraDamping), impactImpulse, damage, body: { mass, restitution, friction }, blast: { inner, radius, impulse, damage, shockRadius, shockImpulse, occlusionRadius } | null, detonate: { onCollision, onTimeout, nearTarget: { radius, minDelay, maxDelay } | null }, _source }`; `projectileRulebook(root) → { rows }` over the 114; `flight(row, bolt, dt)` (velocity under gravity and drag, clamped to `maxSpeed`, life counted against `ttl`) → `{ gone }`; `arc(row, from, dir, speed) → [[x, y, z]...]` (the closed-form arc for a thrown grenade’s aim line).

- [ ] **Step 1: Failing tests**: the stun fixture gives `kind 'missile'`, speed 8000, maxSpeed 1000, gravity 0, ttl 3, impactImpulse 50, blast radius 2 with impulse 500 and shock 5; the grenade fixture a `body.mass`; Review Focus 1 and 2; a bolt over `ttl` reports `gone`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; build the rulebook from the fetched records (expect under 150 KB; refused names counted in `NOTES.md`). **Step 4: Run** → PASS; `bolt.test.js` green.
- [ ] **Step 5: Commit** `A bolt flies by its projectile’s row: speed, gravity, drag and life, from the game`.

### Task 2: Blasts

**Files:**
- Create: `src/lib/physics/blast.js`, `blast.test.js`

**Interfaces:**
- Produces: `applyBlast(physics, at, row, { occlusion = true, bodies = physics.awake, ragdolls = [], ray }) → { hit: [{ body, impulse, distance }], kicked: [...] }`: every body within `row.blast.radius` takes `impulse × falloff` (1 inside `inner`, to 0 at `radius`) along the line from `at`; every ragdoll within `shockRadius` is kicked by `shockImpulse × falloff` through its `kick`; a body behind a solid (the ray from `at` to its centre) takes nothing when `occlusion`.

- [ ] **Step 1: Failing tests** (the engine): a crate at the inner radius takes the full impulse (its velocity after a step matches impulse / mass within 5%), one at the edge none, one behind a wall none; a ragdoll stub’s `kick` is called with the shock impulse.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A blast shoves what stands in its radius and kicks what has fallen, by the game’s numbers`.

### Task 3: Hit zones

**Files:**
- Create: `src/lib/physics/hurtbox.js` (+ test, from the #781 branch, as it was), the builder `boneSetRow`, `src/data/bf2017/physics/bones.json`, `src/lib/physics/boneCapsules.js`, `boneCapsules.test.js`, the fixture cut of `DefaultSoldierBoneCollision`
- Modify: `src/components/galaxy/surface/blaster.js` or `boltPlay.js` (`capsulesOf(figure)` picks `boneCapsules` when the figure’s skeleton has the game’s names (`Head`, `Spine`, … from lane 1’s rig) and `hurtbox.js`’s regions otherwise)

**Interfaces:**
- Produces: `boneSetRow(asset) → { id, bones: [{ bone, length, radius, offset: [x, y, z], axis, reaction, hiLod, lowLod, material }], aimAssist: [...] }`; `capsulesOf(bones: { name: { matrixWorld } }, set, { lod = 'hi' }) → [{ a, b, r, region: bone, reaction }]` in `bolt.js`’s body form; `regionOf(reaction) → 'head' | 'chest' | 'limb'` for `lib/combat/damage.js`’s resolver.

- [ ] **Step 1: Failing tests**: the fixture gives the head capsule r 0.16 length 0.045 with `HRT_Head`; Review Focus 4; the low-LOD set is fewer capsules than the hi set; a figure without the game’s names gets `hurtbox.js`’s ten regions.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `A figure on the game’s skeleton is hit where the game’s capsules say`.

### Task 4: The ragdoll

**Files:**
- Create: the builder `ragdollRow`, `src/data/bf2017/physics/ragdoll.json`, `src/lib/three/ragdoll2017.js`, `ragdoll2017.test.js`, the fixture cut of `StormTrooperShared`’s `WSEACharacterPhysicsComponentData`

**Interfaces:**
- Produces: `ragdollRow(asset) → { id, bodies: [{ bone, parent, shape, radius, length, mass? }], maxImpulse, impulseLifetime, dismemberment }`; `rig2017(bones, row, { collide, push, speed, velocity, gravity }) → ragdollPhysics.rigRagdoll’s return` (the points at the fifteen bodies’ bones, sticks along the parents, hinges at knees and elbows, the chest braced; `push` capped by `maxImpulse / mass`); `collide` from a physics world’s `floorAt` when given, else the height function (the surface passes what it has).

- [ ] **Step 1: Failing tests**: the fixture gives 15 bodies and `maxImpulse` 1000; `rig2017` on a 15-bone stub makes 15 points and the sticks; a kick over the cap is capped; after 6 s of steps on a flat `collide` the body is `settled` with every point at or above the floor.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The dead fall as the game’s fifteen bodies, on the game’s skeleton`.

### Task 5: The PR and the hand-off

- [ ] The surface uses it where it can without lane 1 (the player’s bolts take `ballistic` from the rifle row when `projectiles.json` has it, else as today; the ray from P0’s world when there is one); the gates; the lane’s section in `docs/superpowers/HANDOFF-bf2017-physics.md` (Done; Left: lane 1’s figures through `capsulesOf` and `rig2017`, the Battlefront sim’s use of `flight`); merge `origin/main`, push, PR `Bolts, blasts, hit zones and ragdolls from the game’s data`. Merge per the slot.
