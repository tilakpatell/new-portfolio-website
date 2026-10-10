# The galaxy's engine, lane R: the light. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, yourself, in order. Steps use checkbox (`- [ ]`) syntax for tracking. Build directly; one judge pass at most before the PR.

**Goal:** One render stack under `src/lib/three/light/` that any `'nodes'` world takes with one call: the game's sun with cascaded shadows, its placed lights clustered, its probes as environments, its sky and fog as TSL, and a post chain (SSGI, ambient occlusion, reflections, bloom, god rays, lens flare, grading, temporal anti-aliasing) described as data and built by the runtime. Proved on the runtime's lit fixture on both backend kinds, with the frame-time table.

**Architecture:** Each idea is one file under `src/lib/three/light/` with its pure part tested in Node (`cascadesFor`, `splitsFor`, `lightsFor`, `lumensToCandela`, `probeFor`, `passesFor`) and its three/TSL part loaded dynamically. `src/runtime/webgpu.js`'s `buildPostProcessing` learns the new pass kinds. `src/runtime/look.js` gains `applyGameLight(scene, renderer, entry, tier)` that wires the stack from lane G's `siteLightFrom` entry. A script writes each level's placed lights beside lane L's pack.

**Tech Stack:** three `^0.186.1`: `three/webgpu`, `three/tsl`, `three/addons/lights/SunLight.js` and `SunLightNode.js`, `three/addons/lighting/ClusteredLighting.js`, `three/addons/lighting/LightProbeGrid.js`, `three/addons/tsl/display/{SSGINode,SSRNode,GTAONode,TRAANode,RecurrentDenoiseNode,DenoiseNode,GodraysNode,LensflareNode,Lut3DNode,SMAANode,BloomNode}.js`; `src/runtime/` (`backend.js`, `gfx.js`, `webgpu.js`, `look.js`, `fixtures/nodesWorld.js`); lane G's `src/lib/three/gameLight.js` (on `claude/bf2017-g-light`; read it there, do not copy it); Vitest; `scripts/perf-probe.mjs` with `GPU=webgl|webgpu`; `scripts/gpu-parity.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-10-galaxy-engine-design.md` ("The light").

## Global Constraints

- **Files this lane owns**: `src/lib/three/light/*` (+ tests), `scripts/bf2017-lights.mjs`, `scripts/lib/bf2017-lights.mjs` (+ test), `src/runtime/webgpu.js` (the pass kinds: additive), `src/runtime/look.js` (`applyGameLight`: additive), `src/runtime/fixtures/litWorld.js` (new), `docs/stack/webgpu-tsl.md` ("Where it is used": the new addons). Nothing under `src/components/`. Lane T wires the surface; lane 5 of the game wires Battlefront.
- **Every addon import is dynamic** and lives in `src/lib/three/light/` only; `scripts/health/` counts imports and `docs/stack/three.md` names the rule.
- **Pure first**: no file in `light/` imports three at module scope except through the one `loadThree()` helper; the pure functions take plain data.
- **Numbers from the records** (lane G's entry) or named constants with a comment (`CSM_CASCADES = 4`, `CSM_MAX_FAR = 600`, `POINT_POOL = 1024`, `SPOT_POOL = 16`, `PROBE_GRID = [8, 3, 8]`, the SSGI presets as three's doc gives them).
- The key for the private bucket comes from `.env.local` (`BF2017_KEY`), never from a commit; the script says which file it read and fails plainly without one.
- Files under 800 lines; tests beside; no network in tests; the gates (`npm run lint`, `npm test`, `node scripts/health/measure.mjs` where it exists).

## Review Focus

