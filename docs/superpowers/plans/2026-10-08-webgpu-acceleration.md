# WebGPU Acceleration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the runtime’s WebGPU backend reachable and safe for a visitor (a `'nodes'` module runs everywhere, its promise is checked over its imports, a port is measured for the same picture and the frame time on both backends), then port the worlds in order of their GLSL count, Earth first, Minecraft second.

**Architecture:** `src/runtime/backend.js` gains a third kind, `'nodes-webgl'` (`WebGPURenderer({ forceWebGL: true })`), so a `'nodes'` module never meets the classic `WebGLRenderer`. `src/runtime/shadingClosure.js` (pure) walks a module’s imports so `shading.test.js` checks the whole closure. `scripts/gpu-parity.mjs` diffs a route’s render on `main` against the branch on both backends; `scripts/perf-probe.mjs` learns `GPU=`. Each port moves a world’s `ShaderMaterial`s into a `nodes.js` of TSL factories that keep the uniform names the frame code writes, and flips the module to `'nodes'`.

**Tech Stack:** three 0.186.1 (`three`, `three/webgpu`, `three/tsl`, `three/addons/tsl/display/BloomNode.js`), Vite 8, Vitest 5 (Node environment), playwright-core 1.56 with the pre-installed Chromium, `sharp` (a devDependency already).

**Spec:** `docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md`

## Global Constraints

- Every pull request alone: lint (`npm run lint`), tests (`npm test`), build (`npm run build`), `node scripts/health.mjs --check --skip build`, and `node scripts/autopilot-check.mjs --only smoke --routes <the routes touched>` green before merge. Merge with a merge commit (`merge_method: merge`), never a rebase or a force-push.
- A port merges only with its parity table in the pull request: **every view PSNR ≥ 32 dB and under 2 % of pixels off by more than 16/255, on the `webgl` leg at least**, and the `webgpu` leg’s row (or `skipped: no adapter`).
- A port changes a world’s materials and nothing it does: save keys, dev hooks (`window.__EARTH__`, `window.__RUNTIME__`), achievements, sounds and keys untouched.
- `readOverride` accepts only `webgl` and `webgpu`; `'nodes-webgl'` is never asked for.
- British spelling, curly quotes, plain sentences; comments say why, in the file’s voice. No model identifiers in commit messages. Commits end with the attribution lines the harness gives.
- Don’t edit files an open pull request changes (`git fetch --all --prune`, then look at the open PRs’ file lists first).
- The GLSL originals stay as they are for every `'glsl'` module; a port adds a `nodes.js` beside a world’s scene (and later `lib/three/<name>Nodes.js` beside a shared shader), it does not rewrite shared GLSL.
- `docs/architecture.md`: edit only the runtime bullet and the ported world’s bullet, a sentence each.

## Review Focus

1. **A `'nodes'` module on Safari (no `navigator.gpu`).** It must mount and draw on `'nodes-webgl'`, never on the classic renderer. Task 1 (`pickBackend({ gpu: false, shading: 'nodes' })` → `'nodes-webgl'`) and Task 3 (`runtime.test.js`: mount without gpu asks `makeBackend('nodes-webgl', …)`).
2. **A WebGPU device lost mid-world.** The next mount of the same `'nodes'` module must come up on `'nodes-webgl'`, and a loss there must not downgrade again. Task 1 and Task 3.
3. **A `'nodes'` module that imports a GLSL helper two files away** (Expanse’s case). `shading.test.js` must fail it. Task 4 (the temp-dir fixture).
4. **Colour on the Minecraft port.** The atlas is `NoColorSpace` and the arithmetic is on sRGB bytes; a node material that lets the renderer linearise the texture or double-apply the output transform shifts every block. Task 12’s `nodes.test.js` asserts `atlas.colorSpace === NoColorSpace` is untouched and the parity check’s first view is the daylight one.
5. **Earth’s sun moves with the clock**, so two shots a minute apart differ. The parity script freezes the page clock (Task 5) and Earth’s parity views are shot at `orbit` and `low` with the sun pinned by that clock.

---

## Pull request 1: the path made reachable

