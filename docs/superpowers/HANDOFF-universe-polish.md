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
| C | The lens and the frame | | | |
