// The second Death Star’s working half, worked out before anything is
// drawn: where a Lambda shuttle’s model goes on the prop furnish puts
// down for her, her ramp down to the station’s ramp spot, the well in a
// bay’s ceiling her folded wings rise into when she stands taller than the
// bay, the ranks marked out on Hangar 272’s deck for the troops who line
// the Emperor’s way, the antechamber’s bench alcoves, and which of the
// command centre’s two screens is the big targeting one and where its
// rifle rack hangs. ../ds2a.js draws from these. Pure.
//
//   LAMBDA: { url, tall, wide, ramp: { run, rise } }   the model; her height and folded span for her length
//   fitModel(prop, { min, max }) → { scale, turn, offset, at }   a model (nose to +z, as loaded) on its prop:
//     the model at `offset` (its own units) in a holder at `at`, turned `turn` (rotation.y), scaled `scale`
//   rampFor(prop, spots) → { foot, top, rise, yaw } | null   from her hatch down to the ramp spot ahead of her
//   wellOver(prop, room) → { x0, x1, z0, z1, y0, y1 } | null   the ceiling’s well over a shuttle too tall for it
//   cutSpan(a, b, holes) → [[a, b]]   the stretches of a..b left round the holes ([[h0, h1]])
//   ranksOf(room, { spots, solids, doors }) → { aisle, blocks: [{ yaw, x0, x1, z0, z1, places: [{ x, z }] }] }
//     aisle: { a, b, half, x, z0, z1 } from the foot of the ramp up to the far wall, `half` either side
//   alcovesOf(room, layout) → [{ x0, z0, x1, z1, y0, y1, n }]   one a doorless wall, in its middle;
//     n: the way the alcove goes into the wall, out of the room
//   screensOf(props) → [screen prop & { size: 'big' | 'small' }]   the one the desk faces is big
//   rackOf(room, layout, props) → { x, z, yaw }   on the door’s wall, on the far side from the desk

import { roomWalls } from '../../kit';

// The Lambda as /models/galaxy/surface/lambda.glb has her, wings folded:
// her height and span for her length (the model is 20 × 12.5 × 17.6 as it
// loads). Furnish’s prop is the length she is drawn at; her ramp runs from
// under her cockpit 4 m down to its foot, from a hatch 1.6 m up.
export const LAMBDA = { url: '/models/galaxy/surface/lambda.glb', tall: 1.14, wide: 0.71, ramp: { run: 4, rise: 1.6 } };

const R = 0.35; // a body’s radius (walker.js)
const fwd = (yaw) => ({ x: Math.sin(yaw), z: -Math.cos(yaw) });
const right = (yaw) => ({ x: Math.cos(yaw), z: Math.sin(yaw) });
const dot = (p, q, v) => (p.x - q.x) * v.x + (p.z - q.z) * v.z;
const mod = (a, n) => ((a % n) + n) % n;

export function fitModel(prop, { min, max }) {
  return {
    scale: prop.d / (max.z - min.z),
    // (her nose is +z as she loads; yaw 0 faces −z)
    turn: Math.PI - prop.yaw,
    offset: { x: -(min.x + max.x) / 2, y: -min.y, z: -(min.z + max.z) / 2 },
    at: { x: prop.x, y: prop.y, z: prop.z },
  };
}

export function rampFor(prop, spots) {
  const [f, r] = [fwd(prop.yaw), right(prop.yaw)];
  const best = spots
    .filter((s) => /ramp/.test(s.name))
    .map((s) => ({ s, ahead: dot(s, prop, f), side: dot(s, prop, r) }))
    .filter((c) => c.ahead > 0 && Math.abs(c.side) < prop.w / 2)
    .sort((p, q) => p.ahead - q.ahead)[0];
  if (!best) return null;
  const foot = { x: best.s.x, z: best.s.z };
  const top = { x: foot.x - f.x * LAMBDA.ramp.run, z: foot.z - f.z * LAMBDA.ramp.run };
  return { foot, top, rise: LAMBDA.ramp.rise, yaw: prop.yaw };
}

