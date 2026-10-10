// How anyone aboard moves: a body is an upright capsule (a circle seen
// from above, with feet and a head) walked against the layout’s wall
// segments, its floors and whatever solids a room’s furniture adds. It
// steps up anything within a step, walks down stairs without leaving the
// ground, falls off ledges and lands, and a drop of more than 6 m (or one
// into a void) puts it back at the last place it stood, with the fall
// counted. The same walls stop sight lines and bolts. Doors are asked
// through `open(doorId)`, so this never needs to know how they work. Pure
// apart from moving the body it is given.
//
//   BODY                          the Global Constraints’ numbers for a person
//   createBody({ x, y, z, yaw = 0, r = 0.35, h = 1.8, room }) → body
//     body: { x, y, z, vy, yaw, r, h, tall, room, ground, crouch, safe: { x, y, z, room }, falls }
//     y is the feet; h the height now (lower crouched), tall the height standing
//   stepBody(body, { dir: { x, z }, run, jump, crouch }, dt, { layout, open, solids }) → events
//     dir: the wanted direction in the world, length ≤ 1 (longer is cut to 1)
//     events: { type: 'land', speed } | { type: 'fell', x, y, z, room } | { type: 'respawn', x, y, z, room }
//       | { type: 'room', from, to }
//   pushOut(body, layout, open, solids) → void   out of walls (a closed door’s gap is wall) and solids
//   lineClear(layout, open, a, b, solids = []) → bool   nothing solid on the straight line from a to b
//
// solids: { box: { x0, x1, z0, z1, y0, y1 } } or { circle: { x, z, r, y0, y1 } }; one whose top is
// within a step above the feet is stood on, a taller one is walked round. A floor with a `tag` (the
// chasm's bridge) is there only while open(`floor:<tag>`) is false: the game answers it from
// layout.offTags, so a bridge drawn back is a void. Every floor of a room is
// solid from just under the room’s lowest floor up to its top, so a stair, a ramp or a landing is a
// block to walk round from below and to stand on from above (the scene draws them so).

export const BODY = Object.freeze({
  r: 0.35,
  h: 1.8,
  crouchH: 1.2,
  eyes: 1.62,
  crouchEyes: 1.05,
  walk: 1.6,
  run: 4.2,
  crouchWalk: 1.0,
  jump: 4.2,
  gravity: 9.8,
  step: 0.4,
  // a fall further than this is one nobody walks away from
  drop: 6,
  // a press that lands: seconds off a ledge a jump still goes (coyote
  // time), and seconds a jump pressed in the air is kept for the landing
  coyote: 0.1,
  buffer: 0.12,
});

const EPS = 1e-6;
const UNDER = 0.5; // as layout.js: how far under its floor a point still counts as in a room
const SLAB = 0.1; // a floor’s thickness, so a line down through it is stopped
const CELL = 4; // the grid the layout’s pieces are filed in, metres
const PAD = 1; // how far past its radius a body looks for pieces: further than a step’s move and pushes take it
const PASSES = 4;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const cellOf = (v) => Math.floor(v / CELL);
const keyOf = (i, j) => (i + 32768) * 65536 + (j + 32768);

function holds(room, x, z) {
  if (room.round) return Math.hypot(x - room.x, z - room.z) <= room.w / 2;
  const b = room.box;
  return x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
}

const solidOf = (s) => (s.box ? { kind: 'box', ...s.box } : { kind: 'circle', ...s.circle });

// Every step asks what is near each body, so a layout’s walls and floors
// are filed once in a grid; the layout itself is never changed.
const indexes = new WeakMap();

function indexOf(layout) {
  const known = indexes.get(layout);
  if (known) return known;
  const grid = new Map();
  const put = (item, x0, z0, x1, z1) => {
    for (let i = cellOf(x0); i <= cellOf(x1); i++) {
      for (let j = cellOf(z0); j <= cellOf(z1); j++) {
        const k = keyOf(i, j);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(item);
      }
    }
  };
  for (const w of layout.walls) {
    put({ kind: 'seg', ax: w.x0, az: w.z0, bx: w.x1, bz: w.z1, y0: w.y0, y1: w.y1, door: w.door, over: w.over, mark: 0 }, Math.min(w.x0, w.x1), Math.min(w.z0, w.z1), Math.max(w.x0, w.x1), Math.max(w.z0, w.z1));
  }
  const ceilings = [];
  for (const room of layout.rooms.values()) {
    const lo = Math.min(room.y, ...room.floors.map((f) => f.y));
    for (const f of room.floors) {
      const item = f.circle ? { kind: 'circle', x: f.circle.x, z: f.circle.z, r: f.circle.r } : { kind: 'box', x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1 };
      // a tagged floor (the chasm's bridge) is there only while open() doesn't call it off by name
      put(Object.assign(item, { y0: lo - SLAB, y1: f.y, mark: 0 }, f.tag ? { door: `floor:${f.tag}` } : null), f.x0, f.z0, f.x1, f.z1);
    }
    ceilings.push({ room, lo, hi: room.y + room.h });
  }
  const index = { grid, ceilings, stamp: 0 };
  indexes.set(layout, index);
  return index;
}

