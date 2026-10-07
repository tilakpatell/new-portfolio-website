// The ship on the universe map, as plain numbers: where it is, which way it
// points, how fast it goes, and one step of flying it. Pure (no three.js),
// so it's tested in Node; the scene copies the numbers onto the model and
// the camera.
//
// It flies like a starfighter (Battlefront's): free all the way round. Which
// way it points is `heading`, `pitch` and `bank` (orient.js: 'YXZ' angles,
// heading 0 the nose down −z, growing turning left; pitch the nose up; bank
// the roll to the right), and it turns about its own three axes: the nose
// left and right (`turn`), up and down (`climb`, nose up +) and the roll
// about it (`roll`, right +), each in the ship's own frame, so it loops,
// rolls and flies upside down, and "up" on the stick is always up on the
// screen. Input is { throttle: −1…1, turn, climb, roll: −1…1, boost, and
// the visitor's sensitivity: turnRate, pitchRate, rollRate and level (1 as
// it comes: controls.js), and `tune`, what the parts fitted in the hangar
// do (outfit.js's statsOf: boost, accel, cruise, agility and level, each 1
// as it comes) }. Each turn has a little inertia (`rate`,
// `tipRate`, `rollRate`, radians a second, easing toward what the stick
// asks), so it rolls into and out of everything rather than snapping, and
// all of it is slower the faster it goes. Let go of the roll and the nose
// and it rolls itself back upright (as quickly as `level` says; 0, never).
// It flies along its nose, so pointed up it climbs and pointed down it
// dives, faster the faster it goes; turning, it leans into the turn
// (`lean`, for the model and the camera only). It coasts to a stop, can't
// go through a planet (it bounces off) and is turned back at the edge of
// the map; near the ceiling or the floor (SHIP.ceiling above or below the
// disc) the nose comes round level in time for the speed it has, and past
// them it's eased back in.
//
// Between the places (deep.js) it opens up: the boost becomes a pulse drive
// (up to SHIP.pulse, easing back as it comes up on any place, so it never
// arrives at a planet at pulse speed, but not for one it's only flying past:
// deep.js's driveOpen; and cut to the boost while hunters have it
// interdicted, `input.interdicted`: true, or how far, 0 … 1, as a battle
// holds it coming in to the fight), the brakes and the
// coasting bite harder to match, the ceiling lifts to DEEP.ceiling out of
// the home system, and the wonders out there are as solid as the planets,
// and places the autopilot can take you (GOALS: every planet and station,
// and every wonder, the nebulae too). All but the black hole, which
// swallows: touch it at any speed and that's a crash, with no bounce (the
// scene plays out the fall, and the page goes on to what's beyond it). The
// Death Star's trench lets the ship down into it, all the way round.
//
// Super speed (the nav map's, nav.js): `input.overdrive` (up to OVERDRIVE)
// pushes the pulse drive past itself, that many times as fast as far as the
// drive is open where the ship is, with the brakes, the coasting and the
// pulse drive's push that many squared as hard, so it stops in the same room
// it would have and still comes up on every place at the boost. The
// autopilot flies it (its `od`); hunters' interdiction cuts it like the rest.
// Past the pulse drive's speed with no overdrive left (the pilot took the
// stick), it falls back as hard as it's over, so it drops out of super speed
// in a second or so rather than sailing on. Over what the drive allows
// anywhere it's eased down onto it (SHIP.settle), never braked at a flat
// rate into a wall.

import { DEEP, DEEP_SOLIDS, WONDERS, driveOpen, easeOpen, gapAlong, openness, reachOf, trenchBand } from './deep';
import { HOME_RADIUS, MAP_RADIUS, ORDER, POSITIONS, REACH, SUN } from './layout';
import { MAW } from './maw';
import { NOSE, UP, axisAngle, conj, fromAngles, mul, normalize, rotate, toAngles, turnToward } from './orient';
import { byId } from './universes';
import { sunFor } from './lighting';

