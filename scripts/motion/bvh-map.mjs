// A clip from HY-Motion (scripts/motion/generate.py: SMPL-H's 22 body
// joints written out as a BVH) under the names scripts/preview/ualRetarget.js
// already knows, so the retarget that carries Quaternius's UAL clips onto
// Meshy's 24-bone skeleton carries this one too, unchanged.
//
// SMPL-H's body and UAL's Rigify body are the same 22 joints in the same
// chains (hips, three spine, neck, head; collar, upper arm, forearm, hand;
// thigh, shin, ankle, toes), so the map is a renaming and nothing more. Its
// fingers (30 more joints) have nowhere to go on Meshy's mittens and are
// left out of the BVH. Both are +y up with the figure's left at +x; the
// retarget squares any difference in facing or rest (SMPL-H's T-pose
// against Meshy's A-pose) itself.
//
//   SMPLH_BODY        the 22 joints in SMPL-H's order (HY-Motion's joint_names.json)
//   SMPLH_PARENTS     each one's parent's index (-1: the root)
//   SMPLH_TO_DEF      SMPL-H's name → UAL's DEF-* name
//   bvhSource(text, { name, keepNames }) → { src, clip }: a mannequin for
//     retargetUal (ualRig, at rest) and its clip, on the DEF-* names
//     (keepNames: SMPL-H's own, to check the BVH against the model's joints)
//   bvhText({ rest, frames, root, fps }) → a BVH in generate.py's layout,
//     for tests: rest (22 [x, y, z], metres), frames ([22 [z, x, y] degrees]),
//     root (each frame's hips travel from rest)

import * as THREE from 'three';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import { keepRest, ualRig } from '../preview/ualRetarget.js';

export const SMPLH_BODY = [
  'Pelvis',
  'L_Hip',
  'R_Hip',
  'Spine1',
  'L_Knee',
  'R_Knee',
  'Spine2',
  'L_Ankle',
  'R_Ankle',
  'Spine3',
  'L_Foot',
  'R_Foot',
  'Neck',
  'L_Collar',
  'R_Collar',
  'Head',
  'L_Shoulder',
  'R_Shoulder',
  'L_Elbow',
  'R_Elbow',
  'L_Wrist',
  'R_Wrist',
];
export const SMPLH_PARENTS = [-1, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9, 12, 13, 14, 16, 17, 18, 19];

export const SMPLH_TO_DEF = {
  Pelvis: 'DEF-hips',
  Spine1: 'DEF-spine001',
  Spine2: 'DEF-spine002',
  Spine3: 'DEF-spine003',
  Neck: 'DEF-neck',
  Head: 'DEF-head',
  L_Collar: 'DEF-shoulderL',
  L_Shoulder: 'DEF-upper_armL',
  L_Elbow: 'DEF-forearmL',
  L_Wrist: 'DEF-handL',
  R_Collar: 'DEF-shoulderR',
  R_Shoulder: 'DEF-upper_armR',
  R_Elbow: 'DEF-forearmR',
  R_Wrist: 'DEF-handR',
  L_Hip: 'DEF-thighL',
  L_Knee: 'DEF-shinL',
  L_Ankle: 'DEF-footL',
  L_Foot: 'DEF-toeL',
  R_Hip: 'DEF-thighR',
  R_Knee: 'DEF-shinR',
  R_Ankle: 'DEF-footR',
  R_Foot: 'DEF-toeR',
};

export function bvhSource(text, { name = 'motion', keepNames = false } = {}) {
  const { skeleton, clip } = new BVHLoader().parse(text);
  const to = keepNames ? (n) => n : (n) => SMPLH_TO_DEF[n] ?? n;
  const root = skeleton.bones[0].name;
  // only the joints' turns, and the hips' travel: BVHLoader writes every
  // joint's offset as a position track too, constant, and the clip carries
  // only what moves
  clip.tracks = clip.tracks.filter((t) => t.name.endsWith('.quaternion') || t.name === `${root}.position`);
  for (const b of skeleton.bones) b.name = to(b.name);
  for (const t of clip.tracks) {
    const [bone, prop] = t.name.split('.');
    t.name = `${to(bone)}.${prop}`;
  }
  clip.name = name;
  const scene = new THREE.Group();
  scene.add(skeleton.bones[0]);
  scene.updateMatrixWorld(true);
  return { src: keepRest(ualRig({ scene, animations: [clip] })), clip };
}

const f = (v) => (Math.abs(v) < 5e-7 ? '0' : v.toFixed(6).replace(/\.?0+$/, ''));

// A leaf joint's end, a short way on along its bone (BVH wants one; nothing reads it)
function endOf(i, rest) {
  const p = rest[SMPLH_PARENTS[i]];
  const d = rest[i].map((v, k) => v - p[k]);
  const len = Math.hypot(...d) || 1;
  return d.map((v) => (v / len) * 0.08);
}

export function bvhText({ rest, frames, root, fps = 30 }) {
  const kids = SMPLH_BODY.map((_, i) => SMPLH_PARENTS.map((p, j) => (p === i ? j : -1)).filter((j) => j >= 0));
  const lines = [];
  const joint = (i, depth) => {
    const pad = '  '.repeat(depth);
    const off = SMPLH_PARENTS[i] < 0 ? rest[i] : rest[i].map((v, k) => v - rest[SMPLH_PARENTS[i]][k]);
    lines.push(`${pad}${i === 0 ? 'ROOT' : 'JOINT'} ${SMPLH_BODY[i]}`, `${pad}{`, `${pad}  OFFSET ${off.map(f).join(' ')}`);
    lines.push(`${pad}  CHANNELS ${i === 0 ? '6 Xposition Yposition Zposition ' : '3 '}Zrotation Xrotation Yrotation`);
    if (kids[i].length) for (const k of kids[i]) joint(k, depth + 1);
    else lines.push(`${pad}  End Site`, `${pad}  {`, `${pad}    OFFSET ${endOf(i, rest).map(f).join(' ')}`, `${pad}  }`);
    lines.push(`${pad}}`);
  };
  lines.push('HIERARCHY');
  joint(0, 0);
  lines.push('MOTION', `Frames: ${frames.length}`, `Frame Time: ${f(1 / fps)}`);
  const order = [];
  const walk = (i) => {
    order.push(i);
    for (const k of kids[i]) walk(k);
  };
  walk(0);
  frames.forEach((frame, n) => lines.push([...root[n], ...order.flatMap((i) => frame[i])].map(f).join(' ')));
  return `${lines.join('\n')}\n`;
}
