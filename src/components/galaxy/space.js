// A star system as somewhere to fly: the space ship.js's step() and
// autopilot() fly the ship through (universe/ship.js's SPACE has the same
// shape). Pure numbers, so it's tested in Node.
//
// A system is free all the way round: no disc to keep to, so the ceiling and
// the floor are a long way off (CEILING), and it ends at EDGE, where the ship
// is turned back (beyond it there's only hyperspace: the way to the next
// system is a jump, not a flight). Near the planet and the big things round
// it the boost is the boost; out in the open between them it opens up into
// the sublight drive (up to PULSE), so crossing the system doesn't drag, and
// drops back as you come up on anything (so you never arrive at it flat out).
//
// How open it is goes by what's ahead, the way the universe map's deep space
// does it (deep.js's gapAlong): something off to the side counts as DRIVE.wide
// times further than it is, and something behind you all of it, so flying past
// a moon, round the planet or out of a battle keeps the drive open, and only
// what the nose is on closes it. It used to count everything round you, in
// every direction, from anything a rock's size up: a moon passed 20 units off
// pinned the ship at the boost (12, from 62) for a hundred units either side
// of it, and a battle's hulls held a whole stretch of the system down, which
// flew like glue. And it closes at a steady rate (DRIVE.decel: the speed the
// drive allows at a gap is what braking that hard from there would leave),
// not the old smoothstep, whose middle braked twice as hard as its ends.
// A planet counts from just over its surface (DRIVE.air), not from its reach:
// the worlds are grown (fit.js), so Hoth's reach is 150 units of air over its
// ground, and the drive shut all through it took twelve seconds at the boost
// to climb out of.
//
// makeSpace(solids) → { edge, ceilingAt, openness, driveAt, driveAlong, homeAt, boostAt, brakeAt, coastAt, drop, solids, goals }
// solids: [{ id, at: [x, y, z], r, reach, band?, swallow? }]: what the ship
// bumps into (the planet, its moons, the Death Star, the big rocks…); the
// ones with `goal` are somewhere the autopilot can take you.

import { SHIP, headingTo } from '../universe/ship';
import { conj, fromAngles, rotate } from '../universe/orient';

export const EDGE = 900;
export const CEILING = 420;
export const PULSE = 62;
export const DRIVE = {
  near: 16, // past a thing's reach: closer than this (the way you're going), the drive's down to the boost
  decel: 16, // map units a second, a second: how hard it slows you coming up on something, all the way in
  wide: 6, // something off the nose counts this many times as far as it's off to the side
  big: 3, // what's smaller than this (its reach) never closes the drive: you bump off a rock, it doesn't hold you
  drop: 120, // the hardest it pulls you back to what it allows (the universe map's SHIP.drop, 340, is a wall at these speeds)
  air: 0.15, // a planet's, of its radius over its surface: where its drive's down
};
const PARK = 6; // how far past a goal's reach the autopilot stops

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// how far it is to `o` going the way `f` points (a unit vector; null, every way alike)
function gapAlong(x, y, z, f, o) {
  const reach = o.planet ? o.r * (1 + DRIVE.air) : (o.reach ?? o.r);
  const cx = o.at[0] - x;
  const cy = o.at[1] - y;
  const cz = o.at[2] - z;
  const d = Math.sqrt(cx * cx + cy * cy + cz * cz);
  if (!f) return d - reach;
  const along = cx * f[0] + cy * f[1] + cz * f[2];
  const miss = along > 0 ? Math.sqrt(Math.max(0, d * d - along * along)) : d; // (going away: all of it)
  return d - reach + DRIVE.wide * Math.max(0, miss - reach);
}

// how open the drive is `gap` out: the speed braking at DRIVE.decel from
// there would still have at DRIVE.near, as a share of the way from the boost
// to PULSE
export function openAt(gap) {
  const b = SHIP.boost;
  const v = Math.sqrt(b * b + 2 * DRIVE.decel * Math.max(0, gap - DRIVE.near));
  return clamp((v - b) / (PULSE - b), 0, 1);
}

