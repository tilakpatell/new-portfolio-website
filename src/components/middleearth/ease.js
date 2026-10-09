// Middle-earth’s eases moved `min(1, dt × k)` a frame, which goes further in
// a second at 144 Hz than at 30. `byFrame(k, dt)` moves as that did at 60 Hz
// (where they were tuned), by dt: 1 − e^(−k′·dt) with k′ = −60·ln(1 − k/60),
// the plan’s rule (lib/ease.js’s `damp`). Pure, for the rules and the scenes.
//
//   byFrame(k, dt) → the share of the way to go this frame

import { damp } from '../../lib/ease';

export function byFrame(k, dt) {
  if (!(dt > 0)) return 0;
  // (a rate a 60 Hz frame couldn’t hold was there at once, and still is)
  if (k >= 60) return 1;
  return damp(-60 * Math.log(1 - k / 60), dt);
}
