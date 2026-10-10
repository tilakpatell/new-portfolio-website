# Where the worlds stall (2026-10-07)

Measured with `scripts/perf-probe.mjs` on an M3 Pro, Chromium 141 on Metal with no vsync and no frame cap, a 1470×956 window at device pixel ratio 2 (a 13-inch laptop's retina screen), the device's own tier (high), a fresh browser profile each journey (nothing cached but the dev server's own transforms). The design that answers it is `docs/superpowers/specs/2026-10-07-smooth-worlds-design.md`.

The probe's rows are phases of a journey: `load` (the address to the world's first sign of life), `settle` (the first four seconds after), `idle` (six seconds untouched), and `move`/`fly`/`walk` (a few seconds of the keys). For each it gives the frame times' spread and the frames over 50 and 100 ms; for the worst frames, what the graphics chip was sent in them (shader programs linked, pictures uploaded and their size, buffers) and which script the browser's long-animation-frame timing blames.

## Per journey

| journey | worst frame | frames > 100 ms | typical frame once up | draws / k triangles once up |
|---|---|---|---|---|
| universe map | 2586 ms | 12 | 3.8–5 ms | 63–74 / 301–319 |
| galaxy (Tatooine system) | 1256 ms | 7 | 6.5–7.3 ms | 48–51 / 265 |
| the flown trip down to Tatooine and back | 6005 ms | 22 | 5.3 ms on foot, 14 ms back in space | 144 / 572 |
| a galaxy surface, from its address | 1274 ms | 21 | 9.1 ms | 184 / 604 |
| Avengers compound | 1769 ms | 10 | 11.6 ms | 189 / 629 |
| the Shire | 4042 ms | 9 | 8.8 ms walking, 22.7 ms on the map | 359–1056 / 555–1096 |
| Albuquerque | 1819 ms | 7 | 6 ms | 180 / 908 |
| Dimension C-137 | 1848 ms | 16 | 3.5 ms | 42 / 348 |
| Cybertron (and Roll out, opened by the click) | 10149 ms | 11 | 8.3 ms | 96 / 362 |
| Invincible | 499 ms | 12 | 15.7 ms | 174 / 2278 |
| Earth | 3119 ms | 4 | 2.2 ms | 38 / 206 |
| Dot Matrix island | 2479 ms | 3 | 2.2 ms | 363 / 33 |
| Caribbean (Dead man's tide) | 1234 ms | 6 | 9 ms | 30 / 369 |

## What the worst frames were

- **Shader links queued in bulk, then asked about synchronously.** Albuquerque: 146 programs compiled at once, then `precompile`'s readiness check blocked 1818 ms in `getProgramParameter`. The universe's first frame: 2.6 s (and 4.3 s on a colder run), because the house look patches every lit material on the first frame, after `ready` compiled the unpatched shaders.
- **Pictures sent in one frame.** Earth: about a gigabyte of maps in a 3.1 s frame. A galaxy surface: 200 MB in 1.3 s on arrival and again 207 MB while walking. The universe: 61 MB in its first frame, 18–51 MB in frames of 0.6–1.7 s while flying.
- **Synchronous builds.** The galaxy surface's module builds in one 1.9 s task in the middle of the dive; the galaxy has frames of 1–1.3 s with nothing sent at all; Dot Matrix island 2.5 s; Albuquerque's world 1.2 s; Roll out 10 s.
- **Floor bakes on arrival.** `lib/three/grounding-bake` held one frame for 4.6 s on landing on Tatooine, and 0.25–0.65 s in the Avengers compound and Cybertron.

## The graphics chip's side, in isolation

`KHR_parallel_shader_compile` works on ANGLE/Metal: 150 three.js standard and physical materials, each its own program, link in 0.7–1 s without blocking the page, if nothing asks about them synchronously meanwhile (a fence polled with `getSyncParameter` costs nothing to ask). But `renderer.compile()` takes 110–180 ms of main-thread JavaScript to make them, and their first draw another 40–150 ms. `EXT_disjoint_timer_query_webgl2` is there for timing frames on the graphics chip.

## So

The steady frame is cheap on this machine and two to five times dearer on a laptop's chip, which is mostly the pixel count (a retina window at ratio 2, multisampling and bloom). The stalls are the problem: every world does its whole warm-up, or the next thing's, inside one frame.

## After the frame guard and the universe's loading screen

Same journeys, same machine, with `window.__tpNoShaderChecks` (development otherwise reads back every shader's log, which waits on each link; the built site doesn't):

| journey | worst frame before → after, once the world is up |
|---|---|
| universe map, resting / flying | 2586 / 1290 ms → 33 / 188 ms |
| galaxy, resting / flying | 1053 / 1256 ms → 18 / 32 ms |
| landing on Tatooine / walking / back in space | 6005 / 31 / 72 ms → 397 / 164 / 129 ms |
| Earth, arriving | 3119 ms → 413 ms |
| Cybertron, Roll out opened | 10149 ms → 19 ms |
| Albuquerque, walking | 489 ms → 62 ms |

Two more causes turned up on the way. A shader made but still linking, drawn, waits for its link: the guard now draws at once only a shader known to have linked (`gpuWork`'s `markLinked`). And the pace changing the runtime's sharpness resized the canvas, which on Metal waits for the graphics chip (0.8 s or more each time, twice per change): it's one resize per change now, none when nothing changed, and the runtime's pace only ever steps down.

## After calibration (part 6)

The galaxy, flown from its address: worst frame resting 29 ms, flying 39 ms, and 45 ms in the first seconds after it's shown (was 430–1237 ms: the pace stepping the sharpness down in answer to start-up stalls, each step a canvas resize). The sharpness is now found behind the loading screen and held as the pace's ceiling.
