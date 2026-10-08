// The lanes in the scene's flight: the autopilot on the Hyperlanes drive
// (nav.js), and a ride's frame for anyone. Pure, tested in Node; the scene
// calls laneFrame once a frame (before ship.js's step, which it skips while
// there's a ride) and, flying the autopilot, aims it with laneAim.
//
// The autopilot on the lanes flies hyperlanes.js's routeTo legs: free to the
// first ramp, parked in its ring facing out along the lane (so it gets on
// the way a hand does, ride.js's enter), rides, straight on through each
// junction with the throttle forward, slows for the last node and comes off
// there, and the last leg in to the place is the autopilot of today. The
// stick's still the pilot's while it rides (laneFrame's `input`: drifting
// across the tube); dropped out on the way (the throttle held back), it
// flies the rest free.

import { LANES, R, carriageway, nodeById, routeTo } from './hyperlanes';
import { tangent } from './lanes';
import { enter, frame, poseOf, step } from './ride';
import { SPACE, headingTo, parkAt } from './ship';

// A trip by the lanes to `id` (parked at `park` at the end): the autopilot's
// state, { id, park, od, route, leg }, or null where free flight is quicker
export function lanePlan(ship, id, park) {
  const route = routeTo(ship, id);
  return route ? { id, park, od: 1, route, leg: 0 } : null;
}

// the node a ride leg starts at
const startOf = (leg) => nodeById(leg.way === 'out' ? leg.lane.from : leg.lane.to);

// What the autopilot flies to now, on a free leg before a ride: { id, park,
// space } (the ride's first node, parked at in its ring facing out along
// the lane, and ship.js's space with that node as somewhere to go); null on
// the last leg, where it's the place itself as ever
export function laneAim(auto) {
  const legs = auto?.route?.legs;
  if (!legs || legs[auto.leg]?.kind !== 'fly' || auto.leg >= legs.length - 1) return null;
  const ride = legs[auto.leg + 1];
  const node = startOf(ride);
  const d = tangent(carriageway(ride.lane, ride.way), 0);
  const park = { x: node.at[0], y: node.at[1], z: node.at[2], heading: headingTo(d[0], d[2]) };
  const space = { ...SPACE, goals: { ...SPACE.goals, [node.id]: { id: node.id, at: node.at, r: 0, reach: 0, deep: true } } };
  return { id: node.id, park, space };
}

// the stick for a ride on the autopilot: straight on onto the next ride's
// lane at the end, or off (the throttle back to nothing) for the last
export function rideInput(auto) {
  const next = auto.route.legs[auto.leg + 1];
  return next?.kind === 'ride' ? { throttle: 1, next: next.lane.id } : { throttle: 0 };
}

// the autopilot flying on free from here, its route given up
const free = (auto) => auto && { id: auto.id, park: auto.park, od: 1, route: null, leg: 0 };

// One frame of the lanes: getting on (`canEnter`: not landed, and not on an
// autopilot of another drive, which mustn't be taken onto a lane), riding,
// getting off. null when there's no ride and none starts; else { ride (null
// once off), auto, ship (posed by the ride; none the frame it gets on, when
// ship.js still flies it), on (it got on), out ('end' | 'dropped' | 'lost':
// moved off the lane by something else) }.
export function laneFrame({ ride, auto, ship }, input, dt, { canEnter = true } = {}) {
  const route = auto?.route;
  if (!ride) {
    if (!canEnter) return null;
    const want = route?.legs.slice(auto.leg).find((l) => l.kind === 'ride');
    if (route && !want) return null; // (off its last lane, on the way in: not onto another)
    const on = enter(ship, { throttle: route ? 1 : (input.throttle ?? 0), only: want ?? null });
    if (!on) return null;
    // (the autopilot's on its first ride, or whichever ride of its route
    // starts on this lane; a ride it didn't mean, it leaves the route for)
    const at = route ? route.legs.findIndex((l, i) => i > auto.leg && l.kind === 'ride' && l.lane === on.lane && l.way === on.way) : -1;
    return { ride: on, auto: route ? (at > 0 ? { ...auto, leg: at } : free(auto)) : auto, on: true };
  }
  // (on the autopilot, the hand still has the stick: drifting across the
  // tube, and the throttle held back drops it out, which ends the route)
  const hand = { turn: input.turn ?? 0, climb: input.climb ?? 0 };
  // (moved off it since the last frame, through a portal, a respawn or a
  // pose: off the lane, where it is, and the autopilot flies on free)
  const was = poseOf(ride);
  if (Math.hypot(ship.x - was.x, (ship.y ?? 0) - was.y, ship.z - was.z) > R * 4) return { ride: null, auto: route ? free(auto) : auto, out: 'lost' };
  const r = step(ride, ship, route ? { ...rideInput(auto), ...hand, ...((input.throttle ?? 0) < -0.5 ? { throttle: input.throttle } : {}) } : input, dt);
  let next = auto;
  if (route && r.ride && r.ride.lane !== ride.lane) next = { ...auto, leg: auto.leg + 1 }; // (straight on through a junction)
  // (off the last lane: in to the place, parked on the side it came off at,
  // not the side the trip set out from, which is round the far side of it)
  if (route && r.out === 'end') next = auto.route.legs[auto.leg + 1]?.kind === 'fly' ? { ...auto, leg: auto.leg + 1, park: parkAt(auto.id, [r.ship.x, r.ship.z]) ?? auto.park } : (lanePlan(r.ship, auto.id, auto.park) ?? free(auto));
  if (route && r.out === 'dropped') next = free(auto);
  return { ride: r.out ? null : r.ride, auto: next, ship: r.ship, out: r.out };
}

// Whether the throttle held forward at the end of `lane` going `way` carries
// straight on, the way ride.js's step tells it: another lane leaving that
// node as quick or quicker, within 30° of the way the ride's going. (Only a
// beacon has one, and not every beacon does for every lane in.) Worked out
// once a lane and way, as the HUD asks every time the line changes.
const ON_ANGLE = (30 * Math.PI) / 180;
const RANK = { local: 0, trunk: 1, express: 2 };
const onward = new Map();
function carriesOn(lane, way) {
  const key = `${lane.id}:${way}`;
  if (onward.has(key)) return onward.get(key);
  const node = way === 'out' ? lane.to : lane.from;
  const along = frame(lane, way, 1).along;
  const yes = LANES.some((o) => {
    if (o === lane || (o.from !== node && o.to !== node) || RANK[o.tier] < RANK[lane.tier]) return false;
    const d = frame(o, o.from === node ? 'out' : 'in', 0).along;
    return Math.acos(Math.min(1, along[0] * d[0] + along[1] * d[1] + along[2] * d[2])) <= ON_ANGLE;
  });
  onward.set(key, yes);
  return yes;
}

// The HUD's lane line for a ride: the lane's name and tier, the node it's
// coming to, the seconds till it gets there, and whether that's a junction
// it can carry on through with the throttle held forward (else the ride
// ends there, at the node's off-ramp)
export function rideLine(ride) {
  const node = nodeById(ride.way === 'out' ? ride.lane.to : ride.lane.from);
  const eta = ((1 - ride.s) * ride.lane.length) / Math.max(1, ride.speed);
  return { name: ride.lane.name, tier: ride.lane.tier, next: node?.name ?? '', eta, junction: carriesOn(ride.lane, ride.way) };
}
