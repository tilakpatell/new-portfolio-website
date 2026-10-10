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
//     and the rest of the station’s: { type: 'say', who, name, text } | 'shot' | 'hit' | 'hurt' | 'impact'
//       | 'deflect' | 'swing' | 'vented' | 'down' | 'alert' { section, level } | 'scene' { id } | 'music'
//       | 'achievement' { id } | 'storyEnd' | 'roar' | 'choked' | 'broke' | the eggs’ own events
//   drain(g) → events          what happened since the last drain
//   teleport(g, where, x?, z?, yaw?) → bool   you to a room (its middle unless told) or a named spot
//   promptOf(g) → null | { text, use }   what E does where you stand (`use: true`), or a notice
//     with no key: a door that won’t open for you, a lift on its way
//
// Everyone else aboard is the crew (brains.js): the garrison each room
// keeps (play/garrison.js) and whoever the story brings. Each step runs, in
// order: the doors, you, the crew, the bolts (play/battle.js), the alarm,
// the disguise, the story (play/plot.js) and the eggs; E and the lines you
// pick go through play/act.js. Far-off people sleep where they stand until
// you come within three doors of them, or a fight wakes them.
//
// A lift is its cars, one a stop, each a room of its own on its level.
// Use in a car rides it to the lift’s next stop (round to the first from
// the last): both cars’ doors close, unless someone stands in a doorway,
// whom they never close on; 3 s pass; everyone wholly inside the car
// moves by the offset between the two cars, keeping where they stood in
// it; and the doors are let go, to open for whoever is near. Anyone half
// out stays on the landing they were on.

import { seeded } from '../../../../lib/seeded';
import { createAlarm, levelOf, lockdowns, raise, stepAlarm } from './alarm';
import { stepBreach } from './breach';
import { addPerson, createCrew, stepCrew } from './brains';
import { createCombat, fire } from './combat';
import { doubtStep, disguised, FRESH } from './disguise';
import { clearDoorway, createDoors, passable, stepDoors } from './doors';
import { eggsOn } from './eggs';
import { furnish } from './furnish';
import { CAST } from './cast';
import { buildLayout, offTags } from './layout';
import { createNav } from './nav';
import { act, battle, duel, garrison, plot } from './play';
import { ESCORT } from './story';
import { STATIONS } from './stations';
import { WHO } from './talk';
import { BODY, createBody, stepBody } from './walker';

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
const GUNS = { luke: 'e11', han: 'dl44', leia: 'e11', obiwan: null, stormtrooper: 'e11', dstrooper: 'e11' };
// the game’s own flags, which a story’s checkpoint keeps: the freighter’s ramp is down from the start
const KEEP = ['ramp'];
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
  const who = own === 'imperial' ? (id === 'ds2' ? 'dstrooper' : 'stormtrooper') : HEROES.includes(hero) ? hero : 'luke';
  const armour = own === 'imperial';
  const start = layout.station.starts[own];
  const body = createBody({ x: start.x, y: layout.floorAt(start.room, start.x, start.z) ?? layout.rooms.get(start.room).y, z: start.z, yaw: start.yaw ?? 0, room: start.room });
  const you = Object.assign(body, { id: 'you', side: own, hero: who, hp: 100, max: 100, gun: who in GUNS ? GUNS[who] : 'e11', blade: who === 'obiwan' ? 'blue' : null, heat: 0, armour, helmet: armour, pitch: 0, doubt: FRESH });
  const rand = seeded(seed);
  const nav = createNav(layout);
  const g = {
    station: id,
    side: own,
    mode: mode === 'roam' ? 'roam' : 'story',
    layout,
    nav,
    doors: createDoors(layout),
    you,
    bodies: [],
    // the freighter’s ramp is down from the start, so the hold’s hatch opens
    flags: new Set(KEEP),
    keep: KEEP,
    seen: new Set(),
    lift: null,
    time: 0,
    events: [],
    rand,
    combat: createCombat(),
    alarm: createAlarm(layout.station),
    items: new Set(),
    eggs: new Set(save?.[id]?.eggs ?? []),
    doubt: FRESH,
    talk: null,
    scene: null,
    furnished: new Map(),
    plot: null,
  };
  g.solidsOf = (room) => furnishedOf(g, room).solids;
  g.crew = createCrew({ rand, layout, nav, solidsOf: g.solidsOf });
  g.teleport = (where, x, z, yaw) => teleport(g, where, x, z, yaw);
  for (const room of save?.[id]?.seen ?? []) if (layout.rooms.has(room)) g.seen.add(room);
  g.seen.add(you.room);
  // the story’s own people where it brings them; the garrison everywhere else
  const story = g.mode === 'story' ? plot.startPlot : null;
  for (const p of garrison(layout, { side: own, skip: g.mode === 'story' ? storyRooms(g) : new Set() })) addPerson(g.crew, p);
  story?.(g, save?.[id]?.story?.[own] ?? null);
  return g;
}

