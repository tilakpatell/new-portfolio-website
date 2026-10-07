// Quaternius's Universal Animation Library (CC0; the Godot GLB, a 53-bone
// Rigify rig named DEF-*) onto Meshy's 24-bone skeleton, rest-pose aware.
// A spike for scripts/preview/heroes-ual.html, not shipped.
//
// Each mapped bone's turn is carried over in the world, not in its parent's
// frame: the target bone gets the source bone's world turn away from its
// rest, on top of its own rest, so the two rigs' bone rolls (Rigify's and
// Meshy's point their axes every which way) don't matter. Where the two
// rests stand differently (UAL's arms out, Meshy's lower), each target bone
// is first swung so it points the way the source's points at rest; the hips
// are matched on two axes (up the spine, across the thighs), which also
// turns one rig's facing onto the other's. The hips' travel is scaled by
// the two hips' heights.
//
//   ualRig(gltf) → { scene, bones, clips: { name: clip } }
//   retargetUal(src, clip, target, { fps }) → a THREE.AnimationClip on target's bone names
//     target: the Meshy figure's model (its bones still at rest)

import * as THREE from 'three';

const V = THREE.Vector3;
const Q = THREE.Quaternion;

// UAL (DEF-*, as GLTFLoader names them: the dots taken out) → Meshy
export const UAL_MAP = {
  'DEF-hips': 'Hips',
  'DEF-spine001': 'Spine02',
  'DEF-spine002': 'Spine01',
  'DEF-spine003': 'Spine',
  'DEF-neck': 'neck',
  'DEF-head': 'Head',
  'DEF-shoulderL': 'LeftShoulder',
  'DEF-upper_armL': 'LeftArm',
  'DEF-forearmL': 'LeftForeArm',
  'DEF-handL': 'LeftHand',
  'DEF-shoulderR': 'RightShoulder',
  'DEF-upper_armR': 'RightArm',
  'DEF-forearmR': 'RightForeArm',
  'DEF-handR': 'RightHand',
  'DEF-thighL': 'LeftUpLeg',
  'DEF-shinL': 'LeftLeg',
  'DEF-footL': 'LeftFoot',
  'DEF-toeL': 'LeftToeBase',
  'DEF-thighR': 'RightUpLeg',
  'DEF-shinR': 'RightLeg',
  'DEF-footR': 'RightFoot',
  'DEF-toeR': 'RightToeBase',
};
const TO_SRC = Object.fromEntries(Object.entries(UAL_MAP).map(([s, t]) => [t, s]));
// which child each target bone points at, to swing its rest onto the
// source's (the same joint on both rigs); none: the parent's swing
const AIM = {
  Spine02: 'Spine01',
  Spine01: 'Spine',
  Spine: 'neck',
  neck: 'Head',
  LeftShoulder: 'LeftArm',
  LeftArm: 'LeftForeArm',
  LeftForeArm: 'LeftHand',
  RightShoulder: 'RightArm',
  RightArm: 'RightForeArm',
  RightForeArm: 'RightHand',
  LeftUpLeg: 'LeftLeg',
  LeftLeg: 'LeftFoot',
  LeftFoot: 'LeftToeBase',
  RightUpLeg: 'RightLeg',
  RightLeg: 'RightFoot',
  RightFoot: 'RightToeBase',
};
// the order to solve in: every parent before its children
const ORDER = [
  'Hips',
  'Spine02',
  'Spine01',
  'Spine',
  'neck',
  'Head',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'LeftToeBase',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
  'RightToeBase',
];

export function ualRig(gltf) {
  const bones = {};
  gltf.scene.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
  });
  const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
  return { scene: gltf.scene, bones, clips };
}

// everything in the root's own frame (whatever the root's placed at)
const rootInv = (root) => {
  root.updateMatrixWorld(true);
  return root.matrixWorld.clone().invert();
};
const worldOf = (o, inv) => {
  const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
  const p = new V();
  const q = new Q();
  const s = new V();
  m.decompose(p, q, s);
  return { p, q, s };
};
// a frame from two axes: `up` exact, `side` made square to it
const frame = (up, side) => {
  const y = up.clone().normalize();
  const x = side.clone().addScaledVector(y, -side.dot(y)).normalize();
  const z = new V().crossVectors(x, y).normalize();
  return new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
};
const snap = (bones, names, inv) => Object.fromEntries(names.filter((n) => bones[n]).map((n) => [n, worldOf(bones[n], inv)]));

