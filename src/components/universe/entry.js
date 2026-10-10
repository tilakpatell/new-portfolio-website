// Flying down into a planet's air to land, as plain numbers (no three.js),
// so it's tested in Node: scene.js asks it whether the ship is going in,
// footScene.js flies the way down it gives, and reentry.js draws the show
// from its timeline.
//
// Every fandom planet has air round it, out to AIR of its radius (the halo
// planets.js draws reaches exactly as far, so what glows round a planet is
// what you fly into). Come down through it at a normal speed and it takes
// the ship: a glide on round the planet to a spot ahead of where it went
// in, slowing to a stop over it, then a settle straight down onto the
// planet's landing. Come down through it too fast (boosting) and nothing
// takes the ship: it carries on into the ground and ship.js's step() calls
// it a crash, as it always has. The stations, the Star Wars gate and
// anything airless have no air, so nothing changes for them.
//
// The way down is in the planet's own frame, as foot.js has it: its middle
// at the origin, a point on the ground as a unit vector out from it (n),
// and a height above the ground (h).

import { facingAlong, rotate as about, vec } from './foot';
import { NOSE, fromAngles, rotate } from './orient';
import { PLANETS } from './ship';
import { byId } from './universes';

const { dot, cross, add, scale, len, unit } = vec;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// 0 before a, 1 after b, easing in and out between
const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

export const AIR = 1.2; // the air's top as a share of a planet's radius (planets.js's halo reaches exactly as far and will import this)

export const ENTRY = {
  fast: 10, // map units/s: any faster through the air is no landing; the ship carries on and crashes (SHIP.cruise 3.3, SHIP.boost 12)
  sink: 0.15, // map units/s toward the planet's middle, at least, to count as going in (skimming the top isn't)
  clear: 1.5, // map units over the air's top a ship takes off to (and waits at, while it's down), so it's well out of it
  arc: [0.22, 0.85], // radians round the planet from where it went in to the spot: least, most
  lean: 0.6, // radians, at most, the spot leans toward the day side
  day: 0.5, // dot(spot, light) it leans toward: no lean once it's that far into the day
  glide: 4.6, // seconds from the air's top to over the spot
  settle: 1.3, // seconds from over the spot down onto it
};

// the planets with air to fly into and a landing under it: not the
// stations, not the gate (flown into, it's a jump), nothing airless
export const LANDABLE = PLANETS.filter((p) => {
  const u = byId(p.id);
  return u.kind !== 'core' && !u.portal && !u.airless;
});

export const airTop = (p) => p.r * AIR;

const posOf = (s) => [s.x, s.y, s.z];

// Which way the ship is actually going, and how fast, in the map's axes:
// along its nose at its speed, with the climb step() reports (its nose's
// share and the lift that eases it back from the ceiling), or worked out
// the same way for a ship that hasn't been stepped yet.
export function velocityOf(s) {
  const f = rotate(fromAngles(s.heading, s.pitch || 0, s.bank || 0), NOSE);
  const v = s.speed || 0;
  const vy = typeof s.vy === 'number' ? s.vy : f[1] * v + (s.lift || 0);
  return [f[0] * v, vy, f[2] * v];
}

// Whether the ship is going into a planet's air this frame: the first one
// (of `planets`) it's inside the air of and coming down through. 'enter'
// is a landing; 'hot'
// is too fast for one, so nothing takes it and it carries on to crash (the
// HUD says so while it's in the air). With where it went in (n, out from
// the middle, and h, its height above the ground) and how (vel), for the
// way down. Null when it isn't going into any.
export function entering(s, planets = LANDABLE) {
  const pos = posOf(s);
  for (const p of planets) {
    const off = add(pos, p.at, -1);
    const d = len(off);
    if (d >= airTop(p) || d < 1e-9) continue;
    const n = scale(off, 1 / d);
    const vel = velocityOf(s);
    // (skimming along the top, or climbing out, isn't going in)
    const sink = -dot(vel, n);
    if (sink < ENTRY.sink) continue;
    const speed = len(vel);
    return { id: p.id, kind: speed > ENTRY.fast ? 'hot' : 'enter', speed, sink, n, h: d - p.r, vel };
  }
  return null;
}

// What entering() will say should the ship hold its course into the air of
// `p` (one of LANDABLE), if it gets there within `within` seconds: the
// same, where its line first meets the air's top, and `t`, the seconds
// till then. Null if it's in the air already, isn't closing on it, passes
// it by, gets there later, or would only skim in (so scene.js can fetch
// the place it'll come down on before it's there: footScene.js's prefetchAt)
export function entryAhead(s, p, within = 2) {
  const off = add(posOf(s), p.at, -1);
  const top = airTop(p);
  const d = len(off);
  if (d < top) return null;
  const vel = velocityOf(s);
  // (where the line from the ship along vel meets the sphere of the air's
  // top: the nearer root of |off + vel·t| = top)
  const b = dot(off, vel);
  if (!(b < 0)) return null;
  const a = dot(vel, vel);
  const disc = b * b - a * (d * d - top * top);
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  if (!(t <= within)) return null;
  const n = unit(add(off, vel, t));
  const sink = -dot(vel, n);
  if (sink < ENTRY.sink) return null;
  const speed = len(vel);
  return { id: p.id, kind: speed > ENTRY.fast ? 'hot' : 'enter', speed, sink, n, h: top - p.r, vel, t };
}

