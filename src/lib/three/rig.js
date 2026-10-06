// Characters from anywhere, posed by one set of code: the HD figures the
// worlds use come rigged four different ways (Meshy's humanoid skeleton,
// Mixamo's, an Unreal one from a game, Character Creator's), with their own
// bone names, axes and rest poses (an A, a T). This finds the bones that
// matter by what they are (upper arm, forearm, thigh…), and poses a figure
// by where each limb should point, in the figure's own frame: +z ahead, +y
// up, +x its left. So a pose is written once and fits every skeleton, and
// a limb's rest pose doesn't matter.
//
// loadFigure(url) → a figure template; figure(template, { h }) → a copy to
// place, with pose(targets, dt) to move it there smoothly.

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gltfLoader } from './gltf';
import { sharpenMaterial } from './textures';

const cache = new Map();

// The figure as loaded (shared: `figure` makes copies).
export function loadFigure(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      gltfLoader()
        .loadAsync(url)
        .then((g) => {
          g.scene.traverse((o) => {
            if (!o.isMesh) return;
            o.castShadow = true;
            o.receiveShadow = true;
            if (o.isSkinnedMesh) o.frustumCulled = false;
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) sharpenMaterial(m);
          });
          return { scene: g.scene, clips: g.animations };
        }),
    );
  }
  return cache.get(url);
}

// a bone's name without its rig's prefix or the number a download appended
const plain = (n) =>
  n
    .replace(/^mixamorig:?/i, '')
    .replace(/^CC_Base_/i, '')
    .replace(/_\d+$/, '')
    .toLowerCase();

// what each part is called, rig by rig: Meshy and Mixamo, Unreal, Character
// Creator, High Moon Studios' Transformers (War for Cybertron, Fall of
// Cybertron: L_Arm02_Shoulder_XB and the like) and the Transformers: Prime
// game's (Humerus.l, Thigh.l)
const ROLES = {
  armL: ['leftarm', 'upperarm_l', 'l_upperarm', 'l_arm02_shoulder_xb', 'humerus.l', 'bicep.l'],
  foreL: ['leftforearm', 'lowerarm_l', 'l_forearm', 'l_arm03_elbow_xb', 'hand.l', 'arm.l'],
  handL: ['lefthand', 'hand_l', 'l_hand', 'l_arm04_hand_xb', 'palm.l'],
  armR: ['rightarm', 'upperarm_r', 'r_upperarm', 'r_arm02_shoulder_xb', 'humerus.r', 'bicep.r'],
  foreR: ['rightforearm', 'lowerarm_r', 'r_forearm', 'r_arm03_elbow_xb', 'hand.r', 'arm.r'],
  handR: ['righthand', 'hand_r', 'r_hand', 'r_arm04_hand_xb', 'palm.r'],
  thighL: ['leftupleg', 'thigh_l', 'l_thigh', 'l_leg01_thigh_xb', 'thigh.l'],
  calfL: ['leftleg', 'calf_l', 'l_calf', 'l_leg02_knee_xb', 'leg.l'],
  footL: ['leftfoot', 'foot_l', 'l_foot', 'l_leg03_ankle_xb', 'foot.l'],
  toeL: ['lefttoebase', 'ball_l', 'l_toebase', 'l_leg04_toes_xl2'],
  thighR: ['rightupleg', 'thigh_r', 'r_thigh', 'r_leg01_thigh_xb', 'thigh.r'],
  calfR: ['rightleg', 'calf_r', 'r_calf', 'r_leg02_knee_xb', 'leg.r'],
  footR: ['rightfoot', 'foot_r', 'r_foot', 'r_leg03_ankle_xb', 'foot.r'],
  toeR: ['righttoebase', 'ball_r', 'r_toebase', 'r_leg04_toes_xl2'],
  head: ['head', 'c_spine04_head_xb'],
  hips: ['hips', 'hip', 'pelvis', 'c_spine00_hips_xb', 'hipcon'], // (Character Creator's hip holds both the spine and the pelvis)
};

// the limbs, each a bone and the one it points at, posed in this order
export const SEGMENTS = [
  ['armL', 'foreL'],
  ['foreL', 'handL'],
  ['armR', 'foreR'],
  ['foreR', 'handR'],
  ['thighL', 'calfL'],
  ['calfL', 'footL'],
  ['footL', 'toeL'],
  ['thighR', 'calfR'],
  ['calfR', 'footR'],
  ['footR', 'toeR'],
];

