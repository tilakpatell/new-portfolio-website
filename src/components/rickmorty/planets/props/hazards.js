// What's dangerous on a planet that isn't anybody: the snakes' shelling, a
// flash in the sky and a blast ring on the ground somewhere near you every
// so often (galaxy/surface/storm.js's strikeAt, which times the lightning on
// Kamino's towers, times it here). It hurts nobody by itself: the site's
// quest or mission hears the shells (scene's `hear`), so the danger is the
// rules', and this only draws it.
//
// A builder that `follows` is updated with where you are: update(t, dt,
// you) (galaxy/surface/placer.js), you null till there's someone to follow.

import * as THREE from 'three';
import { part, ring } from '../../../galaxy/surface/kit';
import { strikeAt } from '../../../galaxy/surface/storm';
import { hash2 } from '../../../galaxy/surface/noise';

const lit = (c, k = 2) => new THREE.Color(c).multiplyScalar(k);

export const PROPS = {
  // opts.r: how far from you a shell lands, at most; opts.every: seconds
  // between shells, about
  shelling(k, { r = 40, every = 6, seed = 7 } = {}) {
    const object = new THREE.Group();
    const blast = k.build([part(ring(1, 0.18, 32), { color: lit('#ffb040', 2.6), to: 'glow' }), part(new THREE.CircleGeometry(0.7, 20).rotateX(-Math.PI / 2), { at: [0, 0.05, 0], color: lit('#ff6020', 2), to: 'glow' })], { name: 'blast' });
    blast.name = 'blast';
    blast.visible = false;
    object.add(blast);
    let slot = -1;
    let here = null; // where this shell landed, in the world
    return {
      object,
      follows: true,
      update(t, dt, you) {
        const on = strikeAt(t, { seed, every });
        if (!on) {
          blast.visible = false;
          return;
        }
        // (a new shell: somewhere within r of you, where you were as it fell)
        const s = Math.floor(t / every);
        if (s !== slot) {
          slot = s;
          if (!you) here = null;
          else {
            const a = hash2(s, seed * 1.7) * Math.PI * 2;
            const d = Math.sqrt(hash2(s, seed * 2.3 + 5)) * r;
            here = { x: you.x + Math.cos(a) * d, y: you.y ?? 0, z: you.z + Math.sin(a) * d };
          }
        }
        if (!here) return;
        // (in the shelling's own frame: it's put somewhere on the site, the
        // shell lands round you)
        object.updateWorldMatrix(true, false);
        const local = object.worldToLocal(new THREE.Vector3(here.x, here.y, here.z));
        blast.position.copy(local);
        blast.scale.setScalar(1 + (1 - on) * 6);
        blast.visible = true;
      },
    };
  },
};
