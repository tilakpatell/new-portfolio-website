# Handoff: the universe polish

The audit is `docs/research/2026-10-08-universe-polish-audit.md`, the design `docs/superpowers/specs/2026-10-08-universe-polish-design.md`, the plan `docs/superpowers/plans/2026-10-08-universe-polish.md`. Three lanes run at once, each on its own branch and its own files (the spec’s “The shape”). Each lane keeps its own row below, in the pull request that merges it.

## The check takes a picture again (lane C, Task C0)

`scripts/universe-check.mjs` was blank at every pose since #678. The scene was made, and the pose drawn, a minute or more before `lib/three/useScene` marked the map’s box `data-gl="on"`, and until then `index.css` holds `.scene-canvas` at opacity 0 behind the loading veil. The shot was a clear canvas over a white page. The map is mounted through `useScene`, not the world runtime, so the plan’s guess of the runtime’s `data-fresh` was the same mechanism under another name. The check now waits for `data-gl="on"`, measures the renderer’s own canvas, and fails loudly if that canvas isn’t the drawn one on screen. A pose takes about five minutes in a container’s software Chromium (`--quality high --frames 3`). **Lanes A and B: take your “before” shots on `main` from this merge on.**

Measured on `main` with the fix, `high`: falcon-sun 132 calls, 1.16 M triangles; overview 154 calls, 1.17 M triangles. The baseline (`lab/universe/baseline/high.json`) has overview at 150 calls, so overview is 4 calls over before any lane’s change. Compare against your own “before”, not only the baseline.

## Status

| Lane | What | PR | Status | Evidence |
|---|---|---|---|---|
| C0 | The check’s shots | #690 | done | falcon-sun entropy 0 → 6.86, edges 0 → 0.258; overview entropy 0 → 3.16 |
| A | The hero ship | | | |
| B | The sky and the space between | | | |
| C | The lens and the frame | #695 | done (README pictures wait for A and B) | Chase camera: the Falcon 0.245 of the frame’s width at rest, 0.21 at cruise, 0.15 boosting (0.11 and 0.07 before; `flight.test.js`). Toe at 0.02–0.08 and contrast 0.18 on the map only: share under 0.02 at overview 0 → 0.86, belt 0 → 0.10, falcon-sun 0 → 0.03; median at belt 0.244 → 0.246, falcon-sun 0.511 → 0.501 (what is lit kept). Soft edge to the corners, not on `low`, off from pace step 3. Counts as before at every pose (falcon-sun 130, 1.16 M; overview 152 → 154, main’s run-to-run ±2; belt 64, 1.03 M), under the baseline but for overview’s calls, which main already had. `scripts/pixel-measure.mjs` for lanes A and B. The falcon-sun pose holds its own camera, so its ship width doesn’t move (295 px); the chase framing shows in flight. The toe floors the overview’s sky almost whole (the band there is under 0.02 linear): lane B’s `dim: 0.4` should be judged with it on |
