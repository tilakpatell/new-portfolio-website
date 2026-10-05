// The ship on the universe map, as plain numbers: where it is, which way it
// points, how fast it goes, and one step of flying it. Pure (no three.js),
// so it's tested in Node; the scene copies the numbers onto the model and
// the camera.
//
// The ship flies over the map's disc (x, z) and up and down (y, as far as
// SHIP.ceiling above or below it), pointing along `heading` (0 is −z, the
// way the camera looks; it grows turning left). Input is { throttle: −1…1,
// turn: −1…1 (right is +), climb: −1…1 (up is +), boost }. It turns on the
// spot, coasts to a stop, climbs and dives (nose up or down as it does),
// can't go through a planet (it bounces off) and is turned back at the edge
// of the map, and eased back from the ceiling and the floor. The turn has a
// little inertia (`rate`, radians a second, easing toward what the stick
// asks), so it rolls into and out of a turn rather than snapping, and turns
// wider the faster it goes.
//
// Between the places (deep.js) it opens up: the boost becomes a pulse drive
// (up to SHIP.pulse, dropping back as it nears any place, hard enough that
// it never arrives at a planet at pulse speed; and cut to the boost while
// hunters have it interdicted, `input.interdicted`), the brakes and the
// coasting bite harder to match, the ceiling lifts to DEEP.ceiling out of
// the home system, and the wonders out there are as solid as the planets,
// and places the autopilot can take you (GOALS: every planet and station,
// and every wonder, the nebulae too). All but the black hole, which
// swallows: touch it at any speed and that's a crash, with no bounce (the
// scene plays out the fall, and the page goes on to what's beyond it). The
// Death Star's trench lets the ship down into it, all the way round.

import { DEEP, DEEP_SOLIDS, WONDERS, openness, trenchBand } from './deep';
import { HOME_RADIUS, MAP_RADIUS, ORDER, POSITIONS, REACH, SUN } from './layout';
import { byId } from './universes';

export const SHIP = {
  cruise: 5.5, // map units a second (the ship is 0.26 long)
  boost: 20,
  pulse: 420, // the boost out in the open
  pulseAccel: 170, // map units a second, a second, getting up to it
  drop: 470, // and how hard it falls back to the boost as it nears a place
  reverse: 2,
  accel: 5.5,
  brake: 11,
  coast: 2.4,
  turn: 2.0, // radians a second, at cruise and under
  turnFast: 0.6, // of that, at boost speed (and a little less again at pulse speed)
  yawEase: 9, // how quickly the turn gets to the rate asked for (a second, roughly a ninth of one)
  radius: 0.15,
  height: 0.3, // above a planet's middle, where it parks
  climb: 4.5, // map units a second, up or down (more with boost)
  lift: 7, // how quickly it gets to the climb it's asked for
  ceiling: 70, // how far above or below the disc it can go (the big ships' lanes start at 75)
  crash: 2.4, // flying into something faster than this is a crash, not a bump
};
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
// what the ship can't fly through: every planet and station, the sun, and
// the wonders out in deep space
export const SOLIDS = [...PLANETS, { id: 'sun', at: SUN.at, r: SUN.r, reach: SUN.r * 1.4 }, ...DEEP_SOLIDS];
export const isPlace = (id) => Boolean(PLANET[id]);
// where the autopilot can take you: the planets and stations, and out in
// deep space every wonder (a nebula, which isn't solid, is somewhere to fly
// into: its goal is its middle)
export const GOALS = {
  ...Object.fromEntries(DEEP_SOLIDS.map((o) => [o.id, o])),
  ...Object.fromEntries(WONDERS.filter((w) => w.solid === false).map((w) => [w.id, { id: w.id, at: w.at, r: w.r, reach: 0, deep: true }])),
  ...PLANET,
};
export const isGoal = (id) => Boolean(GOALS[id]);