// what a room has standing in it, worked out once
function furnishedOf(g, room) {
  if (!g.furnished.has(room)) {
    const r = g.layout.rooms.get(room);
    g.furnished.set(room, r ? furnish(r, g.layout.station) : { solids: [], props: [], spots: [] });
  }
  return g.furnished.get(room);
}

// the rooms a side’s story brings people into, which the garrison leaves to it
function storyRooms(g) {
  const out = new Set();
  const spots = g.layout.station.spots ?? {};
  for (const s of Object.values(plot.storySteps(g))) {
    for (const e of [...(s.start ?? []), ...(s.end ?? [])]) if (e.spawn && spots[e.spawn.spot]) out.add(spots[e.spawn.spot].room);
  }
  return out;
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
  // (where the camera looks, which E reaches along: act.js)
  if (Number.isFinite(input.yaw)) you.look = wrap(input.yaw);
  if ((input.aim || input.fire) && Number.isFinite(input.yaw)) {
    you.yaw = wrap(input.yaw);
    return;
  }
  const d = input.dir;
  if (!d || Math.hypot(d.x, d.z) < 1e-3) {
    // standing: a glance turns only the head; a look well round turns you all the way to it
    if (!Number.isFinite(input.yaw)) return;
    const off = wrap(input.yaw - you.yaw);
    if (Math.abs(off) > LOOK_ROUND) you.turning = true;
    if (!you.turning) return;
    const most = TURN_STANDING * dt;
    you.yaw = wrap(you.yaw + Math.max(-most, Math.min(most, off)));
    if (Math.abs(wrap(input.yaw - you.yaw)) < 0.02) you.turning = false;
    return;
  }
  you.turning = false;
  const turn = wrap(Math.atan2(d.x, -d.z) - you.yaw);
  const most = TURN * dt;
  you.yaw = wrap(you.yaw + Math.max(-most, Math.min(most, turn)));
}
const LOOK_ROUND = 1.0; // radians the look may stray from where you face before you turn to it
const TURN_STANDING = 5; // radians a second you turn on the spot

export function teleport(g, where, x, z, yaw) {
  const spot = g.layout.rooms.has(where) ? null : g.layout.station.spots?.[where];
  const id = spot ? spot.room : where;
  const room = g.layout.rooms.get(id);
  if (!room) return false;
  const you = g.you;
  // (out of any seat: wherever you are put, you stand there)
  you.seat = null;
  const { x: px, z: pz } = standAt(g, id, x ?? spot?.x ?? room.x, z ?? spot?.z ?? room.z);
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

// The nearest place to (x, z) in the room a body can stand: on its floor and
// clear of its furniture (a room's middle is often its table). Rings out
// from the point, half a metre at a time; the point itself when nothing
// near is clear.
const ROOMY = BODY.r + 0.05;
function standAt(g, id, x, z) {
  const solids = g.solidsOf?.(id) ?? [];
  const clear = (px, pz) =>
    g.layout.floorAt(id, px, pz) !== null &&
    !solids.some((s) => (s.box ? px > s.box.x0 - ROOMY && px < s.box.x1 + ROOMY && pz > s.box.z0 - ROOMY && pz < s.box.z1 + ROOMY : s.circle && Math.hypot(px - s.circle.x, pz - s.circle.z) < s.circle.r + ROOMY));
  if (clear(x, z)) return { x, z };
  for (let r = 0.5; r <= 8; r += 0.5) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const [px, pz] = [x + Math.sin(a) * r, z - Math.cos(a) * r];
      if (clear(px, pz)) return { x: px, z: pz };
    }
  }
  return { x, z };
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