// (`named`: a figure's own bone for a role, by name, ahead of the guesses:
// a Rigify rig's head is a spine bone, and its 'spine' is the hips)
function findBones(root, named = {}) {
  const all = [];
  root.traverse((o) => o.isBone && all.push(o));
  const byName = new Map();
  for (const b of all) {
    const k = plain(b.name);
    if (!byName.has(k)) byName.set(k, b);
  }
  const bones = {};
  for (const [role, names] of Object.entries(ROLES)) bones[role] = names.map((n) => byName.get(n)).find(Boolean) ?? null;
  for (const [role, name] of Object.entries(named)) bones[role] = byName.get(plain(name)) ?? bones[role];
  // the spine: everything between the hips and the head
  const spine = [];
  for (let b = bones.head?.parent; b && b !== bones.hips && b.isBone; b = b.parent) spine.unshift(b);
  return { bones, spine, all };
}

// Every vertex where the skin puts it (a sample of them), in world space.
function skinnedBox(root) {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 4000));
    if (o.isSkinnedMesh) o.skeleton.update();
    for (let i = 0; i < pos.count; i += step) {
      o.getVertexPosition(i, v);
      box.expandByPoint(v.applyMatrix4(o.matrixWorld));
    }
  });
  return box;
}

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
// Turn `bone` so the line from it to `child` points along `dir` (world).
function aim(bone, child, dir) {
  bone.updateMatrixWorld(true);
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  _b.sub(_a);
  if (_b.lengthSq() < 1e-10) return;
  _b.normalize();
  _q.setFromUnitVectors(_b, _d.copy(dir).normalize());
  bone.getWorldQuaternion(_q2);
  _q.multiply(_q2);
  bone.parent.getWorldQuaternion(_q2);
  bone.quaternion.copy(_q2.invert().multiply(_q));
  bone.updateMatrixWorld(true);
}
// Turn `bone` by a rotation given in world space.
function turn(bone, worldQ) {
  bone.parent.updateMatrixWorld(true);
  bone.parent.getWorldQuaternion(_q2);
  // local' = parent⁻¹ · R · parent · local
  _q.copy(_q2).invert().multiply(worldQ).multiply(_q2);
  bone.quaternion.premultiply(_q);
}

// A copy of a loaded figure, `h` tall, its hips at its origin (so it turns
// about its middle, as a flyer does). Options: `attach`, a pattern for
// meshes that came unskinned and should ride on the chest (Omni-Man's cape);
// `bones`, a role's bone by name for a rig the names above don't cover.
export function figure(template, { h = 1.8, attach = null, bones: named = {} } = {}) {
  const model = cloneSkinned(template.scene);
  const holder = new THREE.Group();
  const body = new THREE.Group(); // turned by the pose (lean, roll); the holder is placed by the game
  holder.add(body);
  body.add(model);
  const { bones, spine, all } = findBones(model, named);
  const chest = spine[spine.length - 2] ?? spine[spine.length - 1] ?? bones.hips;
  if (attach && chest) {
    const ride = [];
    model.traverse((o) => o.isMesh && !o.isSkinnedMesh && attach.test(o.name) && ride.push(o));
    model.updateMatrixWorld(true);
    for (const o of ride) chest.attach(o);
  }
  // to size: feet to crown `h`, the hips at the origin
  const box = skinnedBox(model);
  const k = h / Math.max(1e-6, box.max.y - box.min.y);
  model.scale.multiplyScalar(k);
  model.updateMatrixWorld(true);
  const hip = (bones.hips ?? model).getWorldPosition(new THREE.Vector3());
  const foot = skinnedBox(model).min.y;
  model.position.sub(new THREE.Vector3(hip.x, hip.y, hip.z));
  const hipHeight = hip.y - foot;
  const rest = new Map(all.map((b) => [b, b.quaternion.clone()]));
  const materials = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.push(m);
  });
  // the limbs' directions now (body frame), eased toward each pose
  const dirs = {};
  const bodyQ = new THREE.Quaternion();
  const inv = new THREE.Quaternion();
  const w = new THREE.Vector3();
  const torsoQ = new THREE.Quaternion();
  const torsoE = new THREE.Euler();
  const torso = { pitch: 0, yaw: 0, roll: 0 };
  const ok = SEGMENTS.filter(([a, b]) => bones[a] && bones[b]);

  return {
    holder,
    body,
    model,
    bones,
    spine,
    materials,
    hipHeight,
    height: h,
    // targets: { armL: [x, y, z], …, torso: { pitch, yaw, roll } } in the
    // figure's frame; `rate` how quickly it gets there (per second; Infinity: at once)
    pose(targets, dt = 1, rate = 12) {
      const k = rate === Infinity ? 1 : 1 - Math.exp(-rate * dt);
      for (const b of all) b.quaternion.copy(rest.get(b));
      // the torso: bent and twisted across the spine
      if (targets.torso) for (const key of ['pitch', 'yaw', 'roll']) torso[key] += ((targets.torso[key] ?? 0) - torso[key]) * k;
      holder.updateMatrixWorld(true);
      body.getWorldQuaternion(bodyQ);
      if (spine.length && (torso.pitch || torso.yaw || torso.roll)) {
        const n = spine.length;
        torsoE.set(torso.pitch / n, torso.yaw / n, torso.roll / n, 'YXZ');
        torsoQ.setFromEuler(torsoE);
        // into world space: body · local · body⁻¹
        inv.copy(bodyQ).invert();
        const wq = bodyQ.clone().multiply(torsoQ).multiply(inv);
        for (const b of spine) turn(b, wq);
      }
      for (const [a, b] of ok) {
        const want = targets[a];
        if (!want) continue;
        const cur = (dirs[a] ??= new THREE.Vector3(...want).normalize());
        w.set(want[0], want[1], want[2]).normalize();
        cur.lerp(w, k).normalize();
        aim(bones[a], bones[b], w.copy(cur).applyQuaternion(bodyQ));
      }
    },
    // straight to a pose, no easing (the first frame, a screenshot)
    snap(targets) {
      for (const key of Object.keys(dirs)) delete dirs[key];
      Object.assign(torso, { pitch: 0, yaw: 0, roll: 0 }, targets.torso ?? {});
      this.pose(targets, 1, Infinity);
    },
    tint(color, amount) {
      for (const m of materials) {
        if (!m.emissive) continue;
        m.emissive.copy(color);
        m.emissiveIntensity = amount;
      }
    },
    dispose() {
      model.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      });
    },
  };
}

