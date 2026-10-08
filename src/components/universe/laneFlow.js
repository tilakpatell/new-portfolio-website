// The traffic in every hyperlane at once, as plain numbers (no three.js), so
// it's tested in Node: laneStreaks.js draws all of it as moving light, and
// laneTraffic.js gives the few ships nearest you real models you can shoot.
//
// Each carriageway (hyperlanes.js) carries a ship a density's length of it
// (TIERS: one per 400 on a local lane, 900 on a trunk, 2,500 on the
// express), each in its own slot: a place across the tube (inside R × 0.7),
// a pace (0.9 to 1.1 of the lane's speed) and a phase, all from a hash of
// the lane, the way and the slot. Where a ship is is a sum of those and the
// clock, `s = (phase + pace × speed × t / length) mod 1`, so the flow is in
// its steady state the moment the map loads (nothing spawns in front of
// you: a ship at s now was at s − pace·t then), and every pilot online sees
// the same traffic in the same places without a message between them, the
// clock being the wall's.
//
// Which ships: the side that holds the lane's end (the Star Wars gate's,
// Albuquerque's, the Rick and Morty planet's or the portal's, or the region
// they're in) sends its everyday traffic and its civilians down the local
// lanes; on the trunks, one slot in three is a convoy, a column of four to
// seven under escort, front and back; on the express, the side's capital
// ships. Where no side holds it, the side of the crew you fly (`side`), or
// every side's, as traffic.js's are.
//
// A ship shot down stays down until it comes round to the start of its lane
// again, a lap's worth at least half a lap after the shot (so one shot the
// moment before it comes round isn't back at once): `kill(dead, …)` keeps
// the lap it comes back on, and flowAt leaves it out until then.

import { LANES, R, TIERS, carriageway, nodeById } from './hyperlanes';
import { bezier } from './lanes';
import { frame } from './ride';
import { REGIONS } from './regions';
import { SIDES } from './sides';

export const RESOLVE = 12; // the flow ships nearest you that get real models (laneTraffic.js)
export const NEAR = 400; // and how near they have to be
export const SLOT_OFF = R * 0.7; // how far off its tube's middle a ship rides, at most
export const PACE = [0.9, 1.1]; // of the lane's speed
export const COLUMN = [4, 7]; // a convoy's ships, its escorts among them
export const CONVOYS = 1 / 3; // of a trunk's slots
export const COLUMN_GAP = 3; // map units between a column's ships
// the side's capital ships, on the express (traffic.js's TYPES: big ones;
// a Madrigal freighter for Albuquerque, which has none bigger)
export const CAPITAL = { starwars: 'destroyer', rickmorty: 'federation', breakingbad: 'madrigal' };
// (traffic.js's TYPES with `big`: high over the map, one at a time; never in
// the everyday flow)
const BIG = new Set(['destroyer', 'federation', 'balloon']);
// the places a side holds
const HOLDS = { starwars: 'starwars', breakingbad: 'breakingbad', rickmorty: 'rickmorty', rmportal: 'rickmorty' };

// ── Hashes ──
// a 32-bit hash of a string, and a small generator from it: the same
// numbers for the same lane, way and slot on every machine
const hashOf = (str) => {
  let h = 2166136261;
  for (let k = 0; k < str.length; k++) h = Math.imul(h ^ str.charCodeAt(k), 16777619);
  return h >>> 0;
};
const numbers = (seed) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let x = seed;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
const pickOf = (list, r) => list[Math.min(list.length - 1, Math.floor(r * list.length))];

// ── Who holds a lane ──
const regionHolder = new Map(REGIONS.map((r) => [r.id, HOLDS[r.members.find((id) => HOLDS[id])] ?? null]));
const holderOf = (node) => (node ? (HOLDS[node.place] ?? regionHolder.get(node.region) ?? null) : null);
// (the express from its far end, the gate's; the others from where they start)
const laneSide = (lane) => {
  const [a, b] = lane.tier === 'express' ? [lane.to, lane.from] : [lane.from, lane.to];
  return holderOf(nodeById(a)) ?? holderOf(nodeById(b));
};
const everyday = (side) => [...side.traffic, ...side.civil].filter((k) => !BIG.has(k));
const civilOf = (side) => side.civil.filter((k) => !BIG.has(k));

// ── Slots ──
export const countFor = (lane) => Math.ceil(lane.length / TIERS[lane.tier].density);

// One slot of a carriageway: { off: [u, v] (across the tube, right and up),
// v (its pace), phase (0…1), kind, column (how many ships: 1, or a convoy's),
// kinds (a column's, front to back) }. `side`: the crew's side's id, for a
// lane no side holds.
export function slotOf(lane, way, i, side = null) {
  const r = numbers(hashOf(`${lane.id}|${way}|${i}`));
  const a = r() * Math.PI * 2;
  const d = SLOT_OFF * Math.sqrt(r());
  const v = PACE[0] + (PACE[1] - PACE[0]) * r();
  const phase = r();
  const any = r(); // (drawn either way, so what follows is the same whoever's asking)
  const s = SIDES[laneSide(lane) ?? side] ?? SIDES[pickOf(Object.keys(SIDES), any)];
  const k = r();
  let kinds;
  if (lane.tier === 'express') kinds = [CAPITAL[s.id]];
  else if (lane.tier === 'trunk' && k < CONVOYS) {
    const n = COLUMN[0] + Math.floor(r() * (COLUMN[1] - COLUMN[0] + 1));
    const civil = civilOf(s);
    kinds = Array.from({ length: n }, (_, m) => (m === 0 || m === n - 1 ? s.convoy.escort : pickOf(civil, r())));
  } else kinds = [pickOf(everyday(s), r())];
  return { off: [Math.cos(a) * d, Math.sin(a) * d], v, phase, kind: kinds[0], column: kinds.length, kinds };
}

