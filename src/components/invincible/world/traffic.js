// The city's traffic and the people on its pavements, as plain numbers
// (./life.js draws them). Cars keep to the right-hand lane of the grid's
// streets, turn at the corners, cross the river only on a bridge, keep
// their distance from the car ahead, and stop dead when something lands
// in the road; people walk the pavements and run from trouble. A fixed
// pool of each, always round the camera: whoever gets too far behind is
// moved to somewhere ahead of it.
//
// A car is on a street: `axis` is the way it runs ('x', an E–W street at
// z = line; 'z', a N–S street at x = line), `dir` which way along it (±1)
// and `s` how far along. A walker is the same, on the pavement either side.

import { BRIDGES, CITY, GRID, RIVER, blockKind, rng } from './map';

export const LANE = 3.5; // the lane's middle, off the street's centre line
export const WALK = 8.5; // the pavement's, likewise
const CELL = GRID.cell;
const HALF = CELL / 2;
const FAR = 420; // cars further than this from the camera are moved (it's all a street-level camera sees)
const NEAR_WALK = 300;
const GAP = 7;

// the street lines near a value (they're at 80k + 40)
const lineNear = (v) => Math.round((v - HALF) / CELL) * CELL + HALF;

// Is there street from `a` to the next corner along the street at `line`
// (both ends inside the city, with a block beside it, or a bridge)?
export function segmentOk(axis, line, a) {
  const lo = Math.floor((a - HALF) / CELL) * CELL + HALF;
  const mid = lo + HALF;
  // across the street: the blocks either side of it, along: the block this stretch runs past
  const across = Math.round((line - HALF) / CELL);
  const along = Math.round(mid / CELL);
  const [x, z] = axis === 'x' ? [mid, line] : [line, mid];
  if (x < CITY.x0 - HALF || x > CITY.x1 + HALF || z < CITY.z0 - HALF || z > CITY.z1 + HALF) return false;
  if (x > RIVER.x0 - 15 && x < RIVER.x1 + 15) return axis === 'x' && BRIDGES.includes(line);
  const sides = axis === 'x' ? [blockKind(along, across), blockKind(along, across + 1)] : [blockKind(across, along), blockKind(across + 1, along)];
  return sides.some(Boolean);
}

// where a car or a walker is: [x, z]
export const carAt = (c) => (c.axis === 'x' ? [c.s, c.line + LANE * c.dir] : [c.line - LANE * c.dir, c.s]);
export const walkerAt = (w) => {
  const [x, z] = w.axis === 'x' ? [w.s, w.line + WALK * w.side] : [w.line + WALK * w.side, w.s];
  return [x + (w.ox ?? 0), z + (w.oz ?? 0)];
};
export const headingOf = (c) => (c.axis === 'x' ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : c.dir > 0 ? 0 : Math.PI);

// somewhere on a street between `near` and `far` metres from (cx, cz),
// mostly in front of where the camera's looking (`yaw`), if it says
function placeOnStreet(r, cx, cz, near, far, tries = 40, yaw = null) {
  for (let i = 0; i < tries; i++) {
    const a = yaw != null && r() < 0.75 ? Math.PI / 2 - yaw + (r() - 0.5) * Math.PI * 0.9 : r() * Math.PI * 2;
    const d = near + r() * (far - near);
    const axis = r() < 0.5 ? 'x' : 'z';
    const px = cx + Math.cos(a) * d;
    const pz = cz + Math.sin(a) * d;
    const line = lineNear(axis === 'x' ? pz : px);
    const s = axis === 'x' ? px : pz;
    if (segmentOk(axis, line, s)) return { axis, line, s };
  }
  return null;
}

export function createTraffic({ cars = 260, walkers = 220, seed = 5, cx = 0, cz = 0 } = {}) {
  const r = rng(seed);
  const st = { r, cars: [], walkers: [] };
  for (let i = 0; i < cars; i++) {
    const at = placeOnStreet(r, cx, cz, 0, FAR * 0.9) ?? { axis: 'x', line: HALF, s: 0 };
    st.cars.push({ id: i, ...at, dir: r() < 0.5 ? 1 : -1, speed: 0, cruise: 11 + r() * 5, kind: Math.floor(r() * 4), colour: r(), turn: null, wait: 0 });
  }
  for (let i = 0; i < walkers; i++) {
    const at = placeOnStreet(r, cx, cz, 0, NEAR_WALK) ?? { axis: 'x', line: HALF, s: 0 };
    st.walkers.push({ id: i, ...at, side: r() < 0.5 ? 1 : -1, dir: r() < 0.5 ? 1 : -1, speed: 1.2 + r() * 0.6, phase: r() * 10, kind: Math.floor(r() * 6), flee: 0, ox: 0, oz: 0, fx: 0, fz: 0 });
  }
  return st;
}

