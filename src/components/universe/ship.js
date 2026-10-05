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
// of the map, and eased back from the ceiling and the floor.

import { MAP_RADIUS, ORDER, POSITIONS, REACH, SUN } from './layout';
import { byId } from './universes';

export const SHIP = {
  cruise: 5.5, // map units a second (the ship is 0.26 long)
  boost: 20,
  reverse: 2,
  accel: 5.5,
  brake: 11,
  coast: 2.4,
  turn: 2.0, // radians a second
  radius: 0.15,
  height: 0.3, // above a planet's middle, where it parks
  climb: 4.5, // map units a second, up or down (more with boost)
  lift: 7, // how quickly it gets to the climb it's asked for
  ceiling: 14, // how far above or below the disc it can go (the big ships' lanes start at 12)
  crash: 2.4, // flying into something faster than this is a crash, not a bump
};
export const EDGE = MAP_RADIUS + 8;
const ORBIT_IN = 2.4; // past a planet's reach: closer than this, you're at it
const ORBIT_OUT = 3.8; // and you've left once you're this far
const PARK = 1.2; // where autopilot stops, past the planet's reach

export const PLANETS = ORDER.map((id) => ({ id, at: POSITIONS[id], r: byId(id).size, reach: REACH[id] }));
const PLANET = Object.fromEntries(PLANETS.map((p) => [p.id, p]));
// what the ship can't fly through: every planet and station, and the sun
export const SOLIDS = [...PLANETS, { id: 'sun', at: SUN.at, r: SUN.r, reach: SUN.r * 1.4 }];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)); // to −π…π
export const forward = (h) => [-Math.sin(h), -Math.cos(h)];
// the heading that points along (dx, dz)
export const headingTo = (dx, dz) => Math.atan2(-dx, -dz);

const away = (s, p) => Math.hypot(s.x - p.at[0], (s.y ?? SHIP.height) - p.at[1], s.z - p.at[2]);

// Parked a little way off a planet, facing it: on a side that's clear of
// the other planets (so being parked there is being at this one), as near
// as it can be to the side the ship comes from (`from`, or the camera's side
// of the map).
export function parkAt(id, from = [0, MAP_RADIUS]) {
  const p = PLANET[id];
  const d = p.reach + PARK;
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
    const inMap = Math.hypot(x, z) < EDGE - 2;
    const score = dx * ax + dz * az + (clear > ORBIT_IN + 0.2 ? 4 : clear) + (inMap ? 2 : 0);
    if (!best || score > best.score) best = { score, x, z, heading: headingTo(-dx, -dz) };
  }
  return { x: best.x, y: p.at[1] + SHIP.height, z: best.z, heading: best.heading };
}

// A new ship: parked at a universe, or at the near edge of the map facing
// its middle.
export function spawn(id) {
  const at = id && PLANET[id] ? parkAt(id) : { x: 0, y: SHIP.height, z: MAP_RADIUS + 1.5, heading: 0 };
  return { ...at, speed: 0, vy: 0, pitch: 0, bank: 0, edge: false };
}

