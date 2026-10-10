// What a bolt stops at on a galaxy surface: the world's solids (the same
// circles and boxes you walk into, each standing from its base, if it has
// one, to its top, if it has one: a waist-high wall stops a bolt at your
// knees and lets one over your head go by) and the ground under them. The
// world's half of lib/combat/bolt.js's step, and of the aim's ray.
//
// boltSolids(world, { step = 1 }) → (a, b) → { at, normal, surface } | null:
// the first solid along the segment a → b ([x, y, z] arrays); `surface`
// what it struck, { ground: true } or { solid, tag } (the solid's own `tag`,
// a material index where one was given), for lib/physics/materials.js. A segment that
// starts inside one stops where it starts (a muzzle pressed into a wall).
// world: { heightAt, normalAt?, solids (walker's createSolids), floors? }.

import { groundAt } from './walker';

const BIG = 1e9;
const CHUNK = 24; // m: a long ray asks the solids' grid a piece at a time

// The span of t in [0, 1] over which y(t) = ay + (by − ay)t lies in [lo, hi].
function within(ay, by, lo, hi) {
  const dy = by - ay;
  if (Math.abs(dy) < 1e-9) return ay >= lo && ay <= hi ? [0, 1] : null;
  let t0 = (lo - ay) / dy;
  let t1 = (hi - ay) / dy;
  if (t0 > t1) [t0, t1] = [t1, t0];
  return [t0, t1];
}

// Where segment a → b enters solid s: { t, normal } or null.
function enter(s, a, b) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  let t0 = -BIG;
  let t1 = BIG;
  let side = null; // the normal of the face it came in by
  if (s.type === 'circle') {
    const fx = a[0] - s.x;
    const fz = a[2] - s.z;
    const A = dx * dx + dz * dz;
    const B = 2 * (fx * dx + fz * dz);
    const C = fx * fx + fz * fz - s.r * s.r;
    if (A < 1e-12) {
      if (C > 0) return null;
    } else {
      const disc = B * B - 4 * A * C;
      if (disc < 0) return null;
      const r = Math.sqrt(disc);
      t0 = (-B - r) / (2 * A);
      t1 = (-B + r) / (2 * A);
      const ex = fx + dx * t0;
      const ez = fz + dz * t0;
      const l = Math.hypot(ex, ez) || 1;
      side = [ex / l, 0, ez / l];
    }
  } else {
    // into the box's frame (turned by yaw, as walker's pushOut turns it)
    const lx = (a[0] - s.x) * s.c - (a[2] - s.z) * s.s;
    const lz = (a[0] - s.x) * s.s + (a[2] - s.z) * s.c;
    const ux = dx * s.c - dz * s.s;
    const uz = dx * s.s + dz * s.c;
    const slab = (p, u, h, axis) => {
      if (Math.abs(u) < 1e-12) return Math.abs(p) <= h;
      let n0 = (-h - p) / u;
      let n1 = (h - p) / u;
      let sign = -1;
      if (n0 > n1) {
        [n0, n1] = [n1, n0];
        sign = 1;
      }
      if (n0 > t0) {
        t0 = n0;
        side = axis === 'x' ? [sign, 0] : [0, sign];
      }
      t1 = Math.min(t1, n1);
      return true;
    };
    if (!slab(lx, ux, s.hw, 'x') || !slab(lz, uz, s.hd, 'z')) return null;
    if (t0 > t1) return null;
    // (back out of its frame)
    if (side) side = [side[0] * s.c + side[1] * s.s, 0, -side[0] * s.s + side[1] * s.c];
  }
  if (t0 > t1) return null;
  const ys = within(a[1], b[1], s.base ?? -BIG, s.top ?? BIG);
  if (!ys) return null;
  let t = Math.max(t0, ys[0], 0);
  if (t > Math.min(t1, ys[1], 1)) return null;
  let normal = side ?? [0, 1, 0];
  if (t === ys[0] && ys[0] > t0) normal = b[1] < a[1] ? [0, 1, 0] : [0, -1, 0];
  if (t <= 0) t = 0;
  return { t, normal };
}

export function boltSolids(world, { step = 1 } = {}) {
  const solids = world.solids;
  const under = (p) => p[1] < groundAt(world, p[0], p[2], p[1]);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // the first piece of ground along a → b, sampled every `step` metres and
  // halved down to the spot
  const ground = (a, b, limit) => {
    if (under(a)) return 0;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.max(1, Math.ceil((len * limit) / step));
    let lo = 0;
    for (let i = 1; i <= n; i++) {
      const hi = (limit * i) / n;
      if (!under(lerp(a, b, hi))) {
        lo = hi;
        continue;
      }
      let l = lo;
      let h = hi;
      for (let k = 0; k < 10; k++) {
        const m = (l + h) / 2;
        if (under(lerp(a, b, m))) h = m;
        else l = m;
      }
      return h;
    }
    return null;
  };

  return (a, b) => {
    let best = 1;
    let normal = null;
    let struck = null;
    if (solids?.near) {
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const pieces = Math.max(1, Math.ceil(len / CHUNK));
      // (nearest piece first, until a piece starts past the best found)
      for (let i = 0; i < pieces && i / pieces < best; i++) {
        const m = lerp(a, b, (i + 0.5) / pieces);
        for (const s of solids.near(m[0], m[2], len / pieces / 2 + 1)) {
          if (s.off) continue;
          const k = enter(s, a, b);
          if (k && k.t < best) {
            best = k.t;
            normal = k.normal;
            struck = s;
          }
        }
      }
    }
    const g = world.heightAt ? ground(a, b, best) : null;
    if (g !== null && (normal === null || g <= best)) {
      best = g;
      const at = lerp(a, b, g);
      return { at: g === 0 ? [...a] : at, normal: world.normalAt ? world.normalAt(at[0], at[2]) : [0, 1, 0], surface: { ground: true } };
    }
    if (normal === null) return null;
    return { at: best === 0 ? [...a] : lerp(a, b, best), normal, surface: { solid: struck, tag: struck.tag ?? null } };
  };
}
