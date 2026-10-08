# The universe map’s visual upgrade — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. One checkpoint is one PR, merged before the next begins. Also read `docs/superpowers/HANDOFF-universe-visuals.md` for how to check each checkpoint in a browser.

**Goal:** The universe map is lit by its stars, its planets have air, clouds, seas and ground, its hero ship and its rocks read as metal and stone, and the render is finished (dither, bloom that follows the screen, the sun in the lens, an exposure that eases), with before-and-after evidence at fixed poses on every tier.

**Architecture:** Pure modules with tests for every decision that is numbers (`universe/lighting.js`, `lib/three/flare.js`’s weight, `lib/three/exposure.js`, `lib/three/noise.js`’s blue noise), drawing in the files that already own it (`universe/post.js`, `universe/planets.js`, `universe/belt.js`, `universe/livery.js`, `landings/sky.js`), and shared pieces in `src/lib/three/` the galaxy imports too (`atmosphere.js`, `noiseGlsl.js`, `rock.js`, `explosions.js`, `flare.js`). Every effect names its tier and the `pace` step it drops out at.

**Tech Stack:** three r186 (WebGL, `EffectComposer`), React 19, Vite 8, Vitest (Node environment: no DOM, so pure modules take their browser bits as parameters), headless Chromium through `scripts/autopilot-check.mjs`’s pattern, `sharp` in the bakers.

**Spec:** `docs/superpowers/specs/2026-10-06-universe-visual-upgrade-design.md`

## Global Constraints

- No subagents (the owner’s rule for this repo), unless the owner’s message for the session says otherwise.
- Every scene starts from `lib/device`’s tier and lowers itself under `lib/three/pace`; every new effect honours the effects table in the spec (tier on or off, and the pace step it drops at).
- Textures: WebP, 2K at most on desktop with a `-sm` copy, mipmapped, anisotropy from the tier, sRGB on colour maps only.
- No new texture over 1 MB resident on the GPU; nothing fetched at runtime from an asset service.
- Don’t change the interfaces of `shipModels.js`, `hulls.js`, `livery.js`, `modules.js`, `outfit.js`, `paint.js`, `Hangar.jsx`; hook in through `livery.js`’s `teach` and `lib/three/gltf.js`’s `tune`.
- `post.js` is shared with `galaxy/scene.js` and `galaxy/surface/scene.js`: every checkpoint that touches it is smoke-checked on `/galaxy/hoth` and `/galaxy/tatooine/surface` too.
- Every new `onBeforeCompile` sets `customProgramCacheKey` and composes after any hook already on the material (the `airGlow` pattern); every new variant is compiled by the warm-up (`scene.js`’s `warm`), never on first use.
- British spelling, curly quotes, plain sentences; comments say why. Commit messages: one plain sentence, the harness’s attribution lines, no model names.
- Before each PR: `npx eslint .`, `npx vitest run`, `npx vite build`, `node scripts/autopilot-check.mjs --only smoke --skip lint,test,build --routes /universe,/galaxy/hoth,/galaxy/tatooine/surface`, then `node scripts/universe-check.mjs` on `high`, `mid` and `low`, and the shots looked at.
- The performance budget per pose (spec, “Performance budget”): calls no more than baseline + 6 per checkpoint and never over 420; triangles no more than baseline + 5 %; `low`’s counts unchanged apart from the engines.

## Review Focus

1. A page link straight to a planet (`/universe/rickmorty`) with the sun behind the planet: the visitor must see a lit planet, not a black disc. Pinned in Task 2.3 (`daySideApproach` and the overview pose tests).
2. `prefers-reduced-motion`: the grain, the aberration pulse and the exposure easing must be still. Pinned in Task 1.1 (`grainFor` returns 0 when reduced) and Task 1.5 (`exposureFor` with `reduced` returns the target at once).
3. The pace stepping down mid-flight: an effect that goes must come back when the frames recover, with no leak of its passes or targets. Pinned in Task 1.6 (`post.test.js`: flare off at step 2 and back at step 0; the bloom target resized, not re-made).
4. A planet with no cloud layer, no roughness map or no air (the Office, Dot Matrix, the stations): every planet material must still compile with the new hooks absent. Pinned in Task 3.3 (`planets.test.js`: `styleFor` and `airFor` give null for them, and `buildPlanet` on a stub `T` with no maps makes a material whose cache key has no `clouds` part).
5. The galaxy inherits `post.js`: a system with two suns must get two flares and one exposure; a surface with no star in the solids list must not throw in the occlusion test. Pinned in Task 1.4 (`occluded` with an empty solids list returns 0) and Task 1.6 (`createPost` with `stars: []`).

---

## Checkpoint 0: poses and a baseline

### Task 0.1: the pose hook

**Files:**
- Modify: `src/components/universe/scene.js` (the DEV hook at `window.__universe`, about line 3918)
- Create: `src/components/universe/poses.js`, `src/components/universe/poses.test.js`

**Interfaces:**
- Produces: `POSES` (`poses.js`): `{ [name]: { at: [x, y, z] (the ship, in the map’s space), yaw, pitch, dist, planet?: id, foot?: id } }` for `overview`, `falcon-sun`, `middleearth-limb`, `rickmorty`, `gaming`, `caribbean`, `belt`, `maw`, `landing-middleearth`; `poseFor(name, { positions = POSITIONS, sun = SUN.at, reach = REACH })` → the pose with `at` worked out from the planet’s position and the sun (the day side toward the camera: the camera between the planet and the sun, `dist` radii out) for the planet poses, and as written for the rest.
- `window.__universe().pose(name)` (DEV only): places the ship at `at` with the camera at `yaw`, `pitch`, `dist` behind it, holds the map (`state.yawTo = null`, the ship’s velocity zero, the hunters cleared, the director paused), and for `foot` lands the crew on that planet at noon. Returns a promise that resolves after two drawn frames.

- [ ] **Step 1: Write the failing tests** in `poses.test.js`:

