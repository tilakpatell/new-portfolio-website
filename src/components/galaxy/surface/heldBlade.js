// A lit lightsaber in a figure's right hand, for one that isn't rigged to
// hold it: the hilt sits where the hand of a figure that tall hangs, the
// blade up and a little forward, held out. activity.js's duellists swing it
// (their `hostile.blade`); actors.js's standing Jedi and Sith hold it lit
// (a life entry's `blade`), as the figures built in code did.
//
// heldBlade({ color, hilt }, tall) → { arm (add it to the figure's holder),
//   gun, owned (to dispose) }

import * as THREE from 'three';
import { buildGun } from '../../universe/gunplay';
import { dress } from './saber';

export function heldBlade({ color = '#ff3b3b', hilt = null } = {}, tall = 1.8) {
  const owned = [];
  const gun = buildGun('saber', owned);
  dress(gun, color, hilt);
  const blade = gun.getObjectByName('blade');
  if (blade) {
    blade.visible = true;
    blade.scale.y = 1;
  }
  const arm = new THREE.Group();
  arm.position.set(-0.19 * tall, 0.47 * tall, 0.08 * tall);
  arm.add(gun);
  gun.rotation.set(-0.35, 0, -0.2);
  return { arm, gun, owned };
}
