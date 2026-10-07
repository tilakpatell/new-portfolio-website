// Plain vector sums on { x, y, z }, shared by the AI toolkit (and free for
// any rules module to use). A surface world passes y: 0. Pure.

export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
export const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const unit = (a) => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
// an angle brought back into −π…π
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// the surface worlds' yaw: 0 along +z, turning toward +x (walker.js's)
export const yawOf = (d) => Math.atan2(d.x, d.z);
export const yawDir = (yaw) => ({ x: Math.sin(yaw), y: 0, z: Math.cos(yaw) });
// the nearest of a list (each with `at`) to a point, and how far: { it, d }
export function nearest(list, p, keep = () => true) {
  let it = null;
  let d = Infinity;
  for (const o of list ?? []) {
    if (!keep(o)) continue;
    const k = apart(o.at, p);
    if (k < d) {
      d = k;
      it = o;
    }
  }
  return { it, d };
}