const NEAR = 3; // doors from you within which people are awake
const SPOT = 1.6; // metres from a named spot that count as at it
const FORCE_GAP = 3; // seconds between uses of the Force
const TRICK = "These aren’t the droids you’re looking for.";
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const pos = (b) => ({ x: b.x, y: b.y, z: b.z });
const nameOf = (kind) => WHO[kind] ?? CAST[kind]?.name ?? kind;

// the rooms within NEAR doors of a room, worked out once for each
function nearRooms(g, from) {
  g.nearby ??= new Map();
  if (!g.nearby.has(from)) {
    const seen = new Set([from]);
    let edge = [from];
    for (let k = 0; k < NEAR; k++) {
      const next = [];
      for (const id of edge) {
        for (const d of g.layout.rooms.get(id)?.doors ?? []) {
          const door = g.layout.doors.get(d);
          const other = door.a === id ? door.b : door.a;
          if (!seen.has(other)) seen.add(other), next.push(other);
        }
      }
      edge = next;
    }
    g.nearby.set(from, seen);
  }
  return g.nearby.get(from);
}

const BUSY = new Set(['fight', 'search', 'flee', 'scripted']);
const awake = (g, p) => !p.hidden && (BUSY.has(p.mode) || p.tag?.startsWith('with:') || nearRooms(g, g.you.room).has(p.room));

function currentStep(g) {
  if (!g.plot || g.plot.done) return null;
  return g.plot.story.steps.find((s) => s.id === g.plot.progress.step) ?? null;
}

// lying low: crouched and still through a story’s hide or still step, nobody sees you
function hidden(g, input) {
  const s = currentStep(g);
  return Boolean(s && (s.type === 'hide' || s.type === 'still') && input.crouch && g.still > 0.2);
}

function roar(g, stims) {
  const chewie = g.crew.people.find((p) => p.kind === 'chewie' && p.hp > 0 && flat(p, g.you) < 12);
  const at = pos(chewie ?? g.you);
  stims.push({ type: 'roar', at });
  g.events.push({ type: 'roar', at });
}

// a Jedi’s Force: guards close by talked round, or a noise down the corridor to draw them off
function force(g, input, stims) {
  const you = g.you;
  if (you.hero !== 'obiwan' && !g.items.has('saber')) return;
  if (g.time - (g.forcedAt ?? -Infinity) < FORCE_GAP) return;
  g.forcedAt = g.time;
  const near = g.crew.people.filter((p) => p.hp > 0 && p.side === 'imperial' && flat(p, you) < 4).sort((a, b) => flat(a, you) - flat(b, you)).slice(0, 2);
  if (near.length) {
    for (const p of near) stims.push({ type: 'trick', id: p.id, s: 8, line: TRICK });
    g.events.push({ type: 'trick', count: near.length });
    g.events.push({ type: 'say', who: you.hero, name: nameOf(you.hero), text: TRICK });
    return;
  }
  const yaw = Number.isFinite(input.yaw) ? input.yaw : you.yaw;
  const at = { x: you.x + Math.sin(yaw) * 10, y: you.y, z: you.z - Math.cos(yaw) * 10 };
  stims.push({ type: 'noise', at, heard: true });
  g.events.push({ type: 'noise', at });
}