export function wellOver(prop, room, { margin = 1.5, pad = 1, inset = 0.5 } = {}) {
  const ceiling = room.y + room.h;
  const top = prop.y + LAMBDA.tall * prop.d + margin;
  if (top <= ceiling) return null;
  const [hw, hd] = [(LAMBDA.wide * prop.d) / 2 + pad, prop.d / 2 + pad];
  const [c, s] = [Math.abs(Math.cos(prop.yaw)), Math.abs(Math.sin(prop.yaw))];
  const [ex, ez] = [hw * c + hd * s, hw * s + hd * c];
  const b = room.box;
  return {
    x0: Math.max(b.x0 + inset, prop.x - ex),
    x1: Math.min(b.x1 - inset, prop.x + ex),
    z0: Math.max(b.z0 + inset, prop.z - ez),
    z1: Math.min(b.z1 - inset, prop.z + ez),
    y0: ceiling,
    y1: top,
  };
}

export function cutSpan(a, b, holes) {
  const merged = [];
  for (const [h0, h1] of holes.filter(([h0, h1]) => h1 > a && h0 < b).sort((p, q) => p[0] - q[0])) {
    const last = merged.at(-1);
    if (last && h0 <= last[1]) last[1] = Math.max(last[1], h1);
    else merged.push([h0, h1]);
  }
  const out = [];
  let t = a;
  for (const [h0, h1] of merged) {
    if (h0 > t) out.push([t, h0]);
    t = Math.max(t, h1);
  }
  if (b > t) out.push([t, b]);
  return out;
}

// how far a point stands from a solid seen from above (furnish’s shapes)
function toSolid(s, p) {
  if (s.circle) return Math.max(0, Math.hypot(p.x - s.circle.x, p.z - s.circle.z) - s.circle.r);
  const b = s.box;
  return Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.z0 - p.z, 0, p.z - b.z1));
}

// The ranks: a trooper every 1.4 m along the aisle and every 1.5 m back
// from it, six deep, in two columns of blocks a side with a wider gap
// between; six files to a block and an empty file between blocks, counted
// from the station’s spot in the ranks so that it stands second in its
// block. A place is kept only if it and its mirror across the aisle are
// both clear, so the two sides match.
const RANKS = { along: 1.4, back: 1.5, deep: 6, files: 6, gap: 1, columns: 2, between: 3.5, wall: 2, start: 1 };

