// The galaxy's wars' operations on the holotable (HoloMap.jsx, WarLayers.jsx),
// as plain rules: each front and attack an arrow from the system its fleets
// come from to the one they're after, and a fleet on it that closes in as its
// side gains; and which battle a pilot's nearest to joining. Pure, tested.
//
// A front's fleets are the liberator's, from its best-held neighbour of the
// front (the nearest of those, on a tie); an attack's come from where it was
// launched (gcw.js's `origin`) while that's still the attacker's, or else
// from its best-held neighbour.
// The arrow bends to whichever side of its way has more room from the other
// systems' dots and the names beside them (roomOf), the left on a tie; two
// along one lane, one each way, bend each to its own left, so they part. It
// stops clear of both systems' dots; a raid's drawn dotted, the decisive
// battle doubled (the drawing's warmap.css's).
//
// opsOf(table) → [{ id, kind ('front', 'decisive', 'attack', 'counter',
// 'raid'), by, from, to, progress (0..1, how much of the holder's hold is
// gone), colour, width, major, d (an SVG path), head (its arrowhead's
// points), start, tip, token ([x, z]: the fleet) }] for gcw.js's warTable;
// nearestBattle(table, current, side) → { id, seconds } | null;
// roomOf([x, z], except) → grid squares from the nearest system's dot or
// name (but the dots of the systems in `except`; below 0 inside a dot);
// NAME_LEFT, the systems whose names go on the left of their dots.

import { NEIGHBOURS } from './gcwRules';
import { SIDES, WARS } from './sides';
import { SYSTEMS, jumpSeconds, systemById } from './systems';

const CLEAR = 0.42; // grid squares off each end of an arrow: clear of the system's dot and ring
const WIDTH = [0.05, 0.13]; // an arrow's, by how fast its side's pushing (grid squares)

// the names that go on the left of their dot (HoloMap.jsx draws them so): a
// neighbour's on the right, or the map's edge
export const NAME_LEFT = new Set(['mustafar', 'hoth', 'geonosis', 'nevarro', 'mandalore', 'lothal', 'kamino']);
// what a system takes up on the map, roughly, in grid squares (a desktop's;
// on a phone a name's a little longer for the squares, so this errs short):
// its dot and ring, and its name, from just off the dot, so wide a letter
const DOT = 0.45;
const NAME = { off: 0.4, per: 0.24, half: 0.25 };
const MARKS = SYSTEMS.map((s) => {
  const [x, z] = s.pos;
  const len = NAME.off + NAME.per * s.name.length;
  return { id: s.id, dot: s.pos, name: NAME_LEFT.has(s.id) ? [x - len, x - NAME.off, z] : [x + NAME.off, x + len, z] };
});

export function roomOf([x, z], except = []) {
  let room = Infinity;
  for (const m of MARKS) {
    const [x0, x1, nz] = m.name;
    room = Math.min(room, Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(Math.abs(z - nz) - NAME.half, 0)));
    if (!except.includes(m.id)) room = Math.min(room, Math.hypot(x - m.dot[0], z - m.dot[1]) - DOT);
  }
  return room;
}

const round = (v) => +v.toFixed(3);
const pt = ([x, z]) => `${round(x)} ${round(z)}`;
const toward = (p, q, r) => {
  const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
  return [p[0] + ((q[0] - p[0]) / l) * r, p[1] + ((q[1] - p[1]) / l) * r];
};

// where a side's fleets come at a system from: its neighbour of it it holds
// best (on a tie the nearest, then the first by name)
function bestHeld(rows, to, by) {
  const far = (o) => Math.hypot(systemById(o).pos[0] - systemById(to).pos[0], systemById(o).pos[1] - systemById(to).pos[1]);
  let from = null;
  for (const o of NEIGHBOURS[to]) {
    if (rows[o]?.owner !== by) continue;
    if (from === null || rows[o].control > rows[from].control || (rows[o].control === rows[from].control && far(o) < far(from))) from = o;
  }
  return from;
}