function disguise(g, input, watched, moved, dt) {
  const you = g.you;
  if (!disguised(you)) return;
  const room = g.layout.rooms.get(you.room);
  const chewie = g.crew.people.some((p) => p.kind === 'chewie' && p.hp > 0 && flat(p, you) < 6);
  const ctx = {
    armour: you.armour,
    helmet: you.helmet,
    running: Boolean(input.run) && moved > 0.05,
    shooting: Boolean(g.fired),
    restricted: Boolean(room?.restricted),
    escorting: chewie,
    ordered: g.flags.has('transfer'),
    officerAt: watched?.officerAt ?? null,
    watchers: watched?.watchers ?? 0,
    tk: g.flags.has('tk421') ? 421 : undefined,
  };
  const blownBefore = g.doubt >= 1;
  const r = doubtStep(g.doubt, ctx, dt);
  g.doubt = r.doubt;
  you.doubt = r.doubt;
  if (r.says) g.events.push({ type: 'say', who: 'officer', name: nameOf('officer'), text: r.says.text, key: r.says.key });
  if (r.blown && !blownBefore) {
    if (room) raise(g.alarm, room.section, 'seen', pos(you), g.time);
    g.events.push({ type: 'blown' });
    plot.feedPlot(g, { type: 'caught' });
  }
}

// where you are, told to the story: a new room, a named spot reached, how long you have kept still
function storyEvents(g, was) {
  if (!g.plot || g.plot.done) return;
  const you = g.you;
  const near = g.crew.people.filter((p) => p.hp > 0 && flat(p, you) <= ESCORT);
  const withYou = [...new Set(near.flatMap((p) => [p.kind, p.tag, p.tag?.startsWith('with:') ? p.tag.slice(5) : null].filter(Boolean)))];
  let spot = null;
  for (const [name, s] of Object.entries(g.layout.station.spots ?? {})) {
    if (s.room === you.room && flat(s, you) <= SPOT && (!spot || flat(s, you) < flat(g.layout.station.spots[spot], you))) spot = name;
  }
  // told on arriving, and again while you wait there as whoever is with you changes (an escort
  // done once the one you walk with comes up, though you came first)
  const company = withYou.join(' ');
  if (you.room !== was.room || spot !== g.atSpot || (spot && company !== g.atWith)) {
    g.atSpot = spot;
    g.atWith = company;
    plot.feedPlot(g, { type: 'at', room: you.room, spot, with: withYou });
  }
  if (g.still > 0) plot.feedPlot(g, { type: 'still', seconds: g.still });
}

// Sat down (act.js): held in the seat, facing the way it faces. A key that walks, aims or fires
// stands you up in front of it, and so do a hurt, a scene, a lift and the Emperor's grip.
function seated(g, input) {
  const { you } = g;
  const s = you.seat;
  const d = input.dir;
  if ((d && Math.hypot(d.x, d.z) > 0.1) || input.jump || input.aim || input.fire || you.hp < s.hp || g.scene || g.lift || duel.gripped(g)) {
    act.standUp(g);
    return;
  }
  Object.assign(you, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, vy: 0, ground: true });
}

// While a story's scene plays you watch it: no walking, shooting, using or talking; the look stays yours
const watching = (input) => ({ dir: { x: 0, z: 0 }, yaw: input.yaw, pitch: input.pitch });

