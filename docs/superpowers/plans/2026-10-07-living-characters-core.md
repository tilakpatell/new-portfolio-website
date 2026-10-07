# Living characters, W0 and W1: the library's bugs and the shared layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the shared animation library's site-wide bugs, then build the animation layer (`clipLibrary`, `locomotion`, `animator`, `gait`, `animBudget`) and the brain-to-body seam (`lib/ai/body`, `lib/ai/react`) every world will move onto, with the UAL clips baked.

**Architecture:** Pure, Node-tested modules in `src/lib/three/` (drawing) and `src/lib/ai/` (deciding). Existing paths keep re-exports, so no world changes in W1. Partial layers are laid over the mixer's result by sampling interpolants and slerping masked bones (`saberBody.js`'s method); the mixer's base weights always sum to 1.

**Tech Stack:** three.js (AnimationMixer, interpolants), vitest, `@gltf-transform/core` for the bake.

**Spec:** `docs/superpowers/specs/2026-10-07-living-characters-design.md`

## Global Constraints

- Callers' shapes stay: `meshyCast` figure `{ mixer, act, update(t, move, hit), play(name, opts), stop(fade) }`; `footScene` figure `{ model, bones, loco, mixer, act, update(dt, move, motion?), after(dt, motion, frame), dispose }`; `clips.js` exports `RICK_HIPS, borrowClips, retarget, faceAhead, faceForward, heading`; `universe/locomotion.js` exports `strideOf, createLocomotion, fallTurn`.
- `src/lib/ai/*` stays free of three.js and `Math.random` (a `rand` is passed in).
- Foot slide bar: planted toe drift under 0.15 m/s. Base weights per bone sum to exactly 1 in every state.
- Every UAL clip baked into its own `public/games/meshy/ual-<name>.glb`; the 6.7 MB pack is never committed. `ual-saber.glb` unchanged.
- Code comments and commit messages in the repo's plain prose voice; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Checks before merge: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`.

## Review Focus

- A figure whose clips are missing `run` (or `walk`) asked to run: expect the walk played faster, never a blend toward the bind pose. (Task 1 and Task 4 tests.)
- `play()` of the clip already playing, rapidly (a punch chain): expect it restarted in place, never cut to nothing. (Task 1, Task 5.)
- A figure without toe bones (Sketchfab, High Moon): expect `locomote` to fall back to `clipSpeed` or the old pace, never NaN timeScale. (Task 4.)
- `dt` of 0 or a long tab-away frame (1 s): expect clamped steps, no jump in phase or weight. (Task 5, Task 6, Task 7.)
- An upper layer played while the figure's model has no `Spine02`/arm bones (a non-Meshy rig without roles): expect the layer to skip missing bones, not throw. (Task 6.)

---

### Task 1: meshyCast one-shots and clip hand-off

**Files:**
- Modify: `src/components/rickmorty/portal/meshyCast.js` (`play`, `stop`, `update`, `loadOne`)
- Test: `src/components/rickmorty/portal/meshyCast.test.js`

**Interfaces:**
- Produces: `c.update(t, move, hit, { dt } = {})` (explicit `dt` wins over `t − c.last`); `cast.load(onEach, names, { clips })` merges clips into an asset already loaded instead of first-ask-wins.

- [ ] **Step 1: Write the failing tests** (a figure built by `make` on a fake loader whose GLBs carry `Hips` and one-track clips):
  - `replaying the clip that is playing restarts it, never cuts it`: `await c.play('punch')`, tick 0.1 s, `await c.play('punch')`, tick 0.05 s → `c.act.punch.isRunning()` true and its effective weight > 0.
  - `a second clip fades the first out fully`: play `wave`, tick, play `cheer`, tick 1 s → `c.act.wave.getEffectiveWeight()` is 0 and `c.act.wave.isRunning()` false.
  - `a missing run hands its weight to the walk`: a figure with idle and walk only, `update(t, 1, 0)` → idle + walk weights sum to 1, walk ≥ 0.99, walk's timeScale > 1.
  - `a missing walk hands its weight to the idle`: idle only, `update(t, 0.6, 0)` → idle weight 1.
  - `update takes an explicit dt`: `update(5, 0, 0, { dt: 0.02 })` advances the mixer 0.02 s.
  - `a later load adds clips to a figure already loaded`: `load(null, ['rick'], { clips: ['idle'] })` then `load(null, ['rick'], { clips: ['idle', 'run'] })` → the next `make('rick').act.run` exists, and the GLB was fetched once.
