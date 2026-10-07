// How much each detail level (lib/detail's 'low' | 'mid' | 'high' |
// 'ultra') may draw: one row a level, the numbers every scene reads about
// *how much* to put on the screen (docs/superpowers/specs/2026-10-07-
// quality-modes-design.md §2). Pure, no three.js, so the check scripts and
// tests read the same table.
//
//   level   triangles  props  LOD1  grass  terrain  water
//   low     0.8M       0.5    yes   0.25   0.5      0.5
//   mid     1.5M       0.75   yes   0.5    0.75     0.75
//   high    3M         1      yes   1      1        1
//   ultra   none       1.5    no    2      2        2
//
// props: how many of the scattered things a world places; lod1: whether a
// model's light copy stands in for it far off; grass, terrain, water: the
// grass's blades, the ground's mesh and the water's mesh and maps, against
// high's.
//
//   budget(level) → that level's row (high's for a level it doesn't know)

export const BUDGETS = {
  low: { triangles: 0.8e6, props: 0.5, lod1: true, grass: 0.25, terrain: 0.5, water: 0.5 },
  mid: { triangles: 1.5e6, props: 0.75, lod1: true, grass: 0.5, terrain: 0.75, water: 0.75 },
  high: { triangles: 3e6, props: 1, lod1: true, grass: 1, terrain: 1, water: 1 },
  ultra: { triangles: null, props: 1.5, lod1: false, grass: 2, terrain: 2, water: 2 },
};

export const budget = (level) => BUDGETS[level] ?? BUDGETS.high;
