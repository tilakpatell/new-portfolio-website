// One wiring for every hit (the spec’s piece 3): a force from Rapier (or a
// world’s own bump, scaled to a force by the mass of what bumped) goes
// through the hit law (lib/impact.js) and comes out as a thud where it was
// (lib/sfx.js), a puff of dust there (./dust.js) and a nudge of the camera.
// A world hands `onHit` to whatever reports its hits and calls `update`
// each frame.
//
//   wireImpacts({ rules = createImpacts(), thud = sfx.thud, dust = null,
//     shake = null, listener = () => null, toWorld = (at) => at, up = null })
//     → { onHit(force, at, key?), update(dt), dispose() }
//
// `shake` is a function of the law’s trauma: a world passes `feel.trauma`
// (./feel.js) or `view.shake` (./view.js), or its own. `listener()` is where
// the ears are, `{ position, forward, up? }` in the same space as
// `toWorld(at)`. `up(at)` is the way the dust rises there (a planet’s up is
// not +y); without it the dust’s own. The wiring is handed the dust: it
// runs it and lets it go with `dispose()`.

import { createImpacts } from '../impact';
import { thud as knock } from '../sfx';

export function wireImpacts({ rules = createImpacts(), thud = knock, dust = null, shake = null, listener = () => null, toWorld = (at) => at, up = null } = {}) {
  let gone = false;
  return {
    onHit(force, at, key) {
      if (gone || !at) return;
      const r = rules.hit(force, at, key ?? at);
      if (!r) return;
      const where = toWorld(at);
      thud({ gain: r.gain, pitch: r.pitch, at: where, listener: listener() });
      if (dust) {
        const rise = up?.(where);
        if (rise) dust.burst(where, r.dust, rise);
        else dust.burst(where, r.dust);
      }
      shake?.(r.shake);
    },
    update(dt) {
      if (!gone) dust?.update(dt);
    },
    dispose() {
      if (gone) return;
      gone = true;
      dust?.dispose();
    },
  };
}
