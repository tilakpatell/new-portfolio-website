import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { meshyRig, swingClip } from '../../../lib/three/meshyRig.fixture';
import { borrowClip, centred, centredClips, rigOf } from './borrow';

// Meshy's bones, and what an Unreal rig (the Hulk's) calls each
const TO_UNREAL = {
  Hips: 'pelvis',
  Spine02: 'spine_01',
  Spine01: 'spine_03',
  Spine: 'spine_05',
  neck: 'neck_01',
  Head: 'head',
  LeftShoulder: 'clavicle_l',
  LeftArm: 'upperarm_l',
  LeftForeArm: 'lowerarm_l',
  LeftHand: 'hand_l',
  RightShoulder: 'clavicle_r',
  RightArm: 'upperarm_r',
  RightForeArm: 'lowerarm_r',
  RightHand: 'hand_r',
  LeftUpLeg: 'thigh_l',
  LeftLeg: 'calf_l',
  LeftFoot: 'foot_l',
  LeftToeBase: 'ball_l',
  RightUpLeg: 'thigh_r',
  RightLeg: 'calf_r',
  RightFoot: 'foot_r',
  RightToeBase: 'ball_r',
};

// a turn of its own for each bone, the same every run
const turnFor = (i) => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(i * 1.7) * 2, Math.cos(i * 2.3) * 2, Math.sin(i * 0.9 + 1) * 2)).normalize();

// The same figure on an Unreal rig, `size` times as big, every bone at the
// same place but turned its own way at rest (so its axes are nothing like
// Meshy's), an extra spine bone between two the clip moves, and the whole
// figure turned `yaw` about the vertical; `rest`: standing otherwise at rest.
function unrealFrom(src, { size = 1.3, yaw = 0, rest = true } = {}) {
  src.model.updateMatrixWorld(true);
  const root = new THREE.Group();
  root.updateMatrixWorld(true);
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const where = (b) => b.getWorldPosition(new THREE.Vector3()).multiplyScalar(size).applyQuaternion(turn);
  const made = {};
  let i = 0;
  const add = (name, parent, at) => {
    const b = new THREE.Bone();
    b.name = name;
    b.quaternion.copy(turnFor(i++));
    (parent ?? root).add(b);
    (parent ?? root).updateMatrixWorld(true);
    b.position.copy((parent ?? root).worldToLocal(at.clone()));
    b.updateMatrixWorld(true);
    made[name] = b;
    return b;
  };
  const walk = (b, parent) => {
    const name = TO_UNREAL[b.name];
    if (!name) return;
    let up = parent;
    if (name === 'spine_03') {
      // spine_02, between spine_01 and spine_03, that no clip moves
      const mid = where(b).add(where(b.parent)).multiplyScalar(0.5);
      up = add('spine_02', parent, mid);
    }
    const mine = add(name, up, where(b));
    for (const c of b.children) walk(c, mine);
  };
  walk(src.bones.Hips, null);
  // and resting otherwise: the arms out nearer a T, the left forearm bent,
  // the legs apart (as the Hulk's rest), the head down (each turned about a world axis)
  const tip = (name, axis, angle) => {
    const b = made[name];
    root.updateMatrixWorld(true);
    const pw = b.parent.getWorldQuaternion(new THREE.Quaternion());
    const w = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    b.quaternion.premultiply(pw.clone().invert().multiply(w).multiply(pw));
  };
  if (rest) {
    const Z = new THREE.Vector3(0, 0, 1).applyQuaternion(turn);
    const X = new THREE.Vector3(1, 0, 0).applyQuaternion(turn);
    tip('upperarm_l', Z, 0.7);
    tip('upperarm_r', Z, -0.6);
    tip('lowerarm_l', X, -0.8);
    tip('thigh_l', Z, 0.3);
    tip('thigh_r', Z, -0.25);
    tip('head', X, 0.4);
    root.updateMatrixWorld(true);
  }
  return { root, bones: made };
}

