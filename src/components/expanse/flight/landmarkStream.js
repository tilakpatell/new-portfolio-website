// Which POIs' landmarks are drawn, from where the ship is: the nearest
// LANDMARK_CAP within LANDMARK_NEAR across the ground; one already drawn
// kept till past LANDMARK_NEAR × LANDMARK_FREE (so a ship on the edge doesn't
// load and free it every frame), still within the cap; and the ones within
// LANDMARK_NEAR × LANDMARK_PREFETCH not yet wanted, to fetch their files
// ahead (at 300 m/s that's 20 s of flight before they're wanted).
//
// Pure: no three.js.
//
//   landmarkPlan(pois, ship, live = Set of ids drawn) → { want: ids, nearest
//     first; prefetch: ids }

import { LANDMARK_CAP, LANDMARK_FREE, LANDMARK_NEAR, LANDMARK_PREFETCH } from '../../../lib/land/flight/landmarkTables';

export function landmarkPlan(pois = [], ship, live = new Set()) {
  const near = (pois ?? [])
    .map((p, i) => ({ id: p.id, i, d: Math.hypot(p.at[0] - ship.x, p.at[1] - ship.z) }))
    .sort((a, b) => a.d - b.d || a.i - b.i);
  const want = near
    .filter((p) => p.d <= LANDMARK_NEAR || (live.has(p.id) && p.d <= LANDMARK_NEAR * LANDMARK_FREE))
    .slice(0, LANDMARK_CAP)
    .map((p) => p.id);
  const wanted = new Set(want);
  const prefetch = near.filter((p) => !wanted.has(p.id) && p.d <= LANDMARK_NEAR * LANDMARK_PREFETCH).map((p) => p.id);
  return { want, prefetch };
}
