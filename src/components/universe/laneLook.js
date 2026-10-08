// The hyperlanes in the scene, together: their ribbons (laneRibbons.js), the
// traffic in all of them as moving light (laneStreaks.js), the few ships of
// it nearest you as real ships you can shoot (laneTraffic.js), and the ride's
// look, the stars drawn out into lines streaming past (lib/three/speedLines)
// and the lens widened by the ride's speed. One thing for scene.js to make,
// call once a frame and ask about a shot, so it gains a few lines and no
// more (it's over its size).
//
// The clock is the wall's, in seconds (laneFlow.js), so every pilot sees the
// same traffic; the ships shot down (`dead`) are kept here and shared by the
// streaks and the models.
//
// By tier (the spec's §11): the ribbons everywhere; on `low` half the
// streaks and nothing else; on a phone a quarter of them, and no near
// traffic; with reduced motion, no near traffic and no speed lines.
//
// createLaneLook({ map, camera, renderer, fleet, engines, tier, phone, small, reduced })
//   → { update(dt, { ship, ride, view, side }) → busy, hit(from, to) → hit | null,
//       fov (degrees to add), rideK, traffic, streaks, ribbons, dead, clear(), dispose() }
//   ship: the ship while it's flying (null on foot, crashed or diving); ride:
//   state.ride; view: the camera's ('map' shows no speed lines); side: the
//   crew's side's id. `hit` is a laneTraffic.js hit, its kill already counted
//   in `dead`; the scene pops it and counts it as it does traffic.js's.

import { createSpeedLines } from '../../lib/three/speedLines';
import { TIERS } from './hyperlanes';
import { createLaneRibbons } from './laneRibbons';
import { createLaneStreaks } from './laneStreaks';
import { createLaneTraffic } from './laneTraffic';
import { SHIP } from './ship';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
// how much a ride shows: the log of its speed over the pulse drive's, 1 on
// the express (a local lane about a half, a trunk about three fifths)
export const rideAmount = (speed) => clamp01(Math.log(Math.max(1, speed / SHIP.pulse)) / Math.log(TIERS.express.speed / SHIP.pulse));
export const RIDE_FOV = 10; // degrees the lens widens on the express, flat out

export function createLaneLook({ map, camera, renderer, fleet, engines = null, tier = 'high', phone = false, small = false, reduced = false }) {
  const dead = new Map();
  const ribbons = createLaneRibbons(map, { reduced });
  const streaks = createLaneStreaks(map, { level: phone ? 'small' : tier === 'low' ? 'low' : 'high' });
  const traffic = phone || reduced || tier === 'low' ? null : createLaneTraffic(map, { fleet, engines, small: phone });
  const lines = tier === 'low' || reduced ? null : createSpeedLines({ small });
  if (lines) camera.add(lines.group);
  let rideK = 0;
  let side = null;
  const now = () => Date.now() / 1000;

  return {
    dead,
    ribbons,
    streaks,
    traffic,
    get rideK() {
      return rideK;
    },
    // degrees to add to the lens
    get fov() {
      return RIDE_FOV * rideK ** 1.2;
    },
    update(dt, { ship = null, ride = null, view = null, side: crew = null } = {}) {
      const t = now();
      if (crew !== side) {
        side = crew;
        streaks.setSide(side);
      }
      ribbons.update(t, camera, renderer);
      streaks.update(t, camera, dead, renderer);
      traffic?.update(dt, t, ship, dead, { side });
      const want = ride && ship && view !== 'map' ? rideAmount(ride.speed) : 0;
      rideK += (want - rideK) * clamp01(dt * 2.5);
      if (rideK < 1e-3 && !want) rideK = 0;
      if (lines) {
        lines.set(rideK > 0 ? { stretch: 0.25 + 0.55 * rideK, speed: 120 + 600 * rideK } : { stretch: 0, speed: 0 });
        lines.update(dt);
      }
      return rideK > 0 || (traffic?.count ?? 0) > 0;
    },
    hit(from, to) {
      return traffic?.hit(from, to, now()) ?? null;
    },
    clear() {
      traffic?.clear();
    },
    dispose() {
      traffic?.dispose();
      streaks.dispose();
      ribbons.dispose();
      if (lines) {
        lines.group.removeFromParent();
        lines.dispose();
      }
    },
  };
}