// how high it can go at (x, z): the home system's ceiling, lifting to deep
// space's out past it; how fast its boost goes at (x, y, z): the pulse
// drive out in the open, the boost at any place; how hard it brakes and
// coasts there (harder out in the open, to match the speeds); and how fast
// it climbs and dives (far faster out in the open, where the places are
// hundreds of units above and below the disc)
export function ceilingAt(x, z) {
  const k = clamp((Math.hypot(x, z) - DEEP.system) / (DEEP.open - DEEP.system), 0, 1);
  return SHIP.ceiling + (DEEP.ceiling - SHIP.ceiling) * k * k * (3 - 2 * k);
}
export const boostAt = (x, y, z) => SHIP.boost + (SHIP.pulse - SHIP.boost) * openness(x, y, z);
export const brakeAt = (x, y, z) => SHIP.brake * (1 + 14.5 * openness(x, y, z));
const coastAt = (x, y, z) => SHIP.coast * (1 + 18.5 * openness(x, y, z));
const WIDE = 13; // how much faster it climbs (and gets to its climb) out in the open
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
// the heading that points along (dx, dz)
export const headingTo = (dx, dz) => Math.atan2(-dx, -dz);

// in a place's trench: level with it, and along the stretch of it that's laid
export function inTrench(p, x, y, z) {
  if (!p.band || Math.abs(y - p.at[1]) >= p.band.half) return false;
  if (p.band.arc >= Math.PI) return true; // (all the way round)
  const a = Math.atan2(z - p.at[2], x - p.at[0]);
  return Math.abs(wrap(a - p.band.home)) < p.band.arc;
}

const away = (s, p) => Math.hypot(s.x - p.at[0], (s.y ?? SHIP.height) - p.at[1], s.z - p.at[2]);

// Parked a little way off a planet, facing it: on a side that's clear of
// the other planets (so being parked there is being at this one), as near
// as it can be to the side the ship comes from (`from`, or the camera's side
// of the map). A wonder out in deep space the same, further off (they're
// big), level with its middle. Null for anywhere that isn't a goal.
export function parkAt(id, from = [0, HOME_RADIUS]) {
  const p = GOALS[id];
  if (!p) return null;
  const deep = !PLANET[id];
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
    for (const o of SOLIDS) if (o !== p) clear = Math.min(clear, Math.hypot(x - o.at[0], z - o.at[2]) - o.reach);
    const inMap = Math.hypot(x, z) < MAP_RADIUS + 30;
    const score = dx * ax + dz * az + (clear > ORBIT_IN + 0.2 ? 4 : clear) + (inMap ? 2 : 0);
    if (!best || score > best.score) best = { score, x, z, heading: headingTo(-dx, -dz) };
  }
  return { x: best.x, y: p.at[1] + (deep ? 0 : SHIP.height), z: best.z, heading: best.heading };
}

// A new ship: parked at a universe, or at the near edge of the home system
// facing its middle.
export function spawn(id) {
  const at = id && PLANET[id] ? parkAt(id) : { x: 0, y: SHIP.height, z: HOME_RADIUS + 1.5, heading: 0 };
  return { ...at, speed: 0, vy: 0, rate: 0, pitch: 0, bank: 0, edge: false };
}

