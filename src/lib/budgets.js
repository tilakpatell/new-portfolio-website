// How much each quality level draws: one row a level, and every number a
// scene reads about *how much* (triangles, draw calls, props, grass, terrain,
// water, which cut of a made model) comes from here through `budget(level)`.
// lib/device decides the level (Auto, or the visitor's pick in the settings
// panel); lib/detail still decides how *fine* (texture sizes, segments).
// Pure and free of three.js, so the QA scripts read the same table in Node
// (scripts/galaxy-check.mjs holds every world to its level's row).
//
//   level  triangles  calls  models MB  props  LOD1  grass  terrain  gen3d cut  water
//   low    0.8M       350    20         0.5    yes   0.25   0.5      .lo        0.5
//   mid    1.5M       500    40         0.75   yes   0.5    0.75     (plain)    0.75
//   high   3M         700    60         1      yes   1      1        .hq        1
//   ultra  none       1500   240        1.5    no    2      2        .ultra     2
//
// Ultra has no triangle ceiling (Infinity) and keeps the full model at every
// distance (no LOD1 swap); its gate is the draw calls, the download and, on
// a real graphics chip, the frame time. The design:
// docs/superpowers/specs/2026-10-07-quality-modes-design.md §2.

export const COLUMNS = ['tris', 'calls', 'modelsMB', 'props', 'lod1', 'grass', 'terrain', 'cut', 'water'];

const row = (tris, calls, modelsMB, props, lod1, grass, terrain, cut, water) => Object.freeze({ tris, calls, modelsMB, props, lod1, grass, terrain, cut, water });

export const BUDGET_ROWS = Object.freeze({
  low: row(0.8e6, 350, 20, 0.5, true, 0.25, 0.5, '.lo', 0.5),
  mid: row(1.5e6, 500, 40, 0.75, true, 0.5, 0.75, '', 0.75),
  high: row(3e6, 700, 60, 1, true, 1, 1, '.hq', 1),
  ultra: row(Infinity, 1500, 240, 1.5, false, 2, 2, '.ultra', 2),
});

// A level's row; anything else (a typo, nothing) reads as high's.
export const budget = (level) => BUDGET_ROWS[level] ?? BUDGET_ROWS.high;

// What the universe map waits for: the bytes of its planets' maps (and the
// sky's) fetched before its first frame, in MB of 10^6 as fetched, the same
// on every level (planetMaps.js's up-front set; the rest come after it,
// nearMaps.js). planetMaps.test.js sums the files; scripts/perf-probe.mjs
// measures them in a browser.
export const FIRST_FRAME_MAPS_MB = 0.7;