export function step(g, input = {}, dt = STEP) {
  const { you, layout, doors } = g;
  if (g.scene) input = watching(input);
  g.time += dt;
  g.fired = false;
  const mark = g.events.length;
  face(you, input, dt);
  if (you.seat) seated(g, input);
  if (input.helmet && you.armour) {
    you.helmet = !you.helmet;
    g.events.push({ type: 'helmet', on: you.helmet });
  }
  // E and the number keys: a line picked, someone talked to, a thing used, a lift called
  if (Number.isInteger(input.choice) && g.talk) act.chooseHere(g, input.choice);
  else if (input.use && !act.useHere(g) && !g.lift) {
    const ride = rideFrom(g);
    if (ride) {
      g.lift = { ...ride, t: 0 };
      g.events.push({ type: 'lift', what: 'leave', ...ride });
    }
  }
  act.openStoryTalk(g);

  // a floor a story draws back (the chasm’s bridge) answers to open() as `floor:<tag>`
  const off = offTags(layout, g.flags);
  const open = (id) => (id.startsWith('floor:') ? off.has(id.slice(6)) : passable(doors, id));
  const people = g.crew.people.filter((p) => p.hp > 0);
  const bodies = [you, ...g.bodies, ...people];
  const held = holdCars(g, bodies);
  // the people aboard are the Empire’s unless they say; a Rebel in armour and helmet passes for one
  // (one who walks with you opens what you may open: your prisoner through the doors your armour does)
  const yours = you.side === 'imperial' || Boolean(you.armour && you.helmet);
  const near = bodies.map((b) => ({ x: b.x, y: b.y, z: b.z, side: b.side ?? 'imperial', disguised: Boolean(b.armour && b.helmet) || (yours && Boolean(b.tag?.startsWith('with:'))) }));
  for (const e of stepDoors(doors, layout, dt, { near, flags: g.flags, lockdown: lockdowns(g.alarm) })) {
    // (a car holding its doors for a ride refuses nobody)
    if (!(e.type === 'denied' && held.has(e.door))) g.events.push({ type: 'door', what: e.type, door: e.door });
  }
  clearDoorway(doors, layout, bodies);

  // you, standing still while a talk is open
  const was = { x: you.x, z: you.z, room: you.room };
  // (holding your father up, you walk; in a grip, nothing; thrown by a push, you go the way it threw you)
  // (the jump's buffer and coyote time are walker.js's: the press is passed on as it came)
  const walk = g.talk || duel.gripped(g) ? {} : plot.held(g, { dir: input.dir, run: input.run, jump: input.jump, crouch: input.crouch });
  const shove = duel.shoveOf(g, dt);
  for (const w of you.seat ? [] : shove ? [walk, { dir: shove, run: true }] : [walk]) {
    for (const e of stepBody(you, w, dt, { layout, open, solids: g.solidsOf(you.room) })) {
      g.events.push(e);
      if (e.type === 'room') g.seen.add(e.to);
    }
  }
  const moved = Math.hypot(you.x - was.x, you.z - was.z);
  g.still = moved < 0.01 ? (g.still ?? 0) + dt : 0;
  if (!g.talk) battle.fireYou(g, input);

  // the crew
  const stims = [];
  if (walk.run && moved > 0.05) stims.push({ type: 'steps', at: pos(you), from: 'you' });
  if (input.roar) roar(g, stims);
  if (input.alt) force(g, input, stims);
  let watched = null;
  const seenBy = hidden(g, input) ? null : you;
  // through a hide or a still, those with you lie low as well
  const lying = ['hide', 'still'].includes(currentStep(g)?.type);
  for (const p of g.crew.people) if (p.tag?.startsWith('with:')) p.hidden = lying;
  for (const e of stepCrew(g.crew, dt, { you: seenBy, alarm: g.alarm, doors, combat: g.combat, flags: g.flags, now: g.time, open, stims, awake: (p) => awake(g, p), talking: g.talk?.npc ?? null })) {
    if (e.type === 'call') raise(g.alarm, e.section, e.how, e.at, g.time);
    else if (e.type === 'shoot') {
      if (fire(g.combat, e, g.rand)) g.events.push({ type: 'shot', by: e.owner, weapon: e.weapon, at: e.from });
    } else if (e.type === 'say') g.events.push({ type: 'say', who: e.kind, name: nameOf(e.kind), text: e.text, id: e.id, key: e.key });
    else if (e.type === 'challenge') watched = e;
    else {
      g.events.push(e);
      if (e.type === 'died') plot.feedPlot(g, { type: 'killed', kind: e.kind, tag: e.tag });
      if (e.type === 'saw' && e.target === 'you' && currentStep(g)?.type === 'hide') plot.feedPlot(g, { type: 'caught' });
    }
  }

  plot.holdUp(g, moved);
  battle.stepBattle(g, dt, open, { guard: Boolean(you.blade && input.aim) });
  // (the jump key dodges a blade; its buffer and coyote time are the walker's, not the duel's)
  if (!g.talk && !g.scene) duel.duelStep(g, { ...input, dodge: input.jump }, dt);
  const quake = stepBreach(g, dt);
  if (quake) g.events.push(quake);

  for (const e of stepAlarm(g.alarm, dt, g.time)) {
    if (e.type === 'intercom') g.events.push({ type: 'say', who: 'intercom', name: 'Intercom', text: e.text, key: e.key });
    else g.events.push({ type: 'alert', section: e.section, level: e.level });
  }
  disguise(g, input, watched, moved, dt);

  storyEvents(g, was);
  plot.stepPlot(g, dt);

  if (g.lift) {
    g.lift.t += dt;
    if (g.lift.t >= RIDE - EPS) arrive(g, bodies);
  }

  // every event of the step handed to the eggs, which may find one
  for (let i = mark; i < g.events.length; i++) {
    for (const egg of eggsOn(g.eggs, g.events[i], g)) {
      g.events.push({ type: 'achievement', id: `ds-${egg}` });
      g.events.push({ type: 'egg', id: egg });
    }
  }
}