// What a car does at the next corner: straight on, left or right, where it can.
function plan(c, r) {
  // (the next corner at least a few metres on, so a turn there is still ahead)
  const a = c.s + c.dir * 4;
  const next = c.dir > 0 ? Math.floor((a - HALF) / CELL + 1) * CELL + HALF : Math.ceil((a - HALF) / CELL - 1) * CELL + HALF;
  const options = [];
  // straight on: there's street past the corner
  if (segmentOk(c.axis, c.line, next + c.dir * 1)) options.push({ kind: 'on', w: 3 });
  for (const turnDir of [1, -1]) {
    // the cross street, from the corner, either way
    const axis = c.axis === 'x' ? 'z' : 'x';
    if (segmentOk(axis, next, c.line + turnDir * 1)) options.push({ kind: 'turn', axis, line: next, dir: turnDir, w: 1 });
  }
  if (!options.length) return { kind: 'back', at: next };
  let pick = r() * options.reduce((a, o) => a + o.w, 0);
  const o = options.find((q) => (pick -= q.w) < 0) ?? options[0];
  if (o.kind === 'on') return { kind: 'on', at: next };
  // turn where the new lane crosses this one, so the car's path is unbroken
  const at = o.axis === 'z' ? o.line - LANE * o.dir : o.line + LANE * o.dir;
  return { ...o, at, s: c.axis === 'x' ? c.line + LANE * c.dir : c.line - LANE * c.dir };
}

// A walker steps aside for the others coming by and for Mark on foot (`hero`,
// { x, z }): a side-step across the pavement, never off it (the offset
// back to the pavement's line eases it in again once they're past).
const ROOM = 0.8; // metres two walkers keep between them
const ROOM_HERO = 1.8; // and between them and him
const ASIDE = 0.5; // the furthest across they step
function sidestep(w, x, z, cells, cellOf, hero, dt) {
  const acrossX = w.axis !== 'x'; // (walking along z: across is x)
  let push = 0;
  for (let gx = -1; gx <= 1; gx++)
    for (let gz = -1; gz <= 1; gz++) {
      const list = cells.get(cellOf(x + gx * 2, z + gz * 2));
      if (!list) continue;
      for (const o of list) {
        if (o.w === w) continue;
        const d = Math.hypot(o.x - x, o.z - z);
        if (d >= ROOM) continue;
        const across = acrossX ? x - o.x : z - o.z;
        push += (across !== 0 ? Math.sign(across) : w.id < o.w.id ? 1 : -1) * (ROOM - d) * 2;
      }
    }
  if (hero) {
    const d = Math.hypot(hero.x - x, hero.z - z);
    if (d < ROOM_HERO) {
      const across = acrossX ? x - hero.x : z - hero.z;
      push += (across !== 0 ? Math.sign(across) : w.side) * (ROOM_HERO - d) * 2.5;
    }
  }
  if (!push) return;
  const key = acrossX ? 'ox' : 'oz';
  const was = w[key] ?? 0;
  const v = was + push * dt;
  // (on the way back from running off somewhere, as far out as they are)
  w[key] = Math.abs(was) > ASIDE ? v : Math.max(-ASIDE, Math.min(ASIDE, v));
}