// One step of `dt` seconds. Returns the new ship and what happened on the
// way: { type: 'bump', id, hard }, { type: 'crash', id, at: [x, y, z],
// normal: [x, y, z], speed, swallowed? } (into something too fast, or into
// something that swallows at any speed: the scene plays it out) and
// { type: 'edge' } (at the edge, the ceiling or the floor).
// `solids` is what it can bump into (everything on the map, unless a test
// says otherwise).
export function step(s, input, dt, solids = SOLIDS) {
  dt = clamp(dt, 0, 0.05);
  const events = [];
  const throttle = clamp(input.throttle || 0, -1, 1);
  const turn = clamp(input.turn || 0, -1, 1);
  const climb = clamp(input.climb || 0, -1, 1);
  const open = input.interdicted ? 0 : openness(s.x, s.y, s.z);
  const limit = input.interdicted ? SHIP.boost : boostAt(s.x, s.y, s.z);
  const top = input.boost && throttle > 0 ? limit : SHIP.cruise;
  const want = throttle > 0 ? throttle * top : throttle * SHIP.reverse;
  const faster = Math.abs(want) > Math.abs(s.speed) && Math.sign(want) !== -Math.sign(s.speed);
  // past what the boost allows where it is now (coming up on a place at pulse
  // speed), it falls back hard, so it's at the boost's speeds by the time it's there
  const over = s.speed > limit;
  let accel = brakeAt(s.x, s.y, s.z);
  if (over) accel = SHIP.drop;
  else if (throttle === 0) accel = coastAt(s.x, s.y, s.z);
  else if (faster) accel = input.boost ? SHIP.accel * 1.8 + (s.speed > SHIP.boost - 1 ? SHIP.pulseAccel * open : 0) : SHIP.accel;
  const speed = s.speed + clamp((over ? Math.min(want, limit) : want) - s.speed, -accel * dt, accel * dt);
  // the turn: toward the rate the stick asks for (less of it the faster it
  // goes), with a little inertia either way
  const wantRate = -turn * SHIP.turn * turnAt(speed);
  const rate = (s.rate || 0) + (wantRate - (s.rate || 0)) * (1 - Math.exp(-SHIP.yawEase * dt));
  let heading = wrap(s.heading + rate * dt);

  // turned back at the edge: the nose comes round toward the middle
  const out = Math.hypot(s.x, s.z);
  if (out > EDGE - 2) {
    const home = headingTo(-s.x, -s.z);
    const k = clamp((out - (EDGE - 2)) / 2, 0, 1);
    heading = wrap(heading + clamp(wrap(home - heading), -2.2 * dt * k, 2.2 * dt * k));
  }

  // up and down: toward the climb it's asked for, easing off as it nears
  // the ceiling (or the floor) and pushed back once past it
  const vy0 = s.vy || 0;
  const ceiling = ceilingAt(s.x, s.z);
  // (faster out in deep space, where there's further to go)
  let rise = climb * SHIP.climb * (input.boost ? 1.35 : 1) * (1 + WIDE * open);
  const high = Math.abs(s.y) - (ceiling - 2);
  if (high > 0 && rise * s.y > 0) rise *= clamp(1 - high / 2, 0, 1);
  if (Math.abs(s.y) > ceiling) rise = -Math.sign(s.y) * Math.max(1.5, (Math.abs(s.y) - ceiling) * 1.2);
  const lift = SHIP.lift * (1 + WIDE * open) * dt;
  let vy = vy0 + clamp(rise - vy0, -lift, lift);

  const [fx, fz] = forward(heading);
  let x = s.x + fx * speed * dt;
  let y = s.y + vy * dt;
  let z = s.z + fz * speed * dt;
  let v = speed;
  const r = Math.hypot(x, z);
  const ceil = ceilingAt(x, z);
  let edge = s.edge && (r > EDGE - 1 || Math.abs(y) > ceil - 1); // clears once well back inside
  if (r > EDGE) {
    x *= EDGE / r;
    z *= EDGE / r;
  }
  if (r > EDGE) {
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
    const d = Math.hypot(dx, dy, dz);
    if (d >= min) continue;
    const [nx, ny, nz] = d > 1e-6 ? [dx / d, dy / d, dz / d] : [-fx, 0, -fz];
    x = p.at[0] + nx * min;
    y = p.at[1] + ny * min;
    z = p.at[2] + nz * min;
    const ahead = fx * nx + fz * nz;
    const into = -(ahead * v + ny * vy); // speed toward the planet
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
      vy += 1.3 * into * ny;
    }
  }

  // it banks with the turn it's actually making (so it rolls in and out
  // with the inertia), more the faster it goes
  const ease = 1 - Math.exp(-6 * dt);
  const steer = clamp(-rate / (SHIP.turn * turnAt(speed)), -1, 1);
  const bank = s.bank + (steer * (0.25 + 0.45 * clamp(Math.abs(v) / SHIP.cruise, 0, 1)) - s.bank) * ease;
  // nose up climbing, down diving (steeper the slower it goes forward)
  const pitch0 = s.pitch || 0;
  const pitch = pitch0 + (clamp(Math.atan2(vy, Math.max(Math.abs(v), 3)), -0.55, 0.55) - pitch0) * ease;
  return { ship: { x, y, z, heading, speed: v, vy, rate, pitch, bank, edge }, events };
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