export function ranksOf(room, { spots = [], solids = [], doors = [] } = {}) {
  const mark = spots.find((s) => /^ranks/.test(s.name));
  const foot = spots.find((s) => /ramp/.test(s.name));
  if (!mark || !foot) return { aisle: null, blocks: [] };
  const [f, r] = [fwd(foot.yaw), right(foot.yaw)];
  const b = room.box;
  // how far up the aisle the far wall is
  const exit = Math.min(...[f.x > 1e-9 ? (b.x1 - foot.x) / f.x : f.x < -1e-9 ? (b.x0 - foot.x) / f.x : Infinity, f.z > 1e-9 ? (b.z1 - foot.z) / f.z : f.z < -1e-9 ? (b.z0 - foot.z) / f.z : Infinity]);
  const at = (t, s) => ({ x: foot.x + f.x * t + r.x * s, z: foot.z + f.z * t + r.z * s });
  const a0 = dot(mark, foot, f);
  const half = Math.abs(dot(mark, foot, r));
  const end = at(exit, 0);
  const aisle = { a: { x: foot.x, z: foot.z }, b: end, half, x: foot.x, z0: Math.min(foot.z, end.z), z1: Math.max(foot.z, end.z) };

  const inRoom = (p) => p.x > b.x0 + 1 && p.x < b.x1 - 1 && p.z > b.z0 + 1 && p.z < b.z1 - 1;
  const inDoorway = (p) => doors.some((d) => (d.axis === 'x' ? Math.abs(p.x - d.x) <= d.w / 2 + R && Math.abs(p.z - d.z) <= 1 + R : Math.abs(p.z - d.z) <= d.w / 2 + R && Math.abs(p.x - d.x) <= 1 + R));
  const clear = (p) => inRoom(p) && !inDoorway(p) && solids.every((s) => toSolid(s, p) >= R + 0.02);

  const period = RANKS.files + RANKS.gap;
  const kFrom = Math.ceil((RANKS.start - a0) / RANKS.along - 1e-9);
  const kTo = Math.floor((exit - RANKS.wall - a0) / RANKS.along + 1e-9);
  const blocks = new Map();
  for (let c = 0; c < RANKS.columns; c++) {
    for (let j = 0; j < RANKS.deep; j++) {
      const back = half + c * ((RANKS.deep - 1) * RANKS.back + RANKS.between) + j * RANKS.back;
      for (let k = kFrom; k <= kTo; k++) {
        if (mod(k + 1, period) >= RANKS.files) continue;
        const t = a0 + k * RANKS.along;
        const [west, east] = [at(t, -back), at(t, back)];
        if (!clear(west) || !clear(east)) continue;
        const run = Math.floor((k + 1) / period);
        for (const [side, p] of [[-1, west], [1, east]]) {
          const key = `${side}:${c}:${run}`;
          // facing the aisle: a quarter turn from up it, towards it
          if (!blocks.has(key)) blocks.set(key, { yaw: foot.yaw - (side * Math.PI) / 2, places: [] });
          blocks.get(key).places.push(p);
        }
      }
    }
  }
  return {
    aisle,
    blocks: [...blocks.values()].map((k) => ({
      ...k,
      x0: Math.min(...k.places.map((p) => p.x)),
      x1: Math.max(...k.places.map((p) => p.x)),
      z0: Math.min(...k.places.map((p) => p.z)),
      z1: Math.max(...k.places.map((p) => p.z)),
    })),
  };
}

export function alcovesOf(room, layout, { len = 4.4, high = 2.4, room: spare = 1 } = {}) {
  const out = [];
  for (const run of roomWalls(layout, room.id)) {
    if (run.holes.length || run.len < len + 2 * spare) continue;
    const t0 = (run.len - len) / 2;
    const p = (t) => ({ x: run.x0 + ((run.x1 - run.x0) * t) / run.len, z: run.z0 + ((run.z1 - run.z0) * t) / run.len });
    const [a, c] = [p(t0), p(t0 + len)];
    out.push({ x0: a.x, z0: a.z, x1: c.x, z1: c.z, y0: run.y0, y1: run.y0 + high, n: { x: -run.n.x || 0, z: -run.n.z || 0 } });
  }
  return out;
}

export function screensOf(props) {
  const screens = props.filter((p) => p.kind === 'screen');
  const desk = props.find((p) => p.kind === 'desk');
  if (!screens.length) return [];
  const f = desk ? fwd(desk.yaw) : null;
  const faced = f ? screens.reduce((best, s) => (dot(s, desk, f) > dot(best, desk, f) ? s : best)) : screens[0];
  return screens.map((s) => ({ ...s, size: s === faced ? 'big' : 'small' }));
}

export function rackOf(room, layout, props, { from = 6, corner = 1.5 } = {}) {
  const door = layout.doors.get(room.doors[0]);
  const b = room.box;
  const desk = props.find((p) => p.kind === 'desk');
  const alongX = door.axis === 'x';
  const [lo, hi] = alongX ? [b.x0, b.x1] : [b.z0, b.z1];
  const at = alongX ? door.x : door.z;
  const deskAt = desk ? (alongX ? desk.x : desk.z) : at + 1;
  const side = deskAt > at ? -1 : 1;
  const t = side < 0 ? Math.max(lo + corner, at - from) : Math.min(hi - corner, at + from);
  // facing into the room off the door’s wall (yaw 0 faces −z)
  const yaw = alongX ? (Math.abs(door.z - b.z1) < 0.05 ? 0 : Math.PI) : Math.abs(door.x - b.x0) < 0.05 ? Math.PI / 2 : -Math.PI / 2;
  return alongX ? { x: t, z: door.z, yaw } : { x: door.x, z: t, yaw };
}