// hero: Mark, when he's on foot in town ({ x, z }), for the walkers to step round
export function stepTraffic(prev, dt, { cx = 0, cz = 0, yaw = null, scare = [], hero = null } = {}) {
  const st = { ...prev, cars: prev.cars.map((c) => ({ ...c })), walkers: prev.walkers.map((w) => ({ ...w })) };
  const r = st.r;

  // ── the cars ──
  // who's ahead of whom, lane by lane
  const lanes = new Map();
  for (const c of st.cars) {
    const k = `${c.axis}:${c.line}:${c.dir}`;
    if (!lanes.has(k)) lanes.set(k, []);
    lanes.get(k).push(c);
  }
  for (const list of lanes.values()) {
    list.sort((a, b) => (a.s - b.s) * a.dir);
    for (let i = 0; i < list.length; i++) list[i].ahead = i + 1 < list.length ? (list[i + 1].s - list[i].s) * list[i].dir : Infinity;
  }
  for (const c of st.cars) {
    const [x, z] = carAt(c);
    if (scare.some((q) => Math.hypot(x - q.x, z - q.z) < q.r)) c.wait = 3;
    let want = c.cruise;
    if (c.wait > 0) {
      c.wait -= dt;
      want = 0;
    }
    // slow for the car ahead, stop short of it
    if (c.ahead < GAP + c.speed * 0.8) want = Math.min(want, Math.max(0, (c.ahead - GAP) * 1.2));
    const brake = c.wait > 0 ? 20 : 8;
    c.speed = c.speed < want ? Math.min(want, c.speed + 3 * dt) : Math.max(want, c.speed - brake * dt);
    c.turn ??= plan(c, r);
    const s0 = c.s;
    c.s += c.dir * c.speed * dt;
    const t = c.turn;
    // past the corner (or where its new lane crosses): carry on, turn, or turn round
    if ((c.s - t.at) * c.dir >= 0 && (s0 - t.at) * c.dir < 0) {
      if (t.kind === 'turn') {
        c.axis = t.axis;
        c.line = t.line;
        c.dir = t.dir;
        c.s = t.s;
      } else if (t.kind === 'back') {
        c.dir = -c.dir;
        c.s = t.at;
      }
      c.turn = null;
    }
    delete c.ahead;
    // too far from the camera: somewhere nearer it, out of sight round it
    if (Math.hypot(x - cx, z - cz) > FAR) {
      const at = placeOnStreet(r, cx, cz, FAR * 0.55, FAR * 0.97, 40, yaw);
      if (at) Object.assign(c, at, { dir: r() < 0.5 ? 1 : -1, speed: c.cruise * 0.7, turn: null, wait: 0 });
    }
  }

  // ── the people ──
  // who's near whom (two-metre cells), for stepping round each other and him
  const cells = new Map();
  const cellOf = (x, z) => Math.floor(x / 2) * 100003 + Math.floor(z / 2);
  for (const w of st.walkers) {
    if (w.flee > 0) continue;
    const [x, z] = walkerAt(w);
    const k = cellOf(x, z);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push({ w, x, z });
  }
  for (const w of st.walkers) {
    const [x, z] = walkerAt(w);
    if (!(w.flee > 0)) sidestep(w, x, z, cells, cellOf, hero, dt);
    for (const q of scare) {
      const d = Math.hypot(x - q.x, z - q.z);
      if (d < q.r) {
        w.flee = 4;
        w.fx = (x - q.x) / (d || 1);
        w.fz = (z - q.z) / (d || 1);
      }
    }
    if (w.flee > 0) {
      // running from it, wherever that takes them
      w.flee -= dt;
      w.ox += w.fx * 5 * dt;
      w.oz += w.fz * 5 * dt;
    } else {
      // and back to the pavement, then on along it
      const k = 1 - Math.exp(-0.8 * dt);
      w.ox -= w.ox * k;
      w.oz -= w.oz * k;
      const s0 = w.s;
      w.s += w.dir * w.speed * dt;
      // at a corner: on across, or back the way they came
      const corner = Math.round((w.s - HALF) / CELL) * CELL + HALF;
      if ((s0 - corner) * (w.s - corner) <= 0 && s0 !== corner) {
        if (!segmentOk(w.axis, w.line, corner + w.dir) || r() < 0.2) w.dir = -w.dir;
      }
    }
    w.phase += dt * w.speed * (w.flee > 0 ? 3.5 : 1);
    if (Math.hypot(x - cx, z - cz) > NEAR_WALK * 1.2) {
      const at = placeOnStreet(r, cx, cz, 60, NEAR_WALK, 40, yaw);
      if (at) Object.assign(w, at, { flee: 0, ox: 0, oz: 0 });
    }
  }
  return st;
}
