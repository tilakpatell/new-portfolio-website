# Handoff: the Middle-earth landing

The map hub at `#/middle-earth`, remade: the sheet in the first frame, a flight down the road, a desk and a candle, places that wake as you look at them, an inked road and a small face over it, on desktop and phone.
This page keeps the lane’s numbers: the baseline taken before any scene change, and a row after each task.

Read `docs/superpowers/specs/2026-10-09-middle-earth-landing-design.md` (the design) and `docs/superpowers/plans/2026-10-09-middle-earth-landing.md` (the tasks). The before shots are `docs/superpowers/shots/2026-10-09-me-hub-before-*.webp`.

## How the numbers are taken

`node lab/me/measure.mjs [--dark] [--phone]` (git-ignored; the plan’s Task 0 says how to write it again if `lab/me/` is gone) starts Vite, opens the hub in the container’s Chromium on SwiftShader with WebGL forced, quality `high` and the opening skipped, waits 8 s and prints one line:

- `calls`, `triangles`: the backdrop’s `renderer.info.render` for its last frame (`window.__ME__.map.info()`).
- `uiShare`: the screen the hub’s UI covers (the union of the boxes of `.me-hub-head`, `.me-pin-label`, `.me-mark-label`, `.me-ribbon`, `.me-route`, `.me-hub-links`, `.me-credit`, `.me-hint`, on a 4 px grid), over the screen.
- `pool` (`--dark` only): the mean Rec. 709 luminance, 0 to 1, of a 300 × 200 px patch of the canvas centred on the sheet’s north-west corner (`project(60, 40)`), where the candle will stand. The patch is clipped to the canvas; `null` when the corner is off it, as it is on a phone today.

Desktop is 1440 × 900, phone 390 × 844 with touch, both at a device pixel ratio of 1.

## Baseline

Taken on 2026-10-09 at `12969237`, before any scene change.

| run | calls | triangles | uiShare | pool |
|---|---|---|---|---|
| desktop | 254 | 206,318 | 0.281 | |
| desktop, dark | 255 | 206,322 | 0.281 | 0.056 |
| phone | 230 | 246,707 | 0.385 | |
| phone, dark | 227 | 234,143 | 0.385 | null (corner off screen) |

The scene moves, so the counts drift between runs. Over the ten runs taken (two or three a mode): desktop calls 254 to 256 and triangles 206,318 to 206,338; phone calls 224 to 230 and triangles 234,143 to 310,281; the desktop pool 0.046 to 0.056. `uiShare` did not move. Read a later row against these ranges, not the single line.

## After each task

| task | calls | triangles | uiShare desktop | uiShare phone | pool dark |
|---|---|---|---|---|---|
