// An escort (director.js's 'escort'): an ordinary ship of your universe (a
// Rebel transport, a family saucer, a Madrigal freighter: sides.js's
// distress.civil) drops in beside you and asks to be seen to the next place
// along. It flies there slower than your cruise; pirates come for it twice
// on the way; while they're on it its hull wears down. Bring it there (or
// far enough that it can make the jump) and it thanks you; lose it and the
// crew say so. Pure (no three.js), so it's tested in Node; the scene flies
// it with traffic.js and sends the pirates with hunters.js.
//
// escortTo(ship, places) → the place it asks to go to: the nearest one
//   ahead of you that isn't where you are (else the nearest that isn't), or null
// escortPlan({ from, to, reach, speed, most }) → { path: [from, mid, end],
//   length, time, arrives, pirates: [{ at: seconds in, where: [x, y, z] }] }:
//   straight toward `to`, stopping short of it (ESCORT.stop of its `reach`),
//   or after ESCORT.most units, where it jumps (arrives: false)
// escortHull(hull, pirates, dt) → its hull (1 whole, 0 lost) after dt
//   seconds with that many pirates on it

import { SHIP, forward } from './ship';

export const ESCORT = {
  speed: SHIP.cruise * 0.85, // map units a second (you keep up at cruise)
  most: 240, // the furthest it goes before it can make the jump
  stop: 1.6, // of a place's reach: where it stops short of it
  pirates: [0.3, 0.65], // of the way along, when the pirates come
  near: 30, // map units: a pirate this close to it is on it
  bite: 0.012, // of its hull a second, each pirate on it
  here: 3, // of a place's radius (and HERE_PAD more): you're at it
};
const HERE_PAD = 10;

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function escortTo(ship, places) {
  const at = [ship.x, ship.y, ship.z];
  const [fx, fz] = forward(ship.heading);
  const away = places.filter((p) => dist(p.at, at) > p.r * ESCORT.here + HERE_PAD);
  const ahead = away.filter((p) => {
    const dx = p.at[0] - at[0];
    const dz = p.at[2] - at[2];
    return (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1) > 0.5;
  });
  const nearest = (list) => list.reduce((best, p) => (!best || dist(p.at, at) < dist(best.at, at) ? p : best), null);
  return nearest(ahead) ?? nearest(away);
}

export function escortPlan({ from, to, reach = 0, speed = ESCORT.speed, most = ESCORT.most }) {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const full = Math.hypot(...d) || 1;
  const u = d.map((v) => v / full);
  const stopAt = Math.max(0, full - reach * ESCORT.stop);
  const length = Math.min(most, stopAt);
  const point = (k) => from.map((v, i) => v + u[i] * length * k);
  const time = length / speed;
  return {
    path: [point(0), point(0.5), point(1)],
    length,
    time,
    arrives: length >= stopAt,
    pirates: ESCORT.pirates.map((k) => ({ at: k * time, where: point(k) })),
  };
}

export const escortHull = (hull, pirates, dt) => Math.max(0, hull - pirates * ESCORT.bite * dt);