export const SHIP = {
  cruise: 5.5, // map units a second (the ship is 0.26 long)
  boost: 20,
  pulse: 420, // the boost out in the open
  pulseAccel: 170, // map units a second, a second, getting up to it
  drop: 470, // the hardest it falls back to what the drive allows, when it's well over it (and harder past the pulse drive: out of super speed)
  settle: 3, // and short of that, how quickly it eases down onto it: the speed it's over by, this many times a second (and a little more, so it gets there)
  reverse: 2,
  accel: 5.5,
  brake: 11,
  coast: 2.4,
  turn: 2.0, // radians a second the nose swings left or right, at cruise and under
  turnFast: 0.6, // of that (and of the pitch and the roll), at boost speed (and a little less again at pulse speed)
  yawEase: 9, // how quickly the turn gets to the rate asked for (a second, roughly a ninth of one)
  pitch: 2.1, // radians a second the nose comes up or down, the stick all the way (a loop in three seconds)
  pitchEase: 8,
  roll: 3.4, // radians a second it rolls over
  rollEase: 10,
  level: 1.8, // radians a second, at most, it rolls itself back upright, let go
  round: 2.2, // radians a second it rounds out at, coming up on the ceiling or the floor
  radius: 0.15,
  height: 0.3, // above a planet's middle, where it parks
  lift: 7, // how quickly it's eased back in from past the ceiling or the floor
  hover: 1.5, // map units a second the autopilot can nudge it up or down, parking
  ceiling: 100, // how far above or below the disc it can go (the big ships' lanes start at 105; the sun's 75 across leaves room to fly over it)
  crash: 2.4, // flying into something faster than this is a crash, not a bump
  approach: 11, // its cruise coming in to a world to land, throttle all the way (approachAt): under what a landing allows, entry.js's ENTRY.fast
};
// super speed: how many times the pulse drive's speed, at most
export const OVERDRIVE = 3;
// how many times as fast the ship goes at a spot `open` (the drive's
// openness there) with `od` of overdrive on: all of it out in the open, and
// half of it at a place, where the drive's down (so it gets in and out of
// one quicker too); its brakes and its push are this squared, so it stops
// in the same room it would have
export const overdriveAt = (open, od) => (od > 1 ? 1 + (od - 1) * (0.5 + 0.5 * open) : 1);
const odBrakes = (space, x, y, z, od) => (od > 1 ? overdriveAt(space.driveAt(x, y, z), od) ** 2 : 1);
export const EDGE = DEEP.edge;
const ORBIT_IN = 8; // past a planet's reach: closer than this, you're at it
const ORBIT_OUT = 14; // and you've left once you're this far
const PARK = 4; // where autopilot stops, past the planet's reach

export const PLANETS = ORDER.map((id) => {
  const u = byId(id);
  const place = { id, at: POSITIONS[id], r: u.size, reach: REACH[id], trench: u.trench };
  const band = trenchBand(place);
  return band ? { ...place, band } : place;
});
const PLANET = Object.fromEntries(PLANETS.map((p) => [p.id, p]));

// How much of the approach speed (SHIP.approach) its cruise has at (x, y, z),
// 0 … 1: all of it from where it parks at a world with air to land in, on
// in, fading out a little further off. The worlds are drawn big (scale.js)
// and parked at past their moons, so at its cruise the last of the way in
// took eight seconds; at the approach it's under five, and flying into the air is
// still a landing.
const LANDS = PLANETS.filter((p) => {
  const u = byId(p.id);
  return u.kind !== 'core' && !u.portal && !u.airless;
});
export function approachAt(x, y, z) {
  let k = 0;
  for (const p of LANDS) {
    const d = Math.sqrt((x - p.at[0]) ** 2 + (y - p.at[1]) ** 2 + (z - p.at[2]) ** 2);
    const t = clamp((d - (p.reach + PARK + 6)) / 30, 0, 1);
    k = Math.max(k, 1 - t * t * (3 - 2 * t));
  }
  return k;
}
// what the ship can't fly through: every planet and station, the sun, and
// the wonders out in deep space
export const SOLIDS = [...PLANETS, { id: 'sun', at: SUN.at, r: SUN.r, reach: SUN.r * 1.4 }, ...DEEP_SOLIDS];
export const isPlace = (id) => Boolean(PLANET[id]);
// where the autopilot can take you: the planets and stations, and out in
// deep space every wonder (a nebula, which isn't solid, is somewhere to fly
// into: its goal is its middle)
export const GOALS = {
  ...Object.fromEntries(DEEP_SOLIDS.filter((o) => !o.part).map((o) => [o.id, o])),
  ...Object.fromEntries(WONDERS.filter((w) => w.solid === false).map((w) => [w.id, { id: w.id, at: w.at, r: w.r, reach: 0, deep: true }])),
  ...PLANET,
};
export const isGoal = (id) => Boolean(GOALS[id]);

// How far the pulse drive has opened up at (x, y, z), 0 … 1, going the way
// `f` points (a unit vector; none: as it would be going straight at the
// nearest thing). Out in deep space, deep.js's driveOpen: down coming up on
// any place, so you arrive at the boost, and open between them and past
// them. The home system's stations are close together, so there it opens
// over HOME_RAMP from each station and the sun (and the ceiling or the floor,
// climbing or diving toward one), the same way, and is down again close by
// one: a hop between two is quick, and still comes up on the next at the
// boost. That gives way to deep space's once well out past the home system
// (by then deep space's is open all the way anyway). (each with how close to
// its surface the drive's all the way down: a station's door, and well clear
// of the sun, which the autopilot goes round)
const HOME_RAMP = 220;
const HOME_BODIES = [...PLANETS.filter((p) => byId(p.id).kind === 'core').map((p) => ({ at: p.at, r: p.r, room: 8 })), { at: SUN.at, r: SUN.r, room: 20 }];
// how much of the home system's own handling there is at (x, z): 1 in it
// and out past it till deep space's drive is open all the way, then easing
// to 0. There the boost gets going harder, and the autopilot comes in to
// park quicker, to match the hops between stations (step, autopilot)
export function homeAt(x, z) {
  const out = (Math.sqrt(x * x + z * z) - DEEP.open) / DEEP.ramp;
  return out <= 0 ? 1 : out >= 1 ? 0 : 1 - out * out * (3 - 2 * out);
}
export function driveAlong(x, y, z, f = null) {
  const o = driveOpen(x, y, z, f);
  const w = homeAt(x, z);
  if (w <= 0) return o;
  // (the home system's ceiling and floor count too, going toward one: it
  // can't go faster than it could come level by them; its gap is how far
  // along the way it's going it would reach it)
  const up = f ? f[1] * (y < 0 ? -1 : 1) : 1;
  let k = up > 0.02 ? easeOpen((ceilingAt(x, z) - Math.abs(y) - 8) / up, HOME_RAMP) : 1;
  for (const b of HOME_BODIES) k = Math.min(k, easeOpen(gapAlong(x, y, z, f, b.at, b.r + b.room), HOME_RAMP));
  return Math.min(o, 1 - w * (1 - k));
}
export const driveAt = (x, y, z) => driveAlong(x, y, z);

