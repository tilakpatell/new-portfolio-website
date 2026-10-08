// The game aboard the Death Star: one station walked by you (and, as the
// cast arrives, the people sharing it), stepped 30 times a second. It owns
// everything that happens and nothing that is drawn: who stands where,
// which doors are open, which rooms you have seen, where the lift is. A
// step turns you, opens and shuts the doors for whoever is near them,
// walks you against the walls and runs the lift; what happened is pushed
// to `g.events` for the module to tell the page, play and save. Pure: a
// game takes its numbers from its own seeded random.
//
//   STEP                       a step’s length, s (30 a second)
//   ticksFor(dt, left = 0) → { ticks, left }   the steps a frame of dt makes with `left` carried
//     over from the last frame: at most 4, the rest of a long frame dropped
//   newGame({ station, side, mode, hero, seed, save }) → g
//     station 'ds1' | 'ds2' (one not built yet starts on the first); side 'rebel' | 'imperial';
//     mode 'story' | 'roam'; hero: a Rebel’s (luke, han, leia, obiwan), an Imperial is a
//     stormtrooper; save: rules/save.js’s, for the rooms seen before and the story’s step
//     g: { station, side, mode, layout, doors, you, bodies, flags: Set, seen: Set<roomId>,
//          lift: null | { id, from, to, t }, time, events, rand, story }
//     you: a walker body & { side, hero, hp, gun, heat, armour, helmet, pitch }
//     bodies: everyone else aboard, as walker bodies (& { side }); they open doors and ride lifts
//   step(g, input, dt = STEP) → void   pushes what happened to g.events
//     input: { dir: { x, z }, yaw, pitch, run, jump, crouch, use, fire, aim, alt, reload, helmet,
//              roar, map, choice }; dir is in the world (the module turns the keys by the camera);
//              use and helmet are presses (true for the one step they were pressed in)
//     events: { type: 'room', from, to } | { type: 'door', what: 'open' | 'close' | 'seal' |
//       'unseal' | 'denied', door } | { type: 'lift', what: 'leave' | 'arrive', id, from, to }
//       | { type: 'helmet', on } | the walker’s 'land', 'fell' and 'respawn'
//   drain(g) → events          what happened since the last drain
//   teleport(g, where, x?, z?, yaw?) → bool   you to a room (its middle unless told) or a named spot
//   promptOf(g) → null | { text, use }   what E does where you stand (`use: true`), or a notice
//     with no key: a door that won’t open for you, a lift on its way
//
// A lift is its cars, one a stop, each a room of its own on its level.
// Use in a car rides it to the lift’s next stop (round to the first from
// the last): both cars’ doors close, unless someone stands in a doorway,
// whom they never close on; 3 s pass; everyone wholly inside the car
// moves by the offset between the two cars, keeping where they stood in
// it; and the doors are let go, to open for whoever is near. Anyone half
// out stays on the landing they were on.

import { seeded } from '../../../../lib/seeded';
import { clearDoorway, createDoors, passable, stepDoors } from './doors';
import { buildLayout } from './layout';
import { STATIONS } from './stations';
import { createBody, stepBody } from './walker';

export const STEP = 1 / 30;
const MOST = 4; // steps a frame at most: a tab coming back after seconds doesn’t run the station on for them
const RIDE = 3; // seconds a lift ride takes, doors shut
const TURN = 10; // radians a second you turn to the way you walk
const REACH = 2.2; // how near a door you must be to be refused by it (doors.js opens within this)
const UNDER = 0.5; // how far under its floor a body still counts as in a room (as layout.js)
const TALL = 1.8; // a body’s height when it doesn’t say
const EPS = 1e-9;
const HEROES = ['luke', 'han', 'leia', 'obiwan'];
// what each comes aboard with: Han his own pistol; Luke and Leia a trooper’s
// rifle, as they had it aboard; Obi-Wan a lightsaber, which isn’t a gun
const GUNS = { luke: 'e11', han: 'dl44', leia: 'e11', obiwan: null, stormtrooper: 'e11' };
// what a door that won’t open says, by its lock
const REFUSALS = { 'side:imperial': 'Imperial personnel only', scomp: 'Locked from the station’s computer', code: 'Locked with a code', flag: 'Sealed' };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function ticksFor(dt, left = 0) {
  const acc = Math.max(0, dt) + Math.max(0, left);
  const n = Math.floor(acc / STEP + 1e-9);
  if (n > MOST) return { ticks: MOST, left: 0 };
  return { ticks: n, left: Math.max(0, acc - n * STEP) };
}