- [ ] **Step 2: Run** `npx vitest run src/components/rickmorty/portal/meshyCast.test.js` → the six fail.
- [ ] **Step 3: Implement.** `play`: if `c.oneShot?.name === name`, reset its action in place (time 0, `w` kept) and return; before a new one, stop any `c.fadingOut` action at once. `update`: compute idle/walk/run as now, then hand a missing clip's weight down (`run → walk → idle`) and, when run's went to walk, raise walk's timeScale by the run/walk pace ratio (1.6). `loadOne`: when `assets.has(name)`, fetch only the clips it lacks and merge (faced ahead like the rest).
- [ ] **Step 4: Run** the file → all pass; `npx vitest run src/components/rickmorty` → no regressions.
- [ ] **Step 5: Commit** `git commit -m "Rick and Morty's cast: a replayed clip restarts, a missing run walks faster, a later ask adds clips"`.

### Task 2: the callers that asked too little, and shared clips faced ahead

**Files:**
- Modify: `src/components/rickmorty/world/scene.js:183-191` (`need` passes every ask through to the merging `load`), `src/components/rickmorty/world/dimensions/stage.js:69` (`['idle', 'walk', 'run']`), `src/components/rickmorty/portal/meshyCast.js` (`sharedClip` callers: `faceAhead` the retargeted copy with the figure's up, as `loadOne` does for its own)
- Test: `src/components/rickmorty/portal/meshyCast.test.js`

- [ ] **Step 1: Failing test** `a shared clip is turned to face where the walk faces`: a fake figure whose armature is turned 90° (as Meshy's come), `play('wave')` → the action's clip has the same root turn `faceAhead` gives the walk (compare the first quaternion key of `Hips.quaternion` against the walk's).
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement** as listed under Files. In `need`, drop the first-ask-wins map; keep one in-flight promise per `name + clips` and let `cast.load` merge.
- [ ] **Step 4: Run** `npx vitest run src/components/rickmorty` → pass.
- [ ] **Step 5: Commit** `"The C-137 world asks for the run, and the shared clips face the way the walk does"`.

### Task 3: the ghosts' clock, the galaxy's roll, the universe's troops

**Files:**
- Modify: `src/components/middleearth/towns/ghosts.js:150` (each ghost keeps `g.clock`, seeded from its id's hash, advanced by `dt`; `animate(g.f, g.clock, p, dt)`)
- Modify: `src/components/galaxy/surface/scene.js` (`stepDodge` writes `state.dodge.roll`; `place()` applies `pp.holder.rotation.x = roll` for the lead after its `rotation.set(0, st.yaw, 0)`)
- Modify: `src/components/universe/footScene.js` (troops' `move` divided by `FOOT.run`, not their own speed; a beaten troop goes down through `motion.down` and `fallTurn`, not a snap)
- Test: `src/components/middleearth/towns/ghosts.test.js` (new)

- [ ] **Step 1: Failing test** `a ghost's gait clock runs at the frame's pace whichever way it walks`: `createGhosts({ animate: spy })`, feed a ghost walking −x then +x for 1 s at 60 fps → the `t` the spy receives rises by 1.0 ± 0.02 over each second, and two ghosts' clocks differ.
- [ ] **Step 2: Run** `npx vitest run src/components/middleearth/towns/ghosts.test.js` → fails (clock follows x).
- [ ] **Step 3: Implement** the three changes above.
- [ ] **Step 4: Run** the test → pass; `npx vitest run src/components/middleearth src/components/galaxy src/components/universe` → no regressions.
- [ ] **Step 5: Browser check** the galaxy roll (X on a surface) and a universe landing fight in the preview; a shot of each to `docs/superpowers/shots/`.
- [ ] **Step 6: Commit** `"Ghosts walk on their own clock, the galaxy's roll rolls, and the universe's troops go down at the knees"`.

### Task 4: `lib/three/clipLibrary.js` and `lib/three/locomotion.js`

**Files:**
- Create: `src/lib/three/clipLibrary.js`, `src/lib/three/clipLibrary.test.js`
- Move: `src/components/rickmorty/portal/clips.js` → body into `clipLibrary.js`; the old file becomes `export * from '../../../lib/three/clipLibrary';`
- Move: `src/components/universe/locomotion.js` → `src/lib/three/locomotion.js` (with its test); the old file re-exports
- Test: `src/lib/three/locomotion.test.js`

**Interfaces:**
- Produces:
  - `CLIPS: { [name]: { url, take?, hips?, loop?, mask? } }` with the sets the spec lists (Rick's, Meshy's 13, UAL's, the troopers', Invincible's later)
  - `loadClip(name, { loader }) → Promise<AnimationClip | null>` (cached; sets `clip.userData.hips`)
  - `forFigure(name, { hipsY, up, key }) → Promise<AnimationClip | null>` (retargeted + faced ahead, cached per `name + key`)
  - `preload(names) → Promise<void>`
  - `strideOf(...)` unchanged; `strideCache: Map` keyed by `clip.uuid + ':' + key`
  - `createLocomotion(fig, { mixer, act, root, unit, clipSpeed, key })`: `clipSpeed` metres/s at 1× for rigs without toes; `key` shares measured strides between copies of one template

- [ ] **Step 1: Failing tests**:
  - `loadClip fetches once and keeps the hips height` (fake loader counting calls).
  - `forFigure scales the hips to the figure and caches per key`.
  - `CLIPS names every shared clip meshyCast plays` (`SHARED_CLIPS.every(n => CLIPS[n])`).
  - `a stride is measured once per template` (two `createLocomotion` with the same `key` → `strideOf` ran once: spy via the cache size).
  - `with no run clip, running plays the walk faster and the weights sum to 1`.
  - `without toes, clipSpeed paces the walk` (`clipSpeed: 1.4`, speed 2.8 → walk timeScale 2 ± 0.05).
  - `a 1 s frame doesn't jump the phase more than 0.1 s of ground` (dt clamp).
- [ ] **Step 2: Run** `npx vitest run src/lib/three` → new tests fail.
- [ ] **Step 3: Implement** the moves, registry, cache, hand-off and `clipSpeed`. Keep `blend`'s 0.8 + 0.4 × move pace as the last fallback.
- [ ] **Step 4: Run** `npx vitest run src/lib/three src/components/universe src/components/rickmorty src/components/galaxy` → pass.
- [ ] **Step 5: Commit** `"The clip library and locomotion move to lib/three: strides measured once, a missing run walks faster"`.

### Task 5: `lib/three/animator.js`, the base

**Files:**
- Create: `src/lib/three/animator.js`, `src/lib/three/animator.test.js`, `src/lib/three/meshyRig.fixture.js` (a 24-bone Meshy skeleton built from names, with toe bones and synthetic idle/walk/run clips)

**Interfaces:**
- Consumes: `createLocomotion`, `forFigure` (Task 4).
- Produces: `createAnimator(model, { clips, hipsY, bones, unit = 1, seed = 0, up, key, clipSpeed }) → animator` with `mixer`, `actions`, `loco`, `locomote(m)`, `base(name | null, { fade })`, `play(name, { layer = 'full', loop, hold, fade, speed, at }) → Promise<'done' | 'cut'>`, `stop(layer, fade)`, `update(dt, { lodRate = 1 })`, `after(dt, motion, frame)`, `dispose()`; `MESHY_MASKS = { upper: [...], lower: [...] }`.

- [ ] **Step 1: Failing tests** on the fixture:
  - `base weights sum to 1 in every state` (idle, walking, running, a base state, a full one-shot fading in and out, a missing run): sum the effective weights of the base actions on each frame → 1 ± 1e-6.
  - `replaying a full one-shot restarts it`: a replay resets the action's time to 0 and keeps its weight; the first call's promise stays pending and resolves `'done'` when the clip ends.
  - `a new one-shot cuts the last`: the first's promise resolves `'cut'`.
  - `base('sit.idle') enters through sit.enter when it exists and leaves through sit.exit`.
  - `seeded figures start their idles apart`: two animators, seeds 1 and 2 → idle action times differ by > 0.1 s.
  - `a 1 s frame is clamped` (update(1) advances the mixer 0.1 s).
- [ ] **Step 2: Run** `npx vitest run src/lib/three/animator.test.js` → fails.
- [ ] **Step 3: Implement**. `locomote` stores the motion; `update` runs `loco.update(dt, motion)`, scales the base weights by `1 − fullW`, runs the full one-shot slot's weight, then `mixer.update(min(dt, 0.1) × lodRate)`. Seed → a mulberry32 for start times (`src/lib/seeded.js` if it has one).
- [ ] **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `"An animator for every rigged figure: base weights that always sum to one, replays that restart, seeded starts"`.

### Task 6: the animator's layers, look, idles and queue

**Files:**
- Modify: `src/lib/three/animator.js`; Test: `src/lib/three/animator.test.js`

**Interfaces:**
- Produces: `play(name, { layer: 'upper' | 'lower' })`, `look(target: THREE.Vector3 | null, { weight = 1, yaw = 1.1, pitch = 0.6, rate = 6 })`, `idles({ fidgets: string[], every: [lo, hi] })`, `queue(steps: Array<{ play } | { base } | { wait } | { look }>) → Promise<'done' | 'cut'>`.

- [ ] **Step 1: Failing tests**:
  - `an upper layer moves only upper bones`: walk playing; play an upper clip whose tracks turn every bone 90°; after update, `LeftUpLeg`'s quaternion equals the walk-only run's, `RightArm`'s equals the clip's (w = 1).
  - `layers skip bones the figure lacks` (fixture without `Spine02`: no throw).
  - `look turns the head toward a target within its clamp, the neck a third`: target 45° left → head+neck world yaw ≈ 45° ± 2° after 2 s; target 170° behind → clamped to `yaw`.
  - `look eases at its rate` (after 1 frame at 60 fps the turn is < 15% of the way).
  - `idles fire a fidget on the upper layer only while still`: seeded, `every: [1, 1]`, standing 1.5 s → one fidget played; moving → none.
  - `a queue runs its steps in order and a play on its layer cuts it`.
- [ ] **Step 2: Run** → fails.
- [ ] **Step 3: Implement** layers as `saberBody.js`'s `layer`/`lay`: per layer, the clip's tracks filtered by mask to the figure's bones, interpolants evaluated at the layer's time, slerped by its weight after the mixer and locomotion's `after`. `look` after layers: the head's and neck's world-space turn toward the target, clamped, eased by `1 − exp(−rate·dt)`.
- [ ] **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `"The animator's layers: a wave while walking, a head that looks, fidgets when still, steps in a queue"`.

### Task 7: `lib/three/gait.js` and `lib/three/animBudget.js`

**Files:**
- Create: `src/lib/three/gait.js`, `src/lib/three/gait.test.js`, `src/lib/three/animBudget.js`, `src/lib/three/animBudget.test.js`

**Interfaces:**
- Produces: `createGait({ stride, cadence: [lo, hi], seed }) → { step(dt, speed) → { phase, amount, run } }`; `turn(current, want, dt, rate) → number`; `breathe(t, seed) → number` (−1…1); `sway(phase, amount) → { bob, roll }`; `createAnimBudget({ near = 12, far = 40, max = 64 }) → { rate(pos: {x,y,z}, camera, inView: boolean) → 0 | 0.25 | 0.5 | 1, frame() }`.

- [ ] **Step 1: Failing tests**:
  - `phase follows distance: a stride of ground is one cycle at any pace`.
  - `changing pace never jumps the phase` (speed 1 → 3 in one frame: phase continuous).
  - `amount eases from 0 to 1 over about a quarter second`.
  - `turn eases by time, the same at 30 and 144 fps` (± 1%).
  - `breathe differs by seed`.
  - `the budget runs near figures every frame, far ones every fourth, unseen ones not at all`, and `never more than max at rate 1 in a frame`.
- [ ] **Step 2: Run** `npx vitest run src/lib/three/gait.test.js src/lib/three/animBudget.test.js` → fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `"A gait for the figures without clips, and a budget for many mixers"`.

### Task 8: `lib/ai/body.js` and `lib/ai/react.js`

**Files:**
- Create: `src/lib/ai/body.js`, `src/lib/ai/body.test.js`, `src/lib/ai/react.js`, `src/lib/ai/react.test.js`; Modify: `src/lib/ai/index.js` (export both)

**Interfaces:**
- Produces:
  - `MODE_BODY` (the spec's default table) and `bodyFrom(prev, next, dt, { table = MODE_BODY, unit = 1, range = 12 }) → { motion: { speed, side, turn, down, hurt }, look: {x,z} | null, base: string | null, action: string | null, scan: boolean }`; a step is `{ x, z, yaw, mode, aim?, look?, down?, hurt?, belief? }`.
  - `REACTIONS` (the spec's default table) and `createReactions(table = REACTIONS, { rand }) → { on(event, ctx: { t, dir?, force?, moving?, target? }) → { clip, layer, hold, look } | null }`.

- [ ] **Step 1: Failing tests**:
  - `a step straight ahead is speed, sideways is side, in the figure's frame` (yaw π/2).
  - `a yaw change is a turn rate` and `dt 0 gives zero motion, never NaN`.
  - `search scans, suspicious stares at the belief, cover crouches, strafe keeps the look on the aim`.
  - `look priority: look, then aim, then a belief within range, else null`.
  - `a reaction doesn't repeat inside its cooldown`.
  - `down picks die.fwd for a hit from behind, die.back from ahead, die.blown above force 0.8`.
  - `hit while moving plays on the upper layer`.
  - `a seeded crowd's greet chances spread` (of 50 with chance 0.6, between 20 and 40 react).
  - `neither module imports three` (read the source text: no `from 'three'`).
- [ ] **Step 2: Run** `npx vitest run src/lib/ai` → fails.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `"The seam from brain to body, and what happens to a body: lib/ai's body and react"`.

### Task 9: the UAL clips, baked

**Files:**
- Modify: `scripts/ual-bake.mjs` (a `SETS` list: `saber` as today; `life` one file per clip, full body, named as the spec's clip library: `talk`, `sit.enter`, … `drive`)
- Modify: `src/lib/three/clipLibrary.js` (`CLIPS` entries for each `ual-<name>.glb`, `hips` from the file)
- Create: `public/games/meshy/ual-*.glb`

- [ ] **Step 1: Run** `node scripts/ual-bake.mjs <path to ual.glb> --set life --report` (the pack is at `.claude/worktrees/stoic-fermat-7ecc3d/scripts/preview/.ual/ual.glb`; copy it to this worktree's git-ignored `scripts/preview/.ual/`) → one file per clip, each 9–40 KB, the report's retarget error ≤ 0.01.
- [ ] **Step 2: Test** `every ual clip in CLIPS has its file` (`clipLibrary.test.js`: `fs.existsSync('public' + url)`), and `the saber bake is unchanged` (hash of `ual-saber.glb` equal to main's).
- [ ] **Step 3: Run** `npx vitest run src/lib/three/clipLibrary.test.js` → pass.
- [ ] **Step 4: Commit** `"Quaternius's library baked for everyone: talking, sitting, crouching, hits, a death, a pistol, jumps"`.

### Task 10: docs, and the checks

**Files:**
- Modify: `docs/architecture.md` ("Where things live": the five `lib/three` modules and the two `lib/ai` ones)

- [ ] **Step 1:** Write the entries.
- [ ] **Step 2: Run** `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build` → clean (Windows's known flakes re-run alone).
- [ ] **Step 3: Commit** `"Docs: where the animation layer and the brain-to-body seam live"`, push `claude/living-npcs`, open the PR, merge after a fetch onto origin/main.
