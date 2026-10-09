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

**#693: the frame guard drew no background.** three draws a scene’s background box from outside the scene graph. The guard held it back, then dropped it as gone from the world, every frame, so every runtime world’s texture sky was black from 7 October. Found by the parity check, and fixed.

**Pull request 2: Earth on nodes** (the plan’s Tasks 7 and 8)

- `src/components/earth/nodes.js`: the globe, clouds, air, beams, contrails and stars as TSL factories returning `{ material, u }`, under the uniform names `scene.js` already wrote. `module.js` is `shading: 'nodes'`.
- **Earth makes its own output.** With tone mapping on, the node renderer draws into a linear buffer and tone maps and encodes the whole frame once at the end. Every material is tone mapped whatever its `toneMapped` says, and the air, clouds and beacons are tone mapped after they’re added over the globe. That was the whole parity gap (25 dB). So Earth sets `NoToneMapping` and linear output, and each material writes what the classic renderer wrote (`classicOutput`): ACES where the classic renderer tone mapped it, then sRGB, before blending. three’s own materials in the scene get it the same way before their first frame. A port whose GLSL tone mapped, and whose transparent or added layers matter, needs the same.
- **The stars are a sphere round the camera**, not `scene.background`: the node renderer tone maps a background, and the classic renderer leaves an sRGB one alone.
- Development views `world.view('orbit' | 'low')` hold the plane, the camera, the clouds’ drift and the beacons’ pulse still.
- Parity, webgl leg: `orbit` 48.91 dB, 0.08 % off; `low` 42.30 dB, 0.28 % off. What’s left is edge antialiasing. The pictures are in `docs/superpowers/parity/earth/`.

**Pull request 3: Minecraft on nodes** (the plan’s Tasks 9 to 11)

- `src/components/minecraft/scene/nodes.js`: the block material in its three passes, the sky’s dome, stars, sun and moon and clouds, the drops and the crack, under the uniform names the scene wrote, now on `material.u`. `scene/shaders.js` is gone; `module.js` is `shading: 'nodes'`.
- **The output is the GLSL’s, untouched.** The game’s light is arithmetic on the sRGB bytes as painted, written to the canvas as it is. So the module sets `NoToneMapping` and linear output (restored for the next world), and the materials write their colour with nothing on top. The atlas keeps `NoColorSpace`. The only built-in material is the block outline, which is black.
- **Texture-array layers are rounded** (`layerOf`). GLSL’s `texture(sampler2DArray, …)` rounds the layer, but the node renderer cuts it off, and a layer through a varying arrives as 6.9999 as often as 7. That took whole tiles from the one before: 25.79 dB on the day view before the fix, 41.55 after. Any later port that samples a texture array needs the same.
- **The stars are a sprite drawn once a star**, two device pixels across. The node renderer draws a `Points` object a pixel wide.
- Development views `world.view('title' | 'day' | 'night')` (seed 1, at noon or midnight) hold the world still while its chunks come in. `world.settled()` says when they’re all in, and the parity script waits on it.
- Parity, webgl leg: `title` 51.17 dB, 0.07 % off; `day` 41.55 dB, 0.37 %; `night` 51.81 dB, 0.03 %. What’s left is silhouette antialiasing. The pictures are in `docs/superpowers/parity/minecraft/`. The clouds, drops and crack aren’t in any view.

## Left, in order

1. **The webgpu leg on a real chip.** In the container, SwiftShader’s WebGPU device is lost (“A valid external Instance reference no longer exists”) even under a bare `WebGPURenderer` cube, so neither world’s webgpu parity leg nor its WebGPU perf run was measured. On the desktop:
   - Earth: make the base (`git branch earth-glsl 432eceb0`, then merge `main` into it on a worktree: GLSL Earth with its views and the sky fix). Then run `node scripts/gpu-parity.mjs /earth --before earth-glsl --view orbit,low`, `node scripts/gpu-parity.mjs /earth --view orbit,low` and `GPU=webgpu node scripts/perf-probe.mjs earth`.
   - Minecraft: the base is GLSL Minecraft with its views, the same way. Its views are `title,day,night`.
   - One thing to watch on WebGPU: the chunk meshes are interleaved `Uint16` triples, and WebGPU has no 3-component 16-bit vertex format.
2. **A WebGPU device lost while a world is being made** fails the mount (`runtime.js` `place()` reads `gfx.canvas` from a gfx that’s gone) instead of coming back on `nodes-webgl`. Open #531 (“a world whose context goes while it’s made is made again”) covers that case; check it once it’s in.
3. **The perf probe’s plain `minecraft` journey** never gets past the site’s gate, on either renderer; use `minecraftWalk`.
4. **PR 4, Mario 64** (9 sites: `looks.js`, `models/things.js`, `scene.js`). Its plan is written from the spec’s “The ports, in order”.
5. **PR 5, the Expanse surface**: the TSL twins of `lib/three`’s shared shaders as `<name>Nodes.js`, then the flip.
6. **`docs/architecture.md`’s runtime bullet** needs a sentence on the three kinds and the parity check. It was left out of PR 1 because four open pull requests change that file. Add it once they’re in.
7. Then `BundleGroup` round what never moves in each ported world, measured by the probe.

## Checking it

- `npx vitest run src/runtime scripts/gpu-parity`: the kinds, the loss path, the closure guard and the diff.
- `node scripts/gpu-parity.mjs /earth --before` then `node scripts/gpu-parity.mjs /earth`. `--view a,b` shoots a world’s named views. Pictures go to `scripts/gpu-parity/out/<route>/`. `PARITY_DEBUG=1` prints each leg’s page time.
- `GPU=webgl node scripts/perf-probe.mjs earth`, then `GPU=webgpu`. On Linux set `CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; the default is a Mac’s Playwright Chromium.
- In the browser: `?gpu=webgl` or `?gpu=webgpu` on a `'nodes'` world. `window.__RUNTIME__.gfx.backend` (development) says the kind in force. `gfx.renderer.backend.isWebGPUBackend` says whether a WebGPU device is under it.

Gotchas:

- `navigator.gpu` is missing on `about:blank`: WebGPU needs a secure context, and localhost is one.
- In the cloud container, Chromium 1194 finds SwiftShader’s software WebGPU adapter (`--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader --enable-features=Vulkan`), but the device is soon lost, so the webgpu leg can’t be measured there. Add `--disable-blink-features=WebGPUExperimentalFeatures` too, or three’s texture-view `swizzle` throws on every frame; the scripts already do.
- A world that moves on per frame stays in step only if every leg needed no more than the 120 settling frames. The parity script says when a leg needed more.
- `__RUNTIME__` exists only in development. That’s why the parity check runs the dev server and not a build.
