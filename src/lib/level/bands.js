// Which cells of a level pack a visitor wants, and at which cut (lane L).
// The bands are the budget row's: within `near` the pack's `plain` cut (ultra
// its `ultra`; low and mid its `lod1`, as their rows swap a kit model to its
// LOD1 there), to `mid` the `lod1`, beyond that the pack's one far list. In
// whole cells round the visitor's own, so a visitor anywhere in a cell has
// the band's distance covered on every side.
//
//   bandsFor(row, cell) → { near, mid, nearRing, midRing, horizon }
//   cutFor(band, tier) → 'plain' | 'lod1' | 'far' | 'ultra'
//   wanted(pack, [x, z], tier) → { near: keys, mid: keys, farList } nearest first

import { budget } from '../budgets.js';
import { CELL, cellKey, cellOf } from './instances.js';

const SMALL = new Set(['low', 'mid']);

export function bandsFor(row, cell = CELL) {
  return {
    near: row.near,
    mid: row.mid,
    nearRing: Math.max(1, Math.ceil(row.near / cell)),
    midRing: Math.max(1, Math.ceil(row.mid / cell)),
    // (the backdrop's reach: the small tiers draw half of it)
    horizon: row.lod1 && row.tris <= 1.5e6 ? 0.5 : 1,
  };
}

export function cutFor(band, tier) {
  if (band === 'far') return 'far';
  if (band === 'mid' || SMALL.has(tier)) return 'lod1';
  return tier === 'ultra' ? 'ultra' : 'plain';
}

export function wanted(pack, [x, z], tier) {
  const cell = pack.cell ?? CELL;
  const b = bandsFor(budget(tier), cell);
  const [cx, cz] = cellOf(x, z, cell);
  const near = [];
  const mid = [];
  const dist = new Map();
  for (let dz = -b.midRing; dz <= b.midRing; dz++) {
    for (let dx = -b.midRing; dx <= b.midRing; dx++) {
      const key = cellKey(cx + dx, cz + dz);
      if (!pack.cells[key]) continue;
      dist.set(key, Math.hypot((cx + dx + 0.5) * cell - x, (cz + dz + 0.5) * cell - z));
      (Math.max(Math.abs(dx), Math.abs(dz)) <= b.nearRing ? near : mid).push(key);
    }
  }
  const byDist = (a, c) => dist.get(a) - dist.get(c);
  return { near: near.sort(byDist), mid: mid.sort(byDist), farList: true };
}
