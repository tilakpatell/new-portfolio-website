import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAnimator } from './animator';
import { BODY } from './walrusRig.js';

// a body on the 2017 game's skeleton, all its bones at rest under the hips
function walrus() {
  const root = new THREE.Group();
  const bones = Object.fromEntries([...BODY, 'Neck1'].map((n) => [n, Object.assign(new THREE.Bone(), { name: n })]));
  root.add(bones.Hips);
  for (const [n, b] of Object.entries(bones)) if (n !== 'Hips') bones.Hips.add(b);
  return { root, bones };
}
const still = (n) => new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]);
const bent = (n) => new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, [0, 1], [0.4, 0, 0, Math.sqrt(0.84), 0.4, 0, 0, Math.sqrt(0.84)]);

describe('an upper-body clip on the game’s skeleton', () => {
  it('turns the game’s chest and neck, not only the arms and head', async () => {
    const { root, bones } = walrus();
    const chest = ['Spine1', 'Spine2', 'Neck', 'Neck1'];
    const clips = {
      idle: new THREE.AnimationClip('idle', 1, [still('Hips')]),
      talk: new THREE.AnimationClip('talk', 1, chest.map(bent)),
    };
    const anim = createAnimator(root, { clips, library: false });
    anim.play('talk', { layer: 'upper', fade: 0 });
    for (let i = 0; i < 6; i++) {
      anim.update(0.05);
      anim.after(0.05, null, { forward: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) });
    }
    for (const n of chest) expect(bones[n].quaternion.x, n).toBeGreaterThan(0.2);
    anim.dispose();
  });
});