### Task 1: The third backend kind

**Files:**
- Modify: `src/runtime/backend.js`
- Test: `src/runtime/backend.test.js`

**Interfaces:**
- Produces: `KINDS = ['webgl', 'webgpu', 'nodes-webgl']`; `pickBackend({ gpu = false, shading = 'glsl', override = null, lost = false }) → 'webgl' | 'webgpu' | 'nodes-webgl'`; `readOverride(search, hash, stored) → 'webgl' | 'webgpu' | null` (unchanged behaviour; it never returns `'nodes-webgl'`).

- [ ] **Step 1: Write the failing tests** (replace the two `pickBackend` tests)

```js
it('a glsl module always gets the classic renderer', () => {
  expect(pickBackend({ gpu: true, shading: 'glsl' })).toBe('webgl');
  expect(pickBackend({ gpu: true })).toBe('webgl');
  expect(pickBackend({ gpu: true, shading: 'glsl', override: 'webgpu' })).toBe('webgl'); // it can't run there
  expect(pickBackend({ gpu: false, shading: 'glsl', lost: true })).toBe('webgl');
});
it('a nodes module gets webgpu with a gpu, nodes-webgl everywhere else', () => {
  expect(pickBackend({ gpu: true, shading: 'nodes' })).toBe('webgpu');
  expect(pickBackend({ gpu: false, shading: 'nodes' })).toBe('nodes-webgl');
  expect(pickBackend({ gpu: true, shading: 'nodes', lost: true })).toBe('nodes-webgl');
  expect(pickBackend({ gpu: true, shading: 'nodes', override: 'webgl' })).toBe('nodes-webgl');
  expect(pickBackend({ gpu: true, shading: 'nodes', override: 'webgpu', lost: true })).toBe('nodes-webgl');
  expect(pickBackend({ gpu: false, shading: 'nodes', override: 'webgpu' })).toBe('nodes-webgl');
});
it('readOverride never names the runtime’s own kind', () => {
  expect(readOverride('?gpu=nodes-webgl', '', null)).toBe(null);
  expect(readOverride('', '', 'nodes-webgl')).toBe(null);
});
```