export function makeSpace(solids, { edge = EDGE, ceiling = CEILING } = {}) {
  const goals = Object.fromEntries(solids.filter((o) => o.goal).map((o) => [o.id, o]));
  // what can close the drive: the planet, its moons, the places to go, and
  // anything else big (a capital ship's hull, a boulder, a shield)
  const big = solids.filter((o) => o.goal || o.planet || o.id?.startsWith('moon-') || Math.max(o.sr ?? 0, o.reach ?? o.r) >= DRIVE.big);
  const driveAlong = (x, y, z, f = null) => {
    let gap = Infinity;
    for (const o of big) {
      if (!((o.reach ?? o.r) > 0)) continue; // (gone: a wreck, a shield that's down)
      const g = gapAlong(x, y, z, f, o);
      if (g < gap) gap = g;
    }
    return openAt(gap);
  };
  const openness = (x, y, z) => driveAlong(x, y, z, null);
  return {
    edge,
    ceilingAt: () => ceiling,
    openness,
    driveAt: openness, // (how far the sublight drive's open: all of how open it is)
    driveAlong, // (and the way the nose points: what ship.js flies by)
    homeAt: () => 0, // (none of the universe map's home-system handling)
    // (`open`, how open the drive is, if ship.js knows it already: less, held down by hunters)
    boostAt: (x, y, z, boost = SHIP.boost, open = openness(x, y, z)) => boost + (PULSE - boost) * open,
    brakeAt: (x, y, z, open = openness(x, y, z)) => SHIP.brake * (1 + 2.5 * open),
    coastAt: (x, y, z, open = openness(x, y, z)) => SHIP.coast * (1 + 3.5 * open),
    drop: DRIVE.drop,
    solids,
    goals,
  };
}

// Where the autopilot parks at a goal, coming from `from` ([x, y, z]): out
// past its reach on the side it's coming from, level with its middle a
// little above, facing it; clear of everything else solid (round to the next
// side along if not). { x, y, z, heading }
export function parkBy(goal, from, solids = []) {
  const d = (goal.reach ?? goal.r) + PARK;
  let ax = from[0] - goal.at[0];
  let az = from[2] - goal.at[2];
  const al = Math.hypot(ax, az) || 1;
  ax /= al;
  az /= al;
  const a0 = Math.atan2(az, ax);
  for (let i = 0; i < 16; i++) {
    const a = a0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 8);
    const x = goal.at[0] + Math.cos(a) * d;
    const z = goal.at[2] + Math.sin(a) * d;
    const y = goal.at[1] + Math.min(goal.r * 0.25, 6);
    const clear = solids.every((o) => o === goal || Math.hypot(x - o.at[0], y - o.at[1], z - o.at[2]) > (o.reach ?? o.r) + 2);
    if (clear) return { x, y, z, heading: headingTo(goal.at[0] - x, goal.at[2] - z) };
  }
  const x = goal.at[0] + ax * d;
  const z = goal.at[2] + az * d;
  return { x, y: goal.at[1], z, heading: headingTo(goal.at[0] - x, goal.at[2] - z) };
}

const gapTo = (ship, o) => Math.hypot(ship.x - o.at[0], ship.y - o.at[1], ship.z - o.at[2]) - (o.reach ?? o.r);

// The goal the ship is at, if any (inside its reach and a little more);
// once at one it stays at it until it's clearly left
export function atGoal(ship, goals, current = null) {
  if (current && goals[current] && gapTo(ship, goals[current]) < PARK * 3) return current;
  let best = null;
  let bd = PARK * 1.6;
  for (const id in goals) {
    const o = goals[id];
    const d = gapTo(ship, o);
    if (d < bd) {
      best = o.id;
      bd = d;
    }
  }
  return best;
}

// How well the nose points along `dir` (a unit vector): the cosine of the
// angle between them, from ship.js's numbers
export function aligned(ship, dir) {
  const cp = Math.cos(ship.pitch || 0);
  const f = [-Math.sin(ship.heading) * cp, Math.sin(ship.pitch || 0), -Math.cos(ship.heading) * cp];
  return f[0] * dir[0] + f[1] * dir[1] + f[2] * dir[2];
}

// The stick that swings the nose round onto `dir` (a unit vector), the way a
// pilot would before a jump: turn and pull toward it in the ship's own frame
// (damped, so the turns' inertia doesn't carry it past), rolling level as it
// goes. { turn, climb, roll }
export function steerToward(ship, dir) {
  const q = fromAngles(ship.heading, ship.pitch || 0, ship.bank || 0);
  const b = rotate(conj(q), dir);
  const yaw = Math.atan2(-b[0], -b[2]); // > 0: off to the left
  const tip = Math.atan2(b[1], Math.sqrt(b[0] * b[0] + b[2] * b[2])); // > 0: above the nose
  return {
    turn: clamp(-yaw * 2.2 + (ship.rate || 0) * 0.12, -1, 1),
    climb: clamp(tip * 2.2 - (ship.tipRate || 0) * 0.12, -1, 1),
    roll: clamp(-(ship.bank || 0) * 1.5 * Math.cos(ship.pitch || 0), -1, 1),
  };
}
