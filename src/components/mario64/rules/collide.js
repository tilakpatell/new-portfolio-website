// What Mario stands on, runs into and bumps his head on, the way Super Mario
// 64 works it out: every triangle of a course is a floor (its normal points
// up), a ceiling (down) or a wall (sideways). The floor under a point is the
// highest one no more than FLOOR_UP above it, so small ledges are stepped
// onto and a drop with no floor is as good as a wall; walls are one-sided
// and push a point out along their normal to a radius. Triangles live in a
// grid of cells over the ground plan. Moving platforms are dynamic colliders:
// their triangles are moved each frame, and a surface remembers its owner,
// so whoever stands on one can be carried with it. Water is boxes with a
// surface level. Units are the original's (Mario is 160 tall).
//
// makeWorld(tris: Float32Array, 9 numbers a triangle, kinds: [string], { water })
//   → world; findFloor, findCeil, pushWalls, waterAt, raycast; addDynamic,
//   moveDynamic, removeDynamic.

export const FLOOR_UP = 78;
const CELL = 512;
const GROW = 160; // a surface goes in every cell within this of it, so a query reads one cell
const EPS = 1e-3;

const cellKey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
const cellOf = (v) => Math.floor(v / CELL);

function makeSurf(p, o, kind, owner) {
  const ax = p[o], ay = p[o + 1], az = p[o + 2];
  const bx = p[o + 3], by = p[o + 4], bz = p[o + 5];
  const cx = p[o + 6], cy = p[o + 7], cz = p[o + 8];
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz);
  if (len < 1e-9) return null;
  nx /= len;
  ny /= len;
  nz /= len;
  return {
    a: [ax, ay, az],
    b: [bx, by, bz],
    c: [cx, cy, cz],
    n: [nx, ny, nz],
    d: -(nx * ax + ny * ay + nz * az),
    minX: Math.min(ax, bx, cx),
    maxX: Math.max(ax, bx, cx),
    minY: Math.min(ay, by, cy),
    maxY: Math.max(ay, by, cy),
    minZ: Math.min(az, bz, cz),
    maxZ: Math.max(az, bz, cz),
    type: ny > 0.01 ? 'floor' : ny < -0.01 ? 'ceil' : 'wall',
    kind: kind || 'default',
    owner,
  };
}

function cellsFor(s, fn) {
  const x0 = cellOf(s.minX - GROW), x1 = cellOf(s.maxX + GROW);
  const z0 = cellOf(s.minZ - GROW), z1 = cellOf(s.maxZ + GROW);
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) fn(cellKey(cx, cz));
}

export function makeWorld(tris, kinds, { water = [] } = {}) {
  const grid = new Map();
  const all = [];
  for (let i = 0, o = 0; o + 9 <= tris.length; i++, o += 9) {
    const s = makeSurf(tris, o, kinds[i], null);
    if (!s) continue;
    all.push(s);
    cellsFor(s, (k) => {
      let c = grid.get(k);
      if (!c) grid.set(k, (c = { floor: [], ceil: [], wall: [] }));
      c[s.type].push(s);
    });
  }
  return { grid, all, dynamic: [], water: water.map((w) => ({ ...w })) };
}

const EMPTY = { floor: [], ceil: [], wall: [] };
const cellAt = (w, x, z) => w.grid.get(cellKey(cellOf(x), cellOf(z))) ?? EMPTY;

// each list of `type` near (x, z), the static cell's and the live dynamic colliders'
function eachNear(w, x, z, type, fn) {
  for (const s of cellAt(w, x, z)[type]) fn(s);
  for (const c of w.dynamic) {
    if (!c.on || x < c.minX - GROW || x > c.maxX + GROW || z < c.minZ - GROW || z > c.maxZ + GROW) continue;
    for (const s of c[type]) fn(s);
  }
}

// inside the triangle's shadow on the ground plan, edges included
function insideXZ(s, x, z) {
  if (x < s.minX - EPS || x > s.maxX + EPS || z < s.minZ - EPS || z > s.maxZ + EPS) return false;
  const [ax, , az] = s.a;
  const [bx, , bz] = s.b;
  const [cx, , cz] = s.c;
  const e = EPS * Math.max(1, s.maxX - s.minX + s.maxZ - s.minZ);
  const s1 = (bx - ax) * (z - az) - (bz - az) * (x - ax);
  const s2 = (cx - bx) * (z - bz) - (cz - bz) * (x - bx);
  const s3 = (ax - cx) * (z - cz) - (az - cz) * (x - cx);
  return (s1 >= -e && s2 >= -e && s3 >= -e) || (s1 <= e && s2 <= e && s3 <= e);
}

