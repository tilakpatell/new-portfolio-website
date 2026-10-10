// Where a shot goes. Pure: vectors are plain [x, y, z] arrays, no three.js.
//
//   aimPoint(ray, solids, targets, { min, max }) → { at, target, dist }
//     the first thing along the camera's ray through the crosshair: a
//     target's capsule or a solid (`solids(from, to) → { at, normal } | null`,
//     the world's raycast), else `max` along it. Never nearer than `min`
//     ahead, so a figure pressed against a wall doesn't fire its bolt from
//     the muzzle back toward itself (the muzzle sits off the camera's line).
//   assist(dir, from, targets, cone) → dir'
//     magnetism: the shot bends toward the nearest target in the cone, fully
//     inside `inner`, less and less out to `outer`, never more than `cap`
//     radians at once. The crosshair isn't moved; cover still blocks the
//     bent shot because the caller casts aimPoint along it after.
//   friction(dir, from, targets, cone) → 0.55 over a target, 1 off
//     (the look's sensitivity multiplier).
//   lead(target, vel, from, speed) → where to aim so a bolt meets a walker.
//   ASSIST, coneFor({ coarse, mode }): the cones for a mouse, a trackpad or
//   a drag, and touch.
//   snapped(cone) → the cone for a tap of a touch fire button: one with
//   `snap` pulls all the way onto a target anywhere inside its outer cone,
//   at once; any other comes back as it is.
//
// A target is a capsule { id, a, b, r, ref }: the segment a–b (feet to
// head, less the radius) and its radius.

export const ASSIST = {
  mouse: { inner: 0.02, outer: 0.05, cap: 0.01 },
  pad: { inner: 0.05, outer: 0.14, cap: 0.03 },
  touch: { inner: 0.09, outer: 0.21, cap: 0.05, snap: true },
};
export const FRICTION = 0.55;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const l = len(a);
  return l > 1e-12 ? scale(a, 1 / l) : [0, 0, 1];
};

// The distance along a ray (from `o`, unit `d`) to where it enters a capsule,
// or null. The side first (the infinite cylinder clipped to the segment),
// then the end spheres; a ray starting inside counts as no hit (the shooter's
// own body never stops the shot).
export function rayCapsule(o, d, pa, pb, r) {
  const ba = sub(pb, pa);
  const oa = sub(o, pa);
  const baba = dot(ba, ba);
  const bard = dot(ba, d);
  const baoa = dot(ba, oa);
  const rdoa = dot(d, oa);
  const oaoa = dot(oa, oa);
  const a = baba - bard * bard;
  let best = null;
  if (a > 1e-9) {
    const b = baba * rdoa - baoa * bard;
    const c = baba * oaoa - baoa * baoa - r * r * baba;
    const h = b * b - a * c;
    if (h >= 0) {
      const t = (-b - Math.sqrt(h)) / a;
      const y = baoa + t * bard;
      if (y > 0 && y < baba && t >= 0) best = t;
    }
  }
  if (best == null) {
    // (the caps: whichever sphere the ray meets first)
    for (const p of [pa, pb]) {
      const oc = sub(o, p);
      const b = dot(d, oc);
      const c = dot(oc, oc) - r * r;
      const h = b * b - c;
      if (h < 0 || c < 0) continue;
      const t = -b - Math.sqrt(h);
      if (t >= 0 && (best == null || t < best)) best = t;
    }
  }
  return best;
}

export function aimPoint(ray, solids, targets = [], { min = 1.5, max = 120 } = {}) {
  const from = ray.from;
  const dir = norm(ray.dir);
  let dist = max;
  let target = null;
  for (const t of targets) {
    const d = rayCapsule(from, dir, t.a, t.b, t.r);
    if (d != null && d < dist) {
      dist = d;
      target = t;
    }
  }
  const hit = solids ? solids(from, add(from, scale(dir, dist))) : null;
  if (hit) {
    const d = dot(sub(hit.at, from), dir);
    if (d <= dist) {
      dist = d;
      target = null;
    }
  }
  dist = Math.max(min, dist);
  return { at: add(from, scale(dir, dist)), target, dist };
}

// The point on a capsule's axis nearest a ray: where magnetism pulls to
// (a tall body is aimed at the height the shot already is, not its middle).
function axisPoint(from, dir, t) {
  const ab = sub(t.b, t.a);
  const a = dot(ab, ab);
  if (a < 1e-12) return t.a;
  const w = sub(t.a, from);
  const b = dot(ab, dir);
  const d0 = dot(ab, w);
  const e = dot(dir, w);
  const den = a - b * b;
  let s = den > 1e-9 ? (b * e - d0) / den : 0;
  s = Math.max(0, Math.min(1, s));
  // (the ray's own point for that s, kept ahead of the shooter, then the
  // segment's nearest point to it)
  const along = Math.max(0, b * s + e);
  s = Math.max(0, Math.min(1, (along * b - d0) / a));
  return add(t.a, scale(ab, s));
}

// The nearest target by angle off `dir`, inside `outer`: { angle, to } or null.
function nearest(dir, from, targets, outer) {
  let best = null;
  for (const t of targets) {
    const to = sub(axisPoint(from, dir, t), from);
    const l = len(to);
    if (l < 1e-6) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(dir, to) / l)));
    if (ang <= outer && (!best || ang < best.angle)) best = { angle: ang, to: scale(to, 1 / l) };
  }
  return best;
}

export function assist(dir, from, targets, cone) {
  const d = norm(dir);
  const near = nearest(d, from, targets, cone.outer);
  if (!near || near.angle < 1e-9) return dir;
  const pull = near.angle <= cone.inner ? 1 : (cone.outer - near.angle) / (cone.outer - cone.inner);
  const turn = Math.min(near.angle * pull, cone.cap);
  if (turn <= 0) return dir;
  // rotate d toward the target by `turn` in the plane they share
  const perp = norm(sub(near.to, scale(d, dot(d, near.to))));
  return add(scale(d, Math.cos(turn)), scale(perp, Math.sin(turn)));
}

export function friction(dir, from, targets, cone) {
  return nearest(norm(dir), from, targets, cone.outer) ? FRICTION : 1;
}

// |target + vel·t − from| = speed·t, the least t > 0; no meeting (a target
// faster than the bolt, running away) aims where it is.
export function lead(target, vel, from, speed) {
  const D = sub(target, from);
  const a = dot(vel, vel) - speed * speed;
  const b = 2 * dot(D, vel);
  const c = dot(D, D);
  let t = null;
  if (Math.abs(a) < 1e-9) {
    if (b < 0) t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      const roots = [(-b - s) / (2 * a), (-b + s) / (2 * a)].filter((x) => x > 0);
      if (roots.length) t = Math.min(...roots);
    }
  }
  return t == null ? [...target] : add(target, scale(vel, t));
}

export function snapped(cone) {
  return cone?.snap ? { inner: cone.outer, outer: cone.outer + 1e-6, cap: Math.PI } : cone;
}

export function coneFor({ coarse = false, mode = 'lock' } = {}) {
  if (coarse || mode === 'touch') return ASSIST.touch;
  return mode === 'drag' ? ASSIST.pad : ASSIST.mouse;
}
