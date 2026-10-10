# Aboard the Death Star: the cast made right — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Old Ben in the station, every figure rigged and animated from what it is doing, bodies that fall as ragdolls, nobody standing inside anybody, and the way to each objective shown.

**Architecture:** Rules stay pure and tested (`rules/`): placement, separation, seated posts, the route. The scene (`scene/figures.js`, `scene/people.js`) moves its figures onto the shared `lib/three/animator.js` and maps each person’s state to clips; a new pure `lib/three/ragdollPhysics.js` drops the dead. Two offline scripts make old Ben (`scripts/meshy-deathstar.mjs`, `scripts/rig-transfer.mjs`).

**Tech Stack:** three.js r17x, Vitest, gltf-transform, meshoptimizer, Playwright (headless Chromium on Metal) for checks.

**Spec:** `docs/superpowers/specs/2026-10-08-deathstar-cast-design.md`

## Global Constraints

- British spelling, curly quotes in copy, comments that say why; files under 800 lines; no TODO notes.
- Rules pure (no three.js, no DOM), seeded where random, tested beside each file.
- Every model through `lib/three/gltf.js`; nothing calls Meshy at runtime; every asset committed and credited (`public/games/credits.json`, `pack.js` PACK.urls).
- Don’t edit `src/lib/three/clipLibrary.js` (open branch `claude/npc-architecture-3j0s5p` rewrites it).
- Budget: draw calls 600, triangles 1.5 M a frame (`scripts/deathstar-check.mjs`); animated people per tier 24/24/14/8.

## Review Focus

1. A body that dies on a ledge, a lift or in the chasm must not hang in the air or sink into the deck — ragdoll test: points come to rest on the floor under them and fall into a void.
2. A figure whose clips fail to load must still stand (the capsule stand-in) and never throw in a frame.
3. Companions placed in a tiny room (the hold) must land on its floor, apart — placement test in the hold.
4. Separation must never push a person through a wall or a shut door — separation test against a wall segment.
5. The route marker for a target on another level must point at the lift, not through the floor — route test across `lift1-l2` → `lift1-l5`.

---

### Task 1: Old Ben, made and rigged

**Files:** Modify `scripts/meshy-deathstar.mjs`, `scripts/meshy-deathstar.test.mjs`; create `scripts/rig-transfer.mjs`, `scripts/rig-transfer.test.mjs`; output `public/models/deathstar/obiwan.glb`; modify `public/games/credits.json`.

**Interfaces:** Produces `transferWeights(donor, target, { k })` (pure: donor `{ positions: Float32Array, joints: Uint16Array, weights: Float32Array }`, target positions → `{ joints, weights }`), and the CLI `node scripts/rig-transfer.mjs <donor.glb> <mesh.glb> <out.glb> [--height m]`.

- [x] Test: ASSETS has `obiwan` (1.78 m, donor jedi3, `nano-banana` + `meshy-6-lite`, 18 credits); prompt free of names.
- [x] Concept (3 credits) and model (15 credits).
- [ ] Test `transferWeights`: a vertex on a donor vertex takes its weights; weights sum to 1; at most four joints; a vertex between an arm and a leg donor vertex takes the nearer.
- [ ] Implement: kNN (k 8) over a uniform grid, inverse-square distance, normals agreeing (dot > 0) preferred; one smoothing pass over shared positions; top four, normalised.
- [ ] CLI: read donor (meshopt decoded, `dequantize()`), its bind-space positions; target scaled to the donor’s height, centred, feet level; write the donor document with the target’s geometry and material; textures WebP 2048; meshopt.
- [ ] Look: lab lineup idle, walk, run, sword, die; fix what tears.
- [ ] Commit.

### Task 2: Mixamo figures play the crew’s clips

**Files:** Create `src/lib/three/retargetMixamo.js`, `src/lib/three/retargetMixamo.test.js`; modify `scene/figures.js`.

**Interfaces:** `mixamoName(meshyName) → string | null`; `retargetToRig(clip, sourceRest, targetRest) → AnimationClip` where each rest is `{ [boneName]: { world: Quaternion, local: Quaternion, parent: name | null } }`; `restOf(root) → rest`.