// A clip on Meshy's skeleton: the left arm swung forward and up, the right
// forearm bent, the left thigh lifted, and the hips pitched forward 70° and
// dropped half a metre (as a push-up starts)
function pushClip(src) {
  const dur = 1;
  const times = [0, 0.5, 1];
  const tracks = [];
  const q = (bone, axis, angles) => {
    const rest = src.bones[bone].quaternion.clone();
    const values = [];
    for (const a of angles) {
      // turned about a world axis, from where it rests
      src.model.updateMatrixWorld(true);
      const pw = src.bones[bone].parent.getWorldQuaternion(new THREE.Quaternion());
      const w = new THREE.Quaternion().setFromAxisAngle(axis, a);
      const local = pw.clone().invert().multiply(w).multiply(pw).multiply(rest);
      values.push(...local.toArray());
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  };
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  q('LeftArm', X, [0, -0.8, -1.4]);
  q('RightForeArm', Z, [0, 0.9, 1.5]);
  q('LeftUpLeg', X, [0, -0.6, -1.0]);
  q('Hips', X, [0, 0.6, 1.2]);
  const hp = src.bones.Hips.position;
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, [hp.x, hp.y, hp.z, hp.x, hp.y - 25, hp.z + 10, hp.x + 4, hp.y - 50, hp.z + 20]));
  return new THREE.AnimationClip('push', dur, tracks);
}

// each limb's direction (in its figure's space) at time t of a clip
const LIMBS = [
  ['LeftArm', 'LeftForeArm'],
  ['LeftForeArm', 'LeftHand'],
  ['RightArm', 'RightForeArm'],
  ['RightForeArm', 'RightHand'],
  ['LeftUpLeg', 'LeftLeg'],
  ['LeftLeg', 'LeftFoot'],
  ['RightUpLeg', 'RightLeg'],
  ['Hips', 'Spine02'],
  ['Spine', 'neck'],
];
function directions(root, names, clip, t) {
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  mixer.setTime(t);
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const at = (n) => root.getObjectByName(n).getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const out = LIMBS.map(([a, b]) => at(names(b)).sub(at(names(a))).normalize());
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  return out;
}

describe('rigOf', () => {
  it("finds each of the compound's rigs by its names", () => {
    const src = meshyRig();
    expect(rigOf(src.model).family).toBe('meshy');
    expect(rigOf(src.model).bones.upperChest.name).toBe('Spine');
    const unreal = unrealFrom(src);
    const u = rigOf(unreal.root);
    expect(u.family).toBe('unreal');
    expect(u.bones.chest.name).toBe('spine_03');
    expect(u.bones.shoulderL.name).toBe('clavicle_l');
    // Mixamo's, with its prefix, and Auto-Rig Pro's (Natasha)
    const chain = (names) => {
      const root = new THREE.Group();
      let at = root;
      for (const n of names) {
        const b = new THREE.Bone();
        b.name = n;
        at.add(b);
        at = b;
      }
      return root;
    };
    const mix = rigOf(chain(['mixamorig:Hips', 'mixamorig:Spine', 'mixamorig:Spine1', 'mixamorig:Spine2', 'mixamorig:Neck', 'mixamorig:Head']));
    expect(mix.family).toBe('mixamo');
    expect(mix.bones.chest.name).toBe('mixamorig:Spine1');
    const arp = rigOf(chain(['root_x', 'spine_01_x', 'spine_02_x', 'spine_03_x', 'neck_x', 'head_x']));
    expect(arp.family).toBe('arp');
    expect(arp.bones.head.name).toBe('head_x');
    expect(rigOf(chain(['a', 'b']))).toBeNull();
  });
});