// how high it can go at (x, z): the home system's ceiling, lifting to deep
// space's out past it; how fast its boost goes at (x, y, z): the pulse
// drive as far as it's open there (driveAt), the boost where it's down; how
// hard it brakes and coasts there (harder the more it's open, to match the
// speeds)
export function ceilingAt(x, z) {
  const k = clamp((Math.sqrt(x * x + z * z) - DEEP.system) / (DEEP.open - DEEP.system), 0, 1);
  return SHIP.ceiling + (DEEP.ceiling - SHIP.ceiling) * k * k * (3 - 2 * k);
}
// (`boost`, a boost of its own: boosters fitted, which push the boost at home
// harder; the pulse drive out in the open is the same for everyone. `open`,
// how open the drive is, if it's known: the way the ship's going, say)
export const boostAt = (x, y, z, boost = SHIP.boost, open = driveAt(x, y, z)) => boost + (SHIP.pulse - boost) * open;
export const brakeAt = (x, y, z, open = driveAt(x, y, z)) => SHIP.brake * (1 + 14.5 * open);
const coastAt = (x, y, z, open = driveAt(x, y, z)) => SHIP.coast * (1 + 18.5 * open);
// how much of the full turn it has at a speed: all of it up to cruise,
// SHIP.turnFast of it at boost, a little less again at pulse
export const turnAt = (speed) => {
  const v = Math.abs(speed);
  const fast = clamp((v - SHIP.cruise) / (SHIP.boost - SHIP.cruise), 0, 1);
  const pulse = clamp((v - SHIP.boost) / (SHIP.pulse - SHIP.boost), 0, 1);
  return 1 - (1 - SHIP.turnFast) * fast - 0.15 * pulse;
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)); // to −π…π
export const forward = (h) => [-Math.sin(h), -Math.cos(h)];
// the way the ship's nose points (and so the way it's flying), a unit vector
export const noseOf = (s) => rotate(fromAngles(s.heading, s.pitch || 0, s.bank || 0), NOSE);
// the heading that points along (dx, dz)
export const headingTo = (dx, dz) => Math.atan2(-dx, -dz);

// in a place's trench: level with it, and along the stretch of it that's laid
export function inTrench(p, x, y, z) {
  if (!p.band || Math.abs(y - p.at[1]) >= p.band.half) return false;
  if (p.band.arc >= Math.PI) return true; // (all the way round)
  const a = Math.atan2(z - p.at[2], x - p.at[0]);
  return Math.abs(wrap(a - p.band.home)) < p.band.arc;
}