// the section you stand in and how alarmed it is, for the HUD
export function alertOf(g) {
  const room = g.layout.rooms.get(g.you.room);
  if (!room) return null;
  return { section: room.section, name: g.layout.station.sections[room.section] ?? room.section, level: levelOf(g.alarm, room.section) ?? 'calm' };
}

// what the HUD shows as the objective: the story’s step, or nothing in free roam
export function objectiveOf(g) {
  const s = currentStep(g);
  return s ? s.text : g.plot?.done ? 'The story is over. The station is yours to walk.' : null;
}

// ── what E does here ──

function refusal(g) {
  const you = g.you;
  for (const door of g.layout.doors.values()) {
    const s = g.doors[door.id];
    if (!s?.denied || s.want || Math.hypot(you.x - door.x, you.z - door.z) > REACH || Math.abs(you.y - door.y) > door.h) continue;
    if (s.sealed) return 'Sealed';
    const lock = door.lock ?? '';
    // (in free roam a Rebel's way through is the station's own computer: say where it is)
    if (lock === 'side:imperial' && !g.plot && g.layout.station.spots?.scomp) return 'Imperial personnel only: a scomp link would open it';
    return REFUSALS[lock] ?? REFUSALS[lock.split(':')[0]] ?? 'Shut fast';
  }
  return null;
}

export function promptOf(g) {
  const { you, layout } = g;
  if (g.talk) return null;
  if (g.lift && (g.lift.from === you.room || g.lift.to === you.room)) {
    return { text: `On the way to ${layout.station.sections[layout.rooms.get(g.lift.to).section] ?? 'the next level'}`, use: false };
  }
  const ride = g.lift ? null : rideFrom(g);
  if (ride) {
    const [a, b] = [layout.rooms.get(ride.from), layout.rooms.get(ride.to)];
    const way = b.y < a.y ? ' down' : b.y > a.y ? ' up' : '';
    return { text: `take the lift${way} to ${layout.station.sections[b.section] ?? b.name}`, use: true };
  }
  const here = act.useText(act.reachable(g));
  if (here) return { text: here, use: true };
  const no = refusal(g);
  return no ? { text: no, use: false } : null;
}
