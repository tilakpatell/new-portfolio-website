// Small numeric helpers for the Mario 64 rules. Angles are radians; a yaw of
// 0 faces +z, and a heading's vector is (sin yaw, cos yaw).

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// cur moved toward target by at most `up` (going up) or `down` (going down)
export function approach(cur, target, up, down = up) {
  if (cur < target) return Math.min(target, cur + up);
  if (cur > target) return Math.max(target, cur - down);
  return cur;
}

export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

// the signed turn from b to a, in (-π, π]
export const angleDiff = (a, b) => wrapAngle(a - b);

// a turned toward b by at most `step`
export function turnToward(a, b, step) {
  const d = angleDiff(b, a);
  if (Math.abs(d) <= step) return b;
  return wrapAngle(a + Math.sign(d) * step);
}

export const len2 = (x, z) => Math.hypot(x, z);
export const lerp = (a, b, t) => a + (b - a) * t;
