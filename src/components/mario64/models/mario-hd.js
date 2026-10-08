// Mario, the rigged model (./catalog.js), in the code-made Mario's place
// (./mario.js): the same { root, hands, apply(pose), setVisible(on) }, and
// the same groups round him (an offset, a spin about his middle for the
// flips, the body that squashes), so pose.js drives either. Each limb is
// pointed by lib/three/rig.js along the direction the code-made Mario's
// would take (./limbs.js); the hips and head turn as whole parts.

import * as THREE from 'three';
import { figure } from '../../../lib/three/rig';
import { MODELS } from './catalog';
import { limbTargets } from './limbs';

const CENTRE = 0.8; // where he spins about, for the flips
const SPREAD = 0.22; // his arms a little further out than the code-made Mario's, clear of his belly

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _p = new THREE.Quaternion();
const _b = new THREE.Quaternion();
// turn a bone by a rotation in the figure's frame
function turnIn(bone, frame, euler) {
  if (!bone || !(euler[0] || euler[1] || euler[2])) return;
  frame.getWorldQuaternion(_b);
  _q.setFromEuler(_e.set(euler[0], euler[1], euler[2]));
  _q.premultiply(_b).multiply(_b.clone().invert()); // into world space
  bone.parent.updateMatrixWorld(true);
  bone.parent.getWorldQuaternion(_p);
  bone.quaternion.premultiply(_p.clone().invert().multiply(_q).multiply(_p));
}

export function makeHdMario(template) {
  const spec = MODELS.mario;
  const fig = figure({ scene: template }, { h: spec.metres, bones: spec.bones });
  const root = new THREE.Group();
  const offset = new THREE.Group();
  const spin = new THREE.Group();
  const body = new THREE.Group();
  const hips = new THREE.Group(); // turned by the hips' joint
  root.add(offset);
  offset.add(spin);
  spin.position.y = CENTRE;
  spin.add(body);
  body.position.y = -CENTRE;
  body.add(hips);
  hips.position.y = fig.hipHeight;
  hips.add(fig.holder);
  const spread = (v, side) => {
    const out = [v[0] + side * SPREAD, v[1], v[2]];
    const l = Math.hypot(...out) || 1;
    return out.map((x) => x / l);
  };
  return {
    root,
    figure: fig,
    leg: fig.hipHeight, // (for ../motion.js's stride)
    hands: [fig.bones.handL, fig.bones.handR],
    apply(p) {
      hips.rotation.set(p.joints.hips[0], p.joints.hips[1], p.joints.hips[2]);
      hips.position.y = fig.hipHeight + p.lift;
      const t = limbTargets(p);
      t.armL = spread(t.armL, 1);
      t.armR = spread(t.armR, -1);
      fig.pose(t, 1, Infinity);
      turnIn(fig.bones.head, fig.body, p.joints.head);
      body.scale.set(1 + (1 - p.squash) * 0.6, p.squash, 1 + (1 - p.squash) * 0.6);
      spin.rotation.set(p.spin[0], p.spin[1], p.spin[2]);
      offset.position.set(p.offset[0], p.offset[1], p.offset[2]);
    },
    setVisible(on) {
      body.visible = on;
    },
    dispose() {
      fig.dispose();
    },
  };
}