const heightAt = (s, x, z) => -(s.n[0] * x + s.n[2] * z + s.d) / s.n[1];

// the highest floor at (x, z) no more than FLOOR_UP above y
export function findFloor(w, x, y, z) {
  let best = null;
  let by = -Infinity;
  eachNear(w, x, z, 'floor', (s) => {
    if (!insideXZ(s, x, z)) return;
    const h = heightAt(s, x, z);
    if (h <= y + FLOOR_UP && h > by) {
      by = h;
      best = s;
    }
  });
  return best ? { y: by, surf: best } : null;
}

// the lowest ceiling at (x, z) at or above y
export function findCeil(w, x, y, z) {
  let best = null;
  let by = Infinity;
  eachNear(w, x, z, 'ceil', (s) => {
    if (!insideXZ(s, x, z)) return;
    const h = heightAt(s, x, z);
    if (h >= y && h < by) {
      by = h;
      best = s;
    }
  });
  return best ? { y: by, surf: best } : null;
}

// on a wall's face, seen along its main horizontal axis, edges included
function insideWall(s, x, y, z) {
  const useZ = Math.abs(s.n[0]) > Math.abs(s.n[2]);
  const u = (p) => (useZ ? p[2] : p[0]);
  const pu = useZ ? z : x;
  const au = u(s.a), bu = u(s.b), cu = u(s.c);
  const [, ay] = s.a;
  const [, by] = s.b;
  const [, cy] = s.c;
  const e = EPS * Math.max(1, s.maxY - s.minY + Math.abs(au - bu) + Math.abs(bu - cu));
  const s1 = (bu - au) * (y - ay) - (by - ay) * (pu - au);
  const s2 = (cu - bu) * (y - by) - (cy - by) * (pu - bu);
  const s3 = (au - cu) * (y - cy) - (ay - cy) * (pu - cu);
  return (s1 >= -e && s2 >= -e && s3 >= -e) || (s1 <= e && s2 <= e && s3 <= e);
}

function closestOnSegment(ax, ay, az, bx, by, bz, px, py, pz, out) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const l2 = dx * dx + dy * dy + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  out[0] = ax + dx * t;
  out[1] = ay + dy * t;
  out[2] = az + dz * t;
  return (out[0] - px) ** 2 + (out[1] - py) ** 2 + (out[2] - pz) ** 2;
}
const tmp = [0, 0, 0];
const near = [0, 0, 0];

// Pushes pos (its point offsetY up) out of every wall within radius; returns
// the last wall that pushed, or null.
export function pushWalls(w, pos, offsetY, radius) {
  let hit = null;
  const py = pos.y + offsetY;
  eachNear(w, pos.x, pos.z, 'wall', (s) => {
    if (py < s.minY || py > s.maxY) return;
    const [nx, ny, nz] = s.n;
    const off = nx * pos.x + ny * py + nz * pos.z + s.d;
    if (off < -radius || off > radius) return;
    const hn = Math.hypot(nx, nz) || 1;
    const qx = pos.x - nx * off;
    const qz = pos.z - nz * off;
    if (insideWall(s, qx, py - ny * off, qz)) {
      const push = radius - off;
      pos.x += (nx / hn) * push;
      pos.z += (nz / hn) * push;
      hit = s;
      return;
    }
    if (off < -1) return; // behind the wall and off its face: not ours
    // past an edge: out from the nearest point on the triangle's edges
    let best = Infinity;
    const edges = [
      [s.a, s.b],
      [s.b, s.c],
      [s.c, s.a],
    ];
    for (const [a, b] of edges) {
      const d2 = closestOnSegment(a[0], a[1], a[2], b[0], b[1], b[2], pos.x, py, pos.z, tmp);
      if (d2 < best) {
        best = d2;
        near[0] = tmp[0];
        near[1] = tmp[1];
        near[2] = tmp[2];
      }
    }
    const hx = pos.x - near[0];
    const hz = pos.z - near[2];
    const h = Math.hypot(hx, hz);
    if (h >= radius || h < 1e-6) return;
    pos.x += (hx / h) * (radius - h);
    pos.z += (hz / h) * (radius - h);
    hit = s;
  });
  return hit;
}

export function waterAt(w, x, z) {
  let level = -Infinity;
  for (const b of w.water) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y > level) level = b.y;
  return level;
}