describe('borrowClip', () => {
  it("points every limb of another rig the way the clip points Meshy's", () => {
    const src = meshyRig();
    const clip = pushClip(src);
    const dst = unrealFrom(src);
    const got = borrowClip(src.model, clip, dst.root, { place: 'none' });
    expect(got).not.toBeNull();
    for (const t of [0, 0.3, 0.75, 1]) {
      const want = directions(src.model, (n) => n, clip, t);
      const have = directions(dst.root, (n) => TO_UNREAL[n], got, t);
      want.forEach((w, i) => expect(w.angleTo(have[i]), `${LIMBS[i].join('→')} at ${t}`).toBeLessThan(0.02));
    }
  });

  it("lowers the hips as far as the clip does, scaled to the figure's height (not set by the feet)", () => {
    const src = meshyRig();
    const clip = pushClip(src);
    const dst = unrealFrom(src, { size: 1.3, rest: false });
    const got = borrowClip(src.model, clip, dst.root, { place: 'none', ground: false });
    const hipsAt = (root, name, c, t) => {
      const mixer = new THREE.AnimationMixer(root);
      mixer.clipAction(c).play();
      mixer.setTime(t);
      root.updateMatrixWorld(true);
      const p = root.getObjectByName(name).getWorldPosition(new THREE.Vector3());
      mixer.uncacheRoot(root);
      return p;
    };
    const restY = dst.bones.pelvis.getWorldPosition(new THREE.Vector3()).y;
    const s0 = hipsAt(src.model, 'Hips', clip, 0).y;
    const s1 = hipsAt(src.model, 'Hips', clip, 1).y;
    const d1 = hipsAt(dst.root, 'pelvis', got, 1).y;
    expect(d1 - restY).toBeCloseTo((s1 - s0) * 1.3, 3);
  });

  it('keeps its feet on the ground where the clip has them, however its legs rest', () => {
    const src = meshyRig();
    // standing at Meshy's rest a moment, then a hop of 20 cm
    const hop = swingClip(src, 'hop', 1, () => 0, { hips: (t) => (t > 0.6 ? 20 : 0) });
    const dst = unrealFrom(src, { size: 1.3 });
    const FEET = ['foot_l', 'ball_l', 'foot_r', 'ball_r'];
    const lowest = (c, t) => {
      const mixer = new THREE.AnimationMixer(dst.root);
      if (c) mixer.clipAction(c).play();
      mixer.setTime(t);
      dst.root.updateMatrixWorld(true);
      const y = Math.min(...FEET.map((n) => dst.bones[n].getWorldPosition(new THREE.Vector3()).y));
      mixer.stopAllAction();
      mixer.uncacheRoot(dst.root);
      dst.root.updateMatrixWorld(true);
      return y;
    };
    const rest = lowest(null, 0);
    // (the legs that rest apart are straightened: by the hips alone, its feet go into the ground)
    const sunk = borrowClip(src.model, hop, dst.root, { place: 'none', ground: false });
    expect(lowest(sunk, 0.2)).toBeLessThan(rest - 0.01);
    const got = borrowClip(src.model, hop, dst.root, { place: 'none' });
    expect(lowest(got, 0.2)).toBeCloseTo(rest, 3);
    // off the ground as far as Meshy's go, scaled to its height
    const hips = (b) => b.getWorldPosition(new THREE.Vector3()).y;
    const k = (hips(dst.bones.pelvis) - (hips(dst.bones.foot_l) + hips(dst.bones.foot_r)) / 2) / (hips(src.bones.Hips) - (hips(src.bones.LeftFoot) + hips(src.bones.RightFoot)) / 2);
    expect(lowest(got, 0.9) - rest).toBeCloseTo(0.2 * k, 3);
  });

  it('turns the clip to face the way the figure does', () => {
    const src = meshyRig();
    const clip = pushClip(src);
    const yaw = Math.PI / 2;
    const dst = unrealFrom(src, { yaw });
    const got = borrowClip(src.model, clip, dst.root, { place: 'none' });
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const want = directions(src.model, (n) => n, clip, 1).map((d) => d.applyQuaternion(turn));
    const have = directions(dst.root, (n) => TO_UNREAL[n], got, 1);
    want.forEach((w, i) => expect(w.angleTo(have[i])).toBeLessThan(0.02));
  });

  it('starts where the figure stands, and a loop ends where it started', () => {
    const src = meshyRig();
    const clip = pushClip(src);
    const dst = unrealFrom(src, { size: 1 });
    const pos = (c) => c.tracks.find((t) => t.name === 'pelvis.position').values;
    const rest = dst.bones.pelvis.position;
    const start = borrowClip(src.model, clip, dst.root, { place: 'start' });
    const p = pos(start);
    // (the pelvis's parent is the figure's root: its position is in the figure's space)
    expect(p[0]).toBeCloseTo(rest.x, 5);
    expect(p[2]).toBeCloseTo(rest.z, 5);
    const n = p.length / 3;
    expect(p[(n - 1) * 3 + 2] - rest.z).toBeGreaterThan(0.15); // it does travel
    const loop = pos(borrowClip(src.model, clip, dst.root, { place: 'loop' }));
    expect(loop[(n - 1) * 3]).toBeCloseTo(loop[0], 5);
    expect(loop[(n - 1) * 3 + 2]).toBeCloseTo(loop[2], 5);
    // the height is the clip's in all three
    expect(loop[(n - 1) * 3 + 1]).toBeCloseTo(p[(n - 1) * 3 + 1], 5);
  });

  it('leaves both figures as they were, and makes nothing of a rig it does not know', () => {
    const src = meshyRig();
    const clip = pushClip(src);
    const dst = unrealFrom(src);
    const before = src.bones.LeftArm.quaternion.clone();
    const dBefore = dst.bones.upperarm_l.quaternion.clone();
    borrowClip(src.model, clip, dst.root);
    expect(src.bones.LeftArm.quaternion.equals(before)).toBe(true);
    expect(dst.bones.upperarm_l.quaternion.equals(dBefore)).toBe(true);
    expect(borrowClip(src.model, clip, new THREE.Group())).toBeNull();
    expect(borrowClip(src.model, null, dst.root)).toBeNull();
  });
});