const away = (s, p) => {
  const dx = s.x - p.at[0];
  const dy = (s.y ?? SHIP.height) - p.at[1];
  const dz = s.z - p.at[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

// Parked a little way off a planet, facing it: on a side that's clear of
// the other planets (so being parked there is being at this one), on a
// world's day side, and as near as it can be to the side the ship comes
// from (`from`, or the camera's side of the map). A wonder out in deep space the same, further off (they're
// big), level with its middle. Null for anywhere that isn't a goal.
export function parkAt(id, from = [0, HOME_RADIUS]) {
  const p = GOALS[id];
  if (!p) return null;
  const deep = !PLANET[id];
  // a world is parked at on its day side (lighting.js), so it's seen lit,
  // not a black disc: the rim of it, coming from the night side
  const u = byId(id);
  const sun = !deep && u.kind !== 'core' && !u.portal ? sunFor(id) : null;
  const sl = sun ? Math.hypot(sun[0], sun[2]) || 1 : 1;
  const d = p.reach + (deep ? PARK * 4 : PARK);
  const al = Math.hypot(from[0] - p.at[0], from[1] - p.at[2]) || 1;
  const ax = (from[0] - p.at[0]) / al;
  const az = (from[1] - p.at[2]) / al;
  let best = null;
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const x = p.at[0] + dx * d;
    const z = p.at[2] + dz * d;
    let clear = Infinity;
    for (const o of SOLIDS) if (o !== p) clear = Math.min(clear, Math.sqrt((x - o.at[0]) ** 2 + (z - o.at[2]) ** 2) - o.reach);
    const inMap = Math.sqrt(x * x + z * z) < MAP_RADIUS + 30;
    // (clear of the others: up to 4, less the less clear it is; a spot not quite clear never outscores one that is)
    const day = sun ? (dx * sun[0] + dz * sun[2]) / sl : 0;
    const score = dx * ax + dz * az + (4 * Math.min(clear, ORBIT_IN + 0.2)) / (ORBIT_IN + 0.2) + (inMap ? 2 : 0) + (day >= -1e-9 ? 3 : 0);
    if (!best || score > best.score) best = { score, x, z, heading: headingTo(-dx, -dz) };
  }
  return { x: best.x, y: p.at[1] + (deep ? 0 : SHIP.height), z: best.z, heading: best.heading };
}

// Where a new ship can start with nowhere picked, so the pilots joining
// don't all turn up in one spot (online, on top of each other): round the
// edge of the home system facing its middle, or out in deep space a way off
// one of the fandoms' planets or one of the wonders, facing it. Never by the
// Maw, whose pull would have a new ship before it had flown. Each is { id,
// at, y, d }: what it starts off, the height it starts at, and how far from
// its middle: out past its reach (so it isn't at it yet), and far enough
// back from a big one to see all of it
const startOff = (reach, r) => Math.max(reach * 1.15 + 12, r * 2.4);
export const STARTS = [
  { id: 'sun', at: SUN.at, y: SHIP.height, d: HOME_RADIUS + 1.5 }, // (the home system's middle)
  ...PLANETS.filter((p) => byId(p.id).kind !== 'core').map((p) => ({ id: p.id, at: p.at, y: p.at[1] + SHIP.height, d: startOff(p.reach, p.r) })),
  // (off a wonder: clear of its solid, which can reach past the wonder's own radius: a pulsar's glare)
  ...WONDERS.filter((w) => w.id !== MAW.id).map((w) => ({ id: w.id, at: w.at, y: w.at[1], d: startOff(reachOf(w), w.solid === false ? 0 : (DEEP_SOLIDS.find((o) => o.id === w.id)?.r ?? w.r)) })),
];
// the near edge of the home system, facing its middle: where a ship starts
// unless told otherwise
const HOME_EDGE = { x: 0, y: SHIP.height, z: HOME_RADIUS + 1.5, heading: 0 };

// clear to start at: well inside the edge and the ceiling, out of the Maw's
// pull, and clear of everything solid (and not at any planet or station)
const clearToStart = (x, y, z) =>
  Math.hypot(x, z) < EDGE - 10 &&
  Math.abs(y) < ceilingAt(x, z) - 1 &&
  Math.hypot(x - MAW.at[0], y - MAW.at[1], z - MAW.at[2]) > MAW.reach + 20 &&
  SOLIDS.every((o) => Math.hypot(x - o.at[0], y - o.at[1], z - o.at[2]) > o.reach + (PLANET[o.id] ? ORBIT_OUT : 2));

// A start for a new ship: one of STARTS (`rand` picks which, and from which
// side), level with it and facing it; round to the next side along should
// that one not be clear.
export function startAt(rand = Math.random) {
  const s = STARTS[Math.min(STARTS.length - 1, Math.floor(rand() * STARTS.length))];
  const a0 = rand() * Math.PI * 2;
  // (off a world, on its day side, so the first thing seen is it lit; any
  // side that's clear, should none of those be)
  const u = PLANET[s.id] ? byId(s.id) : null;
  const sun = u && u.kind !== 'core' && !u.portal ? sunFor(s.id) : null;
  for (const lit of sun ? [true, false] : [false]) {
    for (let i = 0; i < 24; i++) {
      const a = a0 + (i / 24) * Math.PI * 2;
      if (lit && Math.cos(a) * sun[0] + Math.sin(a) * sun[2] < 0) continue;
      const x = s.at[0] + Math.cos(a) * s.d;
      const z = s.at[2] + Math.sin(a) * s.d;
      if (clearToStart(x, s.y, z)) return { x, y: s.y, z, heading: headingTo(s.at[0] - x, s.at[2] - z) };
    }
  }
  return { ...HOME_EDGE };
}

// A new ship: parked at a universe, or (nowhere picked) at `start`: the near
// edge of the home system facing its middle, unless it's given one (a new
// pilot's comes from startAt, so everyone starts somewhere different);
// level, and still.
export function spawn(id, start = HOME_EDGE) {
  const at = id && PLANET[id] ? parkAt(id) : start;
  return { ...at, speed: 0, vy: 0, lift: 0, pitch: 0, bank: 0, rate: 0, tipRate: 0, rollRate: 0, lean: 0, edge: false };
}

// The space the ship flies in: the universe map's, as this file has it
// (its edge, its ceiling and floor, where it's open enough for the pulse
// drive, and how hard the brakes and coasting bite there; what's solid and
// where the autopilot can go). Another map brings its own, the same shape
// (the galaxy's star systems: galaxy/space.js), to step() and autopilot().
export const SPACE = { edge: EDGE, ceilingAt, openness, driveAt, driveAlong, homeAt, boostAt, brakeAt, coastAt, approachAt, solids: SOLIDS, goals: GOALS };

// One step of `dt` seconds. Returns the new ship and what happened on the
// way: { type: 'bump', id, hard }, { type: 'crash', id, at: [x, y, z],
// normal: [x, y, z], speed, swallowed? } (into something too fast, or into
// something that swallows at any speed: the scene plays it out) and
// { type: 'edge' } (at the edge, the ceiling or the floor).
// `solids` is what it can bump into (everything on the map, unless a test
// says otherwise); `space`, where it flies (SPACE, unless it's another map's).
export function step(s, input, dt, solids = SOLIDS, space = SPACE) {
  dt = clamp(dt, 0, 0.05);
  const events = [];
  const throttle = clamp(input.throttle || 0, -1, 1);
  const turn = clamp(input.turn || 0, -1, 1);
  const climb = clamp(input.climb || 0, -1, 1);
  const roll = clamp(input.roll || 0, -1, 1);
  // what's fitted (held to what any fit can do)
  const tune = input.tune;
  const boost = SHIP.boost * clamp(tune?.boost ?? 1, 1, 1.6);
  const cruise = SHIP.cruise * clamp(tune?.cruise ?? 1, 1, 1.2);
  const accelK = clamp(tune?.accel ?? 1, 1, 1.8);
  const agileK = clamp(tune?.agility ?? 1, 0.6, 1.4);
  const turnK = clamp(input.turnRate ?? 1, 0.25, 3) * agileK;
  const pitchK = clamp(input.pitchRate ?? 1, 0.25, 3) * agileK;
  const rollK = clamp(input.rollRate ?? 1, 0.25, 3) * agileK;
  const levelK = clamp(input.level ?? 1, 0, 3) * clamp(tune?.level ?? 1, 1, 1.8);
  // how far it's held down (hunters' interdiction, a battle), and how open
  // the drive is the way it's going (another map's space: where it is)
  const held = input.interdicted === true ? 1 : clamp(Number(input.interdicted) || 0, 0, 1);
  const f0 = noseOf(s);
  const openAt = (x, y, z) => (space.driveAlong ? space.driveAlong(x, y, z, f0) : space.driveAt(x, y, z)) * (1 - held);
  const open = openAt(s.x, s.y, s.z);
  // (super speed: all of it, times the overdrive here; and the brakes and the push, that squared)
  const od = 1 + (clamp(input.overdrive ?? 1, 1, OVERDRIVE) - 1) * (1 - held);
  const odV = overdriveAt(open, od);
  const odK = odV * odV;
  const limit = space.boostAt(s.x, s.y, s.z, boost, open) * odV;
  // (the approach to a world only with the throttle all the way on: part throttle is the cruise's share, as anywhere)
  const near = space.approachAt ? space.approachAt(s.x, s.y, s.z) * clamp((throttle - 0.75) / 0.25, 0, 1) : 0;
  const top = input.boost && throttle > 0 ? limit : cruise + Math.max(0, SHIP.approach - cruise) * near;
  const want = throttle > 0 ? throttle * top : throttle * SHIP.reverse;
  const faster = Math.abs(want) > Math.abs(s.speed) && Math.sign(want) !== -Math.sign(s.speed);
  // past what the drive allows the way it's going now (coming up on a place
  // at pulse speed, turning toward one, held down), it eases down onto it:
  // the further over, the harder (up to SHIP.drop, and harder still the
  // further past the pulse drive it is: out of super speed), keeping up with
  // it as it closes ahead, so it's at the boost's speeds by the time it's
  // there
  const over = s.speed > limit;
  let target = want;
  let accel = space.brakeAt(s.x, s.y, s.z, open) * odK;
  if (over) {
    const [ax, ay, az] = [s.x + f0[0] * s.speed * dt, s.y + f0[1] * s.speed * dt, s.z + f0[2] * s.speed * dt];
    const ahead = openAt(ax, ay, az);
    const next = space.boostAt(ax, ay, az, boost, ahead) * overdriveAt(ahead, od);
    const closing = dt > 0 ? Math.max(0, limit - next) / dt : 0;
    accel = Math.min(SHIP.drop * Math.max(1, s.speed / SHIP.pulse) ** 2, (s.speed - limit) * SHIP.settle + 20) + closing;
    target = Math.min(want, next);
  } else if (throttle === 0) accel = space.coastAt(s.x, s.y, s.z, open) * odK;
  // (boosting toward more than the boost, the pulse drive pushes from the
  // start, all of it once it's a third of the way open: a hop between two
  // stations gets going straight away)
  else if (faster) accel = (input.boost ? (SHIP.accel * 1.8 * (1 + 2 * space.homeAt(s.x, s.z)) + (want > boost + 1 ? SHIP.pulseAccel * Math.min(1, open * 3) : 0)) * odK : SHIP.accel * (1 + near)) * accelK; // (and up to the approach quicker)
  const speed = s.speed + clamp(target - s.speed, -accel * dt, accel * dt);

  // the turns, about the ship's own axes, each toward the rate the stick
  // asks for (less of it the faster it goes), with a little inertia either
  // way. Let go of the roll and the nose and it rolls back upright, by the
  // shorter way round (less the nearer straight up or down the nose is,
  // where upright means nothing)
  const agile = turnAt(speed);
  const ease = (from, to, k) => from + (to - from) * (1 - Math.exp(-k * dt));
  const pitch0 = s.pitch || 0;
  const bank0 = s.bank || 0;
  const rate = ease(s.rate || 0, -turn * SHIP.turn * turnK * agile, SHIP.yawEase * Math.sqrt(turnK));
  const tipRate = ease(s.tipRate || 0, climb * SHIP.pitch * pitchK * agile, SHIP.pitchEase * Math.sqrt(pitchK));
  const free = (1 - Math.abs(roll)) * (1 - Math.abs(climb)) ** 2;
  const upright = -clamp(bank0 * 2, -1, 1) * SHIP.level * levelK * free * Math.cos(pitch0) ** 2;
  const rollRate = ease(s.rollRate || 0, roll * SHIP.roll * rollK * agile + upright, SHIP.rollEase);
  let q = fromAngles(s.heading, pitch0, bank0);
  const spin = Math.sqrt(tipRate * tipRate + rate * rate + rollRate * rollRate);
  if (spin > 1e-9) q = normalize(mul(q, axisAngle([tipRate / spin, rate / spin, -rollRate / spin], spin * dt)));

  // turned back at the edge: the nose comes round toward the middle
  const out = Math.sqrt(s.x * s.x + s.z * s.z);
  if (out > space.edge - 2) {
    const k = clamp((out - (space.edge - 2)) / 2, 0, 1);
    const f = rotate(q, NOSE);
    const level = Math.hypot(f[0], f[2]);
    q = turnToward(q, [(-s.x / out) * level, f[1], (-s.z / out) * level], 2.2 * dt * k);
  }

  // the ceiling and the floor: going out toward one, the nose is never
  // steeper than it could still round out from by then at the speed it has
  // (so it comes round level in time), and past one it's pointed back in
  const y0 = s.y;
  const ceiling = space.ceilingAt(s.x, s.z);
  const side = y0 < 0 ? -1 : 1;
  const room = ceiling - Math.abs(y0);
  if (speed > 0.05) {
    const f = rotate(q, NOSE);
    const steep = Math.asin(clamp(f[1] * side, -1, 1)); // how steeply it's going out
    const most = room <= 0 ? -0.2 : Math.acos(clamp(1 - (room * SHIP.round) / speed, -1, 1));
    if (steep > most) {
      // round out the way it's already pointing (pointed straight out, the
      // way its top faces: the way a pull on the stick would take it)
      let [hx, hz] = [f[0], f[2]];
      if (Math.hypot(hx, hz) < 0.05) {
        const u = rotate(q, UP);
        [hx, hz] = [u[0], u[2]];
        if (Math.hypot(hx, hz) < 1e-6) [hx, hz] = forward(s.heading);
      }
      const hl = Math.hypot(hx, hz);
      const to = [(hx / hl) * Math.cos(most), Math.sin(most) * side, (hz / hl) * Math.cos(most)];
      q = turnToward(q, to, 6 * dt);
    }
  }
  const { heading, pitch, bank } = toAngles(q);
  const f = rotate(q, NOSE);

  // past the ceiling or the floor (coming home from deep space, say, where
  // they're far higher) it's eased back in; parking, the autopilot can nudge
  // it up or down a little
  const lift0 = s.lift || 0;
  const back = room < 0 ? -side * Math.max(1.5, -room * 1.2) : clamp(input.hover || 0, -1, 1) * SHIP.hover;
  const push = SHIP.lift * (1 + 3 * open) * dt;
  let lift = lift0 + clamp(back - lift0, -push, push);

  let x = s.x + f[0] * speed * dt;
  let y = s.y + (f[1] * speed + lift) * dt;
  let z = s.z + f[2] * speed * dt;
  let v = speed;
  const r = Math.sqrt(x * x + z * z);
  const ceil = space.ceilingAt(x, z);
  let edge = s.edge && (r > space.edge - 1 || Math.abs(y) > ceil - 1); // clears once well back inside
  if (r > space.edge) {
    x *= space.edge / r;
    z *= space.edge / r;
  }
  if (r > space.edge) {
    if (!edge) events.push({ type: 'edge' });
    edge = true;
  } else if (Math.abs(y) > ceil) edge = true; // (eased back from the ceiling or the floor without a word)

  // off a planet, never through it: out along the line from its middle,
  // whichever way the ship came at it (from the side, from above or below).
  // A solid with a trench round its middle (the Death Star) lets the ship
  // down into it, as far as its floor, along the stretch that's laid
  for (const p of solids) {
    const min = (p.band && inTrench(p, x, y, z) ? p.band.floor : p.r) + SHIP.radius;
    const dx = x - p.at[0];
    const dy = y - p.at[1];
    const dz = z - p.at[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d >= min) continue;
    const [nx, ny, nz] = d > 1e-6 ? [dx / d, dy / d, dz / d] : [-f[0], -f[1], -f[2]];
    x = p.at[0] + nx * min;
    y = p.at[1] + ny * min;
    z = p.at[2] + nz * min;
    const ahead = f[0] * nx + f[1] * ny + f[2] * nz; // < 0: the nose is into it
    const into = -(ahead * v + ny * lift); // speed toward the planet
    if (p.swallow) {
      // the black hole: nothing bounces off it. Touching it at any speed
      // is the fall (the scene takes it from here)
      events.push({ type: 'crash', id: p.id, at: [x, y, z], normal: [nx, ny, nz], speed: Math.max(0, into), swallowed: true });
      continue;
    }
    if (into > 0) {
      // too fast is a crash (the scene plays it out); otherwise a bump
      if (into > SHIP.crash) events.push({ type: 'crash', id: p.id, at: [x, y, z], normal: [nx, ny, nz], speed: into });
      else events.push({ type: 'bump', id: p.id, hard: into > SHIP.crash * 0.55 });
      // a little bounce back: what it had toward the planet, the other way
      // and smaller (what's left of the ship's speed that it can still fly)
      v += 1.3 * into * ahead;
      if (lift * ny < 0) lift = 0;
    }
  }

  // it leans into the turn it's actually making (so it rolls in and out
  // with the inertia), more the faster it goes: for the eye, on top of
  // the roll that's really there
  const steer = clamp(-rate / (SHIP.turn * agile), -1, 1);
  const lean = ease(s.lean || 0, steer * (0.25 + 0.45 * clamp(Math.abs(v) / SHIP.cruise, 0, 1)), 6);
  const vy = f[1] * v + lift;
  return { ship: { x, y, z, heading, pitch, bank, speed: v, vy, lift, rate, tipRate, rollRate, lean, edge }, events };
}

// The universe the ship is at, if any. Once at one, it stays at it until
// it's clearly left, so the panel doesn't flicker at the edge.
export function orbiting(s, current) {
  if (current && PLANET[current] && away(s, PLANET[current]) < PLANET[current].reach + ORBIT_OUT) return current;
  let best = null;
  let bd = Infinity;
  for (const p of PLANETS) {
    const d = away(s, p) - p.reach;
    if (d < ORBIT_IN && d < bd) {
      best = p.id;
      bd = d;
    }
  }
  return best;
}

// How fast it can be going and still stop by `park`, `far` away, at 0.7 of
// its brakes: the brakes all the way there count (harder where the drive's
// open, between stations as out in deep space), not just where it is now
function stopFrom(s, park, far, space = SPACE, od = 1) {
  const N = 8;
  const py = park.y ?? SHIP.height;
  const step = Math.max(0, far - 0.3) / N;
  let v2 = 0;
  for (let i = 0; i < N; i++) {
    const k = (i + 0.5) / N; // from the stop back toward the ship
    const [x, y, z] = [park.x + (s.x - park.x) * k, py + (s.y - py) * k, park.z + (s.z - park.z) * k];
    v2 += 2 * 0.7 * space.brakeAt(x, y, z) * odBrakes(space, x, y, z, od) * step;
  }
  return Math.sqrt(v2);
}

// The stick that points the nose along `dir` (a unit vector, the map's
// axes): the turn and the tip it's off by in the ship's own frame (with a
// touch of damping, so their inertia doesn't swing it past), and the roll
// back upright. The autopilot steers with it, and so does anything else
// that flies the ship somewhere for a while (entry.js's descent into a
// planet's air).
export function stickToward(s, dir) {
  const q = fromAngles(s.heading, s.pitch || 0, s.bank || 0);
  const b = rotate(conj(q), dir);
  const yaw = Math.atan2(-b[0], -b[2]); // > 0: off to the left
  const tip = Math.atan2(b[1], Math.sqrt(b[0] * b[0] + b[2] * b[2])); // > 0: above the nose
  return {
    turn: clamp(-yaw * 2.5 + (s.rate || 0) * 0.1, -1, 1),
    climb: clamp(tip * 2.5 - (s.tipRate || 0) * 0.1, -1, 1),
    roll: clamp(-(s.bank || 0) * 1.5 * Math.cos(s.pitch || 0), -1, 1),
  };
}

// Flying itself to a universe (or a wonder out in deep space): the input for
// this step, and whether it's there (parked, facing it, level with it,
// upright). It points the nose the way it wants to go with the stick, as a
// pilot would (rolling itself upright as it goes), steers round any planet
// in the way (as if each went all the way up and down: it changes height as
// it goes, so it never cuts across one from above), and never goes faster
// than it can brake from by the time it's there (so a trip out to a wonder
// is on the pulse drive, and the last stretch is gentle). `park` is where
// it's going, worked out once when the trip starts; `space` where it flies
// (SPACE, the universe map's, unless it's another map's: then `park` is
// that map's to give). `od`, super speed: the overdrive it flies on (1, none).
export function autopilot(s, id, park = GOALS[id] && parkAt(id, [s.x, s.z]), space = SPACE, od = 1) {
  const p = space.goals[id];
  if (!p || !park) return { input: { throttle: 0, turn: 0 }, done: true };
  // (a hop between two of the home system's stations is no quicker on it: none)
  od = space.homeAt(s.x, s.z) >= 1 && space.homeAt(park.x, park.z) >= 1 ? 1 : clamp(od, 1, OVERDRIVE);
  const tx = park.x - s.x;
  const tz = park.z - s.z;
  const dist = Math.sqrt(tx * tx + tz * tz);
  // up or down to the planet's height (and no lower or higher than it can
  // go here: the home system's floor and ceiling are near)
  const ceil = space.ceilingAt(s.x, s.z) - 2;
  const ty = clamp(park.y ?? SHIP.height, -ceil, ceil) - s.y;
  if (dist < 0.4 && Math.abs(ty) < 0.4) {
    // there: stop, level off and turn to face it (nudged up or down the last little bit)
    const face = wrap(park.heading - s.heading);
    const [fx, fz] = forward(park.heading);
    const done = Math.abs(face) < 0.08 && Math.abs(s.speed) < 0.25 && Math.abs(ty) < 0.25 && Math.abs(s.vy || 0) < 0.3 && Math.abs(s.pitch || 0) < 0.1 && Math.abs(s.bank || 0) < 0.1;
    return { input: { throttle: 0, ...stickToward(s, [fx, 0, fz]), hover: clamp(ty * 3 - (s.vy || 0), -1, 1) }, done };
  }
  // toward the parking spot, steering round anything the straight line
  // would clip (further ahead the faster it goes, and harder the closer it
  // is), on the side the ship already passes it. What's well above or below
  // the ship's height isn't in the way: a body counts by its width at that
  // height
  const ux = tx / dist;
  const uz = tz / dist;
  let dx = ux;
  let dz = uz;
  const look = 5 + Math.abs(s.speed) * 1;
  const widthAt = (o) => {
    const dy = o.at[1] - s.y;
    const rr = (o.r + SHIP.radius + 0.5) ** 2 - dy * dy;
    return rr > 0 ? Math.sqrt(rr) : 0;
  };
  for (const o of space.solids) {
    if (o.id === id) continue;
    const r = widthAt(o);
    if (r <= 0) continue;
    const ox = o.at[0] - s.x;
    const oz = o.at[2] - s.z;
    const along = ox * ux + oz * uz;
    // (in its own radii, so a world counts like a moon: within one of it,
    // it's minded however slowly the ship's going, or slowing for it would
    // put it out of mind, and the nose straight back on it)
    const gap = (Math.sqrt(ox * ox + oz * oz) - r) / Math.max(4, r);
    if (along < -r || along > dist + r || (along > look + r && gap > 1)) continue; // behind, past the stop, or not yet
    const cross = ox * uz - oz * ux; // > 0: it's to the left of the line
    const clear = r + SHIP.radius + Math.max(1, r * 0.3);
    if (Math.abs(cross) > clear) continue;
    const k = ((clear - Math.abs(cross)) / clear) * (1.6 + 3 * clamp(1 - gap, 0, 1));
    const side = Math.sign(cross) || 1;
    dx += -side * uz * k;
    dz += side * ux * k;
  }
  // and anything the way it's actually pointing, while it swings round at
  // speed (it turns wide when fast): out to where it could stop, and a bit
  const [hx, hz] = forward(s.heading);
  const brakes = space.brakeAt(s.x, s.y, s.z) * odBrakes(space, s.x, s.y, s.z, od);
  const stopping = (s.speed * s.speed) / (2 * brakes) + 3;
  let danger = false;
  for (const o of space.solids) {
    if (o.id === id) continue;
    const r = widthAt(o);
    if (r <= 0) continue;
    const ox = o.at[0] - s.x;
    const oz = o.at[2] - s.z;
    const along = ox * hx + oz * hz;
    if (along < 0 || along > stopping + r) continue;
    const cross = ox * hz - oz * hx;
    const clear = r + SHIP.radius + Math.max(0.8, r * 0.2);
    if (Math.abs(cross) > clear) continue;
    danger = true;
    const side = Math.sign(cross) || 1;
    dx += -side * hz * 2.5;
    dz += side * hx * 2.5;
  }
  // the way to go: round what's in the way, and up or down to its height
  // on the way, mostly early (aiming at a point further up or down than it
  // is), easing in
  const hl = Math.hypot(dx, dz) || 1;
  const rise = clamp(Math.atan2(ty * 2.5 - (s.vy || 0) * 0.4, Math.max(dist, 1)), -1.2, 1.2);
  const dir = [(dx / hl) * Math.cos(rise), Math.sin(rise), (dz / hl) * Math.cos(rise)];
  const nose = rotate(fromAngles(s.heading, s.pitch || 0, s.bank || 0), NOSE);
  const off = Math.acos(clamp(nose[0] * dir[0] + nose[1] * dir[1] + nose[2] * dir[2], -1, 1));
  // no faster than it can brake from by the stop (gently, over the last
  // bit); slow for sharp turns, and hard for anything dead ahead within
  // stopping distance (something merely in the way of the straight line is
  // steered round at speed)
  const far = Math.hypot(dist, ty);
  // (the drive the way it's pointing: a place it's only flying past doesn't slow it)
  const open = space.driveAlong ? space.driveAlong(s.x, s.y, s.z, nose) : space.driveAt(s.x, s.y, s.z);
  const odV = overdriveAt(open, od);
  const vmax = Math.min(stopFrom(s, park, far, space, od), (0.9 + 1.5 * space.homeAt(s.x, s.z)) * odV * far + 0.3);
  const brake = (off > 1.1 ? 0.15 : 1) * (danger ? 0.12 : 1);
  const limit = space.boostAt(s.x, s.y, s.z, SHIP.boost, open) * odV;
  const top = Math.min(vmax, limit) * brake;
  // flat out (the pulse drive, out in the open) once it's pointed right and
  // nothing's dead ahead
  const boost = !danger && top > SHIP.cruise && off < 0.25;
  const throttle = clamp(top / (boost ? limit : SHIP.cruise), 0.12, 1);
  return { input: { throttle, ...stickToward(s, dir), boost, ...(od > 1 ? { overdrive: od } : {}) }, done: false };
}
