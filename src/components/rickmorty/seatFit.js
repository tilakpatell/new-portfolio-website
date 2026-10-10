// Rick and Morty under the cruiser's glass: how big each can sit so none of
// him (his hair's spikes, Cowboy Rick's hat, an elbow) comes through it.
// Pure, no three.js: the dome is read from the saucer's own points above
// its rim, a figure is his points as he's posed, and he's shrunk about
// where he sits, as little as it takes.
//
//   domeOf(points) → { base, top, axis: [x, z], radius(y) }
//   fitScale(points, anchor, dome, { margin, least }) → least…1
//
// Points are flat lists, [x, y, z, x, y, z, …], in one frame (the hull's).

// The glass as how far out from its axis it reaches at each height: at y,
// the furthest out of its points at y or above. For a dome that narrows
// going up, that's never wider than the glass really is there (it's the
// ring above's). Infinity under the rim (that's the hull's, not the
// glass's), and less than nothing over the top. Kept as a table of STEPS
// heights, each the radius at the top of its step (so never wider either),
// for fitScale's thousands of looks.
const STEPS = 512;
export function domeOf(points) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    x0 = Math.min(x0, points[i]);
    x1 = Math.max(x1, points[i]);
    z0 = Math.min(z0, points[i + 2]);
    z1 = Math.max(z1, points[i + 2]);
  }
  const axis = [(x0 + x1) / 2, (z0 + z1) / 2];
  const rings = [];
  for (let i = 0; i < points.length; i += 3) rings.push([points[i + 1], Math.hypot(points[i] - axis[0], points[i + 2] - axis[1])]);
  rings.sort((a, b) => a[0] - b[0]);
  const ys = rings.map((r) => r[0]);
  // (the furthest out at each height or above: from the top down)
  const out = rings.map((r) => r[1]);
  for (let i = out.length - 2; i >= 0; i--) out[i] = Math.max(out[i], out[i + 1]);
  const base = ys[0] ?? 0;
  const top = ys[ys.length - 1] ?? 0;
  // at y exactly: the first point at y or above
  const exact = (y) => {
    let lo = 0;
    let hi = ys.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ys[mid] < y) lo = mid + 1;
      else hi = mid;
    }
    return out[lo];
  };
  const step = (top - base) / STEPS;
  const table = new Float64Array(STEPS);
  for (let i = 0; i < STEPS; i++) table[i] = ys.length ? exact(base + (i + 1) * step) : 0;
  const radius = (y) => {
    if (!ys.length || y < base) return Infinity;
    if (y > top) return -1;
    return table[step > 0 ? Math.min(STEPS - 1, Math.floor((y - base) / step)) : STEPS - 1];
  };
  return { base, top, axis, radius };
}

// The largest scale (no more than 1, no less than `least`) a figure can
// take about `anchor` ([x, y, z]: where he sits) with every one of his
// points `margin` inside the glass: over it and in from its side.
export function fitScale(points, anchor, dome, { margin = 0, least = 0.5 } = {}) {
  const [ax, ay, az] = anchor;
  const [cx, cz] = dome.axis;
  // only what could reach the glass: anything under the rim, and sat
  // under it, stays there however he's shrunk
  const keep = [];
  for (let i = 0; i < points.length; i += 3) if (points[i + 1] + margin >= dome.base || ay + margin >= dome.base) keep.push(i);
  const near = new Float64Array(keep.length * 3);
  keep.forEach((i, j) => {
    near[j * 3] = points[i] - ax;
    near[j * 3 + 1] = points[i + 1] - ay;
    near[j * 3 + 2] = points[i + 2] - az;
  });
  const fits = (s) => {
    for (let i = 0; i < near.length; i += 3) {
      const y = ay + s * near[i + 1];
      if (y + margin < dome.base) continue;
      const dx = ax + s * near[i] - cx;
      const dz = az + s * near[i + 2] - cz;
      if (Math.sqrt(dx * dx + dz * dz) + margin > dome.radius(y + margin)) return false;
    }
    return true;
  };
  if (fits(1)) return 1;
  if (!fits(least)) return least;
  let lo = least;
  let hi = 1;
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}
