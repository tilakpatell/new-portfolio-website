// The ship on a hyperlane (hyperlanes.js): getting on, riding at the lane's
// speed with the traffic, and getting off. Pure, tested in Node; the scene
// keeps the ride (state.ride) and, while there is one, runs this in place of
// ship.js's step and puts the ship where poseOf says.
//
// Getting on: through a node's ramp ring (within RING of a ramp or a beacon,
// flying out along one of its lanes within 40°), or by merging (inside a
// carriageway, flying along it within 25°, at the boost or faster, the
// throttle forward). On it, the speed spools from what the ship came in at
// to the lane's over SPOOL seconds; the stick moves the ship across the tube
// at DRIFT a second, held inside it. Getting off: hold the throttle back for
// half a second, or push on against the tube's side past R × 1.3 (out: the
// speed it had, on the lane's heading, falls back through ship.js's drop),
// or come to the end of the lane (out at the node's off-ramp at the boost,
// unless the throttle's forward and a lane carries on from there: then
// straight onto it).

import { LANES, NODES, R, RING, TIERS, carriageway, laneAt } from './hyperlanes';
import { bezier, tangent } from './lanes';
import { SHIP, headingTo, noseOf } from './ship';

export const SPOOL = 2.5; // seconds from the speed it came in at to the lane's
export const DRIFT = 4; // map units a second across the tube, the stick all the way
const RING_ANGLE = (40 * Math.PI) / 180; // how far off a lane's way out a ship can come through the ring
const MERGE_ANGLE = (25 * Math.PI) / 180; // and merge in, mid-lane
const ON_ANGLE = (30 * Math.PI) / 180; // straight on through a junction: the next lane this near the way it's going
const BACK = 0.5; // seconds of the throttle held back to drop out
const SETTLE = 8; // map units a second it's drawn in to the tube, come in through a ring off its middle
const BANK = 0.35; // radians it leans into a drift

const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const smooth = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

// the tube's frame at s: where its middle is, the way along it, and the
// right and up across it
function frame(lane, way, s) {
  const pts = carriageway(lane, way);
  const at = bezier(pts, s);
  const along = unit(tangent(pts, s));
  const right = unit([-along[2], 0, along[0]]);
  const up = [right[1] * along[2] - right[2] * along[1], right[2] * along[0] - right[0] * along[2], right[0] * along[1] - right[1] * along[0]];
  return { at, along, right, up };
}

// the lanes leaving a node: { lane, way } for each, out along it
const leaving = (nodeId, lanes) => lanes.flatMap((l) => (l.from === nodeId ? [{ lane: l, way: 'out' }] : l.to === nodeId ? [{ lane: l, way: 'in' }] : []));
const endOf = (lane, way) => (way === 'out' ? lane.to : lane.from);

// a ride starting on `lane` going `way`, at s, from the ship where it is
function start(lane, way, s, ship) {
  const f = frame(lane, way, s);
  const d = [ship.x - f.at[0], (ship.y ?? 0) - f.at[1], ship.z - f.at[2]];
  return { lane, way, s, off: [dot(d, f.right), dot(d, f.up)], speed: Math.max(0, ship.speed), from: Math.max(0, ship.speed), age: 0, back: 0, strain: 0, bank: 0 };
}

// A ride, if the ship's getting on one now; null if not.
export function enter(ship, { lanes = LANES, nodes = NODES, throttle = 0 } = {}) {
  const nose = noseOf(ship);
  const y = ship.y ?? 0;
  // through a ring: the lane out of the node that's nearest the way it's going
  for (const n of nodes) {
    if (Math.hypot(ship.x - n.at[0], y - n.at[1], ship.z - n.at[2]) > RING) continue;
    let best = null;
    for (const o of leaving(n.id, lanes)) {
      const a = Math.acos(Math.min(1, dot(nose, frame(o.lane, o.way, 0).along)));
      if (a <= RING_ANGLE && (!best || a < best.a)) best = { ...o, a };
    }
    if (best) return start(best.lane, best.way, 0, ship);
  }
  // merging: in a carriageway, along it, quick enough, and meaning to
  if (ship.speed < SHIP.boost || throttle <= 0) return null;
  const at = laneAt(ship.x, y, ship.z, lanes);
  if (!at || at.off > R || at.s >= 1) return null;
  if (Math.acos(Math.min(1, dot(nose, frame(at.lane, at.way, at.s).along))) > MERGE_ANGLE) return null;
  return start(at.lane, at.way, at.s, ship);
}

