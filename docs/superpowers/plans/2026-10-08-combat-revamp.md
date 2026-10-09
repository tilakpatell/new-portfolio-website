# Combat Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strokes that are clips and hits that are the blade; bolts that stop at the first solid and go where the crosshair is; a look that works on a mouse, a trackpad and a phone; enemies that fence and shoot like people.

**Architecture:** Pure rules in `src/lib/combat/` (no React, no three.js), three.js helpers in `src/lib/three/combat/`, the look controller and the reticle in `src/runtime/`; the galaxy surface, the universe's foot scene and the Rick and Morty worlds become callers. Clips drive strokes (UAL2's sword set, baked full-body with contact windows); code corrects the hand and decides the hit from the blade's swept segment.

**Tech Stack:** three.js r186 (`AnimationMixer`, `SkeletonUtils`), Rapier (already a dependency; the worlds' `solids` callback may raycast through it or through the world's own ground and props), Vitest, the existing `scripts/ual-bake.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-08-combat-revamp-design.md` (and its audit, `docs/research/2026-10-08-combat-feel-and-offline-motion.md`).

## Lanes

The plan is six lanes. Each lane is one session, one branch `claude/combat-<lane>` from `origin/main`, one pull request merged to `main` once CI is green (merge commit, never a rebase). Lanes A, B and C start together; D needs C; E needs A and B; G is a spike. Lanes touching `galaxy/surface/scene.js` (A, B, C, D) merge `origin/main` into their branch before every push and keep their edits to their own functions.

| lane | what | needs | files it owns |
| --- | --- | --- | --- |
| A | the look and the reticle | — | `src/runtime/look.js`, `src/runtime/hud/Reticle.jsx`, `src/lib/combat/aim.js`, the look wiring in `galaxy/surface/scene.js`, `universe/footScene.js`, `rickmorty/world/RmWorld.jsx`, the Menu's Look setting |
| B | bolts that obey the world | — | `src/lib/combat/bolt.js`, `accuracy.js`, `src/lib/three/combat/bolts.js`, `galaxy/surface/blaster.js`, `ground/bolts.js`, `ground/fight.js`, `hostiles.js`, `universe/foot.js` |
| C | strokes from clips, hits from the blade | — | `scripts/ual-bake.mjs`, `src/lib/three/clipLibrary.js`, `src/lib/combat/blade.js`, `src/lib/three/combat/trail.js`, `galaxy/surface/saber.js`, `combatRules.js`, the swing and saber paths in `scene.js` |
| D | duellists | C | `src/lib/combat/duel.js`, `galaxy/surface/activity.js`, `heldBlade.js`, the duellist spawns in `sites/*.js` |
| E | parity: the universe on foot, Rick and Morty, touch | A, B | `universe/footScene.js` (shots, view-model), `rickmorty/world/interiors/rickall.js`, `dimensions/duel.js`, `galaxy/surface/SurfaceView.jsx`, `RmHud.jsx` |
| G | the motion spike | — | `scripts/motion/` (new), `scripts/preview/ualRetarget.js` (a BVH map), the note in `docs/research/` |

## Global Constraints

