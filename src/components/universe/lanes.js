// Where the traffic flies, as plain numbers (no three.js), so it's tested in
// Node. A lane is a gentle curve (a quadratic Bézier: three points in map
// space) that something follows from one end to the other.
//
// laneBetween(rand, { high }) is everyday traffic: from beside one place to
// beside another, well above or below the disc the planets sit on (so it
// never meets a planet, a station, the sun or you), or, for the big ships,
// higher still, across the whole map. flybyLane(ship, rand) is traffic that
// comes to you: from ahead of the ship, at its height, past one side of it
// close enough to see (and shoot), and on behind; none when that would take
// it through a planet. laneNear(ship, rand) is the traffic out in deep
// space, where there are no places to go between: across the space ahead
// of you, from one side to the other, near enough to see. convoyLane(ship,
// rand) is a long straight run past you at a good distance, for a convoy.

import { MAP_RADIUS, ORDER, POSITIONS, REACH } from './layout';
import { SOLIDS, forward } from './ship';

const LOW = [5, 9]; // how far above or below the disc everyday traffic flies (clear of the tallest planet and its moons)
const HIGH = [12, 20]; // and the big ships
const FLYBY = { ahead: [20, 30], side: [0.9, 1.8] };

export function bezier([a, b, c], t, out = [0, 0, 0]) {
  const u = 1 - t;
  for (let i = 0; i < 3; i++) out[i] = u * u * a[i] + 2 * u * t * b[i] + t * t * c[i];
  return out;
}

// the direction along the lane at t (not normalised)
export function tangent([a, b, c], t, out = [0, 0, 0]) {
  for (let i = 0; i < 3; i++) out[i] = 2 * (1 - t) * (b[i] - a[i]) + 2 * t * (c[i] - b[i]);
  return out;
}

export function laneLength(pts, steps = 24) {
  let len = 0;
  let prev = bezier(pts, 0);
  for (let i = 1; i <= steps; i++) {
    const p = bezier(pts, i / steps);
    len += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
    prev = p;
  }
  return len;
}

// how close the lane comes to anything solid, past its surface (negative: through it)
export function clearance(pts, solids = SOLIDS, steps = 40) {
  let min = Infinity;
  for (let i = 0; i <= steps; i++) {
    const p = bezier(pts, i / steps);
    for (const o of solids) min = Math.min(min, Math.hypot(p[0] - o.at[0], p[1] - o.at[1], p[2] - o.at[2]) - o.r);
  }
  return min;
}

const between = (rand, [a, b]) => a + rand() * (b - a);

// a point beside a place, out past its moons, at height y
function beside(id, rand, y) {
  const [x, , z] = POSITIONS[id];
  const a = rand() * Math.PI * 2;
  const d = REACH[id] + 1.5 + rand() * 2;
  return [x + Math.cos(a) * d, y, z + Math.sin(a) * d];
}

export function laneBetween(rand, { high = false } = {}) {
  const side = rand() < 0.5 ? -1 : 1;
  if (high) {
    // the big ships: right across the map, high up, slowly
    const a = rand() * Math.PI * 2;
    const b = a + Math.PI * (0.65 + rand() * 0.7);
    const r = MAP_RADIUS * (0.75 + rand() * 0.35);
    const y = side * between(rand, HIGH);
    const p0 = [Math.cos(a) * r, y, Math.sin(a) * r];
    const p2 = [Math.cos(b) * r, y + (rand() - 0.5) * 2, Math.sin(b) * r];
    return [p0, [(p0[0] + p2[0]) * 0.3, y, (p0[2] + p2[2]) * 0.3], p2];
  }
  const i = Math.floor(rand() * ORDER.length);
  let j = Math.floor(rand() * (ORDER.length - 1));
  if (j >= i) j += 1;
  const y = side * between(rand, LOW);
  const p0 = beside(ORDER[i], rand, y);
  const p2 = beside(ORDER[j], rand, y + (rand() - 0.5) * 1.5);
  // the middle bows out to one side, and a little further from the disc
  const mx = (p0[0] + p2[0]) / 2;
  const mz = (p0[2] + p2[2]) / 2;
  const dx = p2[0] - p0[0];
  const dz = p2[2] - p0[2];
  const len = Math.hypot(dx, dz) || 1;
  const bow = (rand() - 0.5) * 0.5 * len;
  return [p0, [mx - (dz / len) * bow, y + side * rand() * 1.5, mz + (dx / len) * bow], p2];
}