// a station’s layout, made once (it is never changed, and the walker files its walls by it)
const layouts = new Map();
function layoutOf(id) {
  if (!layouts.has(id)) layouts.set(id, buildLayout(STATIONS[id]));
  return layouts.get(id);
}

export function newGame({ station = 'ds1', side = 'rebel', mode = 'story', hero, seed = 1, save } = {}) {
  const id = station in STATIONS ? station : 'ds1';
  const layout = layoutOf(id);
  const own = side === 'imperial' ? 'imperial' : 'rebel';
  const who = own === 'imperial' ? 'stormtrooper' : HEROES.includes(hero) ? hero : 'luke';
  const armour = own === 'imperial';
  const start = layout.station.starts[own];
  const body = createBody({ x: start.x, y: layout.floorAt(start.room, start.x, start.z) ?? layout.rooms.get(start.room).y, z: start.z, yaw: start.yaw ?? 0, room: start.room });
  const you = Object.assign(body, { side: own, hero: who, hp: 100, gun: GUNS[who], heat: 0, armour, helmet: armour, pitch: 0 });
  const g = {
    station: id,
    side: own,
    mode: mode === 'roam' ? 'roam' : 'story',
    layout,
    doors: createDoors(layout),
    you,
    bodies: [],
    // the freighter’s ramp is down from the start, so the hold’s hatch opens
    flags: new Set(['ramp']),
    seen: new Set(),
    lift: null,
    time: 0,
    events: [],
    rand: seeded(seed),
    // the story step the save picks this side’s story up at
    story: save?.[id]?.story?.[own] ?? null,
  };
  for (const room of save?.[id]?.seen ?? []) if (layout.rooms.has(room)) g.seen.add(room);
  g.seen.add(you.room);
  return g;
}

export function drain(g) {
  const out = g.events;
  g.events = [];
  return out;
}

// ── you ──

// Aiming or firing you face the camera’s way at once; walking you turn
// towards where you walk, quickly but not in a snap, so a figure seen from
// behind turns rather than flicks.
function face(you, input, dt) {
  if (Number.isFinite(input.pitch)) you.pitch = input.pitch;
  if ((input.aim || input.fire) && Number.isFinite(input.yaw)) {
    you.yaw = wrap(input.yaw);
    return;
  }
  const d = input.dir;
  if (!d || Math.hypot(d.x, d.z) < 1e-3) return;
  const turn = wrap(Math.atan2(d.x, -d.z) - you.yaw);
  const most = TURN * dt;
  you.yaw = wrap(you.yaw + Math.max(-most, Math.min(most, turn)));
}

export function teleport(g, where, x, z, yaw) {
  const spot = g.layout.rooms.has(where) ? null : g.layout.station.spots?.[where];
  const id = spot ? spot.room : where;
  const room = g.layout.rooms.get(id);
  if (!room) return false;
  const you = g.you;
  const px = x ?? spot?.x ?? room.x;
  const pz = z ?? spot?.z ?? room.z;
  const floor = g.layout.floorAt(id, px, pz);
  Object.assign(you, { x: px, y: floor ?? room.y, z: pz, vy: 0, ground: floor !== null });
  const turn = yaw ?? spot?.yaw;
  if (Number.isFinite(turn)) you.yaw = turn;
  // a void (the magnetic field) is no safe place: you fall from it to the last one
  if (floor !== null) Object.assign(you.safe, { x: px, y: floor, z: pz, room: id });
  if (you.room !== id) g.events.push({ type: 'room', from: you.room, to: id });
  you.room = id;
  g.seen.add(id);
  return true;
}

// ── lifts ──

// the ride from the car you stand in to the lift’s next stop, or null out of a car
function rideFrom(g) {
  if (g.layout.rooms.get(g.you.room)?.kind !== 'lift') return null;
  for (const lift of g.layout.lifts.values()) {
    const stops = (lift.stops ?? []).filter((id) => g.layout.rooms.has(id));
    const i = stops.indexOf(g.you.room);
    if (i >= 0 && stops.length > 1) return { id: lift.id, from: stops[i], to: stops[(i + 1) % stops.length] };
  }
  return null;
}

function inGap(door, b) {
  if (b.y >= door.y + door.h || b.y + (b.h ?? TALL) <= door.y) return false;
  const [along, across] = door.axis === 'x' ? ['x', 'z'] : ['z', 'x'];
  const past = Math.max(0, Math.abs(b[along] - door[along]) - door.w / 2);
  return Math.hypot(b[across] - door[across], past) < b.r;
}

const wholly = (room, b) => b.x - b.r >= room.box.x0 && b.x + b.r <= room.box.x1 && b.z - b.r >= room.box.z0 && b.z + b.r <= room.box.z1 && b.y >= room.y - UNDER && b.y <= room.y + room.h;