// an arrow from a to b, bent to the left of its way (side 1) or the right
// (-1), as the map shows it, z running down (a short one bends wide, so it
// clears the dots at either end), and the point t of the way along it
function arrowOf(a, b, width, side = 1) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = [((b[1] - a[1]) / len) * side, (-(b[0] - a[0]) / len) * side];
  const bend = len < 1.6 ? 0.9 : Math.min(1.2, Math.max(0.3, len * 0.16));
  const c = [(a[0] + b[0]) / 2 + n[0] * bend, (a[1] + b[1]) / 2 + n[1] * bend];
  const start = toward(a, c, CLEAR);
  const tip = toward(b, c, CLEAR);
  // (the line stops at the arrowhead's base, which points along the way it comes in)
  const long = 0.3 + width * 1.5;
  const half = 0.16 + width;
  const u = toward([0, 0], [tip[0] - c[0], tip[1] - c[1]], 1);
  const base = [tip[0] - u[0] * long, tip[1] - u[1] * long];
  const head = [tip, [base[0] - u[1] * half, base[1] + u[0] * half], [base[0] + u[1] * half, base[1] - u[0] * half]];
  const at = (t) => [0, 1].map((i) => (1 - t) ** 2 * start[i] + 2 * (1 - t) * t * c[i] + t * t * base[i]);
  return { d: `M${pt(start)} Q${pt(c)} ${pt(base)}`, head: head.map(([x, z]) => `${round(x)},${round(z)}`).join(' '), start, tip, at };
}

// the side of its way an arrow from one system to another has more room on
// (the least room anywhere along it, from the systems but its own two)
const ALONG = [0.2, 0.35, 0.5, 0.65, 0.8];
function sideFor(from, to, width) {
  const roomAlong = (side) => {
    const arrow = arrowOf(systemById(from).pos, systemById(to).pos, width, side);
    return Math.min(...ALONG.map((t) => roomOf(arrow.at(t), [from, to])));
  };
  return roomAlong(-1) > roomAlong(1) ? -1 : 1;
}

export function opsOf(table) {
  const { liberator } = WARS[table.war];
  const rows = Object.fromEntries(table.systems.map((r) => [r.id, r]));
  const plans = [];
  for (const r of table.systems) {
    const attack = r.attack;
    if (!attack && !(r.front && r.owner !== liberator)) continue;
    const by = attack ? attack.by : liberator;
    const launched = attack?.origin && rows[attack.origin]?.owner === by && NEIGHBOURS[r.id].includes(attack.origin) ? attack.origin : null;
    const from = launched ?? bestHeld(rows, r.id, by);
    if (!from) continue;
    const kind = attack ? (by === 'hutt' ? 'raid' : attack.counter ? 'counter' : 'attack') : r.decisive ? 'decisive' : 'front';
    const progress = Math.min(1, Math.max(0, 1 - r.control));
    const width = round(Math.min(WIDTH[1], Math.max(WIDTH[0], 0.05 + 0.004 * Math.abs(r.effRate ?? 0))));
    plans.push({ id: `${kind}-${r.id}`, kind, by, from, to: r.id, progress, colour: SIDES[by].colour, width, major: Boolean(r.major) });
  }
  // (a lane with an arrow each way: each to its own left)
  const twoWay = (p) => plans.some((q) => q.from === p.to && q.to === p.from);
  return plans.map((p) => {
    const arrow = arrowOf(systemById(p.from).pos, systemById(p.to).pos, p.width, twoWay(p) ? 1 : sideFor(p.from, p.to, p.width));
    return { ...p, d: arrow.d, head: arrow.head, start: arrow.start, tip: arrow.tip, token: arrow.at(0.35 + 0.5 * p.progress) };
  });
}

// the battle a side's in that's the shortest jump from where you are (where
// you are first of all), and how long the jump is
export function nearestBattle(table, current, side) {
  if (!side) return null;
  const here = systemById(current);
  let best = null;
  for (const r of table.systems) {
    const b = r.battle;
    if (!b || (b.attacker !== side && b.defender !== side)) continue;
    const seconds = r.id === current ? 0 : +jumpSeconds(here, systemById(r.id)).toFixed(1);
    if (!best || seconds < best.seconds || (seconds === best.seconds && r.id < best.id)) best = { id: r.id, seconds };
  }
  return best;
}