// ── poses, in the figure's frame (+z ahead, +y up, +x its left) ──
const mirror = (v) => [-v[0], v[1], v[2]];
const sym = (left, more = {}) => {
  const out = { ...more };
  for (const [k, v] of Object.entries(left)) {
    out[`${k}L`] = v;
    out[`${k}R`] = mirror(v);
  }
  return out;
};

export const POSES = {
  // standing at ease
  stand: sym({ arm: [0.22, -1, 0.02], fore: [0.12, -1, 0.12], thigh: [0.05, -1, 0.02], calf: [0.03, -1, -0.02], foot: [0, -0.35, 1] }),
  // hanging in the air: arms loose, knees a little bent
  hover: (t = 0) => {
    const s = Math.sin(t * 1.7);
    return {
      ...sym({ arm: [0.3, -1, 0.06], fore: [0.18, -1, 0.3], foot: [0, -0.7, 0.7] }),
      thighL: [0.1, -1, 0.14 + s * 0.05],
      calfL: [0.06, -1, -0.22 - s * 0.05],
      thighR: [-0.08, -1, 0.04 - s * 0.05],
      calfR: [-0.05, -1, -0.12 + s * 0.05],
      torso: { pitch: 0.04, yaw: 0, roll: 0 },
    };
  },
  // flat out: the lead fist ahead of him (up, in his frame, which the
  // flight turns to ahead), the other arm along his side, legs trailing
  fly: () => ({
    armR: [-0.12, 1, 0.18],
    foreR: [-0.06, 1, 0.12],
    armL: [0.2, -1, -0.12],
    foreL: [0.1, -1, -0.05],
    thighL: [0.07, -1, -0.04],
    calfL: [0.04, -1, -0.16],
    thighR: [-0.05, -1, 0.02],
    calfR: [-0.03, -1, -0.08],
    footL: [0, -1, -0.35],
    footR: [0, -1, -0.35],
    torso: { pitch: 0, yaw: 0, roll: 0 },
  }),
  // a punch thrown at `at` (a direction in the figure's frame)
  punch: (at = [0, 0, 1]) => ({
    armR: at,
    foreR: at,
    armL: [0.35, -0.55, -0.55],
    foreL: [0.1, 0.4, 0.8],
    thighL: [0.08, -1, -0.2],
    calfL: [0.05, -1, -0.35],
    thighR: [-0.06, -1, 0.15],
    calfR: [-0.04, -1, -0.15],
    footL: [0, -1, -0.4],
    footR: [0, -0.8, 0.2],
    torso: { pitch: 0.1, yaw: 0.35, roll: 0 },
  }),
  // fist cocked back for a charge
  windup: () => ({
    armR: [-0.45, -0.15, -1],
    foreR: [-0.15, 0.55, 0.7],
    armL: [0.3, 0.05, 1],
    foreL: [-0.2, 0.25, 1],
    thighL: [0.1, -1, 0.25],
    calfL: [0.06, -1, -0.3],
    thighR: [-0.1, -1, -0.15],
    calfR: [-0.06, -1, -0.45],
    footL: [0, -0.6, 0.8],
    footR: [0, -0.8, 0.4],
    torso: { pitch: 0.15, yaw: -0.45, roll: 0 },
  }),
  // forearms up, tucked
  guard: () => ({
    ...sym({ arm: [0.35, -0.35, 0.8], fore: [-0.35, 0.75, 0.5], foot: [0, -0.6, 0.6] }),
    thighL: [0.1, -1, 0.4],
    calfL: [0.05, -1, -0.4],
    thighR: [-0.1, -1, 0.3],
    calfR: [-0.05, -1, -0.5],
    torso: { pitch: 0.25, yaw: 0, roll: 0 },
  }),
  // knocked back: thrown open
  hurt: () => ({
    ...sym({ arm: [0.8, 0.35, -0.4], fore: [0.6, 0.6, -0.2], thigh: [0.15, -1, 0.35], calf: [0.1, -1, 0.1], foot: [0, -0.2, 1] }),
    torso: { pitch: -0.45, yaw: 0, roll: 0 },
  }),
  // arms wide, falling
  fall: (t = 0) => ({
    ...sym({ arm: [1, 0.25 + Math.sin(t * 6) * 0.3, 0.1], fore: [1, 0.5, 0.2], thigh: [0.2, -1, 0.3], calf: [0.15, -1, -0.4], foot: [0, -0.4, 1] }),
    torso: { pitch: -0.3, yaw: 0, roll: 0 },
  }),
  // hands on hips, the way a father stands over a city
  proud: () => ({
    ...sym({ arm: [0.75, -0.75, -0.15], fore: [-0.6, -0.15, 0.35], thigh: [0.12, -1, 0.02], calf: [0.08, -1, -0.02], foot: [0.1, -0.35, 1] }),
    torso: { pitch: -0.05, yaw: 0, roll: 0 },
  }),
  // walking or running on the spot: `phase` goes round once a stride (two
  // steps; the left leg leads as sin(phase) rises), `amount` from 0 (standing)
  // to 1, `run` from 0 (a walk) to 1 (flat out). Each leg swings from the hip
  // and folds at the knee as it comes through; the arms swing against the
  // legs, bent more the faster he goes, and he leans into a run.
  stride: (phase = 0, amount = 1, run = 0) => {
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const swing = (0.42 + run * 0.5) * amount;
    const fold = (0.7 + run * 1.3) * amount;
    const at = (a, x) => [x, -Math.cos(a), Math.sin(a)];
    const leg = (side, sw, recover) => {
      const a = sw * swing;
      const knee = Math.max(0, recover) * fold + 0.06 + run * 0.12 * amount;
      return { [`thigh${side}`]: at(a, side === 'L' ? 0.05 : -0.05), [`calf${side}`]: at(a - knee, side === 'L' ? 0.03 : -0.03), [`foot${side}`]: [0, -0.3 - Math.max(0, recover) * 0.4, 1] };
    };
    const arm = (side, sw) => {
      const b = -sw * swing * (0.85 + run * 0.4);
      const elbow = 0.25 + run * 1.15 * amount;
      const out = side === 'L' ? 1 : -1;
      return { [`arm${side}`]: at(b, out * (0.2 + run * 0.08)), [`fore${side}`]: at(b + elbow, out * 0.1) };
    };
    return {
      ...leg('L', s, c),
      ...leg('R', -s, -c),
      ...arm('L', s),
      ...arm('R', -s),
      torso: { pitch: (0.04 + run * 0.28) * amount, yaw: -s * 0.14 * amount, roll: 0 },
    };
  },
  // off the ground: knees up, arms out for balance (`rise` 1 going up, −1 coming down)
  leap: (rise = 1) => ({
    ...sym({ arm: [0.85, 0.15 + rise * 0.35, 0.25], fore: [0.6, 0.55 + rise * 0.2, 0.45] }),
    thighL: [0.08, -0.55, 0.85],
    calfL: [0.05, -1, -0.1],
    thighR: [-0.08, -0.9, 0.35 - rise * 0.25],
    calfR: [-0.05, -0.85, -0.6],
    footL: [0, -0.6, 0.8],
    footR: [0, -0.6, 0.8],
    torso: { pitch: 0.12 - rise * 0.08, yaw: 0, roll: 0 },
  }),
};
