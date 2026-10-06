// What happens while you roam a star system: the universe map's director
// (universe/director.js) run on the system's side (roamRules.js's
// galaxySide), so the galaxy gets the same pacing the universe map has (a
// while of quiet, then something every minute or two, sooner the more
// trouble you've made and on the way somewhere, nothing new after you while
// your shields are low), in place of the galaxy's own hunt timer. Pure, so
// it's tested in Node; galaxy/scene.js plays each event out.
//
// createRoam({ events, rand }) → { update(dt, { sys, heat, busy, travelling, calm }) → event id or null,
//   soon(id), side(sys) → the system's side, foretell(sys) }
// `events` is what the scene can play (ROAM_EVENTS unless told otherwise: a
// scene opts in to each as it learns to play it), and nothing else is ever
// brought. Changing system keeps the director's clock: a jump isn't a reset,
// so arriving somewhere new doesn't mean a long quiet, nor a pack at once.

import { createDirector } from '../universe/director';
import { ROAM_EVENTS, galaxySide } from './roamRules';

export function createRoam({ events = ROAM_EVENTS, rand = Math.random } = {}) {
  const director = createDirector({ rand, events });
  return {
    update(dt, { sys, heat = 0, busy = false, travelling = false, calm = false } = {}) {
      return director.update(dt, { side: galaxySide(sys), heat, busy, travelling, calm });
    },
    soon: (id) => director.soon(id),
    side: galaxySide,
    foretell: (sys, opts) => director.foretell(galaxySide(sys), opts),
    events,
  };
}