// every slot of a carriageway, made once (for each side asked for)
const SLOTS = new Map();
const slotsOf = (lane, way, side) => {
  const key = `${lane.id}|${way}|${side ?? ''}`;
  let list = SLOTS.get(key);
  if (!list) SLOTS.set(key, (list = Array.from({ length: countFor(lane) }, (_, i) => slotOf(lane, way, i, side))));
  return list;
};
// how many ships a carriageway carries (a convoy's each counted)
export const shipsOf = (lane, way) => slotsOf(lane, way, null).reduce((n, s) => n + s.column, 0);

// where along it a slot's ship `m` is, unwrapped: its laps and how far round
const lapOf = (lane, slot, m, t) => slot.phase - (m * COLUMN_GAP) / lane.length + (slot.v * TIERS[lane.tier].speed * t) / lane.length;
// the same for slot i's ship m, from outside (laneStreaks.js works out where
// each streak starts from it, in doubles, and leaves the rest to the GPU)
export const lapAt = (lane, way, i, m, t) => lapOf(lane, slotsOf(lane, way, null)[i], m, t);
// the laps a ship has done by t (it comes round to s = 0 at each)
export const wrapsOf = (lane, way, i, m, t) => Math.floor(lapOf(lane, slotsOf(lane, way, null)[i], m, t));
const keyOf = (lane, way, i, m) => `${lane.id}|${way}|${i}|${m}`;

// A ship shot down at t: it's back on the first lap that starts at least
// half a lap after the shot. (`dead`: a Map, the scene's, shared with the
// streaks and the models.)
export function kill(dead, lane, way, i, m, t) {
  dead.set(keyOf(lane, way, i, m), Math.floor(lapOf(lane, slotsOf(lane, way, null)[i], m, t) + 0.5) + 1);
}
// whether a ship's down at t (and, once it's back, forgotten)
export function isDead(dead, lane, way, i, m, t) {
  if (!dead?.size) return false;
  const key = keyOf(lane, way, i, m);
  const back = dead.get(key);
  if (back === undefined) return false;
  if (wrapsOf(lane, way, i, m, t) < back) return true;
  dead.delete(key);
  return false;
}

// The ships in a carriageway at t: [{ i (the slot), m (in its column), s,
// off, kind, speed }], the dead left out.
export function flowAt(lane, way, t, dead = null, side = null) {
  const out = [];
  const slots = slotsOf(lane, way, side);
  const top = TIERS[lane.tier].speed;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    for (let m = 0; m < slot.column; m++) {
      if (isDead(dead, lane, way, i, m, t)) continue;
      const x = lapOf(lane, slot, m, t);
      out.push({ i, m, s: x - Math.floor(x), off: slot.off, kind: slot.kinds[m], speed: slot.v * top });
    }
  }
  return out;
}

// where a ship at s and off (across the tube) is in the map
export function positionOf(lane, way, s, [u, v]) {
  const f = frame(lane, way, s);
  return [f.at[0] + f.right[0] * u + f.up[0] * v, f.at[1] + f.right[1] * u + f.up[1] * v, f.at[2] + f.right[2] * u + f.up[2] * v];
}

// each carriageway's box, to skip the far ones fast
const BOXES = new WeakMap();
const boxesOf = (lanes) => {
  let b = BOXES.get(lanes);
  if (b) return b;
  b = lanes.flatMap((lane) =>
    ['out', 'in'].map((way) => {
      const ps = Array.from({ length: 25 }, (_, k) => bezier(carriageway(lane, way), k / 24));
      const pad = R * 2;
      return { lane, way, lo: [0, 1, 2].map((k) => Math.min(...ps.map((p) => p[k])) - pad), hi: [0, 1, 2].map((k) => Math.max(...ps.map((p) => p[k])) + pad) };
    }),
  );
  BOXES.set(lanes, b);
  return b;
};

// The flow within `near` of the ship at t: [{ lane, way, i, m, s, off, kind,
// speed, at }]
export function flowNear(ship, t, dead = null, near = NEAR, { lanes = LANES, side = null } = {}) {
  const q = [ship.x, ship.y ?? 0, ship.z];
  const out = [];
  for (const b of boxesOf(lanes)) {
    if (q.some((x, k) => x < b.lo[k] - near || x > b.hi[k] + near)) continue;
    for (const f of flowAt(b.lane, b.way, t, dead, side)) {
      const at = positionOf(b.lane, b.way, f.s, f.off);
      if (Math.hypot(at[0] - q[0], at[1] - q[1], at[2] - q[2]) <= near) out.push({ lane: b.lane, way: b.way, ...f, at });
    }
  }
  return out;
}

// The n of `flow` nearest the ship, inside `near`, nearest first: each with
// its `dist`
export function nearest(flow, ship, n = RESOLVE, near = NEAR) {
  const y = ship.y ?? 0;
  return flow
    .map((f) => ({ ...f, dist: Math.hypot(f.at[0] - ship.x, f.at[1] - y, f.at[2] - ship.z) }))
    .filter((f) => f.dist <= near)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, n);
}