// ship: { x, y, z, heading }. Half the time it crosses in front of the
// nose (so a shot timed right will hit it), otherwise it comes from ahead and
// passes close beside the ship. A few shapes of each are tried, on both
// sides: from straight on to peeling away wide and early (behind the ship
// there's often the planet it just left); the first that's clear of
// everything wins.
const SHAPES = [
  { behind: 14, sweep: 2.5, rise: -0.3 },
  { behind: 9, sweep: 6, rise: 1.2 },
  { behind: 5, sweep: 10, rise: 2.5 },
];
const CROSS = [4.5, 7, 10]; // how far ahead of the nose a crossing passes
export function laneNear(ship, rand) {
  const [fx, fz] = forward(ship.heading);
  const rx = -fz;
  const rz = fx;
  for (let i = 0; i < 6; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    const ahead = 30 + rand() * 70;
    const off = 18 + rand() * 30;
    const y = ship.y + (rand() - 0.5) * 16;
    const p0 = [ship.x + fx * ahead + rx * side * off, y, ship.z + fz * ahead + rz * side * off];
    const p2 = [ship.x + fx * (ahead * 0.4 - 25) - rx * side * off, y + (rand() - 0.5) * 6, ship.z + fz * (ahead * 0.4 - 25) - rz * side * off];
    const p1 = [(p0[0] + p2[0]) / 2 + fx * 10, (p0[1] + p2[1]) / 2, (p0[2] + p2[2]) / 2 + fz * 10];
    const pts = [p0, p1, p2];
    if (clearance(pts) > 2) return pts;
  }
  return null;
}

export function convoyLane(ship, rand) {
  const [fx, fz] = forward(ship.heading);
  const rx = -fz;
  const rz = fx;
  for (let i = 0; i < 8; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    const off = 7 + rand() * 6; // to one side of you
    const y = ship.y - 0.6 + rand() * 1.4;
    // from well ahead to well behind, past you
    const p0 = [ship.x + fx * 55 + rx * side * off, y, ship.z + fz * 55 + rz * side * off];
    const p2 = [ship.x - fx * 45 + rx * side * (off + 6), y, ship.z - fz * 45 + rz * side * (off + 6)];
    const pts = [p0, [(p0[0] + p2[0]) / 2, y, (p0[2] + p2[2]) / 2], p2];
    if (clearance(pts) > 1.5) return pts;
  }
  return null;
}

export function flybyLane(ship, rand, { cross = rand() < 0.5 } = {}) {
  const [fx, fz] = forward(ship.heading);
  const rx = -fz; // the ship's right
  const rz = fx;
  const first = rand() < 0.5 ? -1 : 1;
  const ahead = between(rand, FLYBY.ahead);
  const offset = between(rand, FLYBY.side);
  const y = ship.y + 0.15 + rand() * 0.35;
  const through = (p0, p1, p2) => [p0, [0, 1, 2].map((i) => 2 * p1[i] - (p0[i] + p2[i]) / 2), p2]; // the middle point pulls the curve through p1 halfway along
  if (cross) {
    for (const d of CROSS) {
      for (const sign of [first, -first]) {
        const p0 = [ship.x + fx * (d + 8) + rx * sign * 12, y + 0.4, ship.z + fz * (d + 8) + rz * sign * 12];
        const p1 = [ship.x + fx * d, y, ship.z + fz * d];
        const p2 = [ship.x + fx * (d - 6) - rx * sign * 12, y + 0.2, ship.z + fz * (d - 6) - rz * sign * 12];
        const pts = through(p0, p1, p2);
        if (clearance(pts) > 0.6) return pts;
      }
    }
  }
  for (const shape of SHAPES) {
    for (const sign of [first, -first]) {
      const side = sign * offset;
      const p0 = [ship.x + fx * ahead + rx * side * 3, y + 0.6, ship.z + fz * ahead + rz * side * 3];
      const p1 = [ship.x + rx * side, y, ship.z + rz * side]; // where it passes the ship
      const p2 = [ship.x - fx * shape.behind + rx * side * shape.sweep, y + shape.rise, ship.z - fz * shape.behind + rz * side * shape.sweep];
      const pts = through(p0, p1, p2);
      if (clearance(pts) > 0.6) return pts;
    }
  }
  return null;
}
