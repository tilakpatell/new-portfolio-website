import { forward } from '../universe/ship';

// The flight cluster's radar (FlightCluster.jsx, drawn by galaxy/scene.js):
// top-down in the ship's frame, nose up. A contact's x is to the ship's
// right and y ahead of it, both −1…1 of the range; past the range it's
// pinned to the rim, and one well above or below the ship says so (up).
// The range closes to a dogfight's when a hostile is near.

export const RANGE = { fight: 40, cruise: 160 };
const LEVEL = 3; // (units above or below that still count as level)

const xyz = (a) => (Array.isArray(a) ? a : [a.x, a.y, a.z]);

export function rangeFor(ship, hostiles) {
  for (const c of hostiles) {
    const [x, , z] = xyz(c.at);
    if (Math.hypot(x - ship.x, z - ship.z) <= RANGE.fight) return RANGE.fight;
  }
  return RANGE.cruise;
}

export function radarPoints(ship, contacts, range) {
  // the ship's nose on the ground plane, and its right: a quarter turn round
  // from the nose about the up axis, so that a contact to the right plots at x > 0
  const [fx, fz] = forward(ship.heading);
  const rx = -fz;
  const rz = fx;
  const out = [];
  for (const c of contacts) {
    const [x, y, z] = xyz(c.at);
    const dx = x - ship.x;
    const dz = z - ship.z;
    let px = (dx * rx + dz * rz) / range;
    let py = (dx * fx + dz * fz) / range;
    const d = Math.hypot(px, py);
    const rim = d > 1;
    if (rim) {
      px /= d;
      py /= d;
    }
    const dy = y - ship.y;
    out.push({ id: c.id, kind: c.kind, x: px, y: py, up: dy > LEVEL ? 1 : dy < -LEVEL ? -1 : 0, rim, lock: Boolean(c.lock) });
  }
  return out;
}