// Flying itself to a universe (or a wonder out in deep space): the input for
// this step, and whether it's there (parked, facing it, level with it).
// Steers round any planet in the way (as if each went all the way up and
// down: it changes height as it goes, so it never cuts across one from
// above), and never goes faster than it can brake from by the time it's
// there (so a trip out to a wonder is on the pulse drive, and the last
// stretch is gentle). `park` is where it's going, worked out once when the
// trip starts.
export function autopilot(s, id, park = GOALS[id] && parkAt(id, [s.x, s.z])) {
  const p = GOALS[id];
  if (!p || !park) return { input: { throttle: 0, turn: 0 }, done: true };
  const tx = park.x - s.x;
  const tz = park.z - s.z;
  const dist = Math.hypot(tx, tz);
  // up or down to the planet's height, easing in (and no lower or higher
  // than it can go here: the home system's floor and ceiling are near)
  const ceil = ceilingAt(s.x, s.z) - 2;
  const ty = clamp(park.y ?? SHIP.height, -ceil, ceil) - s.y;
  const climb = clamp(ty * 0.8 - (s.vy || 0) * 0.35, -1, 1);
  if (dist < 0.4) {
    // there: stop, level off and turn to face it
    const face = wrap(park.heading - s.heading);
    const done = Math.abs(face) < 0.08 && Math.abs(s.speed) < 0.25 && Math.abs(ty) < 0.25 && Math.abs(s.vy || 0) < 0.3;
    return { input: { throttle: 0, turn: clamp(-face * 3 + (s.rate || 0) * 0.1, -1, 1), climb }, done };
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
  for (const o of SOLIDS) {
    if (o.id === id) continue;
    const r = widthAt(o);
    if (r <= 0) continue;
    const ox = o.at[0] - s.x;
    const oz = o.at[2] - s.z;
    const along = ox * ux + oz * uz;
    if (along < -r || along > Math.min(dist, look) + r) continue; // behind, past the stop, or not yet
    const cross = ox * uz - oz * ux; // > 0: it's to the left of the line
    const clear = r + SHIP.radius + Math.max(1, r * 0.3);
    if (Math.abs(cross) > clear) continue;
    const gap = (Math.hypot(ox, oz) - r) / Math.max(4, r); // in its own radii (so a world counts like a moon)
    const k = ((clear - Math.abs(cross)) / clear) * (1.6 + 3 * clamp(1 - gap, 0, 1));
    const side = Math.sign(cross) || 1;
    dx += -side * uz * k;
    dz += side * ux * k;
  }
  // and anything the way it's actually pointing, while it swings round at
  // speed (it turns wide when fast): out to where it could stop, and a bit
  const [hx, hz] = forward(s.heading);
  const brakes = brakeAt(s.x, s.y, s.z);
  const stopping = (s.speed * s.speed) / (2 * brakes) + 3;
  let danger = false;
  for (const o of SOLIDS) {
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
  const want = headingTo(dx, dz);
  const diff = wrap(want - s.heading);
  // (a touch of damping, so the turn's inertia doesn't swing it past)
  const turn = clamp(-diff * 2.5 + (s.rate || 0) * 0.1, -1, 1);
  // no faster than it can brake from by the stop (gently, over the last
  // bit); slow for sharp turns, and hard for anything dead ahead within
  // stopping distance (something merely in the way of the straight line is
  // steered round at speed)
  const vmax = Math.min(Math.sqrt(2 * brakeAt(s.x, s.y, s.z) * 0.7 * Math.max(0, dist - 0.3)), 0.9 * dist + 0.3);
  const brake = (Math.abs(diff) > 1.1 ? 0.15 : 1) * (danger ? 0.12 : 1);
  const limit = boostAt(s.x, s.y, s.z);
  const top = Math.min(vmax, limit) * brake;
  // flat out (the pulse drive, out in the open) once it's pointed right and
  // nothing's dead ahead
  const boost = !danger && top > SHIP.cruise && Math.abs(diff) < 0.25;
  const throttle = clamp(top / (boost ? limit : SHIP.cruise), 0.12, 1);
  return { input: { throttle, turn, climb, boost }, done: false };
}
