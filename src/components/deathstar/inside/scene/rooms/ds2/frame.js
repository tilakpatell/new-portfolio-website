// The bones of the second Death Star’s big rooms: coffered ceilings of
// deep beams with a light strip down each coffer, holed by the wells a
// shuttle’s folded wings rise into (each well a lit shaft of its own);
// grated walkways along the walls with their rails and braces; and the
// seams let into a deck, so a floor eighty metres across reads as plates.
//
//   ceilingOf(kit, room, { step, depth, wells }) → parts   wells: plan.js’ wellOver rects
//   walkway(kit, { x0, x1, z0, z1 }, y, open, wall) → parts   open: the sides railed ('north'…); wall: the side braced to
//   railing(kit, a, b, y, every) → parts   posts and two rails from a to b ({ x, z }) at height y
//   seamsOf(kit, rect, y, step) → parts   lines across a deck every `step` metres both ways

import { solidRects } from '../../kit';
import { cutSpan } from './plan';

const near = (v, lo, hi, pad) => v > lo - pad && v < hi + pad;

export function ceilingOf(kit, room, { step = 8, depth = 1.4, wide = 0.9, wells = [] } = {}) {
  const b = room.box;
  const y = room.y + room.h;
  const [w, d] = [b.x1 - b.x0, b.z1 - b.z0];
  const holes = wells.map((h) => ({ x0: h.x0 - b.x0, x1: h.x1 - b.x0, y0: h.z0 - b.z0, y1: h.z1 - b.z0 }));
  const parts = solidRects(w, d, holes).map((r) => kit.plate(r.x1 - r.x0, r.y1 - r.y0, b.x0 + (r.x0 + r.x1) / 2, y, b.z0 + (r.y0 + r.y1) / 2, 'ceiling', 'down'));
  // the beams, broken where a well opens
  for (let x = b.x0 + step; x < b.x1 - 0.1; x += step) {
    const gaps = wells.filter((h) => near(x, h.x0, h.x1, wide / 2)).map((h) => [h.z0, h.z1]);
    for (const [z0, z1] of cutSpan(b.z0, b.z1, gaps)) parts.push(kit.box(wide, depth, z1 - z0, x, y - depth / 2, (z0 + z1) / 2, 'trim'));
  }
  for (let z = b.z0 + step; z < b.z1 - 0.1; z += step) {
    const gaps = wells.filter((h) => near(z, h.z0, h.z1, wide / 2)).map((h) => [h.x0, h.x1]);
    for (const [x0, x1] of cutSpan(b.x0, b.x1, gaps)) parts.push(kit.box(x1 - x0, depth * 0.7, wide, (x0 + x1) / 2, y - depth * 0.35, z, 'trim'));
  }
  for (let x = b.x0 + step / 2; x < b.x1; x += step) {
    for (let z = b.z0 + step / 2; z < b.z1; z += step) {
      if (wells.some((h) => near(x, h.x0, h.x1, 0.5) && near(z, h.z0, h.z1, step / 2))) continue;
      parts.push(kit.plate(0.35, step - 2.2, x, y - 0.02, z, 'strip', 'down'));
    }
  }
  for (const h of wells) parts.push(...wellOf(kit, h));
  return parts;
}

