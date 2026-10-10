// A lit lightsaber's light on what's round it: a point light at the blade's
// middle in the blade's colour, so a duel lights its duellists and the
// ground under them. Only on the high and ultra tiers (a light costs every
// lit pixel), only within SABER_LIGHT.within of the eye (past that it
// lights nothing you'd see), and made with the saber, dark until lit, so
// the scene's count of lights never changes and nothing recompiles when a
// blade ignites (scene.js's muzzle flare is the pattern). It lights the
// world, not the blade: the blade's own glow is its emissive, drawn
// without tone mapping into the bloom (post.js), which this leaves alone.
//
//   createSaberLight({ scene, color, tier }) → { update(base, tip, lit, eye), dispose() }
//     base, tip: the blade's ends (world); lit: 0…1, how far out it is; eye: the camera's position
//   SABER_LIGHT      { intensity: { high, ultra }, distance (metres it reaches), decay, within }

import * as THREE from 'three';

export const SABER_LIGHT = { intensity: { high: 1.2, ultra: 1.8 }, distance: 4, decay: 2, within: 12 };

const NONE = { update() {}, dispose() {} };

export function createSaberLight({ scene, color = '#4aa8ff', tier = 'high' } = {}) {
  const peak = SABER_LIGHT.intensity[tier];
  if (!peak || !scene) return NONE;
  const light = new THREE.PointLight(color, 0, SABER_LIGHT.distance, SABER_LIGHT.decay);
  light.name = 'saber-light';
  scene.add(light);
  return {
    update(base, tip, lit, eye) {
      light.position.copy(base).add(tip).multiplyScalar(0.5);
      const near = !eye || light.position.distanceTo(eye) <= SABER_LIGHT.within;
      light.intensity = near && lit > 0 ? peak * Math.min(1, lit) : 0;
    },
    dispose() {
      scene.remove(light);
      light.dispose();
    },
  };
}