// The layout’s pieces filed in any cell the box (x0, z0)–(x1, z1) touches, each once, then the solids.
function near(index, x0, z0, x1, z1, solids) {
  const stamp = ++index.stamp;
  const found = [];
  for (let i = cellOf(x0); i <= cellOf(x1); i++) {
    for (let j = cellOf(z0); j <= cellOf(z1); j++) {
      for (const item of index.grid.get(keyOf(i, j)) ?? []) {
        if (item.mark === stamp) continue;
        item.mark = stamp;
        found.push(item);
      }
    }
  }
  return found.concat(solids);
}

// The shortest way out for a circle whose centre is (ox, oz) from the nearest
// point of something, or null when it is already `reach` away. Dead on the
// point, it goes along (fx, fz).
function away(ox, oz, reach, fx, fz) {
  const d = Math.hypot(ox, oz);
  if (d >= reach - EPS) return null;
  if (d < 1e-9) {
    const n = Math.hypot(fx, fz);
    return { x: (fx / n) * reach, z: (fz / n) * reach };
  }
  return { x: (ox / d) * (reach - d), z: (oz / d) * (reach - d) };
}

// How far to move a circle at (x, z), radius r, to clear one item; null if clear.
function push(item, x, z, r) {
  if (item.kind === 'seg') {
    const dx = item.bx - item.ax;
    const dz = item.bz - item.az;
    const t = clamp(((x - item.ax) * dx + (z - item.az) * dz) / (dx * dx + dz * dz), 0, 1);
    // dead on the line: into the wall’s own room, which is on its right
    return away(x - (item.ax + t * dx), z - (item.az + t * dz), r, -dz, dx);
  }
  if (item.kind === 'circle') return away(x - item.x, z - item.z, r + item.r, 1, 0);
  const cx = clamp(x, item.x0, item.x1);
  const cz = clamp(z, item.z0, item.z1);
  if (cx !== x || cz !== z) return away(x - cx, z - cz, r, 1, 0);
  // the centre is inside the box: out through its nearest side
  const sides = [
    [x - item.x0, -1, 0],
    [item.x1 - x, 1, 0],
    [z - item.z0, 0, -1],
    [item.z1 - z, 0, 1],
  ];
  const [d, nx, nz] = sides.reduce((a, b) => (b[0] < a[0] ? b : a));
  return { x: nx * (d + r), z: nz * (d + r) };
}

const shutTo = (item, open) => item.door === undefined || !open(item.door);

// Whether an item stands in a body’s way: above what it can step over and
// below its head. A wall in an open doorway is no wall, and one taller
// than a man stoops to a man’s height under the wall over it (Chewbacca
// and Vader through the control room’s 2 m door); lower than that, a
// doorway is to be crouched through.
const inWay = (item, feet, h, open) => {
  const head = item.over !== undefined && open(item.over) ? Math.min(h, BODY.h) : h;
  return item.y1 > feet + BODY.step + EPS && item.y0 < feet + head - EPS && shutTo(item, open);
};

function gather(body, index, solids) {
  const reach = body.r + PAD;
  return near(index, body.x - reach, body.z - reach, body.x + reach, body.z + reach, solids);
}

// Pushes the body clear, a few passes so a corner’s two walls settle each
// other; true when it ends clear.
function resolve(body, index, open, solids) {
  const items = gather(body, index, solids).filter((item) => inWay(item, body.y, body.h, open));
  for (let pass = 0; pass < PASSES; pass++) {
    let moved = false;
    for (const item of items) {
      const p = push(item, body.x, body.z, body.r);
      if (!p) continue;
      body.x += p.x;
      body.z += p.z;
      moved = true;
    }
    if (!moved) return true;
  }
  return !items.some((item) => push(item, body.x, body.z, body.r));
}