// Möller–Trumbore, both faces; t along from → to in [0, 1]
function rayTri(s, ox, oy, oz, dx, dy, dz) {
  const [ax, ay, az] = s.a;
  const e1x = s.b[0] - ax, e1y = s.b[1] - ay, e1z = s.b[2] - az;
  const e2x = s.c[0] - ax, e2y = s.c[1] - ay, e2z = s.c[2] - az;
  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-9) return -1;
  const inv = 1 / det;
  const tx = ox - ax, ty = oy - ay, tz = oz - az;
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return -1;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return -1;
  return (e2x * qx + e2y * qy + e2z * qz) * inv;
}

export function raycast(w, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const seen = new Set();
  let best = null;
  let bt = Infinity;
  const test = (s) => {
    if (seen.has(s)) return;
    seen.add(s);
    const t = rayTri(s, from.x, from.y, from.z, dx, dy, dz);
    if (t >= 0 && t <= 1 && t < bt) {
      bt = t;
      best = s;
    }
  };
  const x0 = cellOf(Math.min(from.x, to.x)), x1 = cellOf(Math.max(from.x, to.x));
  const z0 = cellOf(Math.min(from.z, to.z)), z1 = cellOf(Math.max(from.z, to.z));
  for (let cx = x0; cx <= x1; cx++)
    for (let cz = z0; cz <= z1; cz++) {
      const c = w.grid.get(cellKey(cx, cz));
      if (!c) continue;
      c.floor.forEach(test);
      c.ceil.forEach(test);
      c.wall.forEach(test);
    }
  for (const c of w.dynamic) if (c.on) for (const s of c.surfs) test(s);
  return best ? { t: bt, x: from.x + dx * bt, y: from.y + dy * bt, z: from.z + dz * bt, surf: best } : null;
}

// ─── Dynamic colliders ─────────────────────────────────────────────────────
// A row-major 3×4 matrix [r00 r01 r02 tx, r10 r11 r12 ty, r20 r21 r22 tz].
export const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

export function addDynamic(w, { id, tris, kinds }) {
  const c = { id, local: Float32Array.from(tris), kinds, m: IDENTITY.slice(), prev: IDENTITY.slice(), on: true, surfs: [], floor: [], ceil: [], wall: [] };
  w.dynamic.push(c);
  moveDynamic(c, IDENTITY);
  c.prev = c.m.slice();
  return c;
}

export function moveDynamic(c, m) {
  c.prev = c.m;
  c.m = m.slice();
  const p = c.local;
  const out = new Float64Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    out[i] = m[0] * x + m[1] * y + m[2] * z + m[3];
    out[i + 1] = m[4] * x + m[5] * y + m[6] * z + m[7];
    out[i + 2] = m[8] * x + m[9] * y + m[10] * z + m[11];
  }
  c.surfs = [];
  c.floor = [];
  c.ceil = [];
  c.wall = [];
  c.minX = c.minZ = Infinity;
  c.maxX = c.maxZ = -Infinity;
  for (let i = 0, o = 0; o + 9 <= out.length; i++, o += 9) {
    const s = makeSurf(out, o, c.kinds[i], c);
    if (!s) continue;
    c.surfs.push(s);
    c[s.type].push(s);
    c.minX = Math.min(c.minX, s.minX);
    c.maxX = Math.max(c.maxX, s.maxX);
    c.minZ = Math.min(c.minZ, s.minZ);
    c.maxZ = Math.max(c.maxZ, s.maxZ);
  }
}

export function removeDynamic(w, c) {
  const i = w.dynamic.indexOf(c);
  if (i >= 0) w.dynamic.splice(i, 1);
}

// where a point riding a dynamic collider goes when it moves from prev to m
export function carried(c, x, y, z) {
  const a = c.prev, m = c.m;
  // into the collider's frame by the inverse of prev (rotation transposed), out by m
  const lx0 = x - a[3], ly0 = y - a[7], lz0 = z - a[11];
  const lx = a[0] * lx0 + a[4] * ly0 + a[8] * lz0;
  const ly = a[1] * lx0 + a[5] * ly0 + a[9] * lz0;
  const lz = a[2] * lx0 + a[6] * ly0 + a[10] * lz0;
  return {
    x: m[0] * lx + m[1] * ly + m[2] * lz + m[3],
    y: m[4] * lx + m[5] * ly + m[6] * lz + m[7],
    z: m[8] * lx + m[9] * ly + m[10] * lz + m[11],
  };
}
