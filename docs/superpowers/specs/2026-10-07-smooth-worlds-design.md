# Smooth worlds: load first, then never stall

Date: 2026-10-07. Status: approved design (the owner asked for it to be built and merged in parts without stopping to ask). The plan is `docs/superpowers/plans/2026-10-07-smooth-worlds.md`; the measurements are `docs/research/2026-10-07-frame-hitches.md`.

## What was asked

"Is there a way for the universe and the galaxies and worlds to be loaded as chunks similar to Minecraft to improve performance and make it so it's smooth and use hardware acceleration really well? I want to reduce the lag when we enter worlds and exit and the animations and stuff. It's better for people to click start and load and wait a minute and have butter smooth rendering than wait a short time and it be 20-40 frames (laptops)."

So: going into a world, coming out of one and the flown trips between them must not stutter; once a world is up it must hold its frame rate on a laptop; and a longer load is a fair price for that.

## What the probe found

`scripts/perf-probe.mjs` drives each world in Chromium on the Mac's own graphics chip (Metal, no vsync, no frame cap, a 13-inch retina window) and records every frame's time and what the graphics chip was sent in it. The numbers are in the research note; what they say:

- **The steady frame is cheap.** On an M3 Pro the typical frame is 2 to 9 ms in every world, with 40 to 300 draws and 0.2 to 2.3 million triangles. No world here is held back by draw calls.
- **The stalls are single frames that do a whole world's GPU work at once.** Shader links (Albuquerque's precompile check blocked 1.8 s; the universe's first visible frame 2.6 s), picture uploads (Earth sends a gigabyte in one 3.1 s frame; a galaxy surface 200 MB in 1.3 s), synchronous builds (the surface module's create, 1.9 s in the middle of the dive; the galaxy's frames of a second with nothing sent at all) and floor bakes (lib/three/grounding-bake, 4.6 s in one frame on landing). After the world is up, walking or flying into new things does the same again (the universe's flight: frames of 0.8 to 1.3 s; Cybertron's Roll out: 10 s).
- **Why the existing warm-ups miss.** The universe's warm-up runs only while the intro covers the page, so a visitor coming back (no intro) or returning from a world gets none. Its first frame then adopts the house look (lib/three/house), which changes every lit material's shader after `ready` compiled the old ones, so they all compile again in that frame. Late models (planet GLBs, hunters, the trench, the Citadel, online pilots) have their shaders made but their pictures sent on the frame they're first drawn. And leaving the map for any world disposes its renderer; coming back rebuilds it all.
- **Parallel shader compiling is real but easy to defeat.** In isolation (`KHR_parallel_shader_compile` on ANGLE/Metal) 150 three.js programs link in about 0.7 s off the main thread, but `renderer.compile()` itself costs 110 to 180 ms of main-thread JavaScript for them, their first draw another 40 to 150 ms, and any synchronous GL query made while a big batch is queued waits for the graphics chip's process to get through the queue first.

On a laptop's graphics chip the same work takes two to five times as long, which turns these into the multi-second freezes and the 20 to 40 fps the owner sees, and lib/three/pace then softens the picture in answer to stalls that sharpness can't fix.

## Is it Minecraft's chunks?

Minecraft splits an endless world into chunks so it can build them a few at a time, off the main thread, ahead of the player, upload a bounded amount each frame, and forget the far ones. What the worlds here are missing is the middle of that, not the endless part: they are small enough to keep whole on the graphics chip, but they do their work in one frame. So the design takes Minecraft's rules and applies them to the work first and to space second:

1. **No frame does more than its share.** Uploads, shader compiles and first draws go through a queue with a per-frame budget, and wait for the graphics chip with fences rather than by asking it synchronously.
2. **Everything is prepared before it's shown.** A world loads behind a loading screen until its pictures are up, its shaders linked, its pools built and its floor baked, then fades in. Taking longer is fine.
3. **Anything that still arrives late is held back, not waited for.** A frame guard on the renderer leaves out of the frame whatever isn't ready yet and readies it in the background; it pops in a few frames later instead of stopping the world.
4. **The sharpness is chosen once.** While loading, the world is drawn at a few sharpnesses and timed on the graphics chip; the sharpest that fits the frame budget is kept, and the pace only ever steps down from it.
5. **Space is chunked where it's big.** The universe's sectors and planets and the galaxy's surfaces are grids of cells, each prepared ahead of the ship or the walker by distance and heading through the same queue, and drawn only within range.

## The pieces

### 1. GPU work without stalls: `src/lib/three/gpuWork.js`

Pure of three.js except for the renderer it's handed; tested in Node with a fake renderer.