```js
it('puts a planet pose on its day side, dist radii out', () => {
  const p = poseFor('middleearth-limb');
  const planet = POSITIONS.middleearth;
  const toSun = sub(SUN.at, planet); // the pose lies along the planet → sun line
  expect(dot(norm(sub(p.at, planet)), norm(toSun))).toBeGreaterThan(0.85);
  expect(len(sub(p.at, planet)) / REACH.middleearth).toBeCloseTo(p.dist, 1);
});
it('knows every pose the spec names', () => {
  for (const name of ['overview', 'falcon-sun', 'middleearth-limb', 'rickmorty', 'gaming', 'caribbean', 'belt', 'maw', 'landing-middleearth']) expect(poseFor(name)).toBeTruthy();
});
it('the belt pose is inside the belt', () => {
  const r = Math.hypot(poseFor('belt').at[0], poseFor('belt').at[2]);
  expect(r).toBeGreaterThan(BELT.inner); expect(r).toBeLessThan(BELT.outer);
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/universe/poses.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `POSES` and `poseFor` in `poses.js`; add `pose(name)` to the DEV hook in `scene.js` (it uses the scene’s own `state`, `camera` and `foot.begin`; two frames resolve through `ctx.invalidate` and a `requestAnimationFrame` pair).
- [ ] **Step 4: Run** the test. Expected: PASS. In the browser (`npx vite`, `/universe`), run `await window.__universe().pose('falcon-sun')` in the console and look.
- [ ] **Step 5: Commit** `git commit -m "Universe: fixed camera poses for measuring the map"`.

### Task 0.2: the check script and the baseline

**Files:**
- Create: `scripts/universe-check.mjs`
- Modify: `.gitignore` (add `!lab/universe/baseline/` after `lab/`)
- Create: `lab/universe/baseline/{high,mid,low}.json` and the `.webp` shots, from `main` before any later task

**Interfaces:**
- `node scripts/universe-check.mjs [--quality high|mid|low|all] [--poses a,b] [--out lab/universe/<tier>] [--baseline]`: starts `vite preview` (or `--url`) as `autopilot-check.mjs` does, opens `/universe?quality=<tier>` in headless Chromium with `window.__tpKeepFrames = true`, waits for `window.__universe`, for each pose calls `pose(name)`, calls `window.__universeDebug.post.grain(0)` where it exists (Task 1.1 adds it), reads `renderer.info.render.calls` and `.triangles`, times twenty `requestAnimationFrame`s, screenshots at 1280 × 720 to `<out>/<pose>.webp`, and writes `<out>.json` `{ tier, poses: { [name]: { calls, triangles, frameMs } } }`. With `--baseline` the out dir is `lab/universe/baseline/<tier>`. It then runs `.claude/skills/threejs-qa-release/scripts/inspect-threejs-canvas.mjs` on each shot and adds its `metrics` to the JSON. Exit 1 if any pose throws or the canvas is blank.

- [ ] **Step 1: Write** `scripts/universe-check.mjs` on `autopilot-check.mjs`’s server-and-browser pattern (copy its `serve` and `browse` helpers rather than importing: the file is a script).
- [ ] **Step 2: Run** `node scripts/universe-check.mjs --quality all --baseline` on `main` (stash or branch so nothing of later tasks is in). Expected: 27 shots and three JSON files under `lab/universe/baseline/`.
- [ ] **Step 3: Commit** the script, the `.gitignore` line and the baseline: `git commit -m "Universe: a check script that measures the map at fixed poses, and the baseline"`.
- [ ] **Step 4: PR** “Universe: fixed poses and a baseline for the visual upgrade”, CI green, merge.

---

## Checkpoint 1: the render, finished

### Task 1.1: blue noise, dither and grain

**Files:**
- Create: `src/lib/three/noise.js`, `src/lib/three/noise.test.js`
- Modify: `src/components/universe/post.js` (`FINAL` uniforms and fragment; `createPost`)
- Test: `src/components/universe/post.test.js`

**Interfaces:**
- Produces: `blueNoise(size = 64, seed = 1)` → `Float32Array(size × size)` in 0…1, void-and-cluster (a Gaussian energy filter, sigma 1.9, wrapping); `blueNoiseTexture(size, seed)` → a `THREE.DataTexture` (RedFormat, FloatType, RepeatWrapping, NearestFilter, no mipmaps, `colorSpace` none); `grainFor({ rush = 0, reduced = false })` → 0 if reduced, else 0.025 + 0.025 × rush.
- `FINAL` gains `tNoise`, `uNoiseScale` (the canvas size over 64), `uGrain`, `uFrame` (a per-frame offset in texels, 0…63, so the grain moves); the fragment adds `(noise − 0.5) / 255` after the sRGB encode and the grain `(noise − 0.5) × uGrain` to luminance before the shoulder. `post.grain(k)` sets `uGrain` (the check script uses it).

- [ ] **Step 1: Write the failing tests** in `noise.test.js`:

```js
it('is a permutation of the levels: every value once, in 0…1', () => {
  const n = blueNoise(16, 3); const sorted = [...n].sort((a, b) => a - b);
  sorted.forEach((v, i) => expect(v).toBeCloseTo(i / 255, 3));
});
it('has less energy at low frequencies than white noise', () => {
  // the mean absolute difference between neighbours is higher than a shuffled copy’s
  expect(neighbourDiff(blueNoise(32, 5))).toBeGreaterThan(neighbourDiff(shuffle(blueNoise(32, 5))) * 1.15);
});
it('grain is off under reduced motion and rises with the rush', () => {
  expect(grainFor({ reduced: true, rush: 1 })).toBe(0);
  expect(grainFor({ rush: 0 })).toBeCloseTo(0.025); expect(grainFor({ rush: 1 })).toBeCloseTo(0.05);
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/three/noise.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `noise.js`; add the uniforms and the two lines to `FINAL`; set `uFrame` in `post.render` from the frame count; add `grain(k)`.
- [ ] **Step 4: Add to `post.test.js`**: `it('dithers and grains in the final pass')`: the grade pass’s uniforms have `tNoise` and `uGrain` 0.025 by default; `post.grain(0)` sets it to 0. Run `npx vitest run src/components/universe/post.test.js src/lib/three/noise.test.js`. Expected: PASS.
- [ ] **Step 5: In the browser**, `pose('maw')` on `high`: the sky’s gradient round the Maw has no bands at 200 % zoom. Commit `git commit -m "Universe: a blue-noise dither and a little grain in the final pass"`.

### Task 1.2: bloom that follows the screen

**Files:**
- Modify: `src/components/universe/post.js` (`createPost`: `UnrealBloomPass` size; `resize`; the sharpness setter)
- Test: `src/components/universe/post.test.js`

**Interfaces:**
- Produces: `bloomSize(w, h, { small = false, cap = 640 })` → `[bw, bh]`: half of `w × h` (a quarter when `small`), the long side capped at `cap`, never under 64; exported from `post.js`.

- [ ] **Step 1: Write the failing test**: `it('draws the bloom at half the target, capped', () => { expect(bloomSize(2560, 1440)).toEqual([640, 360]); expect(bloomSize(1280, 720)).toEqual([640, 360]); expect(bloomSize(800, 600, { small: true })).toEqual([200, 150]); })`.
- [ ] **Step 2: Run** it. Expected: FAIL.
- [ ] **Step 3: Implement** `bloomSize` and call `bloom.setSize(...bloomSize(w × ratio × sharp, h × ratio × sharp, { small }))` in `resize` and when `sharpness` changes.
- [ ] **Step 4: Run** `post.test.js`. Expected: PASS. `node scripts/universe-check.mjs --quality high --poses overview`: `frameMs` at `overview` no worse than the baseline; the sun’s glow in the shot has no square blocks. Commit `git commit -m "Universe: the bloom is drawn at half the screen, not a fixed 256"`.

### Task 1.3: chromatic aberration at the edges

**Files:**
- Modify: `src/components/universe/post.js` (`FINAL`: `uAberration`; `createPost`: `aberration(k)`; `lite()`/`off()` untouched)
- Test: `src/components/universe/post.test.js`

**Interfaces:**
- Produces: `aberrationFor({ rush = 0, hit = 0, tier = 'high' })` → 0 on `low`, else 0.0015 + 0.0045 × rush + 0.0025 × hit, exported; the pass reads R and B offset by `± uAberration × (uv − 0.5) × vignetteFalloff` (one read each) when `uAberration > 0`, under a `#ifdef ABERRATION` define that `low` leaves out.

- [ ] **Step 1: Write the failing test**: `it('aberration is off on low and grows with the rush and a hit')` with the three values above.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement**; the scene sets `post.aberration(aberrationFor({ rush: state.rush, hit: state.hit, tier }))` where it sets `uRush` today.
- [ ] **Step 4: Run** `post.test.js`; PASS. `pose('maw')` on `high` at a boost: the stars at the edges fringe red and blue; at rest they barely do. Commit `git commit -m "Universe: a touch of chromatic aberration at the edges, more in the boost"`.

### Task 1.4: the sun in the lens

**Files:**
- Create: `src/lib/three/flare.js`, `src/lib/three/flare.test.js`
- Modify: `src/components/universe/scene.js` (make the flares, update them each frame from `lighting.js`’s nearest stars once Task 2.1 lands; until then from the home sun alone), `src/components/galaxy/scene.js` (its suns, from `sky.sunDirs`)
- Test: `src/lib/three/flare.test.js`

**Interfaces:**
- Produces (pure): `flareWeight({ ndc: [x, y], occluded = 0, size = 0.05 })` → 0…1: `size` is the star’s disc radius in clip units; 1 inside the frame, falling to 0 as `max(|x|, |y|)` reaches 1.15, times `(1 − occluded)`; `occluded({ from, to, solids, soften = 0.1 })` → 0…1: the ray from `from` to `to` against `solids` (`[{ at: [x, y, z], r }]`, as `ship.js`’s), 1 when the ray passes within `r` of a solid’s centre, easing to 0 over the last `soften × r` outside, 0 with no solids.
- Produces (drawing): `createFlare({ colour, strength = 1, small = false })` → `{ group (added to the camera), set({ ndc, weight, colour }), dispose }`: five sprites (halo 0.35 of the half-height, four hex ghosts at −0.4, −0.15, 0.3, 0.7 along the line to the centre, a streak 1.2 wide and 0.03 high, a six-point starburst 0.5) painted once in code on a 256 canvas each, additive, `depthTest` off, `renderOrder` 20, drawn before the bloom (they are in the scene, not the post), their sizes in clip units so they are the same on every screen.
- The scene: one flare for the home sun; the second star’s from Task 2.1. Off when `tier === 'low'` or `pace.level >= 2` (weight 0).

- [ ] **Step 1: Write the failing tests**:

```js
it('is full in the frame, gone past the edge', () => {
  expect(flareWeight({ ndc: [0, 0] })).toBe(1);
  expect(flareWeight({ ndc: [1.15, 0] })).toBe(0);
  expect(flareWeight({ ndc: [1.0, 0] })).toBeGreaterThan(0); expect(flareWeight({ ndc: [1.0, 0] })).toBeLessThan(1);
});
it('is cut by occlusion', () => { expect(flareWeight({ ndc: [0, 0], occluded: 1 })).toBe(0); });
it('a planet across the ray hides the star, softly at its limb', () => {
  const solids = [{ at: [0, 0, 5], r: 1 }];
  expect(occluded({ from: [0, 0, 0], to: [0, 0, 10], solids })).toBe(1);
  expect(occluded({ from: [0, 0, 0], to: [0, 3, 10], solids })).toBe(0);
  const limb = occluded({ from: [0, 0, 0], to: [0, 1.04 * 2, 10], solids }); // passes 1.04 r from the centre: inside the soft band
  expect(limb).toBeGreaterThan(0); expect(limb).toBeLessThan(1);
  expect(occluded({ from: [0, 0, 0], to: [0, 0, 10], solids: [] })).toBe(0);
});
```

- [ ] **Step 2: Run** `npx vitest run src/lib/three/flare.test.js`; FAIL. **Step 3: Implement** `flare.js`; wire the scene (the sun’s `ndc` from `camera.projectionMatrix` on the sun’s position each frame; `solids` from `ship.js`’s list without the sun itself).
- [ ] **Step 4: Run**; PASS. Add the flare group to `warm`’s root. `pose('falcon-sun')`: the streak and ghosts show; fly the Falcon between the camera and the sun: the flare dims as the hull crosses it. Commit `git commit -m "Universe: the sun glares in the lens, and what crosses it hides it"`.

### Task 1.5: exposure that eases

**Files:**
- Create: `src/lib/three/exposure.js`, `src/lib/three/exposure.test.js`
- Modify: `src/components/universe/post.js` (`FINAL`: `uExposure` before the shoulder; `exposure(k)`), `src/components/universe/scene.js` (each frame)

**Interfaces:**
- Produces: `exposureFor({ sunShare = 0, darkShare = 0.5, last = 1, dt = 1 / 60, reduced = false })` → the next exposure: target `clamp(1 + 0.25 × darkShare − 0.6 × sunShare, 0.85, 1.25)`, eased toward it at 0.6 per second when rising and 2 per second when falling (linear rate, not a lerp), the target at once when `reduced`; `sunShareOf({ ndc, size })` → the share of the frame the star’s disc and glare cover: `π × (size × 2.5)² / 4` × `flareWeight`-style edge falloff, 0…1.

- [ ] **Step 1: Write the failing tests**: `it('stops down into the sun and opens up in the dark')` (`exposureFor({ sunShare: 1, last: 1, dt: 10 })` → 0.85; `exposureFor({ darkShare: 1, sunShare: 0, last: 1, dt: 10 })` → 1.25); `it('eases at 0.6 a second up and 2 a second down')` (`exposureFor({ darkShare: 1, last: 1, dt: 0.1 })` → 1.06; `exposureFor({ sunShare: 1, last: 1.25, dt: 0.1 })` → 1.05); `it('is instant under reduced motion')`.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement**; the scene keeps `state.exposure` and sets `post.exposure(...)` each frame with `darkShare` from `1 − sunShare` (no readback).
- [ ] **Step 4: Run**; PASS. Turn from the sun to deep space: the Milky Way lifts over a second or so. Commit `git commit -m "Universe: the exposure eases as you turn from the sun into the dark"`.

### Task 1.6: the effects follow the pace, and the galaxy is checked

**Files:**
- Modify: `src/components/universe/post.js` (`setLevel(level)`: flare weight 0 at ≥ 2, aberration define off at ≥ 3), `src/components/universe/scene.js` (call `post.setLevel(pace.level)` where `post.sharpness` is set), `src/components/galaxy/scene.js` (the same call)
- Test: `src/components/universe/post.test.js`

- [ ] **Step 1: Write the failing tests**: `it('drops the flare at pace step 2 and brings it back at 0')` (`createPost(...).setLevel(2)` → `post.flareOn === false`; `setLevel(0)` → true); `it('resizes the bloom target instead of making a new one')` (the `UnrealBloomPass` instance is the same object after two `resize` calls); `it('takes no stars')` (`createPost(renderer, scene, camera, { stars: [] })` does not throw).
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement** `setLevel`. **Step 4: Run**; PASS.
- [ ] **Step 5: Checks**: lint, tests, build, smoke on `/universe,/galaxy/hoth,/galaxy/tatooine/surface`; `node scripts/universe-check.mjs --quality all`; compare each JSON with the baseline (calls ≤ baseline + 6, triangles ≤ + 5 %); look at `maw`, `falcon-sun`, `overview` on `high` and `mid`. Record the scorecard line for “Lighting and render” with the inspector’s `luminance.contrast` at `maw` before and after.
- [ ] **Step 6: PR** “Universe: the render finished: dither, bloom at screen size, the sun in the lens, exposure”, with the shots and the table; CI green; merge. Update the hand-off’s status table in the same PR.

---

## Checkpoint 2: one light

### Task 2.1: the stars and the light at a point

**Files:**
- Create: `src/components/universe/lighting.js`, `src/components/universe/lighting.test.js`

**Interfaces:**
- Produces: `STARS` → `[{ id, at: [x, y, z], colour: '#rrggbb', strength, reach }]`: the home sun (`SUN.at`, `'#ffd6a8'`, 1, 2600), and from `deep.js`’s `WONDERS` every `kind: 'star'` (`color`, strength 0.8, reach 2000), the Twins (both suns, strength 0.5 each), the Lantern (strength 0.3, reach 900, `'#cfe6ff'`), the Graveyard’s white dwarf (0.25, 700). `weightOf(star, point)` → `strength / max(d², r²) × smoothstep(reach × 1.5, reach, d)` (a soft cut). `lightAt(point, { stars = STARS, now = 0, nova = null })` → `{ key: { dir: [x, y, z] (from the star toward the point, unit), colour: [r, g, b] (linear), strength }, fill: { dir, colour, strength }, ambient: [r, g, b] }`: key is the heaviest star, its direction and colour, strength `2.35 × min(1, weight / weightOf(home sun at 300 units))` floored at 0.9 (deep space is never black); fill the second heaviest where its weight is over a tenth of the first, else `[0.7, −0.4, −0.3]` normalised at `'#8ea2ff'` × 0.45; ambient `'#b8c4ff'` × 0.4 tinted a quarter toward the nearest nebula’s colour within its reach (`WONDERS` with `kind: 'nebula'`). `sunFor(planetId, { positions = POSITIONS, stars = STARS })` → the unit direction from the planet toward its heaviest star. `nova`, when given (`{ at, colour, strength }`), is one more star.

- [ ] **Step 1: Write the failing tests**:

```js
it('the home sun lights the home system from where it is', () => {
  const l = lightAt([200, 0, 0]);
  expect(l.key.dir).toEqual(close([1, 0, 0])); expect(l.key.strength).toBeCloseTo(2.35, 1);
});
it('Ember lights its own neighbourhood in its colour', () => {
  const ember = STARS.find((s) => s.id === 'ember');
  const l = lightAt([ember.at[0] + 200, ember.at[1], ember.at[2]]);
  expect(l.key.colour[0]).toBeGreaterThan(l.key.colour[2]); // orange
});
it('between stars the key turns over, never under the floor', () => {
  const l = lightAt([0, 0, -6000]);
  expect(l.key.strength).toBeGreaterThanOrEqual(0.9);
});
it('a planet’s sun is the home sun for the fandoms’ worlds', () => {
  const d = sunFor('middleearth'); const p = POSITIONS.middleearth;
  expect(dot(d, norm(neg(p)))).toBeGreaterThan(0.99);
});
it('a nova is a star while it burns', () => {
  const l = lightAt([100, 0, 100], { nova: { at: [120, 0, 100], colour: '#ffffff', strength: 3 } });
  expect(l.key.dir).toEqual(close([-1, 0, 0]));
});
```

- [ ] **Step 2: Run** `npx vitest run src/components/universe/lighting.test.js`; FAIL. **Step 3: Implement** `lighting.js`. **Step 4: Run**; PASS. Commit `git commit -m "Universe: which star lights a point, as plain numbers"`.

### Task 2.2: the scene’s lights follow the stars

**Files:**
- Modify: `src/components/universe/scene.js` (the key, fill and ambient near line 490; the per-frame update; `post.js`’s `LIGHT` uniform), `src/components/universe/post.js` (`setLight(dir, colour)` for `spaceEnvironment`’s hot spot; `LIGHT` stays exported as the default), `src/components/universe/planets.js` (`buildPlanet(u, T, { sun })`: `uSunW`, `uLight` set from `sun`; `LIGHT` stays the default), `src/components/universe/deepspace.js` and `supernova.js` (the nova tells the scene `{ at, colour, strength }` while it burns)

- [ ] **Step 1: Write the failing test** in `planets.test.js`: `it('a planet takes the sun it is given')`: `buildPlanet(byId('middleearth'), {}, { sun: [0, 0, 1] })` → `p.air.material.uniforms.uLight.value` equals `(0, 0, 1)` and `p.body.material.userData.air.uSunW.value` too.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement**: the scene calls `lightAt(camLocal, { nova })` each frame, eases `key.position` (direction × 50) and the colours at 2 per second (linear rate on each component), sets the ambient; the planets are built with `sunFor(id)`; `spaceEnvironment` is rebuilt only when the key star changes id (a `PMREM` costs a frame: not every frame). Each flare from Task 1.4 reads its star from `STARS` by weight (the two heaviest).
- [ ] **Step 4: Run** `planets.test.js`; PASS. `pose('middleearth-limb')` and `pose('caribbean')`: the terminator faces the sun (the sun is on the lit side of the screen). Fly from home to Ember: the light turns orange over the trip. Commit `git commit -m "Universe: the planets, the ship and the traffic are lit by the nearest star"`.

### Task 2.3: day sides face the visitor

**Files:**
- Modify: `src/components/universe/lighting.js` (`daySideApproach`), `src/components/universe/flight.js` (`focusPose`), `src/components/universe/ship.js` (`startAt`, `parkAt`), `src/components/universe/nav.js` (`parkFor`), `src/components/universe/scene.js` (the overview)
- Test: `lighting.test.js`, `flight.test.js`, `ship.test.js`, `nav.test.js`

**Interfaces:**
- Produces: `daySideApproach(at, sunDir, radius, from, { dist = 2.2 })` → `[x, y, z]`: a point `dist × radius` from `at`, on the hemisphere facing `sunDir`, nearest the direction of `from` (project `from − at` onto the plane of the day hemisphere’s rim if it is on the night side, else keep its direction).

- [ ] **Step 1: Write the failing tests**: in `lighting.test.js`, `it('arrives on the day side, nearest where you came from')` (from the night side the result has `dot(norm(result − at), sunDir) >= 0`; from the day side it keeps the direction); in `ship.test.js`, `it('parks on the day side')` (`parkAt('middleearth', from)` for a `from` behind the planet gives a point with a non-negative dot with `sunFor('middleearth')`); in `flight.test.js`, `it('the focus pose looks at the day side')`; in `nav.test.js`, `it('a jump comes out on the day side')`.
- [ ] **Step 2: Run** the four; FAIL. **Step 3: Implement**. **Step 4: Run**; PASS.
- [ ] **Step 5: Checks** (the full list), `universe-check` on all tiers, every `/universe/:id` link opened once and the planet seen lit. Commit, PR “Universe: one light: the stars light what is near them, and arrivals face the day side”, CI, merge, hand-off table.

---

## Checkpoint 3: air, clouds, seas and ground

### Task 3.1: the atmosphere moves to `lib/three`

**Files:**
- Create: `src/lib/three/atmosphere.js`, `src/lib/three/atmosphere.test.js`, `src/lib/three/noiseGlsl.js`
- Modify: `src/components/galaxy/bodyShaders.js` (`NOISE`, `SHELL_VERT`, `SHELL_FRAG` re-exported from the new files), `src/components/galaxy/bodies.js` (`createAtmosphere` in place of its own `shellMat`)

**Interfaces:**
- Produces: `createAtmosphere({ radius, top = 1.06, colour, density = 2, falloff = 3.5, sunset = '#ffa070', glow = 0.8, suns = [], segments = [64, 40], steps = 8 })` → `{ mesh, set({ suns: [{ dir: [x, y, z], colour: '#rrggbb' | [r, g, b] }], strength }), params, dispose }`: `mesh` is the shell (`BackSide`, additive, no depth write), its fragment `SHELL_FRAG` with `#define STEPS <steps>`; `set` writes `uSunDir`/`uSunCol` (two slots, the second black when one sun) and `uStrength` (a multiplier on the inscatter; the planets’ `RIM` hover brightening uses it). `atmosphereParams(air)` → `{ uAtmo, uAtmoP, uSunset }` as `bodies.js` builds them, pure and tested. `NOISE` glsl exported from `noiseGlsl.js`.

- [ ] **Step 1: Write the failing test** in `atmosphere.test.js`: `it('turns an air description into the shell’s uniforms')` (`atmosphereParams({ colour: '#a6ccff', density: 2.2, top: 1.065, falloff: 3.5, glow: 0.8 })` → `uAtmoP` `[1.065, 3.5, 2.2, 0.8]` and `uAtmo` the colour in linear). `it('a shell with one sun has a black second slot')`.
- [ ] **Step 2: Run**; FAIL. **Step 3: Move** the shaders and implement; `bodies.js` keeps its behaviour (its `setSuns` calls `set`). **Step 4: Run** `npx vitest run src/lib/three src/components/galaxy`; PASS. `node scripts/galaxy-check.mjs space hoth` draws as before. Commit `git commit -m "The galaxy’s atmosphere shell moves to lib/three, for the universe map to share"`.

### Task 3.2: air round the fandoms’ planets

**Files:**
- Modify: `src/components/universe/universes.js` (`air` per fandom planet: Middle-earth `{ colour: '#9fc4ff', density: 1.8, top: 1.05, sunset: '#ffb070' }`; the Caribbean `{ colour: '#bfe4ff', density: 2.4, top: 1.055 }`; Breaking Bad `{ colour: '#ffd9a8', density: 1.6, top: 1.045, sunset: '#ff8a50' }`; C-137 `{ colour: '#b8ff5a', density: 2.0, top: 1.05, flat: true }`; Cybertron `{ colour: '#a98cff', density: 0.9, top: 1.04 }`; Invincible `{ colour: '#ffc9a0', density: 2.8, top: 1.06 }`; Travel `{ colour: '#8fc1ff', density: 2.2, top: 1.05 }`; Marvel `{ colour: '#ffd27a', density: 1.4, top: 1.05 }`; Music `{ colour: '#ffb060', density: 1.2, top: 1.05 }`; the Office `{ rim: '#f0e6d0' }` (a soft rim, no air); Dot Matrix none), `src/components/universe/planets.js` (`halo` → `createAtmosphere` on `high` and `mid`, `haloMaterial` kept for `low`; `airGlow` keeps the night lights and loses the rim where the planet has `air`; `setState` scales `strength` by `RIM`), `src/components/universe/universes.test.js`, `src/components/universe/planets.test.js`

- [ ] **Step 1: Write the failing tests**: `universes.test.js`: `it('every fandom planet says what its air is, or that it has none')` (each `kind: 'fandom'` entry has `air` or `airless` or `air === null` explicitly for Dot Matrix); `planets.test.js`: `it('a planet with air wears the shell on high and the halo on low')` (`buildPlanet(u, T, { sun, tier: 'high' })`’s `air.material.fragmentShader` includes `inscatter`; with `tier: 'low'` it is the halo’s).
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement**; the steps are 8 on `high`, 5 on `mid`; the scene’s `lowerQuality` and pace step 3 swap each planet’s shell for the halo (`p.setAir('halo' | 'shell')`, both built, one visible). Add the shells to `warm`.
- [ ] **Step 4: Run**; PASS. `pose('middleearth-limb')`: a blue-white limb on the sun side, warm at the terminator, dark on the night side. Commit `git commit -m "Universe: real air round the fandoms’ planets, from the galaxy’s own shell"`.

### Task 3.3: cloud shadows, seas and ground that comes up

**Files:**
- Modify: `src/components/universe/planets.js` (`cloudShadow(mat, cloudTex, { alpha })` hook with `uCloudTurn`, `uSunW`; `groundDetail(mat, tile, radius)` hook with `uCamDist`; a shared `detailTile()` built once from `lib/texture.js`’s noise at 512; each planet builder with clouds registers `p.cloudLayer`), `scripts/planets/rickmorty.mjs` and `scripts/build-invincible-planet.mjs` (a roughness map: sea 0.25, land 0.9), `src/components/universe/planets.js`’s `MAPS` (`rickmorty-rough`, `invincible-rough`)
- Test: `src/components/universe/planets.test.js`

**Interfaces:**
- Produces: `styleFor(u, T)` → `{ clouds: texture | null, alpha: bool, rough: texture | null, detail: bool }` pure over the data (what the hooks are given); the hooks compose after `airGlow` with cache keys `clouds`, `detail`.

- [ ] **Step 1: Write the failing tests**: `it('planets without clouds or air get no hooks')` (`styleFor(byId('office'), {})` → `{ clouds: null, rough: null, detail: true }`; `buildPlanet(byId('gaming'), {}).body.material.customProgramCacheKey()` has no `clouds`); `it('the roughness maps for C-137 and Invincible are in MAPS and on disk')` (extend the existing “all there” test’s list).
- [ ] **Step 2: Run**; FAIL. **Step 3: Bake** the two roughness maps (then `node scripts/build-fandom-planets.mjs rickmorty`, `node scripts/build-invincible-planet.mjs`; now `node scripts/planets/bake.mjs --only rickmorty,invincible`), implement the hooks (cloud shadow darkens diffuse by up to 0.55; detail fades in from 3 radii to 1.3, off on `low`; the specular’s roughness floor 0.22 by clamping the roughness map read in the same hook). The scene sets each planet’s `uCamDist` from the camera each frame (only for the nearest two planets; the rest hold 1e9).
- [ ] **Step 4: Run**; PASS. `pose('caribbean')`: a glint on the sea, cloud shadows on the banks; fly to one radius: the ground mottles rather than blurs. Commit `git commit -m "Universe: clouds shadow the ground, seas catch the sun, the ground comes up as you come in"`.

### Task 3.4: the missing high sets

**Files:**
- Modify: `scripts/planets/caribbean.mjs`, `scripts/build-invincible-planet.mjs`, `scripts/build-cybertron-planet.mjs` (since moved to `scripts/planets/invincible.mjs`, `transformers.mjs`) (an `-hq` normal at 2048), `src/components/universe/planets.js`’s `MAPS` (`caribbean-normal`, `invincible-normal`, `transformers-normal-sm` → the three gain `hq: true`; Cybertron’s standard normal is named `transformers-normal` with `-sm` and `-hq` variants, the loader’s old name kept as an alias), `src/components/universe/planets.test.js` (the file check)

- [ ] **Step 1: Extend** the “all there” test’s expectation to the new files. Run; FAIL. **Step 2: Bake** them; sizes recorded in the commit body (each `-hq` normal under 1.2 MB as WebP lossless-ish q95, else q90). **Step 3: Run**; PASS. `?quality=ultra` at `pose('caribbean')`: the reefs’ relief is crisp at full zoom.
- [ ] **Step 4: Checks**, `universe-check` on all tiers (`middleearth-limb` on `mid` no slower than baseline, else `steps` 5 → 4 before the halo), PR “Universe: air, cloud shadows, seas and ground on the fandoms’ planets”, CI, merge, hand-off table.

---

## Checkpoint 4: the styles in the light

### Task 4.1: C-137, cel-shaded

**Files:**
- Modify: `scripts/planets/rickmorty.mjs` (posterised biomes, ink edges on the biome id two texels wide at 2048, craters with rim and cast shadow, flat lime ooze in the glow map), `src/components/universe/planets.js` (`celShade(mat, { bands: [0.55, 0.15], levels: [1, 0.72, 0.45], ink: 8 })` hook; the C-137 builder uses it and a two-band flat air: `air.flat` → the shell’s `uStrength` quantised in the shader by a `#define FLAT`), `src/lib/three/atmosphere.js` (`flat` option: the inscatter posterised to two bands)
- Test: `src/components/universe/planets.test.js`, `src/lib/three/atmosphere.test.js`

- [ ] **Step 1: Write the failing tests**: `it('C-137 is cel-shaded with an inked limb')` (`buildPlanet(byId('rickmorty'), {}).body.material.customProgramCacheKey()` includes `cel`); `it('a flat air is two bands')` (`createAtmosphere({ …, flat: true }).mesh.material.fragmentShader` includes `#define FLAT`).
- [ ] **Step 2: Run**; FAIL. **Step 3: Rebake** the C-137 maps and implement the hook (diffuse quantised with a two-texel soft edge computed from `fwidth(nDotL)`, specular zero, limb darkened by `pow(1 − n·v, 8) × 0.8`).
- [ ] **Step 4: Run**; PASS. `pose('rickmorty')` before and after: the planet reads as a drawing from the show, with the inspector’s `colorEntropyBits` lower (flatter) and `edgeDensity` higher (inked). Commit `git commit -m "C-137’s planet is drawn in the show’s cel style and lit in three bands"`.

### Task 4.2: Dot Matrix, dithered

**Files:**
- Modify: `src/components/universe/planets.js` (`ditherShade(mat, { palette: the four greens, bayer: 4 })` hook: the lit level against a 4 × 4 Bayer threshold at `gl_FragCoord / uDpr` picks one of the four tones; the clouds and the limb outline the same; `uDpr` set from the renderer’s pixel ratio × `post.sharpness`)
- Test: `planets.test.js`

- [ ] **Step 1: Write the failing test**: `it('Dot Matrix is dithered in four greens')` (cache key includes `dither`; the material’s `uPalette` has four colours equal to the Game Boy palette in `universes.js`).
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement**; the scene sets `uDpr` where it sets `uDpr` for the stars. **Step 4: Run**; PASS. `pose('gaming')`: the terminator is a Bayer pattern, dots the same size at `?quality=high` and `?quality=mid`. Commit `git commit -m "Dot Matrix is lit in four greens with an ordered dither"`.

### Task 4.3: paper, and the seams in the key’s colour

**Files:**
- Modify: `src/components/universe/planets.js` (the Office: `MeshPhysicalMaterial` with `sheen` 0.6 in `#f3ecd8`, `sheenRoughness` 0.8; Cybertron: `cybertronSkin`’s glow colour multiplied by the key’s colour through a `uKeyColour` uniform the scene sets), `scripts/planets/office.mjs` (an `-hq` normal if missing), `src/components/cybertron/skin.js` (the uniform; its tests)

- [ ] **Step 1: Write the failing tests**: `it('the Office is paper')` (`buildPlanet(byId('office'), {}).body.material.isMeshPhysicalMaterial` and `sheen` 0.6); in `cybertron/skin.test.js` (or the nearest existing test), `it('the seams take the key light’s colour')`.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement**. **Step 4: Run**; PASS. **Step 5: Checks**, the warm-up variant count (extend `precompile.test.js` with `it('the map’s planets make at most 24 program variants')` over a count exported from `planets.js`, `VARIANTS`), `universe-check`, PR “The fandoms’ planets are lit in their own styles: cel, dither, paper”, CI, merge, hand-off table.

---

## Checkpoint 5: the hero ship

### Task 5.1: tuned on load, with anisotropy from the tier

**Files:**
- Modify: `src/lib/three/gltf.js` (`SHIP_PROFILE = { roughness: [0.42, 0.72], metalness: { metal: 0.65, paint: 0.1 }, envMapIntensity: 1.3 }` exported; `tuneTree(root, SHIP_PROFILE)` applies it), `src/components/universe/shipModels.js` (`dress` calls `tuneTree` with the profile and `sharpenTree`), `src/components/universe/hulls.js` and `trafficKit.js` (anisotropy 8 → `sharpen`)
- Test: `src/lib/three/gltf.test.js`

- [ ] **Step 1: Write the failing test**: `it('the ship profile clamps a clay export into paint and metal')`: a `MeshStandardMaterial` named `hull` with roughness 1 → 0.72, metalness 0.1; one named `metal_trim` → metalness 0.65; `envMapIntensity` 1.3 on both.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement**. **Step 4: Run**; PASS, and `grep -n 'anisotropy = 8' src/components/universe/*.js` finds nothing. `pose('falcon-sun')`: the hull has a specular that reads as metal. Commit `git commit -m "The hero ships are tuned on load: paint and metal, not clay, and sharp to the horizon"`.

### Task 5.2: a rim from the stars

**Files:**
- Modify: `src/components/universe/livery.js` (`teach` adds `uRimColour`, `uRimDir`, `uRimStrength` 0.35 and a line after `PAINT`: emissive += rim colour × `pow(1 − n·v, 3)` × `max(0, n·rimDir)`; `set` untouched; a new `rim({ colour, dir })` on the livery, the scene calls it with `lightAt`’s fill each frame)
- Test: `src/components/universe/livery.test.js` (new, small: the uniforms exist after `apply`; `rim` writes them; the paint uniforms are unchanged by `rim`)

- [ ] **Step 1: Write the failing tests**. **Step 2: Run**; FAIL. **Step 3: Implement**. **Step 4: Run**; PASS. `pose('falcon-sun')`: the Falcon’s edge away from the sun is lit cool. Commit `git commit -m "The ship’s edges catch the sky’s light, so it stands off the dark"`.

### Task 5.3: engines with the throttle

**Files:**
- Create: `src/components/universe/engines.js`, `src/components/universe/engines.test.js`
- Modify: `src/components/universe/shipModels.js` (`buildShip` makes `engines` from `createEngines` and `drive` sets its throttle), `src/components/universe/glbFleet.js` and `trafficModels.js` (each kind’s `ENGINES` entry: positions, radius, colour; kinds without one get `guessEngines(box)`: the stern face’s centre), `src/components/universe/traffic.js`, `hunters.js` (set throttle from speed)
- Test: `engines.test.js`

**Interfaces:**
- Produces: `ENGINES: { [kind]: [{ at: [x, y, z], r, colour }] }` (the Falcon from `FALCON_ENGINES` with `r` 0.05 and `'#8fd0ff'`; the X-wing from `XWING_ENGINES` with `'#ffb0c8'`; `rv` two jets `'#ffb060'`; `cruiser` a ring `'#7dff9a'`; the traffic kinds by hand); `guessEngines(size)` → one entry at the stern; `glowSize(throttle, boost, min = 0.004)` → the quad’s half-size, pure: `max(min, r × (0.6 + 0.9 × throttle + 1.2 × boost))`; `createEngines({ parent, max = 256 })` → `{ add(kind, object) → handle, set(handle, { throttle, boost }), remove(handle), update(t, camera), dispose }`: one `InstancedMesh` of additive quads facing the camera, a hot core past 1.7 so the bloom catches it, flickering by `uTime`, a minimum size on screen of 3 px.

- [ ] **Step 1: Write the failing tests**: `it('every ship kind has engines, guessed from its stern where none are listed')`; `it('the glow grows with the throttle and the boost, never under its floor')` (`glowSize(0, 0, 0.004)` → `max(0.004, 0.6 r)`; `glowSize(1, 1)` → 2.7 r).
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement**. **Step 4: Run**; PASS. Boost: the Falcon’s band flares; far traffic glints. Commit `git commit -m "Every ship’s engines glow with its throttle, as one draw"`.
- [ ] **Step 5: Checks**, `universe-check` (calls at `overview` ≤ baseline + 6), the inspector’s `luminance.contrast` on the ship’s crop at `falcon-sun` before and after in the PR, PR “The hero ship: tuned, rimmed, and its engines lit”, CI, merge, hand-off table.

---

## Checkpoint 6: rock

### Task 6.1: one rock material

**Files:**
- Create: `src/lib/three/rock.js`, `src/lib/three/rock.test.js`
- Modify: `src/components/universe/belt.js` (`rockMaterial` in place of its `MeshStandardMaterial`; a fourth, bigger cratered shape for one rock in forty, `rock(seed, { craters: true })`), `src/components/universe/meteors.js` and `deepspace.js`’s rock streams (the same material)

**Interfaces:**
- Produces: `rockMaterial({ tones = 2, tier = 'high', scale = 1 })` → a `MeshStandardMaterial` (roughness 0.92, metalness 0.05, `flatShading` off) with an `onBeforeCompile` (cache key `rock`) that, on `high` and `mid`, adds triplanar `noised` (from `noiseGlsl.js`) in object space: albedo mixed between the instance colour and a darker pit tone by the noise, the normal tilted by the noise gradient × 0.6, roughness + 0.05 in the pits; `low` gets the flat material as before. `rockShapes(rand, { craters })` → the geometries (three as now, the fourth with eight craters pressed in).

- [ ] **Step 1: Write the failing tests**: `it('the rock material has relief on high and none on low')` (cache key `rock` on `high`; the plain material’s `onBeforeCompile` is the default on `low`); `it('one rock in forty is a boulder')` (over 400 seeded picks, the fourth shape is chosen 8–12 times).
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement**. **Step 4: Run**; PASS. `pose('belt')`: rocks with pits and a lit side; counts unchanged. Commit, checks, `universe-check`, PR “The belt and the rim are rock: relief, variation, a few boulders”, CI, merge, hand-off table.

---

## Checkpoint 7: what burns

### Task 7.1: explosions, pooled

**Files:**
- Create: `src/lib/three/explosions.js`, `src/lib/three/explosions.test.js`
- Modify: `src/components/universe/hunters.js` (where a hunter is removed as shot down: `burst` at its position, size by its kind), `src/components/universe/skirmishes.js` (a ship the fight ends), `src/components/universe/crash.js` (the ship’s own crash adds a burst to the shockwave), `src/components/universe/scene.js` (make it, update it, `lowerQuality` and pace step 2 set `pop` mode)

**Interfaces:**
- Produces: `explosionPlan(size, tint, t)` → pure: `{ fire: { radius, colour: [r, g, b], alpha }, shards: n (24, 0 under 0.1 units), ring: bool (size > 0.3) }` over 1.4 s (fire swells to 2.2 × size by 0.4 s and cools white → orange → `[0.2, 0.18, 0.17]` by 1.4 s); `createExplosions({ parent, small = false, pool = 6 })` → `{ burst(at, size, tint), update(dt, t), setMode('full' | 'pop'), dispose }`: one billboard mesh per pooled blast with a noise fireball shader, one `InstancedMesh` of 24 × pool shards, one of pool rings.

- [ ] **Step 1: Write the failing tests**: `it('a blast swells, cools and is gone by 1.4 s')`; `it('a small blast has no ring and a fighter’s has no shards under 0.1 units')`; `it('pop mode bursts nothing')` (`setMode('pop')` then `burst` leaves every pooled mesh invisible).
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement**; the galaxy’s `fx.js` is left to call it in its own lane (a one-line note in `HANDOFF-galaxy-upgrade.md`). **Step 4: Run**; PASS. Shoot a TIE down: a fireball and shards. Commit, checks, `universe-check` (a blast at `falcon-sun` within the call budget), PR “What is shot down burns: pooled explosions”, CI, merge, hand-off table.

---

## Checkpoint 8: the sky on foot

### Task 8.1: the landing’s sky from the planet’s air

**Files:**
- Modify: `src/components/universe/landings/sky.js` (`createSky(sky, air)`: when `air` has the Task 3.2 shape, the dome’s colours come from `skyColoursFor(air, sunUp)` and the sun’s disc gets a flare through `createFlare` against the landing’s solids), `src/lib/three/atmosphere.js` (`skyColoursFor(air, sunElevation)` → `{ zenith: [r, g, b], horizon, sun }`: the single-scatter evaluated for a ground camera along two directions, pure), `src/components/universe/landings/landings.js` (keep `sky` overrides for the planets with no air; add a test that every landing with air gets colours within 0.15 of its hand-set ones at noon, so nothing shifts far)
- Test: `src/lib/three/atmosphere.test.js`, `src/components/universe/landings/landings.test.js`

- [ ] **Step 1: Write the failing tests**: `it('a clear blue air gives a blue zenith and a pale horizon at noon')` (`skyColoursFor(middleEarthAir, 1)`: zenith’s b > r, horizon’s luminance > zenith’s); `it('at sunset the horizon warms')` (`skyColoursFor(air, 0.05)`: horizon’s r > b); `it('every landing’s sky stays near its hand-set colours at noon')`.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement**. **Step 4: Run**; PASS. `pose('landing-middleearth')`: the sky from the ground matches the limb from orbit; the sun has its glare; `node scripts/landing-check.mjs` passes. Commit, checks, PR “The sky on foot comes from the same air as the limb from orbit”, CI, merge, hand-off table, and the final scorecard in `HANDOFF-universe-visuals.md`.
