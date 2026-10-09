// What stops a shot in one of C-137's places (./rules.js's), for
// lib/combat/bolt.js's step: the floor, the ceiling, the walls inside and
// round the place, and the furniture as the boxes Morty walks into, each as
// high as it stands (`top`; a box without one, a building, goes up to the
// ceiling or the sky). People aren't solids: a shot's bodies are its own
// (Total Rickall's crowd, a duel's hunter). Pure: plain [x, y, z] arrays.
//
//   roomSolids(area) → (a, b) → { at, normal } | null, the first along a–b.

import { AREAS, CEILING, collidersIn, wallsIn } from './rules';

const LOW_WALL = 1; // a wall marked low (the banister): how high it stands

// a box as the walker has it ({ x, z, w, d, turn }), standing from y0 to
// y1: where a–b first goes into it (0…1 along, and the face's normal), or
// null. Turned into the box's own frame, as rules.js's over() turns it.
function boxHit(a, b, box, y0, y1) {
  const t = box.turn || 0;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const local = (x, z) => [(x - box.x) * c - (z - box.z) * s, (x - box.x) * s + (z - box.z) * c];
  const [ax, az] = local(a[0], a[2]);
  const [bx, bz] = local(b[0], b[2]);
  const o = [ax, a[1], az];
  const d = [bx - ax, b[1] - a[1], bz - az];
  const lo = [-box.w / 2, y0, -box.d / 2];
  const hi = [box.w / 2, y1, box.d / 2];
  let enter = -Infinity;
  let exit = Infinity;
  let axis = -1;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-12) {
      if (o[i] < lo[i] || o[i] > hi[i]) return null;
      continue;
    }
    let t0 = (lo[i] - o[i]) / d[i];
    let t1 = (hi[i] - o[i]) / d[i];
    if (t0 > t1) [t0, t1] = [t1, t0];
    if (t0 > enter) {
      enter = t0;
      axis = i;
    }
    exit = Math.min(exit, t1);
  }
  // (starting inside it counts as nothing: a shot from someone leaning on it)
  if (axis < 0 || enter > exit || enter < 0 || enter > 1) return null;
  // the face's normal, back in the world's frame
  const sign = d[axis] > 0 ? -1 : 1;
  let normal = [0, sign, 0];
  if (axis !== 1) {
    const [lx, lz] = axis === 0 ? [sign, 0] : [0, sign];
    normal = [lx * c + lz * s, 0, -lx * s + lz * c].map((v) => (Math.abs(v) < 1e-12 ? 0 : v));
  }
  return { t: enter, normal };
}

// a wall's segment ([x0, z0, x1, z1, thick, low]) as a box along it
const wallBox = ([x0, z0, x1, z1, thick, low]) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: Math.hypot(x1 - x0, z1 - z0), d: thick ?? 0.12, turn: Math.atan2(-(z1 - z0), x1 - x0), low: Boolean(low) });

const made = new Map();
export function roomSolids(area) {
  if (made.has(area)) return made.get(area);
  const top = CEILING[area] ?? Infinity;
  const tall = Number.isFinite(top) ? top : 1e4;
  const parts = [
    ...(collidersIn(area) ?? []).filter((c) => c.kind === 'box').map((c) => ({ box: c, y1: c.top ?? tall })),
    ...(wallsIn(area) ?? []).map(wallBox).map((w) => ({ box: w, y1: w.low ? LOW_WALL : tall })),
  ];
  const A = AREAS[area];
  const solids = (a, b) => {
    let best = null;
    const take = (t, normal) => {
      if (t >= 0 && t <= 1 && (!best || t < best.t)) best = { t, normal };
    };
    const dy = b[1] - a[1];
    // the floor, and the ceiling indoors
    if (a[1] > 0 && b[1] <= 0) take(a[1] / -dy, [0, 1, 0]);
    if (Number.isFinite(top) && a[1] < top && b[1] >= top) take((top - a[1]) / dy, [0, -1, 0]);
    // the place's own walls, from inside: where it leaves its rectangle
    if (A && Number.isFinite(top)) {
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      if (b[0] < A.x0 && a[0] >= A.x0) take((A.x0 - a[0]) / dx, [1, 0, 0]);
      if (b[0] > A.x1 && a[0] <= A.x1) take((A.x1 - a[0]) / dx, [-1, 0, 0]);
      if (b[2] < A.z0 && a[2] >= A.z0) take((A.z0 - a[2]) / dz, [0, 0, 1]);
      if (b[2] > A.z1 && a[2] <= A.z1) take((A.z1 - a[2]) / dz, [0, 0, -1]);
    }
    for (const p of parts) {
      const h = boxHit(a, b, p.box, 0, p.y1);
      if (h) take(h.t, h.normal);
    }
    if (!best) return null;
    return { at: [a[0] + (b[0] - a[0]) * best.t, a[1] + dy * best.t, a[2] + (b[2] - a[2]) * best.t], normal: best.normal };
  };
  made.set(area, solids);
  return solids;
}
