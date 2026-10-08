# Handoff: the WebGPU lane

The lane makes the runtime’s WebGPU backend reachable and safe for a visitor, then ports the worlds onto node (TSL) materials in order of their GLSL count. Design: `docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md`. Plan: `docs/superpowers/plans/2026-10-08-webgpu-acceleration.md`.

## Done

**Pull request 1: the path made reachable** (the plan’s Tasks 1 to 6)

- **Three backend kinds** (`src/runtime/backend.js`). The kinds are `'webgl'`, `'webgpu'` and `'nodes-webgl'`.
  - Every `'glsl'` module gets `'webgl'`, the classic renderer, always. `?gpu=webgpu` no longer hands it a renderer it can’t draw on.
  - A `'nodes'` module gets `'webgpu'` when the browser has WebGPU. It gets `'nodes-webgl'` (`WebGPURenderer({ forceWebGL: true })`) everywhere else: no `navigator.gpu`, a device lost once, or `?gpu=webgl`.
  - A `'nodes'` module never meets the classic renderer.
  - `readOverride` still accepts only `webgl` and `webgpu`.
- **`createWebGPU`** (`src/runtime/webgpu.js`) is both node kinds.
  - On WebGL 2 (forced, or three’s quiet fallback when `navigator.gpu` has no adapter), it reports `'nodes-webgl'` and hears the loss from the canvas’s `webglcontextlost`.
  - `browser.js`’s `makeBackend` maps the kind.
  - Tests: `webgpu.test.js`, `runtime.test.js` (a WebGPU loss downgrades once, to `'nodes-webgl'`, and stays there).
- **The promise, checked over the imports.**
  - `src/runtime/shadingClosure.js` (pure) walks a module’s static, dynamic and re-exported imports.
  - `shading.test.js` fails a `'nodes'` module on any GLSL site anywhere in that closure: `RawShaderMaterial`, `ShaderMaterial`, `onBeforeCompile`, `EffectComposer`, `ShaderPass`, `UnrealBloomPass`, `RenderPass`, `OutputPass`.
  - The exemptions are listed in the test, with a reason each.
  - A temp-dir module whose GLSL is two files away proves the test fails it.
- **The parity check** (`scripts/gpu-parity.mjs`, `scripts/gpu-parity/README.md`). A route is shot at a ref, and on the branch’s `webgl` and `webgpu` legs, each diffed against the ref’s picture.
  - Each leg runs on Vite’s dev server with a stopped page clock, so `main` and the branch are shot at the same page time.
  - The bar: PSNR ≥ 32 dB and under 2 % of pixels off by more than 16/255.
  - Proved on Earth before its port: 86.85 dB, 0.00 % off.
- **The frame guard’s count** (`lib/three/frameGuard.js`’s `heldBack()`, `window.__tpGuardPending` in development). The parity check lets frames run until a world is all on screen.
- **The perf probe** (`scripts/perf-probe.mjs`) takes `GPU=webgl|webgpu`. Each journey’s report says what it was drawn on (`drawnOn`).

## Left, in order

1. **PR 2, Earth on nodes** (plan Tasks 7 and 8).
   - `src/components/earth/nodes.js`: the globe, clouds, air, beams and trail as TSL factories returning `{ material, u }`, under the uniform names `scene.js` writes.
   - `module.js` gets `shading: 'nodes'` and a DEV `world.view('orbit' | 'low')`. The view pins the plane, the camera and the clouds’ drift, which `scene.js` reads from `performance.now()`.
   - Land the view hook in the branch’s first commit, while the materials are still GLSL. Shoot `--before <that commit>`, since main has no view hook to call.
   - Done: the closure guard green on Earth, both views pass the webgl leg, and the parity images are in `docs/superpowers/parity/earth/`.
2. **PR 3, Minecraft on nodes** (plan Tasks 9 to 11). The same shape. Colour first: the atlas is `NoColorSpace` and the arithmetic is on sRGB bytes.
3. **PR 4, Mario 64** (9 sites: `looks.js`, `models/things.js`, `scene.js`). Its plan is written from the spec’s “The ports, in order”.
4. **PR 5, the Expanse surface**: the TSL twins of `lib/three`’s shared shaders as `<name>Nodes.js`, then the flip.
5. **`docs/architecture.md`’s runtime bullet** needs a sentence on the three kinds and the parity check. It was left out of PR 1 because four open pull requests change that file. Add it once they’re in.
6. Then `BundleGroup` round what never moves in each ported world, measured by the probe.

## Checking it

- `npx vitest run src/runtime scripts/gpu-parity`: the kinds, the loss path, the closure guard and the diff.
- `node scripts/gpu-parity.mjs /earth --before` then `node scripts/gpu-parity.mjs /earth`. `--view a,b` shoots a world’s named views. Pictures go to `scripts/gpu-parity/out/<route>/`. `PARITY_DEBUG=1` prints each leg’s page time.
- `GPU=webgl node scripts/perf-probe.mjs earth`, then `GPU=webgpu`. On Linux set `CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; the default is a Mac’s Playwright Chromium.
- In the browser: `?gpu=webgl` or `?gpu=webgpu` on a `'nodes'` world. `window.__RUNTIME__.gfx.backend` (development) says the kind in force. `gfx.renderer.backend.isWebGPUBackend` says whether a WebGPU device is under it.

Gotchas:

- `navigator.gpu` is missing on `about:blank`: WebGPU needs a secure context, and localhost is one.
- In the cloud container, Chromium 1194 finds SwiftShader’s software WebGPU adapter with `--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader --enable-features=Vulkan`. So the webgpu leg runs there, in software. Its pictures count. Its frame times are software’s and say nothing about a real chip; the owner’s desktop runs the probe’s WebGPU leg.
- A world that moves on per frame stays in step only if every leg needed no more than the 120 settling frames. The parity script says when a leg needed more.
- `__RUNTIME__` exists only in development. That’s why the parity check runs the dev server and not a build.
