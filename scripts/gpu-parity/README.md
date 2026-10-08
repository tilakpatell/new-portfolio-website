# gpu-parity

Does a world draw the same picture on its new materials? `scripts/gpu-parity.mjs` shoots a route on `main` and on the branch's two node backends, and diffs each branch picture against `main`'s. It's the gate for a port in the WebGPU lane (`docs/superpowers/specs/2026-10-08-webgpu-acceleration-design.md`).

## Running it

```sh
node scripts/gpu-parity.mjs /earth --before                 # main's pictures (a worktree of origin/main)
node scripts/gpu-parity.mjs /earth --before <ref>           # or any ref: the commit before the material swap
node scripts/gpu-parity.mjs /earth --view orbit,low          # the branch: webgl and webgpu legs, diffed
```

Options: `--view a,b` (the world's named views; none means the world as it opens, `open`), `--quality high|mid|low` (default high), `--settle 8000` (ms of real time for what loads after the world is on), `--adapter auto|swiftshader|system`, `--chromium /path/to/chrome` (or `CHROMIUM=`). `PARITY_DEBUG=1` prints each leg's page time.

Shoot `--before` with the same `--view` list as the branch run. The pictures and `report.json` go to `scripts/gpu-parity/out/<route>/` (gitignored): `<view>-before.png`, `<view>-webgl.png`, `<view>-webgpu.png`. A port's pull request commits the three for each view under `docs/superpowers/parity/<world>/`.

Exit codes: 0 the webgl leg passes, 1 it doesn't, 2 it couldn't run (no Chromium, no before pictures). A webgpu leg that fails is printed as FAIL but doesn't set the exit code: the webgl leg gates.

## What it does

Each leg runs on Vite's dev server, because the dev hooks are the point: `window.__RUNTIME__`, the frame guard's `window.__tpGuardPending`, and a ported world's `view(name)`. The page clock is pinned to 2026-10-08T12:00:00Z and stopped, so a sun or a tide is where it was. The page's time moves only in 16 ms frames the script lets run:

1. One frame at a time until the world is on.
2. The settle, in real time with the clock stopped, for pictures and tiles.
3. 120 frames with real time between them, so shaders link. More frames run if the frame guard still holds something back, and the leg says so.
4. The page's time is moved on to 60 s and its date to 12:01:00, the same on every leg. Then each view is asked for, 100 ms of frames run, and the page is shot at 1280 × 800, device scale 1.

So a world that drifts on its own clock (Earth's clouds read `performance.now()`) is in the same place on every leg. A world that moves on per frame is too, as long as it needs no extra frames in step 3.

The legs:

- `before`: the ref's code, `?gpu=webgl`.
- `webgl`: the branch, `?gpu=webgl`. A `'nodes'` module draws on `'nodes-webgl'` (three's node renderer on WebGL 2), a `'glsl'` one on the classic renderer. This leg gates.
- `webgpu`: the branch, `?gpu=webgpu`. A `'nodes'` module draws on a WebGPU device. The leg is marked `skipped` when the module is `'glsl'`, or when the page found no WebGPU adapter. In that case three's renderer falls back to WebGL 2, and the runtime reports it as `'nodes-webgl'`.

## The numbers

For each view and leg against `before`, over RGB (alpha left out):

- **PSNR**: 10·log10(255² / mean squared error), in dB. ∞ when the two are the same.
- **off %**: the share of pixels with any channel more than 16/255 apart.
- **mean diff**: the mean absolute difference per channel, 0 to 255.

**A port passes when every view has PSNR ≥ 32 dB and under 2 % of its pixels off.** The webgl leg gates the merge. The webgpu leg's row is reported, or marked skipped.

## The adapter

`--adapter swiftshader` asks Chromium for its software WebGPU adapter (`--enable-unsafe-webgpu --use-webgpu-adapter=swiftshader --enable-features=Vulkan`). `system` leaves the choice to Chromium: a desktop's own chip. `auto` (the default) picks swiftshader on Linux without a display and system elsewhere.

In the cloud container (no GPU), Chromium 1194 finds the SwiftShader adapter (`google/swiftshader`) and makes a device, but it doesn't keep it. Dawn reports “A valid external Instance reference no longer exists” and the device is lost, even under a bare `WebGPURenderer` cube. So the webgpu leg fails there, says so, and doesn't gate. The owner’s desktop runs it on a real chip, and the perf probe’s WebGPU leg too.

Two more things about Chromium here:

- A secure context is needed: `navigator.gpu` is missing on `about:blank`.
- `--enable-unsafe-webgpu` also turns on Blink’s experimental WebGPU IDL, whose draft texture-view `swizzle` is a dictionary where three 0.186 passes the spec’s string. Every frame then throws, so the scripts pass `--disable-blink-features=WebGPUExperimentalFeatures`, as a visitor’s Chrome has it.

WebGL draws through ANGLE on SwiftShader on Linux (as `autopilot-check.mjs` does) and on Metal on a Mac. The `before` and branch legs always draw the same way.

## Proving the pipeline

Earth before its port, both legs on the classic renderer, against a worktree of the same commit: `open` webgl 86.85 dB, 0.00 % off; webgpu leg 77.53 dB, 0.00 % off (skipped: the module is glsl).
