// The city Think, Mark! is fought over: a grid of blocks with a downtown of
// towers in the middle, lower blocks round it, a park and the river along
// one side. Pure data from a seed, so the rules can fly into it (every tower
// is one or two boxes to bump into) and the scene can draw it.
//
// Units are metres, y up, the ground at 0, the city centred on the origin.

export const CITY = {
  cells: 11, // blocks a side
  cell: 64, // a block and its street
  street: 16, // the street's width, kerb to kerb
};
export const HALF = (CITY.cells * CITY.cell) / 2; // the city's edge
export const RIVER = { z0: HALF - CITY.cell * 0.9, z1: HALF + 40 }; // a strip of water along +z
export const SKY = 330; // the ceiling: higher than any tower, low enough to keep the fight in the city
export const BOUND = HALF + 30; // how far out anyone may fly

// a seeded random number in [0, 1)
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The block a cell is: 'park', 'water' (the river) or 'built'.
export function cellKind(i, j) {
  const z = -HALF + (j + 0.5) * CITY.cell;
  if (z > RIVER.z0) return 'water';
  if (i === 7 && j === 3) return 'park';
  return 'built';
}

// The towers: { x, z, w, d, h, kind, tone, roof, top } where (x, z) is the
// footprint's middle, w and d its size on x and z, h its height; `top`, if
// there is one, is a narrower tier standing on it ({ w, d, h }, centred).
// kind: 'glass', 'stone' or 'brick' (what the walls are); tone: 0..1 (how
// light); roof: 'flat', 'tank' (water towers) or 'spire'.
export function buildCity(seed = 7) {
  const r = rng(seed);
  const towers = [];
  const lot = CITY.cell - CITY.street;
  for (let i = 0; i < CITY.cells; i++)
    for (let j = 0; j < CITY.cells; j++) {
      if (cellKind(i, j) !== 'built') continue;
      const cx = -HALF + (i + 0.5) * CITY.cell;
      const cz = -HALF + (j + 0.5) * CITY.cell;
      const d = Math.hypot(cx - 20, cz + 30); // downtown, a little off centre
      const core = Math.exp(-((d / 190) ** 2));
      // a downtown block is one or two big towers; further out, four smaller buildings
      const split = core > 0.55 ? (r() < 0.6 ? 1 : 2) : core > 0.2 ? 2 : r() < 0.5 ? 3 : 4;
      const parts = split === 1 ? [[0, 0, 1, 1]] : split === 2 ? (r() < 0.5 ? [[-0.25, 0, 0.5, 1], [0.25, 0, 0.5, 1]] : [[0, -0.25, 1, 0.5], [0, 0.25, 1, 0.5]]) : [[-0.25, -0.25, 0.5, 0.5], [0.25, -0.25, 0.5, 0.5], [-0.25, 0.25, 0.5, 0.5], [0.25, 0.25, 0.5, 0.5]];
      for (const [ox, oz, sx, sz] of parts) {
        if (split === 3 && towers.length % 4 === 0 && r() < 0.5) continue; // a gap: a car park
        const inset = 2 + r() * 3;
        const w = Math.max(10, lot * sx - inset * 2);
        const dd = Math.max(10, lot * sz - inset * 2);
        const h = Math.min(220, Math.round(core > 0.2 ? 30 + core * (110 + r() * 130) : 12 + r() * 30 + core * 60));
        const kind = h > 90 ? (r() < 0.75 ? 'glass' : 'stone') : h > 40 ? (r() < 0.45 ? 'glass' : 'stone') : r() < 0.6 ? 'brick' : 'stone';
        const tall = h > 70;
        const top = tall && r() < 0.6 ? { w: w * (0.55 + r() * 0.2), d: dd * (0.55 + r() * 0.2), h: Math.min(260 - h, Math.round(h * (0.15 + r() * 0.25))) } : null;
        const roof = tall && !top && r() < 0.35 ? 'spire' : !tall && kind !== 'glass' && r() < 0.5 ? 'tank' : 'flat';
        towers.push({ id: towers.length, x: cx + ox * lot, z: cz + oz * lot, w, d: dd, h, kind, tone: r(), roof, top });
      }
    }
  return { towers, seed };
}

// Every box anyone can bump into: each tower, and each tower's top tier.
export function boxes(city) {
  const out = [];
  for (const t of city.towers) {
    out.push({ x0: t.x - t.w / 2, x1: t.x + t.w / 2, z0: t.z - t.d / 2, z1: t.z + t.d / 2, y1: t.h, id: t.id });
    if (t.top) out.push({ x0: t.x - t.top.w / 2, x1: t.x + t.top.w / 2, z0: t.z - t.top.d / 2, z1: t.z + t.top.d / 2, y1: t.h + t.top.h, id: t.id });
  }
  return out;
}

// A grid over the city: which boxes stand in each cell, for quick lookups.
export function index(list) {
  const cells = new Map();
  const key = (i, j) => i * 1000 + j;
  for (const b of list) {
    const i0 = Math.floor((b.x0 + HALF) / CITY.cell);
    const i1 = Math.floor((b.x1 + HALF) / CITY.cell);
    const j0 = Math.floor((b.z0 + HALF) / CITY.cell);
    const j1 = Math.floor((b.z1 + HALF) / CITY.cell);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = key(i, j);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(b);
      }
  }
  const at = (x, z) => cells.get(key(Math.floor((x + HALF) / CITY.cell), Math.floor((z + HALF) / CITY.cell))) ?? [];
  return { list, at };
}

// The box a point is inside (within `pad`), or null.
export function inside(idx, x, y, z, pad = 0) {
  for (const b of idx.at(x, z)) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad && y < b.y1 + pad) return b;
  return null;
}

// How high the roofs are under a point (0 in a street).
export function roofAt(idx, x, z) {
  let h = 0;
  for (const b of idx.at(x, z)) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) h = Math.max(h, b.y1);
  return h;
}

// Whether the straight line from a to b keeps clear of every box (by `pad`):
// sampled every couple of metres, which is finer than any wall is thin.
export function clear(idx, a, b, pad = 2) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / 2));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    if (inside(idx, a[0] + dx * t, a[1] + dy * t, a[2] + dz * t, pad)) return false;
  }
  return true;
}

// The first point along a line from a to b that comes within `pad` of a
// box, as a share of the way (1 if none): the camera stops there.
export function reach(idx, a, b, pad = 0.6) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / 0.75));
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    if (inside(idx, a[0] + dx * t, a[1] + dy * t, a[2] + dz * t, pad) || a[1] + dy * t < 0.6) return (k - 1) / n;
  }
  return 1;
}