const under = (item, x, z) => (item.kind === 'box' ? x >= item.x0 && x <= item.x1 && z >= item.z0 && z <= item.z1 : (x - item.x) ** 2 + (z - item.z) ** 2 <= item.r ** 2);

// The highest floor or solid top under the centre that is no higher than
// `reach`; null when there is nothing (a void).
function support(index, solids, x, z, reach, open) {
  let best = null;
  for (const item of near(index, x, z, x, z, solids)) {
    if (item.kind === 'seg' || item.y1 > reach || !under(item, x, z) || !shutTo(item, open)) continue;
    if (best === null || item.y1 > best) best = item.y1;
  }
  return best;
}

// The lowest thing over the body’s head: its room’s ceiling, or the
// underside of anything it stands partly under (the wall over a doorway,
// the floor of a room overhead, a pipe).
function overhead(body, index, open, solids) {
  const { x, y, z } = body;
  let top = Infinity;
  for (const c of index.ceilings) if (y >= c.lo - UNDER && y <= c.hi && c.hi < top && holds(c.room, x, z)) top = c.hi;
  for (const item of gather(body, index, solids)) {
    if (item.y0 <= y + BODY.step + EPS || item.y0 >= top || !shutTo(item, open)) continue;
    // (one taller than a man, on his feet, stoops under the wall over an open doorway a man's height up)
    if (item.over !== undefined && open(item.over) && body.ground && body.h > BODY.h + EPS && item.y0 >= y + BODY.h - EPS) continue;
    if (push(item, x, z, body.r)) top = item.y0;
  }
  return top;
}

function enter(body, room, events) {
  if (!room || room === body.room) return;
  events.push({ type: 'room', from: body.room, to: room });
  body.room = room;
}

function fall(body, events) {
  events.push({ type: 'fell', x: body.x, y: body.y, z: body.z, room: body.room });
  const { safe } = body;
  body.x = safe.x;
  body.y = safe.y;
  body.z = safe.z;
  body.vy = 0;
  body.ground = true;
  body.falls += 1;
  events.push({ type: 'respawn', x: safe.x, y: safe.y, z: safe.z, room: safe.room });
  enter(body, safe.room, events);
}

export function createBody({ x, y, z, yaw = 0, r = BODY.r, h = BODY.h, room }) {
  return { x, y, z, vy: 0, yaw, r, h, tall: h, room, ground: true, crouch: false, safe: { x, y, z, room }, falls: 0 };
}

export function pushOut(body, layout, open, solids = []) {
  resolve(body, indexOf(layout), open, solids.map(solidOf));
}

// Crouching is at once; standing waits for the headroom.
function crouchOrStand(body, wants, index, open, solids) {
  if (wants) {
    body.crouch = true;
    body.h = Math.min(body.tall, BODY.crouchH);
  } else if (body.crouch && body.y + body.tall <= overhead(body, index, open, solids) + EPS) {
    body.crouch = false;
    body.h = body.tall;
  }
}

// Across the floor, in moves short enough (under half the radius) that a
// wall, which has no thickness, can never be stepped clean over. On the
// ground each move steps up or down whatever is within a step; past that
// the body leaves the ground and falls.
function walkAcross(body, input, dt, { layout, index, open, solids }, events) {
  const dir = input.dir ?? { x: 0, z: 0 };
  const len = Math.hypot(dir.x, dir.z);
  const speed = (body.crouch ? BODY.crouchWalk : input.run ? BODY.run : BODY.walk) * dt * (len > 1 ? 1 / len : 1);
  const mx = dir.x * speed;
  const mz = dir.z * speed;
  const moves = Math.max(1, Math.ceil(Math.hypot(mx, mz) / (body.r / 2)));
  for (let k = 0; k < moves; k++) {
    const was = { x: body.x, z: body.z };
    body.x += mx / moves;
    body.z += mz / moves;
    // a squeeze the passes can’t settle is refused rather than pushed through
    if (!resolve(body, index, open, solids)) Object.assign(body, was);
    if (body.ground) {
      const s = support(index, solids, body.x, body.z, body.y + BODY.step + EPS, open);
      if (s !== null && s >= body.y - BODY.step - EPS) body.y = s;
      else {
        body.ground = false;
        body.vy = 0;
      }
    }
    enter(body, layout.roomAt(body.x, body.y, body.z), events);
  }
}