// Where an entry comes down: on ahead along the ship's ground track from
// where it went in (n), as far round as a ship slowing from `speed` to a
// stop over the glide would go (held to ENTRY.arc), so you land roughly
// where you were heading. Then, should that be on the night side of
// `light` (a unit direction toward the sun), leaned round toward the day,
// by no more than ENTRY.lean. { n: the spot, f: the way it's heading along
// the ground when it gets there }.
export function entrySpot({ n, track, light = null, speed, R }) {
  const arc = clamp((speed * ENTRY.glide * 0.5) / R, ENTRY.arc[0], ENTRY.arc[1]);
  // (straight down, any way along the ground will do)
  const ahead = facingAlong(n, track);
  let spot = unit(add(scale(n, Math.cos(arc)), ahead, Math.sin(arc)));
  if (light) {
    const lit = dot(spot, light);
    if (lit < ENTRY.day) {
      const lean = Math.min(ENTRY.lean, Math.acos(clamp(lit, -1, 1)) - Math.acos(ENTRY.day));
      // round the great circle toward the light (from right under the night
      // side, every way is toward it: on the way it was going)
      const k = cross(spot, light);
      const axis = len(k) > 1e-6 ? unit(k) : unit(cross(spot, facingAlong(spot, ahead)));
      spot = unit(about(spot, axis, lean));
    }
  }
  const k = cross(n, spot);
  const f = len(k) > 1e-6 ? unit(cross(unit(k), spot)) : facingAlong(spot, track);
  return { n: spot, f };
}

// The way down, in the planet's frame: from where it went in (nE, hE above
// the ground) to over the spot (nS, hH above it), then down to `rest` (the
// ship's middle above the ground, parked). Over the glide its ground point
// goes round the great circle from nE to nS, slowing to a stop over the
// spot (as fast at the start as the ship came in, when entrySpot's arc
// isn't held), and its height falls fast at first and levels off at the
// hover (in already lower than that, it stays at the height it came in
// at); then it settles straight down. It never goes back up, but for a
// ship that came in lower than `rest`, which rises to it: it always ends
// parked there, never under the ground. `track`, the ship's velocity, says
// which way round to go should the spot be right the other side of the
// planet. { T, at(t) → { n, h, p, settling, done } }, t in seconds from
// the air's top.
export function entryPath({ nE, hE, nS, hH, rest, R, track = null }) {
  const G = ENTRY.glide;
  const S = ENTRY.settle;
  const T = G + S;
  const from = unit(nE);
  const to = unit(nS);
  // (never up: the hover no higher than it came in; but never under
  // `rest`, so a ship that came in that low parks where it should rather
  // than with its hull in the ground)
  const hover = Math.max(rest, Math.min(hH, hE));
  const k = cross(from, to);
  const theta = Math.atan2(len(k), dot(from, to));
  let axis = k;
  if (len(axis) < 1e-6) {
    // the spot where it went in, or right the other side: round the way it was going, or any way
    axis = track ? cross(from, track) : [0, 0, 0];
    if (len(axis) < 1e-6) axis = cross(from, facingAlong(from, [0, 1, 0]));
  }
  axis = unit(axis);
  const point = (n, h, settling, done) => ({ n, h, p: scale(n, R + h), settling, done });
  const at = (t) => {
    t = clamp(t, 0, T);
    if (t <= G) {
      const g = t / G;
      const u = 1 - (1 - g) ** 2; // the ground covered, slowing to a stop over the spot
      return point(unit(about(from, axis, theta * u)), hover + (hE - hover) * (1 - g) ** 3, false, false);
    }
    return point([...to], hover + (rest - hover) * smooth(0, 1, (t - G) / S), true, t >= T);
  };
  return { T, at };
}

// The show's numbers, t seconds into an entry, each 0 … 1: the burn of
// hitting the air (the bow shock, the sparks, the rumble), the cloud deck
// rushing past and the white-out at its thickest, the sky coming up from
// black to the landing's own, the camera's shake, and whether it's out
// under the clouds yet (when the place's name comes up). All of it over
// the glide; by the settle it's clear sky.
export function fxAt(t) {
  const G = ENTRY.glide;
  const burn = smooth(0, 0.5, t) * (1 - smooth(0.38 * G, 0.6 * G, t));
  const cloud = smooth(0.45 * G, 0.62 * G, t) * (1 - smooth(0.62 * G, 0.8 * G, t));
  const white = 0.85 * smooth(0.52 * G, 0.62 * G, t) * (1 - smooth(0.62 * G, 0.74 * G, t));
  const sky = smooth(0.1 * G, 0.7 * G, t);
  return { burn, cloud, white, sky, shake: Math.min(1, burn * 0.6 + cloud * 0.25), title: t >= 0.75 * G };
}