- `fence(renderer)` → a promise that resolves once the graphics chip's process has caught up with everything sent so far: WebGL2's `fenceSync`, polled with `getSyncParameter` once a frame (which never blocks), deleted after. Without WebGL2 it resolves after two frames.
- `compileSlices(renderer, root, camera, scene, { sliceMs, onStep })` → the materials under `root` (hidden ones too) compiled in batches of no more than `sliceMs` of main-thread time each (a batch is handed to `renderer.compile` as a stand-in root whose `traverse` walks just that batch, against `scene`'s lights), a fence after each batch, and then `isReady()` asked only after the fence, so it never waits on a queue. Resolves once every program has linked (or the context is lost, or a cap passes).
- `uploadSlices(renderer, textures, { sliceMB, onStep })` → pictures sent a few megabytes at a time, a fence between batches.
- `warmDraw(renderer, render, roots)` → every object under `roots` drawn once into a 1×1 scissor with nothing culled (lib/three/renderer's `revealAll`), in batches, so the first real frame creates no pipeline state.
- `prepareScene({ renderer, roots, scene, camera, passes, onProgress })` → the four above in order, with progress from 0 to 1 and the step's name. This is a world's whole warm-up, and every warm-up on the site moves onto it.
- lib/three/renderer's `precompile` waits on a fence before its first `isReady()`, and compiles in slices when there's more than a slice to compile.

### 2. The frame guard: `src/lib/three/frameGuard.js`

`guard(renderer, { uploadMB, compileMs, adopt })` wraps the renderer's own `renderBufferDirect` (three.js calls it through the instance for every draw):

- a draw whose material has never been compiled, or uses a picture that has never been sent, is skipped this frame; the object is queued;
- after the frame (the guard also wraps `render`), the queue is worked through under budget: `adopt(object)` first (a world's house look, so the shader compiled is the one it will use), then its compile, fenced; pictures sent up to `uploadMB` a frame, biggest last;
- a material whose program has linked and whose pictures are up draws from then on, and is never checked again unless it's swapped;
- shadow-map draws pass through (their depth shaders are small and shared); post-processing quads aren't scenes and aren't touched;
- in development, a frame in which a program was still compiled mid-draw, or the scene's lights changed shape (which recompiles every lit shader), is logged with the material's name and what it cost, so the remaining sources can be found and fixed where they are.

`createRenderer` (every page scene, the universe and the worlds with renderers of their own) and the runtime's WebGL backend install it; a renderer can opt out (`guard: false`) for scenes that draw everything once and stop.

### 3. Prepare behind a loading screen

- `src/components/worlds/LoadingVeil.jsx`: the loading screen over a world while it prepares: the world's name, a progress bar with the step ("Sending pictures to the graphics chip", "Compiling shaders", "Baking the light", "Tuning for this screen"), a line of the world's own, and a fade when it's ready. Pure CSS animation, so it keeps moving while the graphics chip works.
- `lib/three/useScene`: a scene's `prepare(onProgress)` (or its old `warmUp`) runs whether the page is covered or not, before the first frame is shown; the hook reports `preparing` and the progress, and the page shows the veil. The universe moves its warm-up onto `prepareScene`, adopts the house look before compiling, and builds and readies its pools (hunters, traffic, the director's set pieces, the war front, the trench and the Citadel, the near-planet spheres and maps, the cockpit) while the veil is up.
- `src/runtime`: `build()` calls the world's `prepare(report)` after `ready` and before `begin()`; `rt.events` carries the progress to the page. For a handover (the dive, the climb), the old world goes on drawing while the new one prepares a slice at a time, so the flight is the loading screen; the surface module's create yields between its steps instead of running as one task.
- Floor bakes run while the veil is up, and their result is kept in the browser (IndexedDB, keyed by the world, the place, the sun, the tier and a hash of what casts), so the second visit doesn't bake at all.

### 4. Calibrate, then hold: `src/lib/three/calibrate.js`

While the veil is up, after the warm-up, the world is drawn about thirty times at each of a few sharpnesses (the device's ratio and the pace's steps under it), each frame timed on the graphics chip with `EXT_disjoint_timer_query_webgl2` (Chrome has it on Metal) or, without it, by waiting on a one-pixel read. The sharpest ratio whose typical frame fits the budget (12 ms for a 60 Hz screen) is kept, remembered for this graphics chip and this world (`tp-calibration`), and handed to the pace as its ceiling: it starts there and steps down only, so it never see-saws. A later visit skips straight to the remembered ratio and checks it with a few frames.

### 5. Chunks: the infinite-worlds design's

Spatial chunking is the infinite-worlds design's (`docs/superpowers/specs/2026-10-07-infinite-worlds-design.md`, another session's), which counts this design as its Phase 0: `runtime/chunkGrid.js` (`rt.chunks`: cells nearest and ahead first, dropped past the radius plus hysteresis), `rt.workers` (generation and meshing off the main thread) and `rt.origin` (a floating origin), with Minecraft streaming through them already. No second grid is made here. What a cell sends the graphics chip goes through this design's frame guard, installed on the runtime's renderer: a cell's new materials and pictures are held back and readied under the per-frame budget. Its install packs are the Download bar that comes before this design's Prepare bar (`LoadingVeil`).

## Order of work (each its own pull request, merged when it's in and measured)

1. The probe and the measurements.
2. `gpuWork` and the frame guard, installed on every renderer; `precompile` on fences. Every world gains from it at once.
3. The loading veil, `useScene`'s prepare, and the universe prepared: house look first, warm-up on `prepareScene`, pools readied, warm-up when coming back from a world.
4. The runtime's prepare: the galaxy and its surfaces (the dive and climb as the loading screen, the surface's create in steps), Earth, and the floor-bake cache.
5. The other worlds with their own renderers (Avengers, Middle-earth, Albuquerque, C-137, Cybertron, Invincible, the music room) on the veil and `prepareScene`, with their late loads moved into it.
6. Calibration and the pace's ceiling.
7. Chunks: left to the infinite-worlds design (above).

## How it's checked

- Unit tests (Vitest, Node) for the pure parts: the fence's fallback, the slices' budgets, the guard's skip-and-queue rules on a fake renderer, calibration's pick, the chunks' cells and hysteresis, the bake cache's key.
- `scripts/perf-probe.mjs` before and after each pull request, on the same journeys. The bar: after a world is revealed, no frame over 100 ms in any journey, and the 99th-percentile frame under 33 ms; the time to ready may grow.
- The site's own tests, lint and build, and the travel, universe and world checks that already exist.
