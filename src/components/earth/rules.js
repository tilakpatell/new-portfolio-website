// Earth, the world: fly a little plane round the globe to the places I've
// been, and get a stamp in your passport at each. This is the flying and the
// stamping, with no drawing in it: where the plane is on the sphere and which
// way it's heading, turning, climbing, the autopilot's great-circle course,
// what counts as arriving, and where the sun is today. ./scene.js draws it;
// ./EarthWorld.jsx reads the keys and shows the postcards.
//
// The Earth is a sphere of radius 1, y up, longitude 0 facing +z: the same
// frame as the travel globe (travel/globe3d/data.js). The plane is a point p
// on the sphere (a unit vector) and a heading h along the ground (a unit
// vector square to p), at a height over the ground. Flying straight follows a
// great circle: p and h turn together about p × h.

import { HOME, PLACES } from '../../data/places';

export const KM = 6371; // the Earth's radius, for distances shown in km
const RAD = Math.PI / 180;

export const ALT = { min: 0.012, max: 0.075, start: 0.032, climb: 0.028 };
export const SPEED = { cruise: 0.11, slow: 0.045, fast: 0.34, ease: 1.6 }; // radians a second
export const TURN = 1.3; // radians a second, hard over
export const CAPTURE = 0.025; // within this many radians of a place (about 160 km), you've arrived
export const ROLL = { time: 1.1 }; // seconds, a barrel roll
export const TRAIL = { step: 0.004, max: 1600 }; // the trail flown: a point every so many radians, and how many are kept
export const AROUND_KM = 2 * Math.PI * KM; // once round the Earth

// ── vectors ──

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
// v turned by angle a about the unit axis k (Rodrigues)
export function rotate(v, k, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const kv = cross(k, v);
  const d = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
}
// the angle between two unit vectors, in radians (exact for small ones too)
export const angle = (a, b) => Math.atan2(len(cross(a, b)), dot(a, b));

// [longitude, latitude] in degrees ↔ a unit vector
export const toVec = (lon, lat) => [Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.cos(lon * RAD)];
export const toLonLat = (v) => [Math.atan2(v[0], v[2]) / RAD, Math.asin(Math.max(-1, Math.min(1, v[1]))) / RAD];

// north and east along the ground at p (at a pole, any pair at right angles)
export function frame(p) {
  let east = cross([0, 1, 0], p);
  if (len(east) < 1e-6) east = [1, 0, 0];
  east = unit(east);
  return { east, north: cross(p, east) };
}

// a heading along the ground at p from a compass bearing (degrees from north,
// clockwise), and back
export function headingOf(p, bearing) {
  const { east, north } = frame(p);
  return unit(add(scale(north, Math.cos(bearing * RAD)), scale(east, Math.sin(bearing * RAD))));
}
export function bearingOf(p, h) {
  const { east, north } = frame(p);
  return (((Math.atan2(dot(h, east), dot(h, north)) / RAD) % 360) + 360) % 360;
}

// the bearing to fly from p to reach q along the shortest way round
export function bearingTo(p, q) {
  const { east, north } = frame(p);
  // q's direction along the ground at p: q with its part along p taken out
  const t = add(q, scale(p, -dot(p, q)));
  if (len(t) < 1e-9) return 0;
  return (((Math.atan2(dot(t, east), dot(t, north)) / RAD) % 360) + 360) % 360;
}

// ── the places ──

// the passport: every place but home, in the travel page's order
export const STAMPS = PLACES.filter((p) => !p.home).map((p) => ({ id: p.id, name: p.name, at: p.at, v: toVec(...p.at), photo: p.photo }));
export const HOME_V = toVec(...HOME.at);
export const placeById = (id) => STAMPS.find((s) => s.id === id) ?? null;
export const kmBetween = (a, b) => angle(a, b) * KM;

// ── flying ──

export function newFlight({ at = HOME.at, bearing = 75 } = {}) {
  const p = toVec(...at);
  return { p, h: headingOf(p, bearing), speed: SPEED.cruise, alt: ALT.start, turn: 0, climb: 0, km: 0, t: 0, roll: 0, rolling: false, rollT: 0 };
}

// One step. input: { turn (-1 left … 1 right), climb (-1 … 1), boost, slow,
// roll (pressed: a barrel roll, if one isn't on) }.
export function fly(f, input, dt) {
  f.t += dt;
  // the barrel roll: right round about the nose over ROLL.time, eased, and
  // back to level exactly; the course is untouched
  if (input.roll && !f.rolling) {
    f.rolling = true;
    f.rollT = 0;
  }
  if (f.rolling) {
    f.rollT += dt;
    const k = Math.min(1, f.rollT / ROLL.time);
    f.roll = 2 * Math.PI * k * k * (3 - 2 * k);
    if (k >= 1) {
      f.roll = 0;
      f.rolling = false;
    }
  }
  // the controls answer smoothly: the wings bank into a turn, the nose into a climb
  const ease = 1 - Math.exp(-4 * dt);
  f.turn += (Math.max(-1, Math.min(1, input.turn ?? 0)) - f.turn) * ease;
  f.climb += (Math.max(-1, Math.min(1, input.climb ?? 0)) - f.climb) * ease;
  const want = input.boost ? SPEED.fast : input.slow ? SPEED.slow : SPEED.cruise;
  f.speed += (want - f.speed) * (1 - Math.exp(-SPEED.ease * dt));
  f.alt = Math.max(ALT.min, Math.min(ALT.max, f.alt + f.climb * ALT.climb * dt));
  // turn: about the way up, clockwise seen from above for a right turn
  f.h = rotate(f.h, f.p, -f.turn * TURN * dt);
  // forward, along the great circle
  const axis = unit(cross(f.p, f.h));
  const s = f.speed * dt;
  f.p = unit(rotate(f.p, axis, s));
  f.h = unit(rotate(f.h, axis, s));
  // (keep the heading square to the ground, against rounding)
  f.h = unit(add(f.h, scale(f.p, -dot(f.h, f.p))));
  f.km += s * KM;
  return f;
}