// Up until the head meets something, down until the feet do; a landing
// further than BODY.drop below the last safe spot is a fall.
function airborne(body, dt, { layout, index, open, solids }, events) {
  body.vy -= BODY.gravity * dt;
  const next = body.y + body.vy * dt;
  if (body.vy > 0) {
    const top = overhead(body, index, open, solids);
    if (next + body.h > top) {
      body.y = Math.max(body.y, top - body.h);
      body.vy = 0;
    } else body.y = next;
  } else {
    const s = support(index, solids, body.x, body.z, body.y + BODY.step + EPS, open);
    if (s === null || next > s) body.y = next;
    else if (body.safe.y - s > BODY.drop) fall(body, events);
    else {
      events.push({ type: 'land', speed: -body.vy });
      body.y = s;
      body.vy = 0;
      body.ground = true;
    }
  }
  if (!body.ground && body.safe.y - body.y > BODY.drop) fall(body, events);
  // dropping past a ledge’s edge slides you off it rather than into it
  if (!body.ground) resolve(body, index, open, solids);
  enter(body, layout.roomAt(body.x, body.y, body.z), events);
}

export function stepBody(body, input, dt, { layout, open, solids = [] }) {
  const events = [];
  const world = { layout, index: indexOf(layout), open, solids: solids.map(solidOf) };
  crouchOrStand(body, input.crouch, world.index, open, world.solids);
  // (both clocks on the body, as plain numbers: the rules' state stays data)
  body.wantJump = input.jump ? BODY.buffer : Math.max(0, (body.wantJump ?? 0) - dt);
  const footing = body.ground || (body.offGround ?? Infinity) <= BODY.coyote;
  if (body.wantJump > 0 && footing && !body.crouch) {
    body.vy = BODY.jump;
    body.ground = false;
    body.wantJump = 0;
    body.offGround = Infinity; // (no second jump from the same footing)
  }
  walkAcross(body, input, dt, world, events);
  if (!body.ground) airborne(body, dt, world, events);
  if (body.ground) Object.assign(body.safe, { x: body.x, y: body.y, z: body.z, room: body.room });
  body.offGround = body.ground ? 0 : (body.offGround ?? 0) + dt;
  return events;
}

// Where a line a + t (b − a) is inside lo < p < hi along one axis, cut to [t0, t1].
function clip(p, d, lo, hi, span) {
  if (Math.abs(d) < 1e-12) return p > lo && p < hi ? span : null;
  const ta = (lo - p) / d;
  const tb = (hi - p) / d;
  const t0 = Math.max(span[0], Math.min(ta, tb));
  const t1 = Math.min(span[1], Math.max(ta, tb));
  return t0 < t1 - 1e-9 ? [t0, t1] : null;
}

// Whether the line goes through the inside of a box or an upright cylinder
// (grazing its surface, like a line along a floor, doesn’t count).
function through(item, a, b) {
  let span = clip(a.y, b.y - a.y, item.y0, item.y1, [0, 1]);
  if (!span) return false;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  if (item.kind === 'box') {
    span = clip(a.x, dx, item.x0, item.x1, span);
    return !!span && !!clip(a.z, dz, item.z0, item.z1, span);
  }
  const ox = a.x - item.x;
  const oz = a.z - item.z;
  const A = dx * dx + dz * dz;
  const C = ox * ox + oz * oz - item.r * item.r;
  if (A < 1e-12) return C < 0;
  const B = 2 * (ox * dx + oz * dz);
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return false;
  const root = Math.sqrt(disc);
  return Math.max(span[0], (-B - root) / (2 * A)) < Math.min(span[1], (-B + root) / (2 * A)) - 1e-9;
}

// Whether the line crosses a wall segment where the wall is, at the line’s height there.
function crosses(seg, a, b) {
  const rx = b.x - a.x;
  const rz = b.z - a.z;
  const sx = seg.bx - seg.ax;
  const sz = seg.bz - seg.az;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-12) return false;
  const qx = seg.ax - a.x;
  const qz = seg.az - a.z;
  const t = (qx * sz - qz * sx) / den;
  const u = (qx * rz - qz * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return false;
  const y = a.y + t * (b.y - a.y);
  return y >= seg.y0 && y <= seg.y1;
}

export function lineClear(layout, open, a, b, solids = []) {
  const items = near(indexOf(layout), Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z), solids.map(solidOf));
  for (const item of items) {
    if (item.kind === 'seg' ? shutTo(item, open) && crosses(item, a, b) : through(item, a, b)) return false;
  }
  return true;
}