- Layers: `src/lib` imports no React and no three.js; `src/lib/three` imports three.js and no world; `src/runtime` imports nothing from `src/components` (`docs/health/RULES.md`).
- A file stays under 800 lines; a new file that would push `scene.js` (3,556 lines) or `footScene.js` (3,618) further is split out, not added in.
- Pure rules in a tested module beside its test; a test runs under a second, no network.
- British spelling, curly quotes, plain sentences; comments say why, in the file's voice. No sequel-trilogy Star Wars.
- No runtime calls to asset services; every asset committed and credited.
- HUD parts come from `src/runtime/hud/` only; text over 3D sits on glass; a key is the house cap.
- The wire protocol only grows: new fields after the old, older readers unaffected (`universe/online/protocol.js`).
- Before a change is done: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`; for anything visible `node scripts/autopilot-check.mjs --routes <routes>` and look at the screenshots.
- No model names in commits or PRs; commit messages one plain sentence with the why in the body.

## Review Focus

1. A pointer lock refused (Safari in some states, an iframe, a `NotSupportedError` on `unadjustedMovement`) must fall back to drag without a thrown error: Lane A, Task A1's `request()` test with a host whose `requestPointerLock` rejects.
2. A trackpad's inertia or palm sends a 400 px `movementX` in one event; the camera must not whip round: Task A1's clamp test.
3. A bolt fired from a muzzle 0.3 m inside a wall (the figure pressed against it) must not hit the shooter or fly through: Task B1's `aimPoint` `min` test and the bolt test with a solid at 0 m.
4. A stroke's contact window must never be empty or outside the clip (a clip the hand barely moves in): Task C1's bake test clamps the window to `[0.05, duration − 0.05]` and asserts it.
5. A duellist whose target dies or teleports mid-combo must drop to `approach` and not swing at air for the rest of the clip: Task D1's test.

---

## Lane A: the look and the reticle

### Task A1: `src/runtime/look.js`

**Files:**
- Create: `src/runtime/look.js`, `src/runtime/look.test.js`
- Modify: `src/runtime/index.js` (export it)

**Interfaces:**
- Produces: `createLook({ host, win = window, onTurn, onButton, onLock, sensitivity = { yaw: 0.0022, pitch: 0.0018 }, mode }) → { attach(), detach(), request(), release(), locked (bool), mode, set(mode), prompt (string | null) }`. `mode` is `'lock' | 'drag' | 'touch'`; `defaultMode({ coarse, safariNoMouse })` picks `'touch'` for coarse, `'drag'` for Safari without a mouse, else `'lock'`. `prompt` is `"Click to look · Esc to release"` in `lock` mode while not locked, else `null`. Constants: `SPIKE = 60` (px, clamp per event), `RELOCK = 1.25` (s), `TP_LOOK = 'tp-look'` (localStorage key).

- [x] **Step 1: Write the failing tests** in `look.test.js` with a fake host (an `EventTarget` with `requestPointerLock`, `getBoundingClientRect`) and a fake document (`pointerLockElement`, `exitPointerLock`):

```js
test('a click in lock mode asks for pointer lock with unadjusted movement, then plainly when that is refused', …)
test('the first pointermove after locking is dropped; the next turns by movement × sensitivity', …)
test('a movement of 400 px is clamped to 60', …) // onTurn's dx is ±60 × 0.0022
test('a refused lock (the promise rejects) leaves mode "lock", locked false, prompt shown, and drag still turns', …)
test('Esc (pointerlockchange to null) calls onLock(false) and shows the prompt again; a click within 1.25 s does not re-request', …)
test('buttons while locked report onButton(0 | 2, down)', …)
test('drag mode turns by the pointer's drag from down to move', …)
test('touch mode never requests a lock and never turns', …)
test('defaultMode: coarse → touch, Safari with no mouse → drag, else lock; set(mode) is kept under tp-look', …)
```

- [x] **Step 2: Run them** — `npx vitest run src/runtime/look.test.js` — expected: FAIL, module not found.
- [x] **Step 3: Implement `look.js`** with the header comment in the runtime's voice (what it does, the signature, the modes). `request()` calls `host.requestPointerLock({ unadjustedMovement: true })`, catches `NotSupportedError` and retries without options; any other rejection sets nothing and resolves. Read `movementX/Y` from `pointermove` only.
- [x] **Step 4: Run** `npx vitest run src/runtime/look.test.js` — PASS.
- [x] **Step 5: Commit** — `git commit -m "The look: pointer lock for a mouse or a trackpad, drag and touch as fallbacks"`.

### Task A2: `src/lib/combat/aim.js`

**Files:**
- Create: `src/lib/combat/aim.js`, `src/lib/combat/aim.test.js`

**Interfaces:**
- Produces: `aimPoint(ray, solids, targets, { min = 1.5, max = 120 }) → { at: [x,y,z], target: T | null, dist }` where `ray = { from: [x,y,z], dir: [x,y,z] }`, `solids(from, to) → { at, normal } | null`, `targets = [{ id, a: [x,y,z], b: [x,y,z], r, ref }]` (capsules). `assist(dir, from, targets, cone) → dir'`; `friction(dir, from, targets, cone) → 1 | 0.55`; `lead(target, vel, from, speed) → [x,y,z]`; `ASSIST = { mouse: { inner: 0.02, outer: 0.05, cap: 0.01 }, pad: { inner: 0.05, outer: 0.14, cap: 0.03 }, touch: { inner: 0.09, outer: 0.21, cap: 0.05, snap: true } }`; `coneFor({ coarse, mode }) → ASSIST.touch | pad | mouse` (coarse → touch; mode `'drag'` → pad; else mouse). Vector maths as plain arrays (no three.js).

- [x] **Step 1: Write the failing tests**:

```js
test('aimPoint stops at a solid before a target and at a target before a solid', …)
test('aimPoint never returns a point nearer than min 1.5 m ahead, with a solid at 0.3 m', …)
test('assist bends a direction 0.03 rad off a target fully inside inner 0.02… no: 0.015 rad off → onto the target; 0.04 rad off → part way; 0.06 rad off → unchanged (mouse cone)', …)
test('assist bends at most cap radians in one call', …)
test('friction is 0.55 with a target inside outer and 1 otherwise', …)
test('lead meets a target walking 2.3 m/s across at 30 m with a bolt at 90 m/s (the bolt arrives within 0.05 m of the target then)', …)
test('coneFor picks touch on coarse, pad for drag, mouse otherwise', …)
```

- [x] **Step 2: Run** — FAIL. **Step 3: Implement.** `lead` solves the quadratic for the meeting time and falls back to the target's position when there is no real root. **Step 4: Run** — PASS. **Step 5: Commit** — `"Where a shot goes: the aim point, the assist's cones, friction, lead"`.

### Task A3: `src/runtime/hud/Reticle.jsx`

**Files:**
- Create: `src/runtime/hud/Reticle.jsx`, `src/runtime/hud/reticle.css` (or rules in `hud.css`), `src/runtime/hud/reticle.test.js` (its rules: `reticleState`)
- Modify: `src/runtime/hud/index.js`

**Interfaces:**
- Produces: `<Reticle state={{ shown, tight (0…1), hit (ms since a hit | null), locked (bool) }} />`, drawn at the centre, four ticks that close with `tight`, a flash on `hit`, a ring when `locked`; `reticleState(prev, { gun, sights, hitAt, now, lock })` pure.

- [x] **Step 1: Write `reticle.test.js`** (`reticleState`: shown while `gun`; `tight` 1 with sights; `hit` set for 180 ms). **Step 2–4:** FAIL, implement, PASS. The part is pointer-events none; it reads `--hud-*` tokens; nothing under 0.7 rem. **Step 5: Commit.**

### Task A4: wire the galaxy surface

**Files:**
- Modify: `src/components/galaxy/surface/scene.js` (`down`/`move`/`up` at 976–1031, `look()`, `fire` at ~1700, `pickLock`), `src/pages/GalaxySurface.jsx` (the Menu's Look item, the Reticle in place of `.surface-crosshair`), `src/components/galaxy/surface/surface.css` (remove `.surface-crosshair`).

**Interfaces:**
- Consumes: A1's `createLook`, A2's `aimPoint`, `assist`, `friction`, `coneFor`, A3's `Reticle`.

- [x] **Step 1:** Replace the drag handlers with `createLook({ host, onTurn: look, onButton })`; `onButton(0, true)` → `fire()` with a gun or `swing()` with a saber (the existing functions), `onButton(2, down)` → `state.ads = down` with a gun, the block with a saber. `look()`'s sensitivity is multiplied by `friction(...)`. The Menu gets Look: Click to lock / Drag (`look.set`). The kit's `Prompt` shows `look.prompt`.
- [x] **Step 2:** The shot's direction: `aimPoint` from the camera's ray with the world's ground (`groundAt`) as `solids` until lane B lands (then B's `world.solids`), `assist` by `coneFor`; the bolt still goes through `blaster.fire` from the muzzle to `at` (its `end`).
- [x] **Step 3:** `Reticle` shown whenever `state.aim > 0` or a gun is up, `tight` from `state.ads`, `hit` from the `hit` event, `locked` from `state.lock`.
- [x] **Step 4:** `node scripts/autopilot-check.mjs --routes '/galaxy/tatooine'` (the route the handoff names) — green, and the screenshot shows the reticle. Also `--phone`.
- [x] **Step 5: Commit** — `"The galaxy surface looks by pointer lock, fires on the button and shows its reticle"`.

### Task A5: wire the universe foot scene and Rick and Morty

**Files:**
- Modify: `src/components/universe/scene.js` (5297: the mouse-only drag), `src/components/universe/footScene.js` (`look`, the reticle at 3431), `src/components/rickmorty/world/RmWorld.jsx` (1518–1537), `RmHud.jsx` (its crosshair → `Reticle`).

- [x] **Step 1:** The same `createLook` in each; left button fires where it fired; Total Rickall's click-to-shoot becomes `onButton(0)`. **Step 2:** `autopilot-check` on a universe planet route and `#/c-137` (Total Rickall); screenshots. **Step 3: Commit.**

### Task A6: the lane's handoff and PR

- [ ] Write `docs/superpowers/HANDOFF-combat.md` (Done with PR numbers, Left, Checking it: the routes, `?quality=mid`, how to force drag mode, that a trackpad was or wasn't tried by hand). Add the stack of checks. Open the PR to `main`; merge when CI is green.

## Lane B: bolts that obey the world

### Task B1: `src/lib/combat/bolt.js`

**Files:**
- Create: `src/lib/combat/bolt.js`, `src/lib/combat/bolt.test.js`

**Interfaces:**
- Produces: `createBolts({ pool = 48 }) → { fire(spec) → bolt, step(dt, world) → events[], live() → bolt[] }`. `spec = { from, dir, speed = 90, range = 120, owner, side ('you' | 'them' | 'none'), damage, colour, deflect = false }`. `world = { solids(a, b) → { at, normal } | null, bodies: [{ id, a, b, r, side, ref }], blades: [{ id, base, tip, r, side, ref }] }`. Events: `{ type: 'hit', bolt, body, at }`, `{ type: 'solid', bolt, at, normal }`, `{ type: 'deflect', bolt, blade, at }`, `{ type: 'gone', bolt }`. Geometry helpers exported: `segCapsule(a, b, ca, cb, r) → { t, at } | null`, `segSeg(a, b, c, d) → { s, t, dist }`.

- [x] **Step 1: Write the failing tests**:

```js
test('a bolt stops at a solid 10 m ahead and reports its point and normal', …)
test('a bolt through a 0.3 m gap between two capsules passes', …)
test('a bolt crossing a capsule within r hits it once and is gone', …)
test('a bolt does not hit a body on its own side', …)
test('a bolt marked deflect crossing a raised blade within r is turned back along its line, its side swapped, and then hits its shooter's capsule', …)
test('a bolt flies no further than range and reports gone', …)
test('the pool reuses a dead slot before the oldest live one', …)
test('a solid at 0 m (the muzzle inside a wall) ends the bolt at the muzzle without hitting the shooter', …)
```

- [x] **Step 2: Run** — FAIL. **Step 3: Implement**, bodies tested nearest-first along the flown segment, solids first. **Step 4: PASS. Step 5: Commit** — `"A bolt's flight: swept against solids, capsules and blades, turned by a raised blade"`.

### Task B2: `src/lib/combat/accuracy.js`

**Files:**
- Create: `src/lib/combat/accuracy.js`, `accuracy.test.js`

**Interfaces:**
- Produces: `spread(range, { base = 0.02, perMetre = 0.0012, moving = false, suppressed = 1, first = false, streak = 0 }) → radians`; `scatter(dir, rad, rng) → dir'`; `shotStep(s, { hit }) → s'` where `s = { streak, fresh }` (two hits in a row → the next shot's `wide: true`, once); `FIRST = 2.5`, `MOVING = 1.6`.

- [x] **Step 1:** Tests: spread grows with range; × 2.5 on `first`; × 1.6 moving; after two hits the third is thrown wide once and the streak resets. **Steps 2–5** as above. Commit — `"How an enemy shoots: spread by range and movement, a first miss, a streak cap"`.

### Task B3: `src/lib/three/combat/bolts.js`

**Files:**
- Create: `src/lib/three/combat/bolts.js`

**Interfaces:**
- Produces: `createBoltMeshes(scene, { pool, colours }) → { sync(bolts.live()), flash(at, dir, colour), dispose() }`: an `InstancedMesh` of thin additive cylinders (as `blaster.js` draws them today) placed from the pool each frame, muzzle flashes as now.

- [x] One step: build it from `blaster.js`'s drawing code (moved, not rewritten), with no world import. Commit.

### Task B4: the galaxy on the one bolt step

**Files:**
- Modify: `src/components/galaxy/surface/blaster.js` (becomes a caller: `fire`, `enemy`, `tracer` and `update` on `createBolts`; `along` and the dice go), `ground/bolts.js` (soldier-on-soldier bolts through the same pool; `farExchange` stays), `ground/groundScene.js` (the mate's capsule in `bodies`; `struck` from the `hit` event), `scene.js` (the player's shot: `aimPoint` + `bolts.fire` from the muzzle; `world.solids` = the surface's ground plus the placer's solids via one raycaster against `solids` meshes; the deflect decided by the `deflect` event, not at fire time; the 0.45 dice at 2918 removed), `ground/fight.js` and `hostiles.js` (aim = `lead`, spread = `accuracy.spread`, `world.solids` from the muzzle each frame they fire; no shot when blocked).

- [x] **Step 1:** `world.solids` for the galaxy: a function in `galaxy/surface/solids.js` (new, under 200 lines) that raycasts `placer`'s solid meshes and tests the ground; tested with a fixture world (`ground.scenario.test.js`'s pattern): a bolt at a wall stops; one over it passes.
- [x] **Step 2:** Wire the callers; delete `along`, the tracer's separate speed, the dice.
- [ ] **Step 3:** `npm test` (the existing `blaster.test.js`, `bolts.test.js`, `fight.test.js` updated to the new seams); `autopilot-check --routes '/galaxy/tatooine','/galaxy/kashyyyk'`: a fight on Kashyyyk's beach in the screenshot.
- [x] **Step 4: Commit** — `"Every galaxy bolt flies the same way and stops at the first solid"`.

### Task B5: the universe on foot

**Files:**
- Modify: `src/components/universe/foot.js` (its `bolt`, `pass`, `fly` → `createBolts`; `shot` aims with `lead` and `spread`), `footScene.js` (the `obstacles()` list as `world.solids`; the planet's sphere as a solid; bodies from the people list).

- [ ] Steps as B4; `autopilot-check` on a universe planet with a squad. Commit — `"The universe's bolts obey its buildings and lead their target"`.

### Task B6: handoff and PR

- [ ] Add Lane B's section to `docs/superpowers/HANDOFF-combat.md`; PR; merge on green.

## Lane C: strokes from clips, hits from the blade

### Task C1: bake the sword set

**Files:**
- Modify: `scripts/ual-bake.mjs` (a set `sword`: every UAL2 `Sword_*` clip, full-body, extras `{ contact: [t0, t1], root: [[t, dx, dz], …] }`), `scripts/ual-bake.test.mjs`, `src/lib/three/clipLibrary.js` (register `sword.<name>` for all 31; retire `saber`), `public/games/meshy/ual-sword.*.glb` (rebaked; `ual-saber.glb` deleted), `scripts/preview/ualRetarget.js` only if a bone needs it.

**Interfaces:**
- Produces: `contactWindow(rows, { widen = 0.06 }) → [t0, t1]` (the hand's fastest span, widened, clamped to `[0.05, duration − 0.05]`); `rootTravel(rmClip) → [[t, dx, dz]…]` at 30 fps from `UAL2_RM.glb`'s hips; clip extras readable at runtime as `clip.userData.contact`, `clip.userData.root`.

- [x] **Step 1:** Fetch the pack: `node scripts/assets-fetch.mjs ual2` (or `--repo`). **Step 2:** Tests in `ual-bake.test.mjs`: `contactWindow` on a synthetic row set (fast in the middle) returns the middle; a flat row set still returns a window inside `[0.05, d − 0.05]`; `rootTravel` sums to the hips' displacement. **Step 3:** FAIL → implement → PASS. **Step 4:** `node scripts/ual-bake.mjs --set sword --report`: 31 files, drift under the report's limit. **Step 5:** Commit the script, the registry and the GLBs — `"The sword set: every UAL2 sword clip full-body, with its contact window and root travel"`.

### Task C2: `src/lib/combat/blade.js`

**Files:**
- Create: `src/lib/combat/blade.js`, `blade.test.js`

**Interfaces:**
- Produces: `createBlade({ r = 0.12, keep = 8 }) → { push(base, tip, t), sweep(targets, { steps }) → [{ target, at, dist }], clash(other) → { at } | null, crosses(a, b) → { at } | null, history() → [{ base, tip, t }] }`. Sub-steps `steps = max(4, ceil(tipTravel / 0.25))`. Uses B1's `segCapsule`, `segSeg` (import from `./bolt.js`; if Lane B isn't merged yet, write them here and let B import from here: say which in the handoff).

- [x] **Step 1:** Tests: a sweep whose segment crosses a capsule hits it at the nearest point; a sweep 0.3 m above a capsule's top misses; a tip that moved 2 m in one frame is sub-sampled and still hits a 0.4 m capsule in the middle of the arc; `clash` finds two blades crossing; `crosses` finds a bolt segment through the blade and not one 0.5 m beside it. **Steps 2–5.** Commit — `"The blade: its swept segment against capsules, blades and bolts"`.

### Task C3: the trail from the ring buffer

**Files:**
- Create: `src/lib/three/combat/trail.js` (from `saber.js`'s trail ribbon, moved; reads `blade.history()`); both blades of a double or dual.

- [x] One step; commit.

### Task C4: strokes as clips

**Files:**
- Modify: `src/components/galaxy/surface/combatRules.js` (`STANCES[id].strokes = [{ clip: 'sword.light.a', speed, damage, lunge }…]`, `HEAVY.clips = ['sword.heavy.a', …'d']`, `BLOCK_CLIP = 'sword.block'`, `DASH_CLIP = 'sword.dash'`; `strokeFor(stance, { last, now, dir })` with `dir ∈ 'up' | 'left' | 'right' | 'rise' | null` → the clip and its numbers; `swingPose` and `arcHit` deleted; `PARRY.window = 0.25`), `combatRules.test.js`, `saber.js` (a stroke = `animator.play(clip, { layer: 'full', speed })`; the root's travel applied to the figure each frame, scaled to reach the lock and capped at `lunge`; the lock turned over the first 40% of the clip, eased; inside `contact` the sword hand corrected by `reach` toward the lock's chest, at most 0.25 rad; `blade.push` each frame; `blade.sweep` inside `contact`; `pose` during a stroke, `swingPose`, `heavyPose` deleted; the block plays `BLOCK_CLIP` on the upper layer), `saberBody.js` deleted with its test, `scene.js` (`swing()` reads the movement key for `dir`; `saberHit` takes the sweep's `at`; `stepLunge` goes, the root does it; the deflect through B's event when B is in, else `blade.crosses` on arriving bolts), `saberRules.js` (`SWINGS`, `swingPose`, `nextSwing`, `arcHit`, `SABER.reach/half/damage` and their tests deleted; `throwAt`, `deflects` kept until B's deflect lands).

**Interfaces:**
- Consumes: C1's clip extras, C2's `createBlade`, A1's `onButton` if merged (else F and C as now).

- [x] **Step 1:** Tests in `combatRules.test.js` for `strokeFor`: the combo in order within 0.45 s; `dir: 'up'` → the overhead (`sword.heavy.a`); `'left'`/`'right'` → the side cuts; `'rise'` → `sword.uppercut`; the heavy chain. **Step 2:** FAIL → implement → PASS.
- [x] **Step 2b: The block, a deliverable of its own.** Held on C (the right button through Lane A's `onButton(2)` once merged, the Block touch button): `BLOCK_CLIP` on the upper layer while held, the blade up in front; a tap under 0.1 s still shows it for `PARRY.window`. An arriving enemy bolt whose flown segment `blade.crosses` is turned back along its line toward its shooter with its side swapped (sparks, the clash sound, the guard spent as today); one passing beside the blade is not, cone or no cone. An enemy's melee contact into the raised blade spends the guard and deals nothing; a block begun within `PARRY.window` before the contact is a parry (the enemy staggered, "Perfect"). Tests: `blade.test.js`'s crosses; a scenario where a bolt at the chest is turned with the block up and lands with it down; the parry inside and outside the window. Once Lane B is merged, B's `deflect` event does the turn and this only wires the sparks, the sound and the guard.
- [x] **Step 3:** A scenario test `galaxy/surface/saber.scenario.test.js` (headless, no canvas: the animator on Luke's rest skeleton fixture, `meshyRig.fixture.js`): a stroke at a capsule 1.8 m ahead hits once; the same capsule 2 m to the side is missed; a target already in the stroke's `hits` is not hit twice; no hit outside `contact`. (Built as `galaxy/surface/saber.test.js`, so it runs in `npm test`: the scenario files are left out of it.)
- [x] **Step 4:** `autopilot-check --routes '/galaxy/tatooine'`; shoot the before on `main` first; the after shows a stroke mid-clip (the DEV hook that triggers a swing, as the handoff's checks do).
- [x] **Step 5: Commit** — `"A stroke is a clip; the blade's sweep decides the hit"`.

### Task C5: online peers play the same clip

**Files:**
- Modify: `src/components/universe/online/protocol.js` (`arms` gains a sixth item, the stroke's clip name, after the old five; `STANCES_SEEN` read from `combatRules.STANCE_IDS`), `protocol.test.js`, `galaxy/surface/peers.js` (plays the named clip; `targets: []` stays, peers' strokes are cosmetic).

- [x] Tests: an old packet (five items) still validates; a new one carries the clip. Commit.

### Task C6: handoff and PR

- [x] The lane's section; PR; merge on green.

## Lane D: duellists

### Task D1: `src/lib/combat/duel.js`

**Files:**
- Create: `src/lib/combat/duel.js`, `duel.test.js`

**Interfaces:**
- Produces: `createDuellist({ reach = 2.2, guard = 0.6, parry = 0.35, stance = 'single', seed }) → d`; `duelStep(d, you, dt, rng) → { state, move: [dx, dz], face, stroke: clip | null, block: bool }` over states `approach | circle | attack | recover | block | parry | stagger | dead`, with `you = { pos, swinging: { contact: [t0, t1], t } | null, dist }`. `onHit(d, { heavy })`, `onParried(d)` (→ `stagger` 0.6 s then `attack`), `onGuardBroken(d)` (→ `stagger` 2 s). The block decision when `you.swinging` starts: `rng() < guard` → `block` held through your contact; the parry decision: `block` begun within `PARRY.window` before your contact and `rng() < parry` → `parry`.

- [x] **Step 1:** Tests: the states in order from 10 m (approach → circle → attack); a block when the roll beats `guard`; a parry inside the window and not outside; stagger on `onParried`; a target that dies (`you.dead`) or jumps 20 m mid-attack → `approach` with `stroke: null`; a seeded `rng` makes it deterministic. **Steps 2–5.** Commit — `"A duellist's mind: approach, circle, attack, block, parry, stagger"`.

### Task D2: rigged duellists on the saber module

**Files:**
- Modify: `galaxy/surface/activity.js` (a spawn with `hostile.blade` is a `crewFigure` with a `saber` gunplay driven by `createSaber` and `duelStep`; its blade's `sweep` against the player's capsule inside its contact; the random parry deleted; `t.blade.swing` cosmetic path deleted), `heldBlade.js` (the unrigged branch deleted; `bladeInHand` passes real `targets`), `sites/dagobah.js` (the vision → the `vader` crew figure), `sites/naboo.js` (Maul), `sites/geonosis.js` (Dooku), `sites/lothal.js` (the Inquisitor), `scene.js` (your parry: the block pressed within `PARRY.window` before their contact → `onParried(d)`; the clash: `blade.clash(theirs)` → sparks, 120 ms hit-stop; your block inside their contact → the guard spends; their hit lands on `sweep`).

- [x] **Step 1:** `galaxy/surface/sites/validity.test.js` still passes with the new spawns. **Step 2:** Scenario test: a duellist's stroke at you with your block up in the window spends the guard and deals nothing; without the block deals its damage; your stroke into their held block is turned. **Step 3:** `autopilot-check --routes '/galaxy/dagobah'`: the vision with a red blade, rigged. **Step 4: Commit** — `"Duellists are rigged figures that block, parry on contact and riposte"`.

### Task D3: deflected bolts go home

- [x] With Lane B in: a `deflect` event's bolt is already turned toward its shooter by B1; here the sound, the sparks and the guard's cost. Test: a stormtrooper's bolt turned by the raised blade kills the stormtrooper. Commit.

### Task D4: handoff and PR.

- [x] `HANDOFF-combat.md`'s Lane D section; the PR.

## Lane E: parity on foot, in Rick and Morty, and on touch

### Task E1: the universe's shot goes where the reticle is

**Files:**
- Modify: `universe/footScene.js` (`fire()`: `aimPoint` from the camera's ray, `assist` by `coneFor`, the lock only bends within the cone; the view-model's mark = the same `at`; the reticle = `Reticle` with `locked` from the lock).

- [x] Test (pure part): a lock 20° off the reticle on a mouse does not take the shot; on touch within 12° it does. `autopilot-check` on a universe planet. Commit.

### Task E2: Rick and Morty

- [x] Total Rickall (`rickall.js`): `shoot()` fires a bolt through `createBolts` with the room's furniture as `solids` (the interior's colliders); `aimAt` keeps the cylinders as bodies. The duel dimension (`duel.js`): `fire()` through the same with the arena's walls. Tests updated. `autopilot-check --routes '#/c-137'`. Commit.

### Task E3: touch

- [x] `SurfaceView.jsx` and `RmHud.jsx`: a Lock `TouchButton`; the fire button's tap snaps inside `ASSIST.touch` when `snap`; the look pad's drag scaled by `friction`. On a coarse pointer the lock-on is on by default within 14 m. `autopilot-check --phone` on both. Commit.

### Task E4: handoff and PR.

- [x] The handoff's Lane E section; the PR, merged on green.

## Lane G: the motion spike

### Task G1: one clip from HY-Motion, on Luke

**Files:**
- Create: `scripts/motion/README.md`, `scripts/motion/generate.py` (HY-Motion 1.0, one prompt → SMPL-H joints → BVH), `scripts/motion/bvh-map.mjs` (SMPL-H joint names → the UAL `DEF-*` names `ualRetarget.js` expects), `scripts/preview/motion.html` (plays the baked clip beside `sword.heavy.a` on Luke).
- The desktop runs it (the cloud can't): the session writes the scripts, the issue form and the `motion.yml` workflow in the gen3d pattern, and asks for the run with `node scripts/desktop/ask.mjs motion overhead-strike --prompt "a two-handed overhead sword strike, stepping forward"` (adding `motion` to `ask.mjs`).

- [ ] **Step 1:** `scripts/motion/bvh-map.test.mjs`: the 22 SMPL-H body joints map onto the 22 `DEF-*` bones the UAL map covers; a BVH with those names retargets through `retargetUal` without a missing bone. **Step 2:** The scripts, the workflow, the ask. **Step 3:** When the desktop's PR comes: the sheet beside `sword.heavy.a`; the note `docs/research/2026-10-08-motion-spike.md` says whether it reads as a strike and what the next step is (the `motion` job for real, or stop). **Step 4:** Commit; PR; merge on green. The spike's clip ships only if it reads well.

---

## Self-review

- Spec coverage: §1 look → A1, A4, A5; §2 aim → A2; §3 bolts → B1, B3, B4, B5; §4 accuracy → B2, B4, B5; §5 blade → C2; §6 saber → C1, C3, C4; §7 duellists → D1, D2; §8 shooting → A3, B4, E1, E2; §9 touch and lock-on → E3; §10 desktop → the gen3d requests (the architect's, outside this plan) and G1; the protocol → C5; the Death Star's saber → out of scope, as the spec says.
- Names: `createLook`, `aimPoint`, `assist`, `friction`, `lead`, `coneFor`, `ASSIST`, `createBolts`, `segCapsule`, `segSeg`, `spread`, `scatter`, `createBoltMeshes`, `contactWindow`, `rootTravel`, `createBlade`, `strokeFor`, `createDuellist`, `duelStep`, `onParried`, `Reticle`, `reticleState` are the names every lane uses; a lane that must change one says so in the handoff and the next lane reads the handoff first.
- Review Focus 1–5 each have a test in A1, A1, B1, C1, D1.
