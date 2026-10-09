// The galaxy map's zoom and pan (HoloMap.jsx): a view { k, x, y } draws the
// map's square at k times the box, its top-left at (x, y) in fractions of
// the box's side, so the stage's transform is translate(x·100%, y·100%)
// scale(k) from its top-left corner. The square always covers the box: x
// and y stay within 1 − k and 0. Points on the map are in its own units
// (the 21-square grid a system's `pos` is on).

export const K_MIN = 1;
export const K_MAX = 4;
export const FIT = Object.freeze({ k: 1, x: 0, y: 0 });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function clampView(v) {
  const k = clamp(v.k, K_MIN, K_MAX);
  return { k, x: clamp(v.x, 1 - k, 0), y: clamp(v.y, 1 - k, 0) };
}

// zoomed by `factor` about the box's point (u, w), which stays where it is
export function zoomAt(v, factor, u, w) {
  const k = clamp(v.k * factor, K_MIN, K_MAX);
  const r = k / v.k;
  return clampView({ k, x: u - (u - v.x) * r, y: w - (w - v.y) * r });
}

export const panBy = (v, du, dw) => clampView({ k: v.k, x: v.x + du, y: v.y + dw });

// where a map point is in the box, as fractions of its side
export const toBox = (v, [px, pz], size = 21) => [v.x + (v.k * px) / size, v.y + (v.k * pz) / size];

// whether a map point is in the box, `pad` in from its edges
export function onView(v, p, { size = 21, pad = 0.04 } = {}) {
  const [u, w] = toBox(v, p, size);
  return u >= pad && u <= 1 - pad && w >= pad && w <= 1 - pad;
}

// the closest view with every point on it, `margin` units round them, no
// nearer than kMax
export function frameUnits(points, { size = 21, margin = 1.6, kMax = 3 } = {}) {
  if (!points.length) return FIT;
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  const x0 = Math.min(...xs) - margin;
  const x1 = Math.max(...xs) + margin;
  const z0 = Math.min(...zs) - margin;
  const z1 = Math.max(...zs) + margin;
  const k = clamp(size / Math.max(x1 - x0, z1 - z0), K_MIN, Math.min(kMax, K_MAX));
  const cx = (x0 + x1) / 2 / size;
  const cz = (z0 + z1) / 2 / size;
  return clampView({ k, x: 0.5 - k * cx, y: 0.5 - k * cz });
}

// the view with a map point in the middle of the box, at the zoom it has (or `kMin`, when that's less: a point is only worth
// centring on once there's a view to move); the square still covers the box, so a point near its edge is as near the middle as that
// allows
export function centreOn(v, [px, pz], { size = 21, kMin = K_MIN } = {}) {
  const k = clamp(Math.max(v.k, kMin), K_MIN, K_MAX);
  return clampView({ k, x: 0.5 - (k * px) / size, y: 0.5 - (k * pz) / size });
}
