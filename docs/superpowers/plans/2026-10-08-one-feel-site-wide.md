# One feel, every world: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every world and page game on the site declares one art, takes the house tone mapper and emissive-only bloom, answers a hit with a thud, a puff and a shake, drives a car whose visible half exaggerates its physics half, opens one tuning panel behind `?debug`, and takes its colliders from a model’s node names.

**Architecture:** Six small shared pieces land first (Phase 1, five lanes at once, each proved on one world), then six lanes apply all of them to every world by the spec’s roster (Phase 2). Pure rules live in `src/lib` and `src/lib/physics` with tests in Node; the three.js halves in `src/lib/three`; the runtime learns one thing (`rt.debug`). A world adds a `look.js` and a few calls; nothing a visitor can do changes.

**Tech Stack:** three.js 0.186 (GLSL, `onBeforeCompile`), Rapier `@dimforge/rapier3d-compat` 0.21 through `src/lib/physics`, Web Audio through `src/lib/audio`, Vitest, plain DOM for the panel. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-08-one-feel-site-wide-design.md` (read it first: the roster, the decisions and the rollout are there and not repeated here).

## Global Constraints

- `src/lib` and `src/lib/physics` import no React and no DOM; `src/lib/physics` imports no three (`docs/health/RULES.md`, the layers). `src/runtime` imports nothing from `src/components`.
- No new dependency. No runtime call to any service. No model names in code, docs or commits.
- British spelling, curly quotes (’ “ ”), plain sentences; comments say why, in the file’s voice.
- Every `onBeforeCompile` composes with the hook already on the material and sets `customProgramCacheKey` (the pattern: `lib/three/house.js`’s `patch`).
- Every number a tier reads comes from `lib/budgets` or `lib/device`. Bloom stays off on `low` as today.
- A file stays under 800 lines; `node scripts/health.mjs --check --skip build` stays green; `big-files` does not rise.
- Nothing a visitor can do is lost: every key, save key, achievement, sound, dev hook (`window.__…`) and gimmick works after as before. A new sound is added, never swapped.
- Draw calls and triangles at a checked route at or under today’s; a rise is a finding in the pull request, not a budget change.
- Before a pull request: `npm run lint`, `npm test`, `npm run build`, `node scripts/health.mjs --check --skip build`, `node scripts/autopilot-check.mjs --only smoke --routes <the lane’s routes>` with before and after screenshots (`--shots <lane> --before` on `main` first), and `node scripts/perf-probe.mjs expanseDrive` for a lane that touches the Expanse.
- One pull request a lane (Phase 2 lanes may make two), to `main`, merged on its own with a merge commit when CI is green. Never merge red, never force-push, never rebase a branch someone else has. Merge `origin/main` in before opening the pull request and again before merging.
- A lane edits only the files its row in the spec’s rollout gives it, plus the worlds it owns in Phase 2. A need for another lane’s file is a line in the handoff, not an edit.

## Review Focus

1. A hit force of `NaN` or `Infinity` (a Rapier body gone bad, caught by `world.js` but reported first) must make no sound and no puff: `impact.test.js` pins `hit(NaN, …)` and `hit(Infinity, …)` to `null` (Task 1B.1).
2. `thud` with no audio context (sound off, or before the first gesture) must do nothing and throw nothing: `sfx.test.js` pins it (Task 1B.2).
3. A `look.js` whose `bloom.threshold` is `1` but whose scene still passes a literal to `createStage` is a silent regression: `looks.test.js` greps each world’s scene files for `threshold:` literals outside `look.js` (Task 1A.3).
4. `?debug` on a world that has no `tune()` must open nothing and log nothing: `runtime/debug.test.js` pins it (Task 1D.2).
5. A `_physical` node with a non-uniform scale on a `ball` child has no one radius: `fromModel.test.js` pins that it throws a plain message naming the node (Task 1E.1).

---

# Phase 1: the pieces (five lanes at once from `main`)

## Lane 1A: the art (`claude/one-feel-art`)

Owns: `src/lib/three/palette.js`, `src/lib/three/bloom.js`, `src/lib/stage3d.js` (defaults and header only), `src/runtime/webgl.js` and `webgpu.js` (defaults only), `scripts/health/art-mix.mjs`, `scripts/health.mjs` (one row), `docs/health/budgets.json`, `docs/health/RULES.md`, `src/components/worlds/looks.js`, `src/components/worlds/looks.test.js`, `src/components/middleearth/shire/look.js`, `src/components/expanse/surface/look.js`, the Shire’s and the Expanse’s scene files where they read the look.

### Task 1A.1: The palette texture

**Files:**
- Create: `src/lib/three/palette.js`, `src/lib/three/palette.test.js`

**Interfaces (produces):** `createPalette(hexes: (number | string)[]) → { texture: THREE.DataTexture, size: number, uv(i) → [u, v], colour(i) → THREE.Color, material(opts = {}) → THREE.MeshLambertMaterial (with `map: texture`; `opts.house` (a `createHouse` result) patches it), paint(geometry, i) → geometry (every `uv` set to `uv(i)`), dispose() }`. The texture is `size × 1`, `RGBAFormat`, `SRGBColorSpace`, `NearestFilter` both ways, `generateMipmaps: false`. `uv(i)` is the cell’s centre: `[(i + 0.5) / size, 0.5]`. Six to sixteen colours; outside that throws.

- [ ] **Step 1: Write the failing tests** in `palette.test.js`: `uv(0)` of eight colours is `[0.0625, 0.5]`; `colour(2)` equals `new Color(hexes[2])`; `paint(new BoxGeometry(), 3)` leaves `uv.count` at 24 and every `u` at `uv(3)[0]`; five colours throw; `material().map` is the texture; `dispose()` disposes the texture.
- [ ] **Step 2: Run** `npx vitest run src/lib/three/palette.test.js` → FAIL (module missing).
- [ ] **Step 3: Implement** `createPalette` per the interface. The pixel data is `Uint8Array(size * 4)` from each colour’s sRGB bytes.
- [ ] **Step 4: Run** the test → PASS.
- [ ] **Step 5: Commit** `The palette texture: one Lambert, one draw, for what a painted world builds in code`.

### Task 1A.2: The house bloom, and the tone mapper by default

**Files:**
- Create: `src/lib/three/bloom.js`, `src/lib/three/bloom.test.js`
- Modify: `src/lib/stage3d.js:1-5` (the header: Neutral, not ACES), `:90` (`bloom = BLOOM`, `exposure = LOOK.exposure`), `:97-98` (`NeutralToneMapping`), `src/runtime/webgl.js:26` (`p.strength ?? BLOOM.strength` and the rest), `:46` (`toneMapping = THREE.NeutralToneMapping`), `src/runtime/webgpu.js:58`; and the three stage worlds that call `houseOn` on the stage’s default exposure (`middleearth/rush/scene.js`, `rickmorty/citadel/scene.js`, `albuquerque/casa/scene.js`) pass `keepExposure: true`, or the house’s 1.4 would be lifted twice.

**Interfaces (produces):** `BLOOM = { threshold: 1, strength: 0.25, radius: 0.4 }`; `bloomGroups(pass: UnrealBloomPass) → groups` (one group `bloom` with `threshold 0…2`, `strength 0…1.5`, `radius 0…1`, as `lib/debugPanel`’s items). `createStage` defaults to `BLOOM` and Neutral at `LOOK.exposure` (`lib/three/house.js`).

- [ ] **Step 1: Write the failing tests**: `BLOOM` equals the three numbers; `bloomGroups({ threshold: 1, strength: 0.25, radius: 0.4 })` returns one group of three range items whose `get()` read the pass and whose `set(v)` write it.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `bloom.js`; change the defaults in `stage3d.js`, `webgl.js`, `webgpu.js`. A caller that passes its own `bloom`, `toneMapping` or `exposure` is unchanged.
- [ ] **Step 4: Run** `npx vitest run src/lib src/runtime` → PASS. `node scripts/autopilot-check.mjs --only smoke --routes /middle-earth/shire,/scranton` → no error (the stage worlds draw at the new default; they look different: that is Phase 2’s work, and the before shots are this lane’s evidence).
- [ ] **Step 5: Commit** `Bloom for emissives only, and Neutral by default on every stage`.

### Task 1A.3: `look.js`, its test, and the first two looks

**Files:**
- Create: `src/components/worlds/looks.js`, `src/components/worlds/looks.test.js`, `src/components/middleearth/shire/look.js`, `src/components/expanse/surface/look.js`
- Modify: `src/components/middleearth/shire/scene.js:89` (bloom from `LOOK.bloom`), `src/components/expanse/surface/scene.js` (the buggy’s and crates’ materials from the palette; `houseOn` with `LOOK.shadow`), `src/components/expanse/surface/buggy.js` (`createBuggy({ palette })` takes a `createPalette` result, paints its boxes by index)

**Interfaces (produces):** `LOOK_FOLDERS` in `looks.js`: the list of `{ folder, routes }` for every world in `WORLD_MB` and every page game in the spec’s roster (the folder of each `createStage`/`fromScene` scene file). `validateLook(look) → string[]` (the problems, empty when fine): `art` in `painted | scanned | own`; `painted` has `palette` of 6…16 colours no two closer than 0.08 in OKLab (copy the distance from `src/components/universe/palette.test.js` into `looks.js` as `oklabDistance`); `tone` in `house | none`, `none` needs `why.tone`; `bloom` is `false` or `{ threshold, strength, radius }`, `threshold < 1` needs `why.bloom`; `own` needs `why.art`.

- [ ] **Step 1: Write the failing tests**: `validateLook` on a good painted look is `[]`; a threshold of 0.8 with no `why.bloom` names `bloom`; a `tone: 'none'` with no `why.tone` names `tone`; a 5-colour palette names `palette`; two colours `#ffffff` and `#fefefe` name `palette`. Then the sweep: for every entry in `LOOK_FOLDERS`, `look.js` exists and validates, and no file in the folder but `look.js` contains the literal `threshold:` (regex `/threshold:\s*[\d.]/`) — this fails for every world without a look today, so the test takes an `EXPECTED_MISSING` list (every folder but the Shire and the Expanse) that Phase 2 lanes empty; it asserts the missing set equals that list exactly, so a lane that forgets to shrink it fails.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `looks.js`; write the Shire’s look (`scanned`, `house`, `bloom: BLOOM`, its `shadow` left to the moods) and the Expanse’s (`painted`, a palette of its species, ground, sand, rock, crate, barrel, body, cab, dark colours, `house`, `BLOOM`); the Expanse scene and buggy take the palette.
- [ ] **Step 4: Run** `npm test`, `node scripts/autopilot-check.mjs --routes /middle-earth/shire,/universe/expanse/7 --shots one-feel-art` → PASS; the Expanse’s crates and buggy are one material; `node scripts/perf-probe.mjs expanseDrive` worst frame no worse.
- [ ] **Step 5: Commit** `Every world says its art: look.js, and the Shire’s and the Expanse’s`.
- Done; then the driven Expanse went from the site (#705), and its look, its crates and buggy on the palette and its `LOOK_FOLDERS` row went with it. The Shire’s look is the proof that stays; `createPalette` waits for the next painted world.

### Task 1A.4: The `art-mix` measure

**Files:**
- Create: `scripts/health/art-mix.mjs`, `scripts/health/art-mix.test.mjs`
- Modify: `scripts/health.mjs:25` (one row), `docs/health/budgets.json` (its first value), `docs/health/RULES.md` (a paragraph under “Worlds are islands”: one art a world, what counts as a scan and a ramp)

**Interfaces (produces):** `artMix({ root }) → { value, items: [{ folder, scan: file, ramp: file }] }`: for each folder in `LOOK_FOLDERS`, the closure (`src/runtime/shadingClosure.js`’s `closure`) from its scene files; a folder counts when it reaches both a ramp (`MeshToonMaterial` or `gradientMap` in a non-test source) and a scan (`lib/three/core`, `lib/cc0` or `lib/hdri` in an import).

- [ ] **Step 1: Write the failing test** on a fixture tree under `scripts/health/fixtures/art-mix/`: one folder with both counts, one with a scan only doesn’t.
- [ ] **Step 2: Run** `npx vitest run scripts/health/art-mix.test.mjs` → FAIL (the health measures’ tests run under Vitest, as `scripts/health.test.mjs` does). `lib/three/frameGuard.js` names `gradientMap` to guard a material’s textures and is exempt; `lib/hdri` counts only where `loadPbr` is imported (its skies are light, not a scan).
- [ ] **Step 3: Implement**; register the metric as the others are; budget it at its first value (`node scripts/health.mjs --json`).
- [ ] **Step 4: Run** `node scripts/health.mjs --check --skip build` → green.
- [ ] **Step 5: Commit** `art-mix: a world that wears a scan and a toon ramp at once, counted and ratcheted`. Open the pull request; fill the handoff row.

## Lane 1B: the hits (`claude/one-feel-hits`)

Owns: `src/lib/impact.js`, `src/lib/sfx.js` (`thud` only), `src/lib/three/dust.js`, `src/lib/three/feel.js` (moved from `src/components/avengers/hq/feel.js`, which becomes a re-export), `src/lib/three/pool.js` (moved from `src/components/expanse/surface/scene.js`’s `pool`), `src/lib/three/impacts.js`, `src/components/universe/landings/physics.js`, `src/components/universe/footScene.js` (the `heard` lines only).

### Task 1B.1: The hit law

**Files:** Create `src/lib/impact.js`, `src/lib/impact.test.js`.

**Interfaces (produces):** `createImpacts({ threshold = 15, full = 120, gap = 0.1, now = () => performance.now() / 1000, random = Math.random }) → { hit(force, at: [x, y, z], key = at) → { gain, pitch, dust, shake, at } | null, set({ threshold, full, gap }), values() }`; `impactGroups(rules) → groups` (one group `hits`: threshold 0…60, full 20…400, gap 0…0.5). The law: `gain = clamp((force − threshold) / (full − threshold), 0, 1)²`; `null` when `gain` is 0 or `force` isn’t finite; `pitch = 0.85 + 0.3 × random()`; `dust = max(1, round(6 × gain))`; `shake = 0.15 × gain`; `null` within `gap` seconds of the last non-null hit on the same `key`.

- [ ] **Step 1: Write the failing tests**: `hit(15)` is `null`; `hit(120)` has `gain 1`, `dust 6`, `shake 0.15`; `hit(67.5)` has `gain 0.25` within 1e-9; `hit(NaN)` and `hit(Infinity)` are `null`; two hits on one key 0.05 s apart: the second is `null`; on two keys both answer; `pitch` with `random: () => 0` is 0.85; `impactGroups` reads and writes `values()`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The hit law: a force becomes a gain, a pitch, a puff count and a shake, throttled`.

### Task 1B.2: The thud

**Files:** Modify `src/lib/sfx.js` (add `thud`), create or extend `src/lib/sfx.test.js`.

**Interfaces (produces):** `thud({ gain, pitch = 1, at = null, listener = null, context = audioContext, destination = output }) → boolean` (false when there is no context): a `burst` of band-passed noise (`f: 1800 × pitch, q 1.2, dur 0.09`) and a `blip` (`sine, f: 90 × pitch, dur 0.12, glide 0.5`), gains `0.3 × gain` and `0.18 × gain`, through a `PannerNode` (`panningModel 'equalpower'`, `distanceModel 'linear'`, `maxDistance 60`) at `at` when `at` and `listener` (`{ position: [x, y, z], forward: [x, y, z] }`) are given, else straight to the destination.

- [ ] **Step 1: Write the failing tests** in a new `src/lib/sfx.test.js` with a remembering fake context (copy the shape of `src/components/deathstar/inside/scene/sounds.test.js`’s `fakeAudio`: every node made, what it joins, each param’s scheduled values): `thud({ gain: 1 })` makes one buffer source and one oscillator and schedules a gain peak of `0.3` on the burst; `thud({ gain: 0.5 })` schedules `0.15` (`thud` takes the gain as given; the square is the law’s, in `impact.js`); `thud({ gain: 1, context: () => null })` returns `false` and throws nothing; with `at: [10, 0, 0]` and a listener, a `PannerNode` is made with `positionX 10` and the sources join it, else none is made.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `thud: a knock scaled by force and placed in the room`.

### Task 1B.3: The dust

**Files:** Create `src/lib/three/dust.js`, `src/lib/three/dust.test.js`.

**Interfaces (produces):** `createDust({ count = 256, colour = 0xd9c8a8, size = 0.5, life = 0.8, up = [0, 1, 0] }) → { mesh: InstancedMesh, burst(at: [x, y, z], n = 1, up?), update(dt), used, dispose() }` (`used`: the cards in the air; the mesh is hidden while none are, so idle dust is no draw call); `dustShader(shader) → { vertexShader, fragmentShader, swapped }` (pure). One `InstancedMesh` of `PlaneGeometry(size, size)` with `blob(size)` from `puffs.js` as the map, `transparent`, `depthWrite false`; per-instance attributes `aStart` (time), `aSeed`; the vertex shader faces the camera, rises `0.6 m` over `life`, swells to twice its size and fades to 0; a slot older than `life` is free; `burst` takes the next `n` free slots round `at` (a 0.3 m jitter). `update(dt)` advances the one `uTime` uniform.

- [ ] **Step 1: Write the failing tests**: `dustShader` on stub shaders swaps the two lines and reports it; `burst` twice with `n: 3` leaves 6 slots used and `update(life + 0.01)` frees them; the mesh’s `count` is `count`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Dust: one draw of soft puffs, risen in the shader, for every hit`.

### Task 1B.4: The shake and the pool move down

**Files:** Create `src/lib/three/feel.js` (the HQ’s `feel.js` whole), `src/lib/three/feel.test.js` (new: none exists; `trauma(1)` then `update(3)` leaves the offset under 0.01, `calm` never moves the camera, `hitstop` slows the game’s dt and not the camera’s); `src/lib/three/pool.js`, `src/lib/three/pool.test.js`. Modify `src/components/avengers/hq/feel.js` → `export * from '../../../lib/three/feel';`; `src/components/expanse/surface/scene.js` imports `pool` from `lib/three/pool`.

**Interfaces (produces):** `createFeel` unchanged; `pool(geometry, material, count, name) → { mesh, take(), place(i, position, quaternion, scale), free(i), dispose() }` unchanged.

- [ ] **Step 1: Move the files** (`git mv`), fix imports, write `pool.test.js` (take until −1, free returns a slot, a placed slot’s matrix is not the zero scale).
- [ ] **Step 2: Run** `npm test` → PASS; `node scripts/health.mjs --check --skip build` → no boundary break.
- [ ] **Step 3: Commit** `The shake and the instance pool move down to lib/three, so every world can have them`.

### Task 1B.5: One wiring, and the landings take it

**Files:** Create `src/lib/three/impacts.js`, `src/lib/three/impacts.test.js`. Modify `src/components/universe/landings/physics.js:52-95` (`onHit` passes `(force, at, entry)` through unchanged; nothing else), `src/components/universe/footScene.js:2108, :2575-2590` (`heard` becomes the wiring’s `onHit`; `impactSound` stays for shots).

**Interfaces (produces):** `wireImpacts({ rules = createImpacts(), thud = sfx.thud, dust = null, shake = null, listener = () => null, toWorld = (at) => at, up = null }) → { onHit(force, at, key?), update(dt), dispose() }`: `onHit` asks `rules.hit`, then `thud({ gain, pitch, at: toWorld(at), listener: listener() })`, `dust?.burst(toWorld(at), result.dust, up?.(toWorld(at)))`, `shake?.(result.shake)`; `update` forwards to the dust; `dispose` disposes the dust it was handed. (`up` added in 1B: a planet’s up is not the dust’s +y.) `shake` is a function: a world passes `feel.trauma` or `view.shake`.

- [ ] **Step 1: Write the failing tests** with fakes: a hit of 120 calls the thud once with `gain 1`, bursts 6, shakes 0.15; a hit of 10 calls nothing; `toWorld` is applied to `at`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; wire the landings: a `createDust` in `footScene`’s root scaled by `METRE` (so its units are metres), the listener the walker’s position, facing and up in metres, `toWorld` map units to metres (`at / METRE`), `up` the planet’s normal, `shake` the foot camera’s own kick spring (`S.cam.kick`) for a hit within 12 m, none with reduced motion. (As built: the landing’s `at` stays in map units, as `physics.js`’s contract has it, and the wiring works in metres so the law’s and the panner’s numbers are a barrel’s.)
- [ ] **Step 4: Run** `npm test`; `node scripts/autopilot-check.mjs --only smoke --routes /universe`; by hand in dev: land, kick a barrel, hear it, see the puff.
- [ ] **Step 5: Commit** `Every hit on a landing is heard, seen and felt`. Open the pull request; fill the handoff row.

## Lane 1C: the car (`claude/one-feel-car`)

Owns: `src/lib/vehicleFeel.js`, `src/lib/three/vehicleBody.js`, `src/lib/physics/carTuning.js`, `src/components/expanse/surface/buggy.js`, `src/components/expanse/surface/module.js` (the feel’s step and the chassis `onHit`’s `hit` flag only).

### Task 1C.1: The visible half’s law

**Files:** Create `src/lib/vehicleFeel.js`, `src/lib/vehicleFeel.test.js`.

**Interfaces (produces):** `FEEL = { pitchPer: 0.05 / 9.81 (rad per m/s² of forward acceleration), pitchMax: 0.05, rollPer: 0.11 / 9.81, rollMax: 0.11, squashStiffness: 120, squashDamping: 8, squashPerLanding: 0.05 (per m/s of landing speed), squashPerHit: 0.15, squashMax: 0.3, antenna: { speedStrength: 10, damping: 0.035, pullBackStrength: 0.02, max: 0.6 }, ease: 12 (pitch and roll, a second) }`; `createVehicleFeel(opts = FEEL) → { step({ forwardSpeed = 0, forwardAccel = 0, lateralAccel = 0, steer = 0, airborne = false, landed = 0 (m/s), hit = 0 (gain 0…1) }, dt) → { squash, roll, pitch, antenna: [x, z] }, reset(), set(opts), values() }`; `feelGroups(feel) → groups` (one group `car feel`, every number above). `pitch` and `roll` are eased toward `clamp(accel × per, ±max)` at `ease` a second; `squash` is a damped spring (`s'' = −k s − c s'`) kicked by `landed × squashPerLanding` and `hit × squashPerHit`, clamped to `squashMax`; the antenna is his spring on the chassis acceleration `(forwardAccel, lateralAccel)`: `v += −tip × pullBackStrength − v × damping + accel × speedStrength × dt; tip += v × dt`, clamped to `max`. Numbers from `docs/research/2026-10-06-bruno-simon-folio.md` (the antenna) and Albuquerque’s `scene.js` (the lean).

- [ ] **Step 1: Write the failing tests**: at rest after 2 s every value is 0 within 1e-6; `forwardAccel 9.81` for 1 s pitches to `−0.05` within 1e-3 (back); `lateralAccel −9.81` rolls to `0.11`; `landed 4` squashes above 0.1 within the first 0.1 s and under 0.01 after 1 s; `hit 1` squashes to 0.15 at once; the antenna is 0 at rest, past 0.1 after 0.3 s of `forwardAccel 5`, and crosses 0 (overshoots) within 2 s after the acceleration stops; `set({ rollMax: 0.2 })` holds; `feelGroups` reads and writes.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The car’s visible half: squash, lean and an antenna from real springs`.

### Task 1C.2: The body on the group

**Files:** Create `src/lib/three/vehicleBody.js`, `src/lib/three/vehicleBody.test.js`.

**Interfaces (produces):** `attachVehicleBody({ body: Object3D (the chassis’s meshes under one pivot), antenna = null (a mesh whose base is at its own origin, `segments` optional for a bent one), base = 0 (the body’s y where it meets the wheels) }) → { apply({ squash, roll, pitch, antenna }), dispose() }`: `body.scale.set(1 + squash / 2, 1 − squash, 1 + squash / 2)` about `base` (the pivot moved so the underside stays put), `body.rotation.set(pitch, 0, roll)`; the antenna’s `rotation.x = −antenna[1] × 1.2`, `rotation.z = antenna[0] × 1.2` (a lean, the tip’s displacement as a bend).

- [ ] **Step 1: Write the failing tests** on a `Group` in Node: `apply({ squash: 0.2, … })` gives `scale.y 0.8`, `scale.x 1.1`; the body’s lowest point (its box’s `min.y`) is unchanged; `apply({ pitch: 0.05 })` gives `rotation.x 0.05`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `vehicleBody: the feel put onto the meshes`.

### Task 1C.3: The car’s sliders, and the buggy takes both

**Files:** Create `src/lib/physics/carTuning.js`, `src/lib/physics/carTuning.test.js`. Modify `src/components/expanse/surface/buggy.js` (an antenna: a `CylinderGeometry(0.015, 0.02, 0.7)` in `dark` at `[−0.9, 0.25, −0.6]`, its base at its origin; the body boxes under one `body` pivot; `update(v, steer, dt, feel)` applies the feel), `src/components/expanse/surface/module.js` (a `createVehicleFeel()` stepped from the vehicle’s state each frame: `forwardAccel` from the change in `forwardSpeed`, `lateralAccel` from the chassis’s velocity across its nose, `airborne` when no wheel has contact, `landed` the vertical speed on the frame contact returns, `hit` from the chassis `onHit`’s gain).

**Interfaces (produces):** `carGroups(vehicle) → groups` (one group `car`: `engineForce 0…800`, `topSpeed 0…20`, `topSpeedBoost 0…80`, `brake 0…80`, `idleBrake 0…0.3`, `steering 0…1`, `suspensionStiffness 5…60`, `suspensionCompression 0…20`, `suspensionRelaxation 0…10`, `frictionSlip 0…3`, `sideFrictionStiffness 0…6`), each `set` writing the vehicle’s live spec and, for a wheel number, every wheel through the controller’s setter (`vehicle.js:104-113` names them).

- [ ] **Step 1: Write the failing tests** against the real engine as `vehicle.test.js` does (`createPhysics` in `beforeAll`): `carGroups(vehicle)` has eleven items; `set` on `suspensionStiffness` reads back from `vehicle.controller.wheelSuspensionStiffness(0)`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; wire the buggy and the module.
- [ ] **Step 4: Run** `npm test`; `node scripts/perf-probe.mjs expanseDrive` (worst frame no worse); `node scripts/autopilot-check.mjs --routes /universe/expanse/7 --shots one-feel-car`; by hand: a turn leans the body, a jump’s landing squashes it, the antenna whips.
- [ ] **Step 5: Commit** `The buggy in two halves: its body leans, squashes and carries an antenna`. Open the pull request; fill the handoff row.

## Lane 1D: the panel (`claude/one-feel-panel`)

Owns: `src/lib/debugPanel.js`, `src/lib/debugPanel.test.js`, `src/runtime/debug.js`, `src/runtime/debug.test.js`, `src/runtime/runtime.js` (the `rt.debug` lines, `mount` and `unmount` calls), `src/runtime/module.js` (the header’s contract), `src/runtime/index.js`, `src/lib/three/houseTuning.js`, `src/lib/stage3d.js` (`tune` only), `src/components/galaxy/surface/tune.js`, `src/components/earth/module.js` (a `tune`), `docs/superpowers/HANDOFF-world-runtime.md` (one line: `tune?()`).

### Task 1D.1: The panel grows

**Files:** Modify `src/lib/debugPanel.js`, `src/lib/debugPanel.test.js`.

**Interfaces (produces):** items gain `type: 'bool'` (a checkbox) and `'select'` (`options: string[]`); `debugPanel({ title, groups, code, id = null })`: with `id`, every `set` also writes the values to `sessionStorage` under `tp-tune-<id>` and the panel applies what is stored when it opens (`restore(id, groups)`, pure, exported: returns how many it set; `keep(id, groups)` writes them); the panel object gains `open(groups, { title, id })` and `close()` so one panel serves worlds in turn; `toCode` prints a bool as `true | false` and a select as a quoted string.

- [ ] **Step 1: Write the failing tests**: `toCode` with a bool and a select; `restore` with a fake storage sets only keys the groups have; `debugOn` unchanged.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `The tuning panel takes a switch, a choice, and keeps its values for the tab`.

### Task 1D.2: `rt.debug`, and `tune()` in the contract

**Files:** Create `src/runtime/debug.js`, `src/runtime/debug.test.js`. Modify `src/runtime/runtime.js` (make `rt.debug = createDebug({ on: debugOn() })` once; after a world is placed and `ready`, `rt.debug.show(mod.id, world.tune?.())`; in `unmount` and `handover`’s letting-go, `rt.debug.hide()`; `fromScene` passes a scene’s `tune()` through as the world’s), `src/runtime/module.js` (header: `tune?() → groups (lib/debugPanel), asked once the world is ready when the address has ?debug`), `src/runtime/index.js` (export `createDebug`), `docs/superpowers/HANDOFF-world-runtime.md`.

**Interfaces (produces):** `createDebug({ on = debugOn(), panel = debugPanel }) → { on, show(id, groups), hide(), current }`: `show` with `on` false or `groups` empty or undefined does nothing and logs nothing; with groups, opens (or re-opens) the one panel with `title: id`, `id`; `hide` closes it.

- [ ] **Step 1: Write the failing tests** with a fake panel: off → never made; on with no groups → never made; on with groups → made once with the id; a second `show` re-opens the same panel; `hide` closes.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run src/runtime` → PASS.
- [ ] **Step 5: Commit** `rt.debug: a world’s tune() opens the panel behind ?debug`.

### Task 1D.3: The house’s groups, the stage’s `tune`, and the first two takers

**Files:** Create `src/lib/three/houseTuning.js`, `src/lib/three/houseTuning.test.js`. Modify `src/lib/stage3d.js` (returns `tune(groups)`: when `debugOn()`, opens the panel with its bloom group (`stageBloomGroups(bloomPass)`, `lib/stage3d.js`’s own until 1A’s `bloomGroups` lands) first and the scene’s groups after, under the canvas’s nearest `[data-route]` or the document title; closed in `dispose`), `src/components/galaxy/surface/tune.js` (its `look` group from `houseGroups`, its own kept), `src/components/earth/module.js` (`tune()` with the globe’s own values: exposure, the cloud height, whatever it reads live).

**Interfaces (produces):** `houseGroups(house, { exposure = null } = {}) → groups`: one group `look` with `shadow` (colour), `edgeFrom 0…1`, `edgeTo 0…1.5`, `mix 0…1`, `bounce 0…1`, `fogLow`, `fogHigh` (colours), `fogBelow 0…1.5`, `fogMix 0…1`, and `exposure 0.4…3` when `exposure` is `{ get, set }`.

- [ ] **Step 1: Write the failing tests**: `houseGroups(createHouse())` reads the uniforms back and `set` on `shadow` changes `uLookShadow`; `stage.tune` with `debugOn` false makes nothing (fake `document`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test`; in dev, `/#/galaxy/yavin/surface?debug` and `/#/earth?debug` open the panel; without `?debug`, nothing (the site’s routes are hash routes, and the galaxy’s surface, not its map, is the world on the look).
- [ ] **Step 5: Commit** `One tuning panel for every world: the house’s groups, the stage’s tune, Earth and the surfaces first`. Open the pull request; fill the handoff row.

## Lane 1E: the colliders (`claude/one-feel-colliders`)

Owns: `src/lib/physics/fromModel.js`, `src/lib/physics/fromModel.test.js`, `src/lib/three/colliders.js`, `src/lib/three/colliders.test.js`, `src/lib/three/fixtures/physical.glb` (made by a script in the test, or a `Group` built in Node), `scripts/gen3d/web.mjs`, `docs/assets/colliders.md`, `docs/stack/physics-rapier.md`, `src/components/universe/landings/furnish.js` (the `_physical` branch only), `src/components/universe/landings/bodies.js` (`bodyOf` prefers a model’s nodes).

### Task 1E.1: Bodies from names

**Files:** Create `src/lib/physics/fromModel.js`, `src/lib/physics/fromModel.test.js`.

**Interfaces (produces):** `bodiesFromNodes(nodes, { mass = 0.1 } = {}) → [{ name, desc }]` where a node is `{ name, position: [x, y, z], quaternion: [x, y, z, w], scale: [x, y, z], children: node[], box?: { min: [x, y, z], max: [x, y, z] }, userData?: { mass?, friction?, restitution? } }`. Rules (the spec §6): `/physical/i` makes a body; `/dynamic/i` → `dynamic`, `/kinematic/i` → `kinematicPositionBased`, else `fixed`; children `/^cuboid/i` → `{ shape: 'cuboid', args: scale / 2 }`, `/^ball/i` → `{ shape: 'ball', args: [scale.y / 2] }` (throws `"<node>: a ball needs one scale"` when the three differ by more than 1e-4), `/^cylinder/i` → `[scale.y / 2, scale.x / 2]`, `/^capsule/i` → `[scale.y / 2 − scale.x / 2, scale.x / 2]`, `/^hull/i` and `/^trimesh/i` → the child’s `points` (a `Float32Array` on the node) scaled, a trimesh with the child’s `indices` (a `Uint32Array`, since Rapier’s trimesh takes both); each collider’s `position` and `rotation` the child’s local; no such child → one cuboid from `box`; `desc.mass` from `userData.mass` else `mass` for a dynamic body, unset for a fixed one; `sleeping: true` for a dynamic body; `friction` and `restitution` from `userData` when present. A `physical` node nested in another is its own body (world transform from the parent chain). Each entry also carries its `node`, for `collidersOf` to match its object; `colliderIn(desc, collider)` puts a collider in its body’s frame, for a caller that makes one body of several (the landings).

- [ ] **Step 1: Write the failing tests**: one per shape with the exact args; the default cuboid from a box; type from the name; the nested case; the ball with scale `[1, 2, 1]` throws with the node’s name; `userData.mass 3` carries; a dynamic body sleeps.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Bodies from a model’s node names, his way: physical, fixed, dynamic, and the shapes`.

### Task 1E.2: Reading a loaded model

**Files:** Create `src/lib/three/colliders.js`, `src/lib/three/colliders.test.js`.

**Interfaces (produces):** `collidersOf(root: Object3D, opts) → { bodies: [{ name, desc, object }], hidden: number }`: builds the node list from `root`’s children (transforms relative to `root`, a mesh’s `box` from its geometry’s bounding box, `points` from `position.array` for hulls and trimeshes), hides every `physical` object (`visible = false`), returns `bodiesFromNodes` with the matching objects.

- [ ] **Step 1: Write the failing tests** on a `Group` built in Node: a `Mesh` named `crate_physical_dynamic` with a child `cuboid` scaled `[1, 1, 1]` → one dynamic body, args `[0.5, 0.5, 0.5]`, the mesh hidden; a `barrel_physical` with no child and a `CylinderGeometry` → one cuboid from its box.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `collidersOf: a model’s physical nodes become bodies and vanish`.

### Task 1E.3: The pipeline keeps the names, and the landings read them

**Files:** Modify `scripts/gen3d/web.mjs` (the cut keeps node names and empty `physical` nodes; a `--check-colliders` flag lists the bodies `bodiesFromNodes` would make from the written GLB, through `@gltf-transform`’s node tree), `docs/assets/colliders.md` (new: the convention in a page a modeller reads: the names, the shapes, mass in Blender’s custom properties, one example), `docs/stack/physics-rapier.md` (“How the site uses it”: one bullet), `src/components/universe/landings/furnish.js` and `bodies.js` (a model with `physical` nodes: `collidersOf` over `spec.body`).

- [ ] **Step 1: Write the failing test** `scripts/gen3d/gen3d.test.mjs` gains a case: a GLB written with a `crate_physical_dynamic` node reads back one body.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test`, `node scripts/autopilot-check.mjs --only smoke --routes /universe` → PASS.
- [ ] **Step 5: Commit** `A prop’s physics is modelled: the web cut keeps physical nodes and the landings read them`. Open the pull request; fill the handoff row.

---

# Phase 2: every world (six lanes at once, from `main` once Phase 1 is merged)

Each lane applies the six pieces to every world in its row of the spec’s roster, in this order per world, and commits per world. The interfaces are Phase 1’s (above). A lane with many worlds may split into two pull requests at a world boundary.

### Change of course (read before Phase 2)

The spec’s “Change of course” applies: the Expanse is removed and lane 1C is closed. In the per-world checklist below, do **Step 4 (hits) and a new Step 4b (feel) first**, then Step 5 where a vehicle remains, then Steps 1 to 3, 6 and 7. Step 4b, per game: `feel.hitstop` on a heavy hit (over gain 0.6, 40 to 80 ms); every input eased (`1 − exp(−k·dt)`, never a per-frame lerp); a jump with coyote time (0.1 s) and a buffered press (0.12 s) where the game has one; the camera eased and leading; a respawn under a second; each of these a pure rule with a test where the game’s `rules.js` holds its movement. Lane 2C drops the Expanse. A Phase 2 lane that gives a vehicle the springs cherry-picks `src/lib/vehicleFeel.js`, `src/lib/three/vehicleBody.js` and their tests from `origin/claude/one-feel-car` (the closed PR #700) rather than writing them again.

### The per-world checklist (one task a world)

- [ ] **Step 1: `look.js`.** Write `src/components/<world>/look.js` per the spec §1 and the roster’s art; remove the folder from `looks.test.js`’s `EXPECTED_MISSING`. Run `npx vitest run src/components/worlds/looks.test.js` → PASS for this folder.
- [ ] **Step 2: Tone and bloom.** The scene passes `LOOK.bloom` to `createStage` or `rt.gfx.post`; an ACES line goes (`houseOn` where the world is lit, else `tone: 'none'` with its `why`); every bloom literal goes; emissives that should glow go over 1 (`hot(hex, k)`). Take the before shots on `main` first (`node scripts/autopilot-check.mjs --skip lint,test --routes <route> --shots one-feel-<lane> --before`). After: no literal `threshold:` outside `look.js` (the test); the shots show the same glows and no glowing walls.
- [ ] **Step 3: Art.** A `painted` world has no `wear`, `dress`, `loadPbr` or `loadCore` call and builds new props on `createPalette`; a `scanned` world has no toon ramp; `art-mix` for the folder is 0. What is left mixed on purpose is in `why.art`.
- [ ] **Step 4: Hits.** The world’s hit sources (the roster’s column 3) call one `wireImpacts(...)`’s `onHit(force, at, key)`: a Rapier world hands it to `physics.add`, `addVehicle`, `addProps`’s kinds or `createLandingPhysics`; a world without Rapier scales its bump speed to a force by the mass of what bumped (the spec’s decision) and calls it. A `createDust` in the scene, updated each frame; `shake` is the world’s `feel.trauma` (HQ games) or `view.shake` (a chase view) or its own camera nudge; the listener is the player. Dynamic props are asleep until touched and repeated kinds are drawn through `pool.js` (check `renderer.info.render.calls` at the route before and after: no higher).
- [ ] **Step 5: The car.** Each vehicle in the roster’s column 4 steps a `createVehicleFeel()` from what it knows (speed, acceleration, lateral acceleration or yaw rate × speed, steer, airborne, landing speed, hit gain) and applies it through `attachVehicleBody`; a sine lean goes. A vehicle with no body meshes to lean (a 2D sprite) says so in `look.js`’s `why`.
- [ ] **Step 6: The panel.** A module exports `tune()` returning `[...houseGroups(house), ...bloomGroups(pass), ...carGroups(vehicle), ...feelGroups(feel), ...impactGroups(rules), ...its own]` for what it has; a stage scene calls `stage.tune([...])`. In dev, `<route>?debug` opens it and every slider moves the picture; without `?debug`, nothing.
- [ ] **Step 7: Colliders.** A world that loads a GLB into Rapier reads `collidersOf(model)` first and its hand-written body second; a world without Rapier does nothing here.
- [ ] **Step 8: Check and commit.** `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build && node scripts/autopilot-check.mjs --routes <route> --shots one-feel-<lane>`; read the shots; commit `<World>: one art, the house tone, hits that land, the panel`.

### Lane 2A: Middle-earth (`claude/one-feel-middleearth`)

Worlds, in order: the Shire (its `tune.js` onto `houseGroups`; already has `look.js`), the 12 towns (`towns/*/scene.js`; one `look.js` each, or one `towns/look.js` they share with a per-town `shadow`: the lane decides and says so), the rush (`rush/scene.js`: hits), the bridge, the ring (`own`: all metal), Gorgoroth, the map backdrop (`tone: 'none'`, why). Routes (the page is `/middle-earth/:place?`): `/middle-earth`, `/middle-earth/shire`, `/middle-earth/<place>` for each town (`moria`, `bree`, … as `chapters.js` names them); the rush, the bridge, the ring and Gorgoroth are sections of `/middle-earth` and are checked there.

### Lane 2B: Star Wars (`claude/one-feel-starwars`)

The galaxy map (`galaxy/scene.js`, `module.js`: `own`, its own post says why; `tune`), the surfaces and sites (`galaxy/surface/`: `scanned`; `bump` → hits; speeders and bikes → the feel; `tune.js` already on `houseGroups`), the Death Star and the trench (`deathstar/DeathStar3D.js`, `Trench3D.js`: ACES goes; hits in the trench), inside (`deathstar/inside/`), the cockpit and the hyperspace jump (`own`, `tone: 'none'`, why). Routes: `/galaxy`, `/galaxy/yavin`, `/galaxy/hoth/surface`, `/deathstar`, `/deathstar/inside`, and `/` for the cockpit and the jump (sections of the home page).

### Lane 2C: the universe (`claude/one-feel-universe`)

The map (`universe/scene.js`, `post.js`, `shipyard/showroom.js`: `own` with `universe/palette.js` as its palette; `tune` with the post’s grade), the landings and the foot scene (hits done in 1B; `tune`; `collidersOf` done in 1E; the dust and the pool checked), the Expanse (what Phase 1 left: `tune` with every group; `addProps`’s kinds `onHit`; `art-mix` 0). Routes: `/universe`, `/universe/expanse/7`.

### Lane 2D: the cities (`claude/one-feel-cities`)

Albuquerque (`albuquerque/world/`: `bump` × 1,500 kg → hits; the Aztek onto the feel, its sine lean gone; `casa/`, `metherria/`: ACES goes), the office (`office/stage3d.js` goes: `lib/stage3d` with the office’s options; the toss’s hits; the cars lean), Cybertron (`cybertron/world/`, `game/` (the plated stage `own`, why), `rollout/`, `planet3d.js`, `transform3d.js`: ACES goes; `bump` × 20,000 kg; the truck onto the feel). Routes: `/albuquerque`, `/scranton`, `/cybertron` (the casa, Metherria, the toss, Roll out, the planet and the transformation are sections of those pages; `scripts/autopilot-check.mjs` sees the page, so scroll each section into view by hand in dev and shoot it for the pull request).

### Lane 2E: the games (`claude/one-feel-games`)

The compound and the HQ games (`avengers/hq/engine.js`: `BLOOM` by default, `tune` once for all, each game its own groups; every game’s `feel.trauma` sites now through `wireImpacts` with the dust), Invincible (`invincible/world/`: crash and hard landing × 80 kg; `thinkmark/`, `viewer/`), the Caribbean tide (`caribbean/tide/`: `own` sea, hits). Routes: `/avengers`, `/invincible`, `/caribbean` (the HQ games are sections of `/avengers`; shoot each by hand for the pull request).

### Lane 2F: the rest (`claude/one-feel-rest`)

C-137 (`rickmorty/`: `painted`, toon and ink its art; the ship onto the feel; Roy’s hits; the Neutral lines move to `look.js`), Dot Matrix, Mario 64, Minecraft, Earth (`own`, `tone: 'none'`, why; `tune` for each), Music’s room, Dick-ansh (ACES goes), the cartridges, the GPU stage, and the page scenes (`contact/plane`, `ambience`, `experience/motif3d`, `mist`, `peace`, `travel/*`: `own`, colours as final, by `createRenderer`’s default; a `look.js` each with `why`). Routes: `/c-137`, `/c-137/<moon>` (`universes.js`’s `MOONS`), `/dot-matrix`, `/dot-matrix/64`, `/dot-matrix/minecraft`, `/earth`, `/music`, `/dickansh`, `/projects`, `/home`, `/experience`, `/contact`, `/travel`.

## Self-review (done when this plan was written)

- Spec coverage: §1 → 1A.1, 1A.3, 1A.4 and every Phase 2 step 1 and 3; §2 → 1A.2 and step 2; §3 → 1B.1–1B.5 and step 4; §4 → 1C.1–1C.3 and step 5; §5 → 1D.1–1D.3 and step 6; §6 → 1E.1–1E.3 and step 7; the roster → the six lanes; the goals table → the tests named in each task and `looks.test.js`’s `EXPECTED_MISSING` ratchet.
- Types: `createImpacts().hit` returns `{ gain, pitch, dust, shake, at }` in 1B.1 and `wireImpacts` reads those names in 1B.5; `createVehicleFeel().step` returns `{ squash, roll, pitch, antenna }` and `attachVehicleBody().apply` takes the same; `houseGroups`, `bloomGroups`, `carGroups`, `feelGroups`, `impactGroups` all return `lib/debugPanel` groups, as `rt.debug.show` and `stage.tune` take.
- Review Focus: each of the five has its test in the task named.
- Open choices left to the implementer on purpose: the towns’ shared or per-town `look.js` (2A); which of a world’s camera nudges is its `shake` (step 4); the exact emissive intensities that keep a glow (step 2, judged by the shots).
