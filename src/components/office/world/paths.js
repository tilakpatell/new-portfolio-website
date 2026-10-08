// Finding the way across the office: a grid over the floor, every cell a
// body can stand in without touching a wall, a desk or a chair (the walk's
// own colliders, ./layout.js), A* over it, and the corners pulled tight so
// the way is a few straight legs rather than a staircase. Pure; the
// coworkers who get up for a coffee walk these (./scene.js).
//
// findPath(from, to, { colliders, walls, radius, bounds, step }) → [{x, z}…] | null
// amblePaths() → [{ who, from, to, face, path, wait, every, offset }]
// isFree(x, z, radius, colliders, walls) → whether a body that wide stands clear there
// freeNear(p, { radius, colliders, walls }) → { x, z }: p if a body stands clear
//   there, else the nearest spot that's clear (rings out to a metre and a half)
// seatYaw(seat) → the way someone sat at it faces (a figure's yaw: 0 along +z,
//   toward +x), the chair as ./set.js turns it
// seatWay(seat, { colliders, walls, radius }) → { yaw, stand, exit }: where the
//   feet are as they stand up out of the chair (between it and the desk, the
//   hips over the seat as the clip sits: ../people.js SIT_BACK), and the steps
//   out round the chair, to whichever side's clear, to where a way can start
//   behind it (or beside it, against a wall; through it, as a last resort)
// colliders(who): every collider but their own chair (what they're getting out of)

import { pushOut } from '../../middleearth/towns/walker';
import { AMBLES, COLLIDERS, SEATS, WALLS } from './layout';

export const isFree = (x, z, radius, colliders = COLLIDERS, walls = WALLS) => {
  // (a point at a circle's very middle isn't pushed anywhere: it's in it all the same)
  for (const c of colliders) if (c.kind === 'circle' && Math.hypot(x - c.x, z - c.z) < c.r + radius - 1e-6) return false;
  const [px, pz] = pushOut(x, z, radius, colliders, walls);
  return Math.hypot(px - x, pz - z) < 1e-4;
};

export function freeNear(p, { radius = 0.26, colliders = COLLIDERS, walls = WALLS } = {}) {
  if (isFree(p.x, p.z, radius, colliders, walls)) return { x: p.x, z: p.z };
  for (let r = 0.05; r <= 1.5 + 1e-9; r += 0.05)
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const x = p.x + Math.sin(a) * r;
      const z = p.z + Math.cos(a) * r;
      if (isFree(x, z, radius, colliders, walls)) return { x, z };
    }
  return { x: p.x, z: p.z };
}

export const seatYaw = (seat) => seat.turn + Math.PI + ((seat.i % 5) - 2) * 0.08;
export const collidersFor = (seat) => COLLIDERS.filter((c) => !(c.kind === 'circle' && Math.hypot(c.x - seat.chair.x, c.z - seat.chair.z) < 0.01));
const STAND = 0.2; // metres ahead of the chair's middle, the feet of someone getting up out of it
const SIDE = 0.62; // metres to the chair's side, stepping round it
const BEHIND = 0.5; // metres behind its middle, the way starts

export function seatWay(seat, { colliders = collidersFor(seat), walls = WALLS, radius = 0.24 } = {}) {
  const yaw = seatYaw(seat);
  const f = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const l = { x: Math.cos(yaw), z: -Math.sin(yaw) }; // (the figure's left)
  const c = seat.chair;
  const at = (side, ahead) => ({ x: c.x + l.x * side + f.x * ahead, z: c.z + l.z * side + f.z * ahead });
  const stand = at(0, STAND);
  const ok = (p) => isFree(p.x, p.z, radius, colliders, walls);
  let beside = null;
  for (const side of [SIDE, -SIDE]) {
    const a = at(side, 0.1);
    const b = at(side, -BEHIND);
    if (ok(a) && ok(b) && straight(a, b, radius * 0.9, colliders, walls)) return { yaw, stand, exit: [a, b] };
    if (ok(a)) beside ??= a;
  }
  // (no room behind: out to the side, and off from there; else back through the chair)
  if (beside) return { yaw, stand, exit: [beside] };
  return { yaw, stand, exit: [at(0, -BEHIND)] };
}

// can a body go straight from a to b? (sampled every few centimetres)
function straight(a, b, radius, colliders, walls) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.05));
  for (let i = 1; i < n; i++) if (!isFree(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n, radius, colliders, walls)) return false;
  return true;
}