// Where the ship is on its ride: { x, y, z, heading, pitch, bank, speed, vy }.
export function poseOf(ride) {
  const f = frame(ride.lane, ride.way, ride.s);
  const [u, v] = ride.off;
  return {
    x: f.at[0] + f.right[0] * u + f.up[0] * v,
    y: f.at[1] + f.right[1] * u + f.up[1] * v,
    z: f.at[2] + f.right[2] * u + f.up[2] * v,
    heading: headingTo(f.along[0], f.along[2]),
    pitch: Math.asin(Math.max(-1, Math.min(1, f.along[1]))),
    bank: ride.bank,
    speed: ride.speed,
    vy: ride.speed * f.along[1],
  };
}
// the ship as its ride poses it, turning and lifting nothing of its own
const posed = (ship, ride) => ({ ...ship, ...poseOf(ride), rate: 0, tipRate: 0, rollRate: 0, lift: 0, lean: 0, edge: false });

// One step of a ride: { ride (null once off it), ship, out: null | 'end' |
// 'dropped' }. `input` is the ship's: throttle, turn, climb; and `next`, the
// id of a lane the autopilot means to carry on onto at the end, if it can.
export function step(ride, ship, input = {}, dt = 0) {
  const throttle = input.throttle ?? 0;
  const top = TIERS[ride.lane.tier].speed;
  const age = ride.age + dt;
  const speed = ride.from + (top - ride.from) * smooth(age / SPOOL);
  // across the tube: the stick moves it, the tube's side holds it (pushing on
  // against the side strains, and past R × 1.3 of it, it's out); come in off
  // its middle through a ring, it's drawn in
  let [u, v] = ride.off;
  u += (input.turn ?? 0) * DRIFT * dt;
  v += (input.climb ?? 0) * DRIFT * dt;
  const was = Math.hypot(...ride.off);
  const room = was > R ? Math.max(R, was - SETTLE * dt) : R; // (drawn in from off its middle)
  let r = Math.hypot(u, v);
  let strain = ride.strain;
  if (r > room) {
    if (was <= R) strain += r - R; // (pushing on against the side)
    [u, v] = [(u * room) / r, (v * room) / r];
    r = room;
  } else strain = Math.max(0, strain - DRIFT * dt);
  const back = throttle < -0.5 ? ride.back + dt : 0;
  const bank = ride.bank + (-(input.turn ?? 0) * BANK - ride.bank) * Math.min(1, dt * 4);
  const s = Math.min(1, ride.s + (speed * dt) / ride.lane.length);
  let next = { ...ride, s, off: [u, v], speed, age, back, strain, bank };

  // dropped out: on the lane's heading, at the speed it had (pushed out
  // through the side: just past it, so it isn't straight back in)
  if (back >= BACK || (was <= R && r + strain > R * 1.3)) {
    const pushed = r + strain > R * 1.3 && r > 1e-6 ? { ...next, off: [(u / r) * R * 1.4, (v / r) * R * 1.4] } : next;
    return { ride: null, ship: posed(ship, pushed), out: 'dropped' };
  }
  if (s < 1) return { ride: next, ship: posed(ship, next), out: null };

  // the end of the lane: straight on through the node with the throttle
  // forward (onto the lane asked for, or one as quick going the same way)
  const node = endOf(ride.lane, ride.way);
  if (throttle > 0.5) {
    const along = frame(ride.lane, ride.way, 1).along;
    const rank = (t) => ['local', 'trunk', 'express'].indexOf(t);
    const on = leaving(node, LANES)
      .filter((o) => o.lane !== ride.lane)
      .find((o) => (input.next ? o.lane.id === input.next : rank(o.lane.tier) >= rank(ride.lane.tier) && Math.acos(Math.min(1, dot(along, frame(o.lane, o.way, 0).along))) <= ON_ANGLE));
    if (on) {
      next = { ...start(on.lane, on.way, 0, posed(ship, next)), from: speed, speed, off: [u, v] };
      return { ride: next, ship: posed(ship, next), out: null };
    }
  }
  // off at the node's off-ramp: at the end of the carriageway, at the boost
  const end = { ...next, off: [0, 0], speed: SHIP.boost, bank: 0 };
  return { ride: { ...end, s: 1 }, ship: { ...posed(ship, end), vy: 0 }, out: 'end' };
}
