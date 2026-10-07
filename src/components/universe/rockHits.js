// The rocks the ship can hit: the home belt, the rim and the debris streams
// between the wonders (belt.js's beltRocks, deepspace.js's debrisRocks:
// the same rocks the meshes draw). Pure (no three.js), so it's tested in
// Node; the scene sweeps the ship's way each frame against the fields it's
// near and plays out what a hit does.
//
// A field's rocks go into a grid of cells (each rock into every cell its
// sphere, padded, reaches), and a sweep walks the cells along the ship's
// way from last frame to this one, in steps of half a cell, testing only
// the rocks in them. At super speed a frame's way is a thousand units long,
// so the rocks it passes between frames are still found.
//
// What a hit does depends on how fast it was going: at the boost or under,
// a bump; above it (the pulse drive, super speed), the shields take it, more
// the faster and the bigger the rock (rockDamage), and the ship's knocked
// back under the pulse drive.
//
// rockGrid(rocks, cell) → grid; sweep(grid, from, to, radius, hidden) →
// { i, t, at } | null; rockDamage(speed, r); toBelt(p, angle) → p in a
// turning ring's own frame; nearRing(from, to, band) → whether a way comes
// near a ring at all

export const ROCK_HIT = {
  fast: 14, // past this (the boost, 12, and a little), a rock does damage
  base: 6, // shields a hit takes, at least
  perSize: 7, // and for each unit of the rock's size
  perSpeed: 0.05, // and for each unit a second past `fast` (a rock at the pulse drive's 300 is as bad as ever)
  most: 45, // at most, a hit
  cool: 0.35, // seconds after a hit before another counts
  gone: 60, // seconds a smashed rock is gone for
  slow: 0.3, // the share of its speed the ship keeps after a hit
};

// how far past a rock's own radius a grid looks for it (a quarter cell, the
// most a point of the way can be from the step it's tested at, and the
// widest ship that's swept, half a unit)
const PAD = (cell) => cell / 4 + 0.5;
const key = (ix, iy, iz) => `${ix},${iy},${iz}`;

// rocks: [{ x, y, z, r }]
export function rockGrid(rocks, cell = 12) {
  const cells = new Map();
  rocks.forEach((o, i) => {
    const reach = o.r + PAD(cell);
    const x0 = Math.floor((o.x - reach) / cell);
    const x1 = Math.floor((o.x + reach) / cell);
    const y0 = Math.floor((o.y - reach) / cell);
    const y1 = Math.floor((o.y + reach) / cell);
    const z0 = Math.floor((o.z - reach) / cell);
    const z1 = Math.floor((o.z + reach) / cell);
    for (let ix = x0; ix <= x1; ix++)
      for (let iy = y0; iy <= y1; iy++)
        for (let iz = z0; iz <= z1; iz++) {
          const k = key(ix, iy, iz);
          const list = cells.get(k);
          if (list) list.push(i);
          else cells.set(k, [i]);
        }
  });
  return { cell, cells, rocks };
}

// The first rock (not one of `hidden`) the way from `from` to `to` comes
// within `radius` (half a unit at most) of: { i, t (0 … 1 along the way),
// at (the ship's middle when it touches) }, or null.
export function sweep(grid, from, to, radius, hidden = null) {
  const { cell, cells, rocks } = grid;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const steps = Math.max(1, Math.ceil(len / (cell / 2)));
  const seen = new Set();
  let best = null;
  for (let s = 0; s <= steps; s++) {
    const k = s / steps;
    const list = cells.get(key(Math.floor((from.x + dx * k) / cell), Math.floor((from.y + dy * k) / cell), Math.floor((from.z + dz * k) / cell)));
    if (!list) continue;
    for (const i of list) {
      if (seen.has(i) || hidden?.has(i)) continue;
      seen.add(i);
      const o = rocks[i];
      const t = touch(from, dx, dy, dz, len, o, o.r + radius);
      if (t !== null && (!best || t < best.t)) best = { i, t };
    }
    // nothing nearer can come in a later step than one already found
    if (best && best.t * len < (k * len) - cell) break;
  }
  if (!best) return null;
  return { i: best.i, t: best.t, at: { x: from.x + dx * best.t, y: from.y + dy * best.t, z: from.z + dz * best.t } };
}

// where along the way (0 … 1) it first comes within `reach` of the rock's
// middle, or null if it never does
function touch(from, dx, dy, dz, len, o, reach) {
  const fx = from.x - o.x;
  const fy = from.y - o.y;
  const fz = from.z - o.z;
  const c = fx * fx + fy * fy + fz * fz - reach * reach;
  if (c <= 0) return 0; // already in it
  if (len < 1e-9) return null;
  const a = len * len;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

// shields a hit takes at `speed` from a rock `r` across
export const rockDamage = (speed, r) => (speed <= ROCK_HIT.fast ? 0 : Math.min(ROCK_HIT.most, ROCK_HIT.base + ROCK_HIT.perSize * r + ROCK_HIT.perSpeed * (speed - ROCK_HIT.fast)));

// a point on the map in the frame of a ring turned `angle` about y (the
// belt and the rim turn round the sun)
export function toBelt(p, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c - p.z * s, y: p.y, z: p.x * s + p.z * c };
}

// whether the way from `from` to `to` comes near a ring ({ inner, outer,
// height } round the y axis, as layout.js's BELT and RIM are) at all: worth
// sweeping. Its nearest and furthest from the axis, against the ring's
// inner and outer edges, and its height against the ring's
export function nearRing(from, to, band, margin = 5) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const l2 = dx * dx + dz * dz;
  const k = l2 > 1e-9 ? Math.min(1, Math.max(0, -(from.x * dx + from.z * dz) / l2)) : 0;
  const near = Math.hypot(from.x + dx * k, from.z + dz * k);
  const far = Math.max(Math.hypot(from.x, from.z), Math.hypot(to.x, to.z));
  const top = band.height / 2 + margin;
  return near <= band.outer + margin && far >= band.inner - margin && Math.min(from.y, to.y) <= top && Math.max(from.y, to.y) >= -top;
}

// the box round a field's rocks, and whether a way comes into it (the
// debris streams: worth sweeping)
export function boxOf(rocks) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const o of rocks) {
    min.x = Math.min(min.x, o.x - o.r);
    min.y = Math.min(min.y, o.y - o.r);
    min.z = Math.min(min.z, o.z - o.r);
    max.x = Math.max(max.x, o.x + o.r);
    max.y = Math.max(max.y, o.y + o.r);
    max.z = Math.max(max.z, o.z + o.r);
  }
  return { min, max };
}
export function nearBox(from, to, { min, max }, margin = 2) {
  // the way's own box against the field's: a way that crosses the box's
  // corner without entering it is swept anyway, which costs only a sweep
  return Math.min(from.x, to.x) <= max.x + margin && Math.max(from.x, to.x) >= min.x - margin && Math.min(from.y, to.y) <= max.y + margin && Math.max(from.y, to.y) >= min.y - margin && Math.min(from.z, to.z) <= max.z + margin && Math.max(from.z, to.z) >= min.z - margin;
}
