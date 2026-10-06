// A ragdoll with no physics engine: a figure's joints (Meshy's bones, or a
// built figure's groups: any named Object3Ds, each the child of the one
// above it) each a damped angular spring from the pose the clip left them
// in, kicked at the start the way the shot pushed (plus noise), and pulled
// by gravity through their own length, so arms and legs flop and swing
// toward the ground and settle. The body as a whole (where it falls, how
// it tumbles) is the caller's: this moves only the joints. Pure three.js
// math (no scene), so it's tested in Node.
//
// createRagdoll(joints, { gravity, push, kick, k, c, noise, swing }) → { step(dt), release(), dispose() }
//   joints: [{ obj, len }]: the Object3D to swing and how long the limb
//     hanging from it is (metres, in the figure's units): a longer limb
//     hangs heavier. Order doesn't matter.
//   gravity: the way down (world, unit); push: the way the shot sent them
//     (world, unit), the kick's direction; kick: how hard (rad/s); k, c:
//     the spring's stiffness and damping; noise: the wobble; swing: how
//     far a joint may go from its rest (radians, the cap).
// step(dt): once a frame after the clip has posed the figure (or, with the
//   mixer stopped, on the pose the ragdoll took at its first step): puts each
//   joint's rotation back to that base and turns it by where its spring has
//   got to. The base is taken at the first step, so start it on the pose to
//   fall from.
// release(): the kick again, softer (the body's hit the ground).

import * as THREE from 'three';
import { rotateWorld } from './ik';

const V = THREE.Vector3;
const _p = new V();
const _c = new V();
const _d = new V();
const _t = new V();
const _axis = new V();

export function createRagdoll(joints, { gravity = new V(0, -1, 0), push = new V(0, 0, -1), kick = 9, k = 10, c = 4.5, noise = 2.5, swing = 1.35 } = {}) {
  const parts = joints
    .filter((j) => j?.obj)
    .map((j) => ({ obj: j.obj, len: Math.max(0.05, j.len ?? 0.3), rot: new V(), w: new V(), base: null, child: j.obj.children.find((o) => o.isBone || o.isObject3D) ?? null, seed: Math.random() * 100 }));
  const g = gravity.clone().normalize();
  const shove = push.clone().normalize();
  let time = 0;
  const boot = (strength) => {
    for (const p of parts) {
      // the kick: about the axis across the push, each joint its own way and amount
      _axis.crossVectors(g, shove);
      if (_axis.lengthSq() < 1e-6) _axis.set(1, 0, 0);
      _axis.normalize();
      const s = (Math.random() - 0.5) * 2;
      p.w.addScaledVector(_axis, strength * (0.4 + Math.random() * 0.6) * (s < 0 ? -0.6 : 1)).addScaledVector(shove, strength * s * 0.5);
    }
  };
  boot(kick);
  return {
    get parts() {
      return parts;
    },
    step(dt) {
      dt = Math.min(dt, 0.05);
      if (!parts.length || dt <= 0) return;
      time += dt;
      for (const p of parts) {
        if (!p.base) p.base = p.obj.quaternion.clone();
        else p.obj.quaternion.copy(p.base);
      }
      // (where each limb hangs now, for gravity: from the base pose this frame)
      parts[0].obj.updateWorldMatrix(true, true);
      for (const p of parts) {
        p.obj.getWorldPosition(_p);
        if (p.child) p.child.getWorldPosition(_c);
        else _c.copy(_p).add(_t.set(0, -1, 0).transformDirection(p.obj.matrixWorld));
        _d.copy(_c).sub(_p);
        if (_d.lengthSq() < 1e-8) _d.copy(g);
        _d.normalize();
        // gravity turns the limb toward down: a torque across it, by how far it is from hanging
        _t.crossVectors(_d, g).multiplyScalar(18 * p.len);
        // the spring home, the damping, and a wobble that dies away
        _t.addScaledVector(p.rot, -k).addScaledVector(p.w, -c);
        const fade = Math.exp(-time * 1.4);
        _t.x += Math.sin(time * 9.1 + p.seed) * noise * fade;
        _t.y += Math.sin(time * 7.3 + p.seed * 2.0) * noise * fade;
        _t.z += Math.cos(time * 11.7 + p.seed * 0.5) * noise * fade;
        p.w.addScaledVector(_t, dt);
        p.rot.addScaledVector(p.w, dt);
        const a = p.rot.length();
        if (a > swing) {
          p.rot.multiplyScalar(swing / a);
          p.w.multiplyScalar(0.5);
        }
      }
      for (const p of parts) {
        const a = p.rot.length();
        if (a > 1e-5) rotateWorld(p.obj, _axis.copy(p.rot).divideScalar(a), a, 1);
      }
    },
    release() {
      boot(kick * 0.45);
    },
    dispose() {
      for (const p of parts) if (p.base) p.obj.quaternion.copy(p.base);
      parts.length = 0;
    },
  };
}
