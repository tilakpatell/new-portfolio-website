// A hard knock on a landing's loose thing, heard (footScene.js): the
// physics' hit (./physics.js, its force a kilogram) through the one wiring
// (lib/three/impacts.js) as a thud where it was round your ears, a puff of
// dust off the ground there, and a nudge of the camera's own kick for a
// near one. A full knock at your feet kicks the view as the stock gun does
// (gunplay.js's kick.up, 1.5), fading to nothing at KNOCK.near metres; with
// reduced motion it doesn't kick at all. Pure but for what it's handed.
//
//   createKnocks({ rules = createImpacts(), thud?, dust?, listener?, toWorld?,
//     up?, me() → where you are | null, metre, kick(v), reduced })
//     → { heard(force, at, key), update(dt), dispose(), rules }
//
// `at` and `me()` are in the scene's units (map units), `metre` of them to
// a metre; the rest is wireImpacts' own.

import { createImpacts } from '../../../lib/impact';
import { wireImpacts } from '../../../lib/three/impacts';

export const KNOCK = {
  near: 12, // metres: past this a knock is heard but doesn't move the view
  kick: 1.5, // the view's kick for a full knock at your feet (the stock gun's)
};
const FULL_SHAKE = 0.15; // (lib/impact.js's shake at full: a knock's share of it is its gain)

export function createKnocks({ rules = createImpacts(), me = () => null, metre = 1, kick = () => {}, reduced = false, ...wiring } = {}) {
  let knocked = null; // (where the hit being told was)
  const away = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / metre;
  const wired = wireImpacts({
    ...wiring,
    rules,
    shake: (k) => {
      // (a hit by you, not one over the field; none with reduced motion)
      const at = me();
      if (reduced || !knocked || !at) return;
      const d = away(knocked, at);
      if (d < KNOCK.near) kick((k / FULL_SHAKE) * KNOCK.kick * (1 - d / KNOCK.near));
    },
  });
  return {
    rules,
    heard(force, at, key) {
      if (!me()) return;
      knocked = at;
      wired.onHit(force, at, key);
    },
    update: (dt) => wired.update(dt),
    dispose: () => wired.dispose(),
  };
}
