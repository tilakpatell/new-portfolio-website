import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { meshyRig } from '../../src/lib/three/meshyRig.fixture.js';
import { findBones } from '../../src/lib/three/rig.js';
import { UAL_MAP, keepRest, retargetUal, targetMap, ualRig } from './ualRetarget.js';

const TO_DEF = Object.fromEntries(Object.entries(UAL_MAP).map(([d, m]) => [m, d]));
const MIXAMO = { Hips: 'Hips', Spine02: 'Spine', Spine01: 'Spine1', Spine: 'Spine2', neck: 'Neck', Head: 'Head', head_end: 'HeadTop_End', headfront: 'HeadFront' };
const mixName = (n, i) => `mixamorig:${MIXAMO[n] ?? n}_${i}`;
const ORDER = Object.values(UAL_MAP);

// the fixture's rig with its bones renamed
function renamed(rig, name) {
  const names = {};
  Object.values(rig.bones).forEach((b, i) => {
    names[b.name] = name(b.name, i);
    b.name = names[b.name];
  });
  return names;
}
// a mannequin to take clips from: the fixture under UAL's DEF names, its walk with it
function mannequin() {
  const rig = meshyRig();
  const walk = rig.clips.walk.clone();
  for (const t of walk.tracks) {
    const [bone, prop] = t.name.split('.');
    t.name = `${TO_DEF[bone] ?? bone}.${prop}`;
  }
  renamed(rig, (n) => TO_DEF[n] ?? n);
  return { src: keepRest(ualRig({ scene: rig.model, animations: [walk] })), walk };
}

describe('targetMap', () => {
  it('maps a Meshy rig by its own names', () => {
    const rig = meshyRig();
    const map = targetMap(rig.model);
    expect(Object.keys(map).sort()).toEqual([...ORDER].sort());
    for (const [k, b] of Object.entries(map)) expect(b.name).toBe(k);
  });

  it('maps a downloaded Mixamo rig by role, its spine by position up from the hips', () => {
    const rig = meshyRig();
    renamed(rig, mixName);
    const map = targetMap(rig.model, { findBones });
    const plain = Object.fromEntries(Object.entries(map).map(([k, b]) => [k, b.name.replace(/^mixamorig:/, '').replace(/_\d+$/, '')]));
    expect(plain).toEqual({
      Hips: 'Hips',
      Spine02: 'Spine',
      Spine01: 'Spine1',
      Spine: 'Spine2',
      neck: 'Neck',
      Head: 'Head',
      LeftShoulder: 'LeftShoulder',
      LeftArm: 'LeftArm',
      LeftForeArm: 'LeftForeArm',
      LeftHand: 'LeftHand',
      RightShoulder: 'RightShoulder',
      RightArm: 'RightArm',
      RightForeArm: 'RightForeArm',
      RightHand: 'RightHand',
      LeftUpLeg: 'LeftUpLeg',
      LeftLeg: 'LeftLeg',
      LeftFoot: 'LeftFoot',
      LeftToeBase: 'LeftToeBase',
      RightUpLeg: 'RightUpLeg',
      RightLeg: 'RightLeg',
      RightFoot: 'RightFoot',
      RightToeBase: 'RightToeBase',
    });
  });

  it('throws, naming the bones it saw, on a rig with no hips', () => {
    const root = new THREE.Group();
    const a = new THREE.Bone();
    a.name = 'Bone.001_01';
    const b = new THREE.Bone();
    b.name = 'Bone.002_02';
    root.add(a);
    a.add(b);
    expect(() => targetMap(root, { findBones })).toThrow(/no hips in Bone\.001_01, Bone\.002_02/);
  });
});

describe('retargetUal onto any skeleton', () => {
  it('gives a Mixamo-named rig the same turns as the Meshy rig it is a copy of, on its own names', () => {
    const { src, walk } = mannequin();
    const meshy = meshyRig();
    const mixamo = meshyRig();
    const names = renamed(mixamo, mixName);
    const a = retargetUal(src, walk, meshy.model);
    const b = retargetUal(src, walk, mixamo.model, { findBones });
    expect(b.tracks.length).toBe(a.tracks.length);
    for (const t of a.tracks) {
      const [bone, prop] = t.name.split('.');
      const u = b.tracks.find((x) => x.name === `${names[bone]}.${prop}`);
      expect(u, t.name).toBeTruthy();
      u.values.forEach((v, i) => expect(v).toBeCloseTo(t.values[i], 5));
    }
  });

  it('skips the bones a rig lacks (no neck, no shoulders, no toes) and still walks its legs', () => {
    const { src, walk } = mannequin();
    const rig = meshyRig({ without: ['neck', 'LeftShoulder', 'RightShoulder', 'LeftToeBase', 'RightToeBase'] });
    const c = retargetUal(src, walk, rig.model, { findBones });
    const named = c.tracks.map((t) => t.name);
    expect(named).not.toContain('neck.quaternion');
    expect(named).not.toContain('LeftShoulder.quaternion');
    expect(named).toContain('LeftUpLeg.quaternion');
    expect(named).toContain('Hips.position');
    const thigh = c.tracks.find((t) => t.name === 'LeftUpLeg.quaternion').values;
    const q0 = new THREE.Quaternion().fromArray(thigh, 0);
    const qh = new THREE.Quaternion().fromArray(thigh, Math.floor(thigh.length / 16) * 4); // (a quarter of the way through: the thigh at its furthest)
    expect(q0.angleTo(qh)).toBeGreaterThan(0.1);
  });
});
