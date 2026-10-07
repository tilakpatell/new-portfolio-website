// Crossing between two of a kit figure's hand-set poses, so a figure going
// from one to the other (a crouch to a stride, standing to walking) eases
// over rather than snapping: pose it one way and take a snapshot, pose it
// the other and take another, then lay it `w` of the way from the first to
// the second (every bone's turn, and the hips' height).
//
//   snapPose(h, into) → [{ bone, q, p }]   each bone's turn and place now
//     (into: a snapshot to fill again, rather than make a new one)
//   mixPose(h, a, b, w)                    the figure w of the way from a to b

import * as THREE from 'three';

export function snapPose(h, into = null) {
  const bones = h.skeleton.bones;
  const out = into ?? bones.map((bone) => ({ bone, q: new THREE.Quaternion(), p: new THREE.Vector3() }));
  for (const s of out) {
    s.q.copy(s.bone.quaternion);
    s.p.copy(s.bone.position);
  }
  return out;
}

export function mixPose(h, a, b, w) {
  const k = Math.min(1, Math.max(0, w));
  for (let i = 0; i < a.length; i++) {
    const bone = a[i].bone;
    bone.quaternion.slerpQuaternions(a[i].q, b[i].q, k);
    bone.position.lerpVectors(a[i].p, b[i].p, k);
  }
}