// the rest of both, and each target bone's swing onto the source's rest
function prepare(src, target) {
  const tBones = {};
  target.traverse((o) => {
    if (o.isBone) tBones[o.name] = o;
  });
  const tInv = rootInv(target);
  const sInv = rootInv(src.scene);
  // (the source at its rest: its nodes as loaded, before any clip)
  const tRest = snap(tBones, [...ORDER, 'Armature'].concat(tBones.Hips?.parent ? [tBones.Hips.parent.name] : []), tInv);
  const sRest = snap(src.bones, Object.keys(UAL_MAP), sInv);
  const hipsParent = tBones.Hips.parent;
  const tParent = worldOf(hipsParent, tInv);
  // the hips: up the spine and across the thighs, on both
  const fT = frame(tRest.Spine02.p.clone().sub(tRest.Hips.p), tRest.LeftUpLeg.p.clone().sub(tRest.RightUpLeg.p));
  const fS = frame(sRest['DEF-spine001'].p.clone().sub(sRest['DEF-hips'].p), sRest['DEF-thighL'].p.clone().sub(sRest['DEF-thighR'].p));
  // the source turned to face the way the target does (about up only, so a lean stays a lean)
  const fwdT = new V(0, 0, 1).applyQuaternion(fT).setY(0).normalize();
  const fwdS = new V(0, 0, 1).applyQuaternion(fS).setY(0).normalize();
  const face = new Q().setFromUnitVectors(fwdS, fwdT);
  // each target bone's swing: its rest direction onto the source's (both faced alike)
  const align = {};
  align.Hips = new Q().multiplyQuaternions(face.clone().multiply(fS), fT.clone().invert());
  for (const n of ORDER) {
    if (n === 'Hips') continue;
    const c = AIM[n];
    if (c && tRest[c] && sRest[TO_SRC[c]]) {
      const dT = tRest[c].p.clone().sub(tRest[n].p).normalize();
      const dS = sRest[TO_SRC[c]].p.clone().sub(sRest[TO_SRC[n]].p).applyQuaternion(face).normalize();
      align[n] = new Q().setFromUnitVectors(dT, dS);
    } else align[n] = align[tBones[n].parent.name] ?? new Q();
  }
  const hipsK = (tRest.Hips.p.y - Math.min(tRest.LeftToeBase.p.y, tRest.RightToeBase.p.y)) / (sRest['DEF-hips'].p.y - Math.min(sRest['DEF-toeL'].p.y, sRest['DEF-toeR'].p.y));
  return { tBones, tRest, sRest, tParent, face, align, hipsK, sInv };
}

export function retargetUal(src, clip, target, { fps = 30, prep = null } = {}) {
  const P = prep ?? prepare(src, target);
  const { tBones, tRest, sRest, tParent, face, align, hipsK } = P;
  const mixer = new THREE.AnimationMixer(src.scene);
  const action = mixer.clipAction(clip);
  action.play();
  const frames = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = new Float32Array(frames);
  const out = Object.fromEntries(ORDER.map((n) => [n, new Float32Array(frames * 4)]));
  const hipsPos = new Float32Array(frames * 3);
  const faceInv = face.clone().invert();
  const tParentInv = new THREE.Matrix4().compose(tParent.p, tParent.q, tParent.s).invert();
  const world = {};
  const q = new Q();
  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration, f / fps);
    times[f] = t;
    action.time = t;
    mixer.update(0);
    src.scene.updateMatrixWorld(true);
    for (const n of ORDER) {
      const s = worldOf(src.bones[TO_SRC[n]], P.sInv);
      // the source's world turn away from rest, faced as the target: face·(Qs·Qs_rest⁻¹)·face⁻¹
      const d = face.clone().multiply(s.q).multiply(sRest[TO_SRC[n]].q.clone().invert()).multiply(faceInv);
      world[n] = d.multiply(align[n]).multiply(tRest[n].q);
      // to the parent's frame
      const parent = tBones[n].parent.name;
      const pw = world[parent] ?? tParent.q;
      q.copy(pw).invert().multiply(world[n]);
      // (hemisphere kept with the last frame's, so the interpolation doesn't spin)
      const o = out[n];
      if (f > 0 && q.x * o[f * 4 - 4] + q.y * o[f * 4 - 3] + q.z * o[f * 4 - 2] + q.w * o[f * 4 - 1] < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      q.toArray(o, f * 4);
      if (n === 'Hips') {
        const moved = s.p.clone().sub(sRest['DEF-hips'].p).applyQuaternion(face).multiplyScalar(hipsK);
        tRest.Hips.p
          .clone()
          .add(moved)
          .applyMatrix4(tParentInv)
          .toArray(hipsPos, f * 3);
      }
    }
  }
  action.stop();
  mixer.uncacheRoot(src.scene);
  toRest(src); // (the source back at rest for the next)
  const tracks = ORDER.map((n) => new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, times, out[n]));
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hipsPos));
  const c = new THREE.AnimationClip(`ual:${clip.name}`, clip.duration, tracks);
  c.userData = { hips: tRest.Hips.p.clone().applyMatrix4(tParentInv).y };
  return c;
}

// rest kept on the source's bones (prepare reads them as loaded; a clip
// sampled for one target would leave the next a posed rig)
export function keepRest(src) {
  for (const b of Object.values(src.bones))
    b.userData.rest = {
      q: b.quaternion.clone(),
      p: b.position.clone(),
      s: b.scale.clone(),
    };
  return src;
}
export function toRest(src) {
  for (const b of Object.values(src.bones)) {
    const r = b.userData.rest;
    if (!r) continue;
    b.quaternion.copy(r.q);
    b.position.copy(r.p);
    b.scale.copy(r.s);
  }
  src.scene.updateMatrixWorld(true);
}
export { prepare as prepareUal };