// The cars’ doors held shut for the ride, through doors.js’s seal (which a
// sliding door, as every car’s is, keeps until it is lifted); a door with
// someone in its gap is let go instead, so it never shuts on them.
function holdCars(g, bodies) {
  const held = new Set();
  if (!g.lift) return held;
  for (const car of [g.lift.from, g.lift.to]) {
    for (const id of g.layout.rooms.get(car)?.doors ?? []) {
      const door = g.layout.doors.get(id);
      const hold = !bodies.some((b) => inGap(door, b));
      g.doors[id].sealed = hold;
      if (hold) held.add(id);
    }
  }
  return held;
}

function arrive(g, bodies) {
  const { id, from, to } = g.lift;
  const a = g.layout.rooms.get(from);
  const b = g.layout.rooms.get(to);
  const [dx, dy, dz] = [b.x - a.x, b.y - a.y, b.z - a.z];
  for (const body of bodies) {
    if (!wholly(a, body)) continue;
    body.x += dx;
    body.y += dy;
    body.z += dz;
    // (the walker would take a move of 36 m down for a fall)
    if (body.safe) Object.assign(body.safe, { x: body.x, y: body.y, z: body.z, room: to });
    if (body === g.you && body.room !== to) g.events.push({ type: 'room', from: body.room, to });
    body.room = to;
  }
  if (g.you.room === to) g.seen.add(to);
  for (const car of [a, b]) for (const door of car.doors) g.doors[door].sealed = false;
  g.lift = null;
  g.events.push({ type: 'lift', what: 'arrive', id, from, to });
}

// ── a step ──

export function step(g, input = {}, dt = STEP) {
  const { you, layout, doors } = g;
  g.time += dt;
  face(you, input, dt);
  if (input.helmet && you.armour) {
    you.helmet = !you.helmet;
    g.events.push({ type: 'helmet', on: you.helmet });
  }
  if (input.use && !g.lift) {
    const ride = rideFrom(g);
    if (ride) {
      g.lift = { ...ride, t: 0 };
      g.events.push({ type: 'lift', what: 'leave', ...ride });
    }
  }

  const bodies = [you, ...g.bodies];
  const held = holdCars(g, bodies);
  // the people aboard are the Empire’s unless they say; a Rebel in armour and helmet passes for one
  const near = bodies.map((b) => ({ x: b.x, y: b.y, z: b.z, side: b.side ?? 'imperial', disguised: Boolean(b.armour && b.helmet) }));
  for (const e of stepDoors(doors, layout, dt, { near, flags: g.flags })) {
    // (a car holding its doors for a ride refuses nobody)
    if (!(e.type === 'denied' && held.has(e.door))) g.events.push({ type: 'door', what: e.type, door: e.door });
  }
  clearDoorway(doors, layout, bodies);

  const open = (id) => passable(doors, id);
  for (const e of stepBody(you, { dir: input.dir, run: input.run, jump: input.jump, crouch: input.crouch }, dt, { layout, open })) {
    g.events.push(e);
    if (e.type === 'room') g.seen.add(e.to);
  }

  if (g.lift) {
    g.lift.t += dt;
    if (g.lift.t >= RIDE - EPS) arrive(g, bodies);
  }
}

// ── what E does here ──

function refusal(g) {
  const you = g.you;
  for (const door of g.layout.doors.values()) {
    const s = g.doors[door.id];
    if (!s?.denied || s.want || Math.hypot(you.x - door.x, you.z - door.z) > REACH || Math.abs(you.y - door.y) > door.h) continue;
    if (s.sealed) return 'Sealed';
    const lock = door.lock ?? '';
    return REFUSALS[lock] ?? REFUSALS[lock.split(':')[0]] ?? 'Shut fast';
  }
  return null;
}

export function promptOf(g) {
  const { you, layout } = g;
  if (g.lift && (g.lift.from === you.room || g.lift.to === you.room)) {
    return { text: `On the way to ${layout.station.sections[layout.rooms.get(g.lift.to).section] ?? 'the next level'}`, use: false };
  }
  const ride = g.lift ? null : rideFrom(g);
  if (ride) {
    const [a, b] = [layout.rooms.get(ride.from), layout.rooms.get(ride.to)];
    const way = b.y < a.y ? ' down' : b.y > a.y ? ' up' : '';
    return { text: `take the lift${way} to ${layout.station.sections[b.section] ?? b.name}`, use: true };
  }
  const no = refusal(g);
  return no ? { text: no, use: false } : null;
}