- [ ] Test: identity rest on both sides gives the clip back; a source bone turned 90° at rest about y, target not: the target’s track is the source’s delta in the world.
- [ ] Implement world-space carry: `Rt(t) = Rs(t) · Rs⁻¹rest · Rt rest`, made local by the target parent’s animated world turn, bones in hierarchy order; the hips’ height scaled.
- [ ] figures.js: a model with `mixamorig` bones gets its clips through this, against a reference Meshy rest (the officer’s, loaded once).
- [ ] Lab: C-3PO idles, walks, sits, falls. Commit.

### Task 3: Dyes

**Files:** Modify `rules/cast.js` (+ test), `scene/figures.js`.

- [ ] Test: `CAST.dstrooper.dye` and `CAST.royalguard.dye` set; no `tint` on either.
- [ ] Implement `dyed(material, hex, { keep })`: `onBeforeCompile` replaces `diffuseColor.rgb` with the dye’s hue at the texel’s luminance (keep: how much of the original colour remains).
- [ ] Lab: trooper charcoal with sheen, guard crimson. Commit.

### Task 4: Figures on the animator

**Files:** Modify `scene/figures.js` (person API unchanged + `base`, `pose`, `look`, `down`), `scene/people.js` (`clipFor` → `actOf`), `scene/index.js` (player crouch, jump, strafe); tests `scene/figures.test.js`, `scene/people.test.js`.

**Interfaces:** `actOf(person) → { base: 'crouch' | 'sit' | null, loop: name | null, shot: name | null, raised }` pure; person `pose(act)` applies it.

- [ ] Test `actOf`: `attention` → stance loop; `work` → typing loop; `talk` → talk loop; `sit` → base sit; `shoot` while moving → upper `shoot`; `hit` from behind → `hit.knock`… ; a sabre fighter’s stroke → `sword.*`; the Force’s target → `lifted` / `electrocuted`.
- [ ] Implement on `createAnimator` with `locomote({ move, speed, side, turn })` from the track.
- [ ] Lab and in game. Commit.

### Task 5: The ragdoll

**Files:** Create `src/lib/three/ragdollPhysics.js` (+ test); modify `scene/people.js`, `scene/index.js`.

**Interfaces:** `createBody(points, sticks, { floor(x, z, y) → y | null, walls: [{ x0, z0, x1, z1 }] })` → `{ step(dt), points }`; `rigRagdoll(bones, world) → { start(push), step(dt), done }`.

- [ ] Tests: sticks keep length within 2 %; a body dropped from 1 m comes to rest on y = 0; a point pushed at a wall stays on its side; with `floor` null under it the body falls on; elbows never bend past the cone.
- [ ] Implement Verlet (substeps 4, iterations 6), friction on the floor, sleep when still.
- [ ] Scene: on `dead`, 0.25 s hit clip, then the ragdoll with the shot’s direction; bodies kept; player too.
- [ ] Browser: front, back, side shots, chasm. Commit.

### Task 6: Nobody inside anybody

**Files:** Modify `rules/play/plot.js` (companion placement), `rules/brains.js` or `rules/routines.js` (separation), `rules/play/garrison.js` (seat posts sit), tests beside each.

- [ ] Tests: five companions in the hold each on its floor, ≥ 0.6 m apart and from you; two people at one spot end ≥ 0.55 m apart after 1 s, neither through a wall; a post on a `sit` spot poses `sit`.
- [ ] Implement. Commit.

### Task 7: The way shown

**Files:** Create `rules/route.js` (+ test); modify `module.js` (route in the `hud` event), `ui/Hud.jsx`, `ui/Map.jsx`, `inside.css`; a first-time controls card in `ui/Start.jsx` / `Hud.jsx`.

**Interfaces:** `routeTo(g, target) → { next: { x, y, z }, at: { x, y, z }, room, metres } | null`.

- [ ] Tests: same room → next is the target; through a door → next is the door; another level → next is the lift.
- [ ] HUD marker projected through the camera each frame (module passes screen x, y, behind), edge arrow when off screen; map draws the route.
- [ ] Commit.

### Task 8: Proof

- [ ] Browser bot over each story’s first beats; lineup screenshots; deathstar-check over every room.
- [ ] Gates: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/pack-check.mjs`.
- [ ] Hand-off updated; PR; merge once green.