// A well: its four sides in deep-ribbed plating, a ring of light round its
// mouth and another round its head, and a cap of light strips.
function wellOf(kit, h) {
  const [w, d, tall] = [h.x1 - h.x0, h.z1 - h.z0, h.y1 - h.y0];
  const [cx, cz, cy] = [(h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2, (h.y0 + h.y1) / 2];
  const parts = [kit.plate(w, d, cx, h.y1, cz, 'ceiling', 'down')];
  for (const [len, x, z, alongX] of [[w, cx, h.z0, true], [w, cx, h.z1, true], [d, h.x0, cz, false], [d, h.x1, cz, false]]) {
    parts.push(alongX ? kit.box(len + 0.4, tall, 0.2, x, cy, z, 'wall') : kit.box(0.2, tall, len, x, cy, z, 'wall'));
    for (const y of [h.y0 + 0.3, h.y1 - 0.4]) parts.push(alongX ? kit.box(len - 0.4, 0.14, 0.24, x, y, z, 'strip') : kit.box(0.24, 0.14, len - 0.4, x, y, z, 'strip'));
    for (let t = 2; t < len - 1; t += 3) {
      const [px, pz] = alongX ? [h.x0 + t, z] : [x, h.z0 + t];
      parts.push(alongX ? kit.box(0.4, tall - 1, 0.5, px, cy, pz, 'trim') : kit.box(0.5, tall - 1, 0.4, px, cy, pz, 'trim'));
    }
  }
  for (let x = h.x0 + 2; x < h.x1 - 1; x += 3) parts.push(kit.plate(0.4, d - 2, x, h.y1 - 0.03, cz, 'strip', 'down'));
  return parts;
}

export function railing(kit, a, b, y, every = 2) {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.round(len / every));
  const parts = [];
  for (let i = 0; i <= n; i++) parts.push(kit.box(0.06, 1.05, 0.06, a.x + ((b.x - a.x) * i) / n, y + 0.525, a.z + ((b.z - a.z) * i) / n, 'rail'));
  for (const h of [0.55, 1.05]) parts.push(kit.beam({ x: a.x, y: y + h, z: a.z }, { x: b.x, y: y + h, z: b.z }, 0.06, 0.06, 'rail'));
  return parts;
}

export function walkway(kit, { x0, x1, z0, z1 }, y, open, wall) {
  const parts = [kit.plate(x1 - x0, z1 - z0, (x0 + x1) / 2, y, (z0 + z1) / 2, 'grate', 'up')];
  const alongX = x1 - x0 > z1 - z0;
  const edges = alongX
    ? { north: [{ x: x0, z: z0 }, { x: x1, z: z0 }], south: [{ x: x0, z: z1 }, { x: x1, z: z1 }] }
    : { west: [{ x: x0, z: z0 }, { x: x0, z: z1 }], east: [{ x: x1, z: z0 }, { x: x1, z: z1 }] };
  for (const [side, [a, b]] of Object.entries(edges)) {
    parts.push(kit.beam({ ...a, y: y - 0.15 }, { ...b, y: y - 0.15 }, 0.15, 0.3, 'trim'));
    if (open.includes(side)) parts.push(...railing(kit, a, b, y));
  }
  const len = alongX ? x1 - x0 : z1 - z0;
  if (wall) {
    for (let s = 2; s < len; s += 6) {
      const p = alongX ? { x: x0 + s, z: wall === 'north' ? z0 : z1 } : { x: wall === 'west' ? x0 : x1, z: z0 + s };
      const q = alongX ? { x: p.x, z: wall === 'north' ? z1 : z0 } : { x: wall === 'west' ? x1 : x0, z: p.z };
      parts.push(kit.beam({ ...p, y: y - 2 }, { ...q, y: y - 0.3 }, 0.14, 0.2, 'trim'));
    }
  }
  for (let s = 1; s < len; s += 4) {
    const c = alongX ? { x: x0 + s, z: (z0 + z1) / 2 } : { x: (x0 + x1) / 2, z: z0 + s };
    parts.push(kit.box(alongX ? 0.5 : 0.2, 0.04, alongX ? 0.2 : 0.5, c.x, y - 0.32, c.z, 'strip'));
  }
  return parts;
}

export function seamsOf(kit, { x0, x1, z0, z1 }, y, step = 8, line = 0.05) {
  const parts = [];
  for (let x = x0 + step; x < x1 - 0.5; x += step) parts.push(kit.plate(line, z1 - z0, x, y + 0.002, (z0 + z1) / 2, 'trim', 'up'));
  for (let z = z0 + step; z < z1 - 0.5; z += step) parts.push(kit.plate(x1 - x0, line, (x0 + x1) / 2, y + 0.002, z, 'trim', 'up'));
  return parts;
}