// The autopilot: the stick input that turns towards `target` (a unit vector)
// and holds a cruising height.
export function autopilot(f, target) {
  let d = bearingTo(f.p, target) - bearingOf(f.p, f.h);
  d = ((d + 540) % 360) - 180;
  const far = angle(f.p, target);
  // (well off the nose it slows down to turn tighter: a U-turn at cruising
  // speed is a thousand kilometres round; and close by and off the nose too,
  // or it would go round and round the place outside its turning circle)
  const tight = (2.5 * SPEED.cruise) / TURN;
  return {
    turn: Math.max(-1, Math.min(1, d / 35)),
    climb: Math.max(-1, Math.min(1, (ALT.start - f.alt) * 40)),
    boost: far > 0.35 && Math.abs(d) < 25,
    slow: Math.abs(d) > 40 || (far < tight && Math.abs(d) > 30),
  };
}

// What's happened on arriving: a stamp at each new place within reach, and
// a welcome home after being away. `stamped` is a Set of ids; `away` whether
// the plane has been well away from home since it was last there.
export function arrivals(f, stamped, away) {
  const ev = [];
  for (const s of STAMPS) {
    if (stamped.has(s.id)) continue;
    if (angle(f.p, s.v) < CAPTURE) {
      stamped.add(s.id);
      ev.push({ type: 'stamp', id: s.id });
    }
  }
  const fromHome = angle(f.p, HOME_V);
  if (away && fromHome < CAPTURE) ev.push({ type: 'home' });
  return { ev, away: fromHome < CAPTURE ? false : away || fromHome > CAPTURE * 6 };
}

// the nearest place not yet stamped, and how far and which way it is
export function nextStamp(f, stamped) {
  let best = null;
  for (const s of STAMPS) {
    if (stamped.has(s.id)) continue;
    const a = angle(f.p, s.v);
    if (!best || a < best.a) best = { a, s };
  }
  if (!best) return null;
  let rel = bearingTo(f.p, best.s.v) - bearingOf(f.p, f.h);
  rel = ((rel + 540) % 360) - 180;
  return { id: best.s.id, name: best.s.name, km: best.a * KM, rel };
}

// ── the flight log ──

// The trail flown: `trail` is a list of points on the sphere; `p` is added
// when it's TRAIL.step or more from the last, and the oldest go once there
// are TRAIL.max. Returns whether a point was added.
export function logTrail(trail, p) {
  const last = trail[trail.length - 1];
  if (last && angle(last, p) < TRAIL.step) return false;
  trail.push([p[0], p[1], p[2]]);
  if (trail.length > TRAIL.max) trail.splice(0, trail.length - TRAIL.max);
  return true;
}

// The route from a to b along the great circle: n + 1 points, evenly spaced.
export function routeArc(a, b, n) {
  const total = angle(a, b);
  if (total < 1e-9) return Array.from({ length: n + 1 }, () => [a[0], a[1], a[2]]);
  const axis = unit(cross(a, b));
  return Array.from({ length: n + 1 }, (_, i) => (i === 0 ? [a[0], a[1], a[2]] : i === n ? [b[0], b[1], b[2]] : unit(rotate(a, axis, (total * i) / n))));
}

// how far round the world a distance flown comes to, 0 to 1
export const aroundWorld = (km) => Math.max(0, Math.min(1, km / AROUND_KM));

// ── the sun ──

// Where the sun is overhead at a moment: its latitude from the season, its
// longitude from the time of day (UTC). Good to a degree or two, which is
// all the day and night on the globe need.
export function subsolar(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = (date.getTime() - start) / 86400000;
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365.24) * (day + 10));
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const lon = (((-(hours - 12) * 15 + 540) % 360) - 180);
  return [lon, decl];
}
export const sunVec = (date) => toVec(...subsolar(date));
// is it day at p? (the sun more than a little over the horizon)
export const daylight = (p, sun) => dot(p, sun) > -0.05;

// Which sea a point is over, roughly, for "Over the Atlantic": by latitude
// and longitude boxes, good enough for the routes a plane from Syracuse takes.
export function seaName([lon, lat]) {
  if (lat > 66) return 'the Arctic Ocean';
  if (lat < -58) return 'the Southern Ocean';
  if (lat > 30 && lat < 46 && lon > -6 && lon < 36) return 'the Mediterranean';
  if (lat > 8 && lat < 31 && lon > -98 && lon < -59) return 'the Caribbean Sea';
  if (lon >= 20 && lon < 120 && lat < 30) return 'the Indian Ocean';
  if ((lon >= -70 && lon < 20) || (lon >= -100 && lon < -70 && lat > 8)) return 'the Atlantic';
  return 'the Pacific';
}