describe('centred', () => {
  // the feet's midpoint (in the world) at time t of a clip on the figure
  const feetAt = (rig, clip, t) => {
    const mixer = new THREE.AnimationMixer(rig.model);
    mixer.clipAction(clip).play();
    mixer.setTime(t);
    rig.model.updateMatrixWorld(true);
    const p = rig.bones.LeftFoot.getWorldPosition(new THREE.Vector3()).add(rig.bones.RightFoot.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
    mixer.stopAllAction();
    mixer.uncacheRoot(rig.model);
    rig.model.updateMatrixWorld(true);
    return p;
  };
  // an idle standing a metre to its right and a little ahead of where it rests (as Thor's does)
  const aside = (rig) => {
    const c = rig.clips.idle.clone();
    const p = rig.rest.Hips.at;
    const times = [0, 1.5, 3];
    c.tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, times.flatMap(() => [p.x - 100, p.y, p.z + 30])));
    return c;
  };

  it("stands an idle that's off to one side back where the figure rests", () => {
    const rig = meshyRig();
    rig.model.updateMatrixWorld(true);
    const rest = rig.bones.LeftFoot.getWorldPosition(new THREE.Vector3()).add(rig.bones.RightFoot.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
    const off = aside(rig);
    expect(feetAt(rig, off, 1).x - rest.x).toBeCloseTo(-1, 2);
    const fixed = centred(off, rig.model);
    expect(fixed).not.toBe(off);
    for (const t of [0, 1, 2.5]) {
      const at = feetAt(rig, fixed, t);
      expect(at.x).toBeCloseTo(rest.x, 2);
      expect(at.z).toBeCloseTo(rest.z, 2);
    }
    // its height, its turns and the clip it came from as they were
    expect(feetAt(rig, fixed, 1).y).toBeCloseTo(feetAt(rig, off, 1).y, 5);
    expect(off.tracks.at(-1).values[0]).toBeCloseTo(rig.rest.Hips.at.x - 100, 5);
    // and the figure too
    expect(rig.bones.Hips.position.equals(rig.rest.Hips.at)).toBe(true);
  });

  it('leaves a clip that stands where it rests, or has no hips to move, as it is', () => {
    const rig = meshyRig();
    expect(centred(rig.clips.walk, rig.model)).toBe(rig.clips.walk);
    const still = swingClip(rig, 'still', 1, () => 0, { hips: () => 2 });
    expect(centred(still, rig.model)).toBe(still);
    expect(centred(rig.clips.idle, new THREE.Group())).toBe(rig.clips.idle);
    // a template's, made once
    const t = { scene: rig.model, clips: [aside(rig), rig.clips.walk] };
    const once = centredClips(t);
    expect(centredClips(t)).toBe(once);
    expect(once[0]).not.toBe(t.clips[0]);
    expect(once[1]).toBe(t.clips[1]);
  });
});