Note the change from today: `override: 'webgpu'` on a `'glsl'` module used to return `'webgpu'`, which could never draw it. The override now picks between the two kinds a `'nodes'` module can run on and does nothing for a `'glsl'` one. Say so in the file’s header comment.

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/runtime/backend.test.js` → FAIL (`'webgl'` where `'nodes-webgl'` expected).
- [ ] **Step 3: Implement** in `backend.js`: `KINDS` gains the third; `readOverride` keeps a local `ASKABLE = ['webgl', 'webgpu']`; `pickBackend`: `shading !== 'nodes'` → `'webgl'`; else `lost || !gpu || override === 'webgl'` → `'nodes-webgl'`; else `'webgpu'`.
- [ ] **Step 4: Run** `npx vitest run src/runtime/backend.test.js` → PASS.
- [ ] **Step 5: Commit**: `git add src/runtime/backend.js src/runtime/backend.test.js && git commit -m "A nodes module has a renderer everywhere: pickBackend’s third kind, nodes-webgl, where WebGPU isn’t"`.

### Task 2: `createWebGPU` on WebGL 2

**Files:**
- Modify: `src/runtime/webgpu.js` (`createWebGPU(canvas, { budget, onLost, alpha, toneMapping, exposure, forceWebGL = false })`)
- Modify: `src/runtime/browser.js` (`makeBackend`)
- Test: `src/runtime/webgpu.test.js` (new; mocks `three/webgpu` with `vi.mock`)

**Interfaces:**
- Produces: `createWebGPU(canvas, opts) → Promise<gfx>` where `gfx.backend` is `'webgpu'` or `'nodes-webgl'` (from `forceWebGL`); `makeBackend(kind, opts)` maps `'nodes-webgl'` to `createWebGPU(canvas, { ...opts, forceWebGL: true })`.

- [ ] **Step 1: Write the failing test** `webgpu.test.js`: mock `three/webgpu` so `WebGPURenderer` is a class recording its constructor options with `init: vi.fn(async () => {})`, `backend: { device: { lost: new Promise(() => {}) } }`, `setPixelRatio`, `setSize`, `dispose`, `getPixelRatio`, `setClearColor`; mock `../lib/settle` to pass through.

```js
it('forceWebGL makes the nodes-webgl kind on a WebGL 2 context', async () => {
  const canvas = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const gfx = await createWebGPU(canvas, { forceWebGL: true });
  expect(gfx.backend).toBe('nodes-webgl');
  expect(made[0].options.forceWebGL).toBe(true);
});
it('without it the kind is webgpu', async () => { /* backend 'webgpu', options.forceWebGL false */ });
it('a WebGL 2 context lost is reported through onLost', async () => {
  const onLost = vi.fn();
  const canvas = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  await createWebGPU(canvas, { forceWebGL: true, onLost });
  const [name, handler] = canvas.addEventListener.mock.calls.find((c) => c[0] === 'webglcontextlost');
  handler({ preventDefault() {} });
  expect(onLost).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run to verify it fails**: `npx vitest run src/runtime/webgpu.test.js` → FAIL (`forceWebGL` ignored, backend `'webgpu'`).
- [ ] **Step 3: Implement**: pass `forceWebGL` to the `WebGPURenderer` constructor; `backend: forceWebGL ? 'nodes-webgl' : 'webgpu'`; when `forceWebGL`, listen to `canvas`’s `webglcontextlost` (`preventDefault`, set `lost`, call `onLost`) and remove the listener in `release`; otherwise keep the `device.lost` promise as today. Update the header comment: the file is both node-renderer kinds.
- [ ] **Step 4: `browser.js`**: `kind === 'webgl' ? createWebGL(canvas, opts) : createWebGPU(canvas, { ...opts, forceWebGL: kind === 'nodes-webgl' })`.
- [ ] **Step 5: Run** `npx vitest run src/runtime` → PASS. `npm run lint` clean.
- [ ] **Step 6: Commit**: `git commit -m "The node renderer on WebGL 2: createWebGPU takes forceWebGL and reports the nodes-webgl kind"`.

### Task 3: The runtime’s loss path

**Files:**
- Modify: `src/runtime/runtime.js:245` (the pick), `:452-453` (`lost()`)
- Test: `src/runtime/runtime.test.js`

- [ ] **Step 1: Write the failing tests** beside “a webgpu loss comes back on webgl” (which changes):

```js
it('a nodes module without a gpu mounts on nodes-webgl', async () => {
  const { rt, makeBackend } = make({ gpu: false });
  await rt.mount({ id: 'n', shading: 'nodes', create: () => fakeWorld() }, {}, fakeHost());
  expect(makeBackend.mock.calls[0][0]).toBe('nodes-webgl');
});
it('a webgpu loss comes back on nodes-webgl, and a loss there stays there', async () => {
  const { rt, makeBackend } = make({ gpu: true });
  await rt.mount({ id: 'n', shading: 'nodes', create: () => fakeWorld() }, {}, fakeHost());
  expect(makeBackend.mock.calls[0][0]).toBe('webgpu');
  makeBackend.mock.calls[0][1].onLost();
  await rt.mount({ id: 'n', shading: 'nodes', create: () => fakeWorld() }, {}, fakeHost());
  expect(makeBackend.mock.calls[1][0]).toBe('nodes-webgl');
  makeBackend.mock.calls[1][1].onLost();
  await rt.mount({ id: 'n', shading: 'nodes', create: () => fakeWorld() }, {}, fakeHost());
  expect(makeBackend.mock.calls[2][0]).toBe('nodes-webgl');
});
```

(`make({ gpu })` is whatever the file’s existing helper is called; read it first. Its fake `makeBackend` must answer the new kind as it answers the others.)

- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/runtime/runtime.test.js` → FAIL.
- [ ] **Step 3: Implement**: nothing in the pick line changes (Task 1 did it); `lost()` keeps `if (kind === 'webgpu') lostWebGPU = true;`. Fix the fake backend in the test’s helper if it rejects an unknown kind. (As built: `runtime.js` needed no change at all, and its header never named the kinds, so it was left alone; two open pull requests change it.)
- [ ] **Step 4: Run** `npx vitest run src/runtime` → PASS.
- [ ] **Step 5: Commit**: `git commit -m "A nodes world mounts on nodes-webgl without a gpu, and after a WebGPU loss"`.

### Task 4: The promise, checked over the imports

**Files:**
- Create: `src/runtime/shadingClosure.js`, `src/runtime/shadingClosure.test.js`
- Modify: `src/runtime/shading.test.js`

**Interfaces:**
- Produces: `importsOf(source: string) → string[]` (specifiers of `import … from '…'`, `export … from '…'`, bare `import '…'` and `import('…')`); `resolveImport(from: string, spec: string, { exists }) → string | null` (relative specifiers only; tries the path, `.js`, `.jsx`, `/index.js`, `/index.jsx`); `closure(entry: string, { read, exists }) → Set<string>` (files reached, `*.test.js*` left out); `glslSites(source: string) → string[]` (names used, comments stripped first: `RawShaderMaterial`, `ShaderMaterial`, `onBeforeCompile`, `EffectComposer`, `ShaderPass`, `UnrealBloomPass`, `RenderPass`, `OutputPass`).

- [ ] **Step 1: Write the failing tests** `shadingClosure.test.js`: `importsOf` on a source with all four forms and one in a comment (the comment one is found too; that is fine, the resolver drops what doesn’t exist); `resolveImport` picks `.jsx` and `index.js`; `closure` over an in-memory tree `{ 'a.js': "import './b'; import('./c.jsx')", 'b.js': "export * from './d/index'", 'c.jsx': '', 'd/index.js': "import './e.test.js'", 'd/e.test.js': '' }` → `a.js, b.js, c.jsx, d/index.js` and not the test; `glslSites("// a ShaderMaterial in a comment\nnew THREE.ShaderMaterial()")` → `['ShaderMaterial']` once; `glslSites('m.onBeforeCompile = fn')` → `['onBeforeCompile']`.
- [ ] **Step 2: Run to verify they fail**: `npx vitest run src/runtime/shadingClosure.test.js` → FAIL (module missing).
- [ ] **Step 3: Implement** `shadingClosure.js` as pure functions with the file system passed in (`read(path) → string`, `exists(path) → boolean`), the comment stripper a small regex pass for `//…` and `/* … */` (template strings holding GLSL must still count: strip only line and block comments outside strings is more than this needs; strip comments, accept that a GLSL string with `// ShaderMaterial` in it loses that one word, and say so in the comment).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Rewrite `shading.test.js`** to use `closure` from each `'nodes'` module (the same `modules()` list plus the fixture), with `EXEMPT = ['lib/three/frameGuard.js', 'lib/three/renderer.js', 'lib/three/gpuWork.js']` and anything under `runtime/`, each with a one-line reason, and a new test that writes a temp module tree (`fs.mkdtempSync`) with `module.js` (`shading: 'nodes'`, imports `./look`) and `look.js` (`new ShaderMaterial()`), runs the same check on it, and expects a failure naming `look.js`. Keep the existing live-check test.
- [ ] **Step 6: Run** `npx vitest run src/runtime` → PASS. Run the closure by hand on each shipped module and confirm all are `'glsl'` and so not checked.
- [ ] **Step 7: Commit**: `git commit -m "The nodes promise is checked over a module’s imports, not its folder alone"`.

### Task 5: The parity check

**Files:**
- Create: `scripts/gpu-parity.mjs`, `scripts/gpu-parity/diff.mjs`, `scripts/gpu-parity/diff.test.mjs`, `scripts/gpu-parity/README.md`
- Modify: `.gitignore` (`scripts/gpu-parity/out/`)

**Interfaces:**
- Produces: `diff(a: { data, width, height, channels }, b) → { mad: [r, g, b], off: number (0..1, the share of pixels with any channel > 16/255 apart), psnr: number }` (pure, on raw RGBA buffers as `sharp(...).raw().toBuffer({ resolveWithObject: true })` gives them); `passes({ psnr, off }) → boolean` (`psnr >= 32 && off < 0.02`); the script’s exit codes: 0 pass, 1 fail, 2 could not run (no browser, no build).
- Script: `node scripts/gpu-parity.mjs <route> [--before] [--view a,b] [--quality high] [--settle 8000] [--chromium path]`.

- [ ] **Step 1: Write the failing tests** `diff.test.mjs` (Vitest; the vite config already includes `scripts/**` tests? Check `vite.config.js`’s `test.exclude`; `scripts/health.test.mjs` runs, so a `.test.mjs` under `scripts/` does): identical buffers → `psnr` `Infinity`, `off` 0; one of four pixels off by 20 in red → `off` 0.25, `mad[0]` 5; a buffer off by 1 everywhere → `psnr` about 48.1 (10·log10(255²/1)); `passes({ psnr: 32, off: 0.019 })` true, `passes({ psnr: 31.9, off: 0 })` false.
- [ ] **Step 2: Run to verify they fail**, then implement `diff.mjs`, run → PASS.
- [ ] **Step 3 (as built, where it differs from what follows):** `autopilot-check.mjs` has no `--before` build of `main` (it expects to run on main), and `window.__RUNTIME__` and the views are development-only, so each leg runs on Vite’s dev server, and `--before [ref]` makes a worktree at the ref (default `origin/main`) with this checkout’s `node_modules` linked in. The page clock is stopped from the first script: frames run one at a time till the world is on, then 120 with real time between them (shaders link on the chip’s time), more while the frame guard holds something back (`window.__tpGuardPending`, added for this), and the page’s time is moved to 60 s on every leg before the views are shot, so a world drifting on `performance.now` is where it was. A WebGPU leg that found no device is told by `gfx.renderer.backend.isWebGPUBackend`. In the cloud container `--use-webgpu-adapter=swiftshader` does find an adapter, so the webgpu leg runs there in software.
- [ ] **Step 3: Write `gpu-parity.mjs`**, modelled on `autopilot-check.mjs`’s smoke step (reuse `scripts/lib/noise.mjs`, its Vite preview on a free port, its `--before` build of `main` into a temp worktree): for each leg (`before` on `main`; else `webgl` and `webgpu` on the branch) launch Chromium with `--enable-unsafe-webgpu --enable-features=Vulkan` (and, when `--adapter swiftshader`, `--use-webgpu-adapter=swiftshader`), `page.clock.install({ time: new Date('2026-10-08T12:00:00Z') })`, go to `#<route>?quality=<q>&calibrate=off&gpu=<leg>`, wait for a canvas over 300 × 200, settle, then for each view call `window.__RUNTIME__.current?.world?.view?.(name)` (skip the view with a note when the hook is missing), wait two frames, `page.screenshot` to `scripts/gpu-parity/out/<route-slug>/<view>-<leg>.png` at 1280 × 800, device scale 1. After the branch legs, read `window.__RUNTIME__.gfx.backend` and record it; when the `webgpu` leg reports `'nodes-webgl'` (no adapter), mark it `skipped: no WebGPU adapter`. Diff each leg against `-before`, print a table (view, leg, backend, PSNR, off %, pass), write `report.json`, exit 1 when any `webgl` row fails.
- [ ] **Step 4: Run it on `/earth` before any port** (`--before` on `main`, then the branch): both legs are the classic renderer today, so PSNR should be `Infinity` or near; that proves the pipeline. Paste the table in the PR.
- [ ] **Step 5: Write `README.md`** (how to run, what the numbers mean, the thresholds, the adapter note).
- [ ] **Step 6: Commit**: `git commit -m "gpu-parity: a route rendered on main and on the branch’s two backends, diffed and judged"`.

### Task 6: The perf probe’s backend, and the docs

**Files:**
- Modify: `scripts/perf-probe.mjs:527` (the query), `:544` (the report row), the header comment
- Modify: `docs/architecture.md` (the runtime bullet: one sentence on the three kinds and the parity check; as built, left for later: four open pull requests change the file, and the handoff carries it as a Left item), `docs/superpowers/HANDOFF-webgpu-acceleration.md` (new: what is done, how to check, what is next, in the other handoffs’ shape)

- [ ] **Step 1**: `GPU` from the environment; `h.q` gains `&gpu=${GPU}` (or `?gpu=` when there is no quality); each `report[name]` gains `backend: GPU ?? 'default'`; header comment says so.
- [ ] **Step 2**: `node scripts/perf-probe.mjs --list` still lists; `GPU=webgl node scripts/perf-probe.mjs earth` runs (software WebGL in the container is slow: use `--settle` if the probe has it, else accept the run).
- [ ] **Step 3**: the docs. Commit: `git commit -m "The perf probe names its backend, and the WebGPU lane’s handoff"`.
- [ ] **Step 4: Ship PR 1**: `npm run lint && npm test && npm run build && node scripts/health.mjs --check --skip build && node scripts/autopilot-check.mjs --only smoke --routes /earth,/dot-matrix/minecraft`; push; open the pull request (title “The WebGPU path made reachable: a nodes module runs everywhere, its promise is checked over its imports, and a port is measured”); wait for the `CI` check; merge with a merge commit; `git fetch origin main`.

---

## Pull request 2: Earth on nodes

Branch from `main` after PR 1 merges.

### Task 7: Earth’s materials as TSL

**Files:**
- Create: `src/components/earth/nodes.js`, `src/components/earth/nodes.test.js`
- Read first: `src/components/earth/scene.js:43-230` (the seven GLSL strings) and `:350-500` (how they are built and which uniforms the frame writes)

**Interfaces:**
- Produces, each returning `{ material, u }` where `u` is an object of TSL `uniform(...)` nodes under the GLSL uniform names (so `u.uSun.value.copy(...)` keeps working):
  - `globeMaterial({ textures, seg }) → { material: NodeMaterial, u }` (every uniform `globeU` has today)
  - `cloudMaterial({ textures }) → { material, u }` (`transparent`, `depthWrite: false`, `side: DoubleSide`)
  - `airMaterial() → { material, u: { uSun } }` (`side: BackSide`, `transparent`, `depthWrite: false`, `blending: AdditiveBlending`)
  - `beamMaterial(colour) → { material, u: { uColor, uOpacity } }` (`transparent`, `depthWrite: false`, `AdditiveBlending`, `DoubleSide`)
  - `trailMaterial() → { material, u: { uLight } }` (`transparent`, `depthWrite: false`, `DoubleSide`; reads `attribute('aFade', 'float')`; alpha `vF³ · 0.5`)

- [ ] **Step 1: Write the failing test** `nodes.test.js` (TSL builds in Node without a GPU): each factory returns a material whose `isNodeMaterial` is true, with the flags above, and whose `u` has exactly the uniform names of the GLSL original (list them from `scene.js`); `u.uSun.value` is a `Vector3`; setting `u.uLight.value = 0.5` reads back.
- [ ] **Step 2: Run to verify it fails**, `npx vitest run src/components/earth` → FAIL (module missing).
- [ ] **Step 3: Implement** `nodes.js`: each GLSL function becomes a `Fn` (`three/tsl`): `GLOBE_FRAG`’s lighting, night lights, glint, cloud shadow, rim; `CLOUD_FRAG`; `AIR_*`; `BEAM_*`; the trail. Use `MeshBasicNodeMaterial` with `colorNode`/`opacityNode`/`positionNode` set, `lights: false`. Textures through `texture(tex, uvNode)`. `#include <colorspace_fragment>` is dropped: the node renderer applies the output transform itself. Where GLSL used `gl_FragCoord` or derivatives, use `screenCoordinate` / `dFdx`. Keep the file in the scene’s voice; a comment at the top says which GLSL block each `Fn` is.
- [ ] **Step 4: Run** → PASS. Commit: `git commit -m "Earth’s globe, clouds, air, beams and trail as TSL node materials"`.

### Task 8: The scene takes the node materials

**Files:**
- Modify: `src/components/earth/scene.js` (the five `new THREE.ShaderMaterial(...)` sites, the `precompile` import, the GLSL constants removed), `src/components/earth/module.js:78` (`shading: 'nodes'`)
- Modify: `src/components/earth/module.js` (a dev hook `world.view(name)` for `'orbit'` and `'low'`: set the sim to orbit over home, or to a low flight at `ALT.min` over Syracuse heading east, and return after one step; DEV only, like `window.__EARTH__`)

- [ ] **Step 1**: swap each material for its factory; `globeU` and friends become the factories’ `u`; `ready` returns `rt.gfx.compile(scene, camera)` instead of `precompile(renderer, scene, camera)` (`createEarth` gets `compile` passed in with `renderer`; read how `module.js` calls it); `disposeTree` stays (`lib/three/renderer` is exempt in the guard; or move the import to a `disposeTree` of its own if the guard objects).
- [ ] **Step 2**: `npx vitest run src/runtime/shading.test.js src/components/earth` → PASS (the guard now checks Earth’s closure: it must be clean).
- [ ] **Step 3**: `npm run build`; `node scripts/autopilot-check.mjs --only smoke --routes /earth` → a canvas drawn, no console error (the container has no WebGPU: this runs on `'nodes-webgl'`, which is the point).
- [ ] **Step 4**: main has no `view` hook to call, so land the hook (Step 1’s `module.js` part) in the branch’s first commit while the materials are still GLSL, and shoot `node scripts/gpu-parity.mjs /earth --before <that commit> --view orbit,low`; the hook must also pin the clouds’ drift (`scene.js` reads it from `performance.now()`). Then `node scripts/gpu-parity.mjs /earth --view orbit,low` on the branch. Read the three images for each view (`Read` them). The `webgl` leg must pass; fix the TSL until it does (the usual culprits: a `pow` on a negative, a `saturate` missing, texture colour space, the output transform applied twice).
- [ ] **Step 5**: `GPU=webgl node scripts/perf-probe.mjs earth` and, where there is an adapter, `GPU=webgpu …`. Keep both tables.
- [ ] **Step 6**: Commit: `git commit -m "Earth is the first nodes world: its materials are TSL, so it draws on WebGPU where the browser has it"`. Ship PR 2 (title “Earth on WebGPU”; body: the parity table with the images, the perf tables, the checks run; the `webgpu` leg’s row or “skipped: no adapter here; the owner’s desktop runs it”). Merge when CI is green and the `webgl` parity leg passes.

---

## Pull request 3: Minecraft on nodes

Branch from `main` after PR 2 merges. Read `src/components/minecraft/scene/shaders.js`, `sky.js`, `drops.js`, `cursor.js`, `atlasTexture.js`, `rules/mesher.js` (the vertex format) first.

### Task 9: The block material

**Files:**
- Create: `src/components/minecraft/scene/nodes.js`, `src/components/minecraft/scene/nodes.test.js`
- Modify later (Task 11): `shaders.js`’s `blockMaterial` and `setFrames` callers

**Interfaces:**
- Produces: `blockMaterial({ array, pass, colours }) → material` with `material.u = { atlas, sun, tints, anim, fogColour, fogNear, fogFar }` (the names `shaders.js` has; `anim` a `uniformArray` of four `Vector4`), and `setFrames(material, anims, ticks)` working on `material.u.anim.array[i]` as it worked on `uniforms.anim.value[i]`. Passes: `'opaque'`, `'cutout'` (discard under alpha 0.5), `'water'` (alpha from the texel).

- [ ] **Step 1: Write the failing test**: for each pass a material with the right `transparent`/`depthWrite`; `u` has the seven names; `setFrames` writes `(layer, a, b, blend)` into slot `i`; the atlas uniform’s texture is the one passed and its `colorSpace` is untouched.
- [ ] **Step 2**: FAIL, then implement: `attribute('data', 'vec3')`, the unpacking as integer maths on floats exactly as the GLSL (`mod`, `floor`), the `Loop` over four `anim` slots, `varying(...).setInterpolation('flat')` for the next layer and the blend, `texture(atlas, uv).depth(layer)` for the array sample, fog as `smoothstep(fogNear, fogFar, dist)`, `discard()` under `If` for the cutout. `lights: false`, no tone mapping (the module already sets `renderer.toneMapping = NoToneMapping`).
- [ ] **Step 3**: PASS; commit `git commit -m "Minecraft’s block material as TSL: the mesher’s packed vertex, the atlas array, the lightmap and the fog"`.

### Task 10: The sky, the drops and the cursor

**Files:**
- Modify: `src/components/minecraft/scene/nodes.js`, `nodes.test.js`

**Interfaces:**
- Produces: `domeMaterial() → { material, u: { sky, fog, glow, sunDir } }`; `starsMaterial() → { material: PointsNodeMaterial, u: { strength } }` (`sizeNode` for the point size, additive, no depth); `spriteMaterial(map) → { material, u: { map, frame, strength } }`; `cloudMaterial(clouds) → { material, u: { map, offset, fog, tint, far } }`; `dropMaterial(atlas) → material` (`DoubleSide`); `crackMaterial(atlas) → { material, u }` (the names `cursor.js` has).

- [ ] **Step 1**: tests as Task 9’s (flags and uniform names per original).
- [ ] **Step 2**: FAIL, implement, PASS. Commit: `git commit -m "Minecraft’s sky, stars, sun and moon, clouds, drops and crack cursor as TSL"`.

### Task 11: The scene takes them, and the module flips

**Files:**
- Modify: `shaders.js` (keep `TINT_COLOURS`, `frameAt` use; `blockMaterial`/`setFrames` re-exported from `nodes.js`, the GLSL strings removed), `sky.js`, `drops.js`, `cursor.js`, `scene/*.js` where `material.uniforms.x.value` is written (now `material.u.x.value`)
- Modify: `src/components/minecraft/module.js:81` (`shading: 'nodes'`), plus a DEV `world.view(name)` for `'title'` (as it opens) and `'day'` (a world opened, noon, the player on the surface facing the sun)

- [ ] **Step 1**: swap and rename; `npx vitest run src/components/minecraft src/runtime/shading.test.js` → PASS (`rules/*` tests untouched; the guard checks Minecraft’s closure).
- [ ] **Step 2**: `node scripts/autopilot-check.mjs --only smoke --routes /dot-matrix/minecraft` → green.
- [ ] **Step 3**: `node scripts/gpu-parity.mjs /dot-matrix/minecraft --before` on `main`, then `--view title,day` on the branch. The `webgl` leg must pass; colour first (Review Focus 4).
- [ ] **Step 4**: `GPU=webgl node scripts/perf-probe.mjs minecraft` (the journey exists at `:405`) and `GPU=webgpu` where there is an adapter. Draws per frame are the number to watch.
- [ ] **Step 5**: Commit, ship PR 3 (“Minecraft on WebGPU”), merge when green and the `webgl` parity passes.

---

## After: the next ports (their own plans)

- **PR 4, Mario 64** (9 sites: `looks.js`, `models/things.js`, `scene.js`): the same shape as PR 2.
- **PR 5, the Expanse surface** (21 sites, all in `lib/three`): `lib/three/<name>Nodes.js` beside each of `foliage`, `wind`, `groundmap`, `house`, `grass`, `river`, `land`, `tracks`, `puffs`, `windLines`, each with the GLSL original’s factory signature and a pure test on a stub, then `expanse/surface` flipped. Its plan is written when PR 3 is merged, from the spec’s section “The ports, in order”.
- Then `BundleGroup` round the static parts of each ported world, measured by the probe.

## Self-review (done when this plan was written)

Spec coverage: three kinds (Tasks 1–3), the closure guard (Task 4), the parity check and the probe (Tasks 5–6), Earth (Tasks 7–8), Minecraft (Tasks 9–11), the later ports (outlined). Names used across tasks: `'nodes-webgl'`, `createWebGPU(canvas, { forceWebGL })`, `closure`/`glslSites`, `diff`/`passes`, `{ material, u }` factories, `world.view(name)`. Review Focus items each name their task.