// One step of `dt` seconds. Returns the new ship and what happened on the
// way: { type: 'bump', id, hard }, { type: 'crash', id, at: [x, y, z],
// normal: [x, y, z], speed } (into something too fast: the scene plays it
// out) and { type: 'edge' } (at the edge, the ceiling or the floor).
// `solids` is what it can bump into (everything on the map, unless a test
// says otherwise).
export function step(s, input, dt, solids = SOLIDS) {
  dt = clamp(dt, 0, 0.05);
  const events = [];
  const throttle = clamp(input.throttle || 0, -1, 1);
  const turn = clamp(input.turn || 0, -1, 1);
  const climb = clamp(input.climb || 0, -1, 1);
  const top = input.boost && throttle > 0 ? SHIP.boost : SHIP.cruise;
  const want = throttle > 0 ? throttle * top : throttle * SHIP.reverse;
  const faster = Math.abs(want) > Math.abs(s.speed) && Math.sign(want) !== -Math.sign(s.speed);
  const rate = throttle === 0 ? SHIP.coast : faster ? SHIP.accel * (input.boost ? 1.8 : 1) : SHIP.brake;
  const speed = s.speed + clamp(want - s.speed, -rate * dt, rate * dt);
  let heading = wrap(s.heading - turn * SHIP.turn * dt * (speed > SHIP.cruise ? 0.65 : 1));

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
  let rise = climb * SHIP.climb * (input.boost ? 1.35 : 1);
  const high = Math.abs(s.y) - (SHIP.ceiling - 2);
  if (high > 0 && rise * s.y > 0) rise *= clamp(1 - high / 2, 0, 1);
  if (Math.abs(s.y) > SHIP.ceiling) rise = -Math.sign(s.y) * 1.5;
  let vy = vy0 + clamp(rise - vy0, -SHIP.lift * dt, SHIP.lift * dt);

  const [fx, fz] = forward(heading);
  let x = s.x + fx * speed * dt;
  let y = clamp(s.y + vy * dt, -SHIP.ceiling - 1, SHIP.ceiling + 1);
  let z = s.z + fz * speed * dt;
  let v = speed;
  const r = Math.hypot(x, z);
  let edge = s.edge && (r > EDGE - 1 || Math.abs(y) > SHIP.ceiling - 1); // clears once well back inside
  if (r > EDGE) {
    x *= EDGE / r;
    z *= EDGE / r;
  }
  if (r > EDGE || Math.abs(y) > SHIP.ceiling) {
    if (!edge) events.push({ type: 'edge' });
    edge = true;
  }

  // off a planet, never through it: out along the line from its middle,
  // whichever way the ship came at it (from the side, from above or below)
  for (const p of solids) {
    const min = p.r + SHIP.radius;
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

  const bank = s.bank + (turn * (0.25 + 0.45 * clamp(Math.abs(v) / SHIP.cruise, 0, 1)) - s.bank) * clamp(dt * 6, 0, 1);
  // nose up climbing, down diving (steeper the slower it goes forward)
  const pitch0 = s.pitch || 0;
  const pitch = pitch0 + (clamp(Math.atan2(vy, Math.max(Math.abs(v), 3)), -0.55, 0.55) - pitch0) * clamp(dt * 6, 0, 1);
  return { ship: { x, y, z, heading, speed: v, vy, pitch, bank, edge }, events };
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

// Flying itself to a universe: the input for this step, and whether it's
// there (parked, facing it, level with it). Steers round any planet in the
// way (as if each went all the way up and down: it changes height as it
// goes, so it never cuts across one from above). `park` is where it's going,
// worked out once when the trip starts.
export function autopilot(s, id, park = PLANET[id] && parkAt(id, [s.x, s.z])) {
  const p = PLANET[id];
  if (!p) return { input: { throttle: 0, turn: 0 }, done: true };
  const tx = park.x - s.x;
  const tz = park.z - s.z;
  const dist = Math.hypot(tx, tz);
  // up or down to the planet's height, easing in
  const ty = (park.y ?? SHIP.height) - s.y;
  const climb = clamp(ty * 0.8 - (s.vy || 0) * 0.35, -1, 1);
  if (dist < 0.4) {
    // there: stop, level off and turn to face it
    const face = wrap(park.heading - s.heading);
    const done = Math.abs(face) < 0.08 && Math.abs(s.speed) < 0.25 && Math.abs(ty) < 0.25 && Math.abs(s.vy || 0) < 0.3;
    return { input: { throttle: 0, turn: clamp(-face * 3, -1, 1), climb }, done };
  }
  // toward the parking spot, steering round anything the straight line
  // would clip (further ahead the faster it goes, and harder the closer it
  // is), on the side the ship already passes it
  const ux = tx / dist;
  const uz = tz / dist;
  let dx = ux;
  let dz = uz;
  let blocked = false;
  let closest = Infinity; // the gap to the nearest thing in the way
  const look = 5 + Math.abs(s.speed) * 1;
  for (const o of SOLIDS) {
    if (o.id === id) continue;
    const ox = o.at[0] - s.x;
    const oz = o.at[2] - s.z;
    const along = ox * ux + oz * uz;
    if (along < -o.r || along > Math.min(dist, look) + o.r) continue; // behind, past the stop, or not yet
    const cross = ox * uz - oz * ux; // > 0: it's to the left of the line
    const clear = o.r + SHIP.radius + 1;
    if (Math.abs(cross) > clear) continue;
    blocked = true;
    const gap = Math.hypot(ox, oz) - o.r;
    closest = Math.min(closest, gap);
    const k = ((clear - Math.abs(cross)) / clear) * (1.6 + 3 * clamp(1 - gap / 4, 0, 1));
    const side = Math.sign(cross) || 1;
    dx += -side * uz * k;
    dz += side * ux * k;
  }
  // and anything the way it's actually pointing, while it swings round at
  // speed (it turns wide when fast): out to where it could stop, and a bit
  const [hx, hz] = forward(s.heading);
  const stopping = (s.speed * s.speed) / (2 * SHIP.brake) + 3;
  let danger = false;
  for (const o of SOLIDS) {
    if (o.id === id) continue;
    const ox = o.at[0] - s.x;
    const oz = o.at[2] - s.z;
    const along = ox * hx + oz * hz;
    if (along < 0 || along > stopping + o.r) continue;
    const cross = ox * hz - oz * hx;
    const clear = o.r + SHIP.radius + 0.8;
    if (Math.abs(cross) > clear) continue;
    danger = true;
    blocked = true;
    closest = Math.min(closest, Math.hypot(ox, oz) - o.r);
    const side = Math.sign(cross) || 1;
    dx += -side * hz * 2.5;
    dz += side * hx * 2.5;
  }
  const want = headingTo(dx, dz);
  const diff = wrap(want - s.heading);
  const turn = clamp(-diff * 2.5, -1, 1);
  // slow for sharp turns, and for anything close ahead, so it can steer
  // round; hard, for anything dead ahead within stopping distance
  const brake = (Math.abs(diff) > 1.1 ? 0.15 : 1) * (danger ? 0.12 : clamp(closest / 5, 0.3, 1));
  const throttle = brake * clamp(dist / 5, 0.12, 1);
  return { input: { throttle, turn, climb, boost: !blocked && dist > 18 && Math.abs(diff) < 0.25 }, done: false };
}
