// How much a world's surface draws, from the level's row of the budget
// table (lib/budgets: terrain, props, grass, water, LOD1) and whether the
// screen is small (a phone keeps the numbers it was tuned at, whatever its level).
// High, on a big screen, is what the surface has always drawn; ultra draws
// the ground twice as fine, half as many props again, twice the grass
// reaching further, twice the water, and the extras only it has (the fine
// relief, the layered ground, the finer clouds). Pure, so it's tested.
//
//   amountsFor({ level, small }) → { grid: { n, grow } (terrain.js's
//     heightGrid), scatter (how many of each scatter's n), grass: { side,
//     size } (lib/three/grass), map, marks (the ground map's and the marks'
//     texels a side), rings (ocean.js's discRings), depthN (the water's
//     depth bake), relief (terrain.js's fine relief, 0…1), splat (the
//     layered ground: ground.js), clouds (sky.js's finer clouds, 0 or 1) }
// (whether a model's light copy stands in far off is the placer's, from
// the same row: catalog's wantsLod; seat: things seated on the lowest
// ground under them, placer.js, ultra only)

import { budget } from '../../../lib/budgets';

// what high draws, on a big screen and on a small one
const HIGH = { n: 256, grow: 1.08, grassSide: 280, grassSize: 44, map: 512, depth: 512 };
const SMALL = { n: 160, grow: 1.13, scatter: 0.6, grassSide: 120, map: 256, depth: 256 };

const pow2 = (v) => 2 ** Math.round(Math.log2(v));

export function amountsFor({ level = 'high', small = false } = {}) {
  const b = budget(level);
  const ultra = level === 'ultra' && !small;
  // (the grass: its blades × b.grass, the patch's side growing with the
  // cube root of it, so it's both denser and reaches further)
  const grassSide = Math.round(HIGH.grassSide * Math.sqrt(b.grass));
  const grassSize = Math.round(HIGH.grassSize * Math.cbrt(b.grass));
  if (small)
    return {
      grid: { n: SMALL.n, grow: SMALL.grow },
      scatter: SMALL.scatter,
      grass: { side: SMALL.grassSide, size: HIGH.grassSize },
      map: SMALL.map,
      marks: SMALL.map,
      rings: { small: true, scale: 1 },
      depthN: SMALL.depth,
      relief: 0,
      splat: false,
      seat: false,
      clouds: 0,
    };
  return {
    // (the grid's growing rings out to the horizon finer with it too)
    grid: { n: Math.round(HIGH.n * b.terrain), grow: +(1 + (HIGH.grow - 1) / b.terrain).toFixed(3) },
    scatter: b.props,
    grass: { side: grassSide, size: grassSize },
    map: pow2(HIGH.map * Math.min(2, Math.max(0.5, b.terrain))),
    marks: pow2(HIGH.map * Math.min(2, Math.max(0.5, b.terrain))),
    rings: { scale: b.water },
    depthN: pow2(HIGH.depth * b.water),
    relief: ultra ? 1 : 0,
    splat: ultra,
    seat: ultra,
    clouds: ultra ? 1 : 0,
  };
}
