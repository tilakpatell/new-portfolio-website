// One shake for Middle-earth (the Shire, the twelve towns, the bridge): the
// site’s feel (lib/three/feel.js: trauma², smoothed, still under reduced
// motion) in place of the random jitter each scene rolled for itself. The
// scenes still ask for a shake as a level (`A.shake = 0.3`, or at least
// 0.08 every frame a thing is going on), so the level asked is the trauma
// it is raised to, not added on: a level held for a while stays that level.
// The old jitter faded 0.8 a second, and so does this; a scene whose own
// shake had other numbers (the bridge’s: trauma² × 0.7, 1.8 a second)
// passes them.
//
// The camera eases moved `min(1, dt × k)` a frame; `byFrame` (./ease.js)
// moves by dt as they did at 60 Hz, and is passed on from here.
//
//   createShake({ calm, title, offset, decay }) → { feel, update(dt, camera, k), step(dt),
//     hitstop(ms), groups(), dispose() }: `update` after the camera is placed
//     and before it looks; `step` is the dt the game’s rules should run by
//     (hitstop); with a `title` and ?debug, a panel of the feel’s numbers

import { debugOn, debugPanel } from '../../lib/debugPanel';
import { createFeel, feelGroups } from '../../lib/three/feel';

export { byFrame } from './ease';

// the jitter’s fade a second, and the reach at full trauma (metres): a
// caught (0.3) moves the eye about as far as the jitter’s average did
export const SHAKE = { decay: 0.8, offset: 1 };

export function createShake({ calm, title = null, offset = SHAKE.offset, decay = SHAKE.decay } = {}) {
  const feel = createFeel(calm === undefined ? { offset } : { offset, calm });
  feel.set({ decay });
  const groups = () => feelGroups(feel);
  const panel = title && debugOn() ? debugPanel({ title, groups: groups() }) : null;
  return {
    feel,
    update(dt, camera, k = 0) {
      const now = feel.state().trauma;
      if (k > now) feel.trauma(k - now);
      // the scene eases its own lens; the feel only adds its punch on top
      feel.setBaseFov(camera.fov);
      feel.update(dt, camera);
    },
    step: (dt) => feel.step(dt),
    hitstop: (ms) => feel.hitstop(ms),
    groups,
    dispose() {
      panel?.dispose();
    },
  };
}