// a binary heap of [priority, value], least first
function heap() {
  const a = [];
  return {
    get size() {
      return a.length;
    },
    push(item) {
      a.push(item);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p][0] <= a[i][0]) break;
        [a[p], a[i]] = [a[i], a[p]];
        i = p;
      }
    },
    pop() {
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < a.length && a[l][0] < a[m][0]) m = l;
          if (r < a.length && a[r][0] < a[m][0]) m = r;
          if (m === i) break;
          [a[m], a[i]] = [a[i], a[m]];
          i = m;
        }
      }
      return top;
    },
  };
}

export function findPath(from, to, { colliders = [], walls = [], radius = 0.3, bounds, step = 0.1 } = {}) {
  const { x0, x1, z0, z1 } = bounds;
  const W = Math.ceil((x1 - x0) / step) + 1;
  const H = Math.ceil((z1 - z0) / step) + 1;
  const cell = (x, z) => [Math.round((x - x0) / step), Math.round((z - z0) / step)];
  const at = (i, k) => ({ x: x0 + i * step, z: z0 + k * step });
  const ok = new Uint8Array(W * H); // 0 unknown, 1 free, 2 blocked
  const free = (i, k) => {
    if (i < 0 || k < 0 || i >= W || k >= H) return false;
    const j = k * W + i;
    if (!ok[j]) {
      const p = at(i, k);
      ok[j] = isFree(p.x, p.z, radius, colliders, walls) ? 1 : 2;
    }
    return ok[j] === 1;
  };
  // the nearest free cell to a point (it may start in a chair's way)
  const snap = (p) => {
    const [ci, ck] = cell(p.x, p.z);
    for (let r = 0; r < 12; r++)
      for (let di = -r; di <= r; di++)
        for (let dk = -r; dk <= r; dk++) {
          if (Math.max(Math.abs(di), Math.abs(dk)) !== r) continue;
          if (free(ci + di, ck + dk)) return [ci + di, ck + dk];
        }
    return null;
  };
  const s = snap(from);
  const g = snap(to);
  if (!s || !g) return null;
  const key = (i, k) => k * W + i;
  const goal = key(...g);
  const cost = new Float64Array(W * H).fill(Infinity);
  const came = new Int32Array(W * H).fill(-1);
  const h = (i, k) => Math.hypot(i - g[0], k - g[1]);
  const open = heap();
  open.push([h(...s), key(...s)]);
  cost[key(...s)] = 0;
  const done = new Uint8Array(W * H);
  const N = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
  while (open.size) {
    const [, j] = open.pop();
    if (done[j]) continue;
    done[j] = 1;
    if (j === goal) break;
    const i0 = j % W;
    const k0 = (j - i0) / W;
    for (const [di, dk, c] of N) {
      const i = i0 + di;
      const k = k0 + dk;
      if (!free(i, k)) continue;
      if (di && dk && (!free(i0 + di, k0) || !free(i0, k0 + dk))) continue; // no cutting corners
      const n = key(i, k);
      const nc = cost[j] + c;
      if (nc < cost[n]) {
        cost[n] = nc;
        came[n] = j;
        open.push([nc + h(i, k), n]);
      }
    }
  }
  if (!done[goal]) return null;
  const cells = [];
  for (let j = goal; j !== -1; j = came[j]) cells.push(at(j % W, (j - (j % W)) / W));
  cells.reverse();
  // pull the corners tight: from each point, the furthest one in a straight
  // line (and an end that's in something's way ends at the nearest free spot)
  const end = isFree(to.x, to.z, radius, colliders, walls) ? { x: to.x, z: to.z } : cells[cells.length - 1];
  const pts = [{ x: from.x, z: from.z }, ...cells, end];
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !straight(pts[i], pts[j], radius * 0.9, colliders, walls)) j -= 1;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

// where each ambler gets up from (just out from their chair) and the way
// to where they're going, round the desks
export function amblePaths() {
  const bounds = { x0: -15, x1: 15, z0: -8.5, z1: 8.5 };
  return AMBLES.map((a) => {
    const seat = SEATS.find((s) => s.who === a.who);
    const dx = seat.chair.x - seat.x;
    const dz = seat.chair.z - seat.z;
    const d = Math.hypot(dx, dz) || 1;
    const from = { x: seat.chair.x + (dx / d) * 0.25, z: seat.chair.z + (dz / d) * 0.25 };
    // (the ambler's own chair isn't in their way: they're getting out of it)
    const colliders = COLLIDERS.filter((c) => !(c.kind === 'circle' && Math.hypot(c.x - seat.chair.x, c.z - seat.chair.z) < 0.01));
    const path = findPath(from, a.to, { colliders, walls: WALLS, radius: 0.26, bounds });
    return { ...a, from, face: a.to.face, path };
  });
}
