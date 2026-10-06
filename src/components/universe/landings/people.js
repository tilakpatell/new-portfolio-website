// People standing about a landing (a thing of kind 'figure' in landings.js):
// the site's own figures, idling where they stand, facing the ship as it
// comes down. A Meshy figure on the shared skeleton (Albuquerque's people,
// the office's, the galaxy's crew) idles on Rick's clips, borrowed as the
// crews' are (footScene.js's loadPartyFigure); one of Portal panic's cast
// (`meshy`: Beth, Jerry, Summer, the President…) on its own.
//
// figure(kit, { url | meshy, tall }) → { object (in metres), solids, update } | null

import * as THREE from 'three';
import { loadPartyFigure } from '../footScene';
import { createMeshyCast } from '../../rickmorty/portal/meshyCast';
import { METRE } from '../foot';

export async function figure(k, { url = null, meshy = null, tall = 1.8 } = {}) {
  let cast = null;
  if (meshy) {
    // (one cast a landing, freed with the kit)
    cast = k.cast ??= k.own(createMeshyCast());
    await cast.load(null, [meshy]).catch(() => {});
  }
  const fig = await loadPartyFigure({ id: meshy ?? url, name: meshy ?? url, tall, src: meshy ? { meshy } : { url } }, cast).catch(() => null);
  if (!fig) return null;
  const inner = new THREE.Group();
  inner.scale.setScalar(1 / METRE); // (the party's figures are in the map's units)
  inner.add(fig.model);
  const object = new THREE.Group();
  object.name = 'figure';
  object.add(inner);
  object.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  // a little out of step with each other
  let lag = Math.random() * 2;
  return {
    object,
    solids: [{ circle: [0, 0, 0.35] }],
    update(t, dt) {
      if (lag > 0) {
        lag -= dt;
        fig.update(Math.max(0, -lag), 0);
        return;
      }
      fig.update(dt, 0);
    },
  };
}