1. **`ClusteredLighting` and the environment** (spec A2): three issue #34763 says `DynamicLighting` drops `scene.environment`, ambient occlusion and light maps. Task 1's fixture test renders the lit cube under `ClusteredLighting` with an environment and asserts the pixel differs from the no-environment render; if it does not, the placed lights go to a fixed pool of 64 on the default lighting, `placed.js` says `CLUSTERED = false`, and the PR says why.
2. **Spots** (spec A1): read `ClusteredLighting.js`'s `createNode` for what it clusters; spots either cluster or take the `SPOT_POOL` path. The test asserts the pool is never grown after creation (no recompile: count the renderer's `info.programs` before and after a light moves).
3. **The post order** is fixed in `post.js` and tested: a chain given out of order is reordered, and a chain with `ssgi` and no `traa` gets `denoise` (three's doc: temporal filtering needs `TRAANode`, else `DenoiseNode`).
4. **The lit fixture on `?gpu=webgl`**: every pass must build on the node renderer over WebGL 2 (`'nodes-webgl'`); a pass that cannot (SSGI on a context without the needed formats) is dropped by `passesFor` with the backend kind as an input, not thrown.
5. **Units**: lumens to candela (`lm / 4π` sphere, `lm / (2π(1 − cos(outer/2)))` cone), lux through lane G's `GAME_TO_SITE`; the test pins a 1,000 lm sphere at 79.6 cd and a 1,000 lm 60° cone at 1,188 cd.

---

### Task 1: The sun and the placed lights

**Files:**
- Create: `src/lib/three/light/sun.js` (+ test), `light/placed.js` (+ test), `light/three.js` (the `loadThree()` and `registerLights(renderer)` helpers), `src/runtime/fixtures/litWorld.js` (the nodes fixture plus a sun, 200 point lights in a ring, 8 spots, an environment)

**Interfaces:**
- `cascadesFor(tier) → { n, far }`; `splitsFor(near, far, n, lambda = 0.5) → number[]` (pure).
- `createSun(entry, { tier }) → { light, update(camera), dispose }`: a `SunLight` registered through `registerLights`, colour and direction from the entry, `shadow` configured from the record's settings.
- `lumensToCandela(lm, kind, outer)`; `lightsFor(lights, cells, camera, { max, cull = 0.005, fade = 0.01 }) → [{ i, weight }]` (pure: the nearest cells' lights by screen area, faded in a band).
- `createPlacedLights(scene, renderer, { points = POINT_POOL, spots = SPOT_POOL }) → { set(list), update(camera), dispose }`.

- [ ] **Step 1: Failing tests**: cascades per tier; splits sum and monotonic; candela pins; `lightsFor` on 300 lights round a camera keeps the near ones and fades the band; the pool never grows (a `set` with 2,000 lights lights 1,024).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: The fixture**: `node scripts/perf-probe.mjs` is not for fixtures; add `scripts/light-fixture.mjs` (headless Chromium on the fixture route the runtime's dev page exposes, `?gpu=webgpu` and `?gpu=webgl`, a screenshot and the frame time over 5 s each). Review focus 1 and 2 are checked here; the two shots go in `docs/superpowers/evidence/galaxy-engine/R/`.
- [ ] **Step 6: Commit** `The sun with cascades and the placed lights clustered, under src/lib/three/light`.

### Task 2: The level's lights from the export

**Files:**
- Create: `scripts/bf2017-lights.mjs`, `scripts/lib/bf2017-lights.mjs` (+ test), `scripts/fixtures/bf2017/maps/hoth.extras.fixture.json` (ten lights, under 4 KB)

**Interfaces:**
- `rebase(light, origin, yaw)`; `cellOf(pos, cell = 128)`; `lightsJson(extras, pack) → { cells: { "cx,cz": [...] } }` (pure).
- CLI `node scripts/bf2017-lights.mjs <world> [--level levels/mp/hoth_01]`: reads the pack's `level.json` for the frame, fetches `maps/<level>.extras.json` from the bucket, writes `public/models/galaxy/bf2017/levels/<world>/lights.json`; prints the count per kind and per cell.

- [ ] **Step 1: Failing tests** on the fixture: ten lights rebased, binned, converted. **Step 2–4.**
- [ ] **Step 5: Run it for Hoth** when lane L's pack is on its branch (`git fetch origin claude/bf2017-l-hoth`, read `level.json` from there; do not check the branch out); commit the JSON; `scripts/assets-upload.mjs --dry` in the PR.
- [ ] **Step 6: Commit** `Hoth's placed lights, rebased to the level pack, beside it`.

### Task 3: The probes, the sky and the fog

**Files:**
- Create: `light/probes.js` (+ test), `light/sky.js` (+ test), `light/fog.js` (+ test)

**Interfaces:**
- `probeFor(volumes, pos) → { i, blend }` (pure); `createProbes(scene, renderer, volumes, loadCube) → { update(pos, dt), dispose }` (`loadCube` is lane G's `probeEnv.js` loader, passed in).
- `createProbeGrid(scene, renderer, bounds, PROBE_GRID) → { bake(), dispose }` behind `tier === 'ultra'`.
- `createSky(entry) → { mesh, envTexture(renderer), update(sunDir) }` (TSL Rayleigh and Mie from the entry's coefficients; cloud colours as the entry gives them).
- `createFog(entry) → fogNode` (the record's curve over distance, with height media), set as `scene.fogNode`.

- [ ] **Step 1–4** as above; the sky's test builds the material in Node and checks its uniforms; the fog's evaluates the curve at three distances.
- [ ] **Step 5: Measure the grid** on the fixture at an arena-sized box: bake time and frame cost in the PR; keep it only under 400 ms and 0.5 ms (spec A3).
- [ ] **Step 6: Commit** `Probes per volume, a probe grid on ultra, the sky and the fog as nodes`.

### Task 4: The post chain as data, and the runtime's passes

**Files:**
- Create: `light/post.js` (+ test)
- Modify: `src/runtime/webgpu.js` (`buildPostProcessing`: `ssgi`, `ao`, `ssr`, `godrays`, `lensflare`, `lut`, `traa`, `smaa`, `denoise`), `src/runtime/webgpu.test.js` or the backends' tests (each kind builds; `shader` still throws), `src/runtime/webgl.js` (throws `unknown pass` on the new kinds with a message naming the node renderer)

**Interfaces:**
- `ORDER` and `passesFor(tier, entry, backend) → passes[]` (pure); `shed(passes, level) → passes[]` (the shedding order).
- Each pass as data: `{ kind: 'ssgi', slices, steps, radius, temporal }`, `{ kind: 'ao', radius, bias, power }`, `{ kind: 'ssr', maxDistance, thickness }`, `{ kind: 'lut', texture }`, `{ kind: 'traa' }`, …

- [ ] **Step 1: Failing tests**: the order, the shedding, `ssgi` without `traa` gaining `denoise`, the tiers' chains, a backend that cannot build a pass dropping it.
- [ ] **Step 2–4.** **Step 5: The fixture on both backends** with the ultra chain; shots and frame times in the evidence folder; the frame at ultra on the owner's laptop under 16 ms at 1600 × 900 or the PR says what it is.
- [ ] **Step 6: Commit** `The post chain as data: SSGI, AO, SSR, god rays, flare, LUT and TRAA built by the runtime`.

### Task 5: `applyGameLight`, the docs, the PR

**Files:**
- Modify: `src/runtime/look.js` (`applyGameLight(scene, renderer, entry, { tier, volumes, lights, loadCube }) → { update(dt, camera), setWeather(entry, seconds), passes, dispose }`), `docs/stack/webgpu-tsl.md` ("Where it is used" and "Rules"), `docs/superpowers/HANDOFF-galaxy-engine.md` (lane R's row and its Done/Left)

- [ ] **Step 1: A test** that `applyGameLight` on the fixture's scene wires the five pieces and disposes them all (count the scene's children and the renderer's programs before and after).
- [ ] **Step 2: The lit fixture takes it**; `scripts/light-fixture.mjs` both backends; the final shots.
- [ ] **Step 3: Tell lane 5** (the Battlefront world's plan, Task 3) in the hand-off: its `lighting.js` and `post.js` become `applyGameLight` and `passesFor`; its runtime change is done here.
- [ ] **Step 4: The gates**; merge `origin/main`; push; PR `The galaxy's engine, lane R: the game's light as one stack under src/lib/three/light` with the shots, the frame table, A1–A3 answered.
