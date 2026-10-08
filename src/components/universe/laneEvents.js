// The director's lane events (director.js's 'lane' zone), where they happen.
// Pure, tested in Node; scene.js's happen plays them.
//
// - interdiction: the side's capital ship drops across the lane AHEAD.
//   interdiction on, and its gravity well pulls you out of the lane: the
//   ride ends and the drive's held down for WELL seconds (ship.js's drop,
//   under the pull, brings a ship at an express lane's 4,000 down inside
//   about 600, a local lane's 1,200 inside 450)
// - lanejam: a wreck's mines across the carriageway AHEAD.lanejam on
//   (minefield.js's bandAcross): weave or drop out
// - ambush: a pack waiting at your off-ramp (the node at the end of the
//   way you're going): it springs when you come off there, and gives up if
//   you come off anywhere else or carry on through the junction. A fight is
//   where you come off a lane, never in it.
//
// ahead(ride, d) → { s, at, heading, pts (the carriageway's) } | null (past the lane's end)
// offRamp(ride) → the node the ride comes off at
// ambushStep(ambush, ride, ship) → 'wait' | 'spring' | 'gone'

import { carriageway, nodeById } from './hyperlanes';
import { bezier, tangent } from './lanes';
import { headingTo } from './ship';

export const AHEAD = { interdiction: 600, lanejam: 900 };
export const WELL = 6; // seconds the capital ship's well holds the drive down
const SPRING = 400; // how near its node you must come off for the ambush to spring

export function ahead(ride, d) {
  const s = ride.s + d / ride.lane.length;
  if (s >= 1) return null;
  const pts = carriageway(ride.lane, ride.way);
  const t = tangent(pts, s);
  return { s, at: bezier(pts, s), heading: headingTo(t[0], t[2]), pts };
}

export const offRamp = (ride) => nodeById(ride.way === 'out' ? ride.lane.to : ride.lane.from);

export function ambushStep(ambush, ride, ship) {
  if (ride) return offRamp(ride) === ambush.node ? 'wait' : 'gone';
  const [x, y, z] = ambush.node.at;
  return Math.hypot(ship.x - x, (ship.y ?? 0) - y, ship.z - z) < SPRING ? 'spring' : 'gone';
}
