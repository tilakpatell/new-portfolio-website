import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHitboxRig } from './hitboxRig';

// a Meshy-shaped skeleton standing 1.8 m, feet at y 0, facing +z
function skeleton({ without = [] } = {}) {
  const root = new THREE.Group();
  const bone = (name, parent, x, y, z) => {
    if (without.includes(name)) return parent;
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    parent.add(b);
    return b;
  };
  const hips = bone('Hips', root, 0, 0.95, 0);
  const spine = bone('Spine', hips, 0, 0.3, 0);
  const neck = bone('neck', spine, 0, 0.3, 0);
  const head = bone('Head', neck, 0, 0.1, 0);
  bone('head_end', head, 0, 0.15, 0);
  for (const [side, sx] of [
    ['Left', 1],
    ['Right', -1],
  ]) {
    const arm = bone(`${side}Arm`, spine, sx * 0.2, 0.25, 0);
    const fore = bone(`${side}ForeArm`, arm, sx * 0.28, 0, 0);
    bone(`${side}Hand`, fore, sx * 0.26, 0, 0);
    const up = bone(`${side}UpLeg`, hips, sx * 0.1, -0.05, 0);
    const leg = bone(`${side}Leg`, up, 0, -0.45, 0);
    bone(`${side}Foot`, leg, 0, -0.42, 0);
  }
  root.updateMatrixWorld(true);
  return root;
}
const spy = () => {
  const calls = [];
  return { calls, set: (region, a, b) => calls.push([region, a, b]) };
};
const worldOf = (root, name) => root.getObjectByName(name).getWorldPosition(new THREE.Vector3()).toArray();
const near = (a, b, tol = 0.01) => a.every((v, i) => Math.abs(v - b[i]) < tol);

describe('createHitboxRig', () => {
  it('every region’s segment ends land on its bones within 1 cm', () => {
    const root = skeleton();
    const rig = createHitboxRig(root, null);
    expect(rig.single).toBe(false);
    expect(rig.regions).toHaveLength(10);
    const h = spy();
    rig.attach(h);
    rig.update();
    expect(h.calls).toHaveLength(10);
    const expected = { head: ['neck', 'head_end'], chest: ['Hips', 'neck'], upperArmL: ['LeftArm', 'LeftForeArm'], shinR: ['RightLeg', 'RightFoot'] };
    for (const [region, [from, to]] of Object.entries(expected)) {
      const call = h.calls.find((c) => c[0] === region);
      expect(near(call[1], worldOf(root, from))).toBe(true);
      expect(near(call[2], worldOf(root, to))).toBe(true);
    }
  });

  it('a posed arm moves its hurtbox', () => {
    const root = skeleton();
    const rig = createHitboxRig(root, null);
    const h = spy();
    rig.attach(h);
    rig.update();
    const before = h.calls.find((c) => c[0] === 'upperArmL')[2];
    root.getObjectByName('LeftArm').rotation.z = Math.PI / 2;
    root.updateMatrixWorld(true);
    h.calls.length = 0;
    rig.update();
    const after = h.calls.find((c) => c[0] === 'upperArmL')[2];
    expect(near(after, worldOf(root, 'LeftForeArm'))).toBe(true);
    expect(near(after, before, 0.1)).toBe(false);
  });

  it('a missing neck drops the head and the chest and keeps the limbs', () => {
    const rig = createHitboxRig(skeleton({ without: ['neck'] }), null);
    expect(rig.regions).not.toContain('head');
    expect(rig.regions).not.toContain('chest');
    expect(rig.regions).toHaveLength(8);
    expect(rig.single).toBe(false);
  });

  it('fewer than four regions is single, and update sets whole from the feet up tall', () => {
    const root = skeleton({ without: ['LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'neck'] });
    const rig = createHitboxRig(root, null, { tall: 1.8 });
    expect(rig.single).toBe(true);
    expect(rig.regions).toEqual([]);
    const h = spy();
    rig.attach(h);
    rig.update();
    expect(h.calls).toEqual([['whole', [0, 0, 0], [0, 1.8, 0]]]);
  });

  it('a root with no bones at all is single and never throws', () => {
    const rig = createHitboxRig(new THREE.Group(), null);
    expect(rig.single).toBe(true);
    expect(() => rig.update()).not.toThrow();
  });

  it('blade() follows the hand bone', () => {
    const root = skeleton();
    const rig = createHitboxRig(root, null, { blade: { bone: 'RightHand', length: 1.2, offset: 0.1 } });
    const hand = worldOf(root, 'RightHand');
    const b = rig.blade();
    expect(near(b.base, [hand[0], hand[1] + 0.1, hand[2]])).toBe(true);
    expect(near(b.tip, [hand[0], hand[1] + 1.3, hand[2]])).toBe(true);
    root.getObjectByName('RightHand').rotation.x = Math.PI / 2; // the hand's y now points along +z
    root.updateMatrixWorld(true);
    const c = rig.blade();
    expect(near(c.tip, [hand[0], hand[1], hand[2] + 1.3])).toBe(true);
    expect(createHitboxRig(root, null).blade()).toBeNull();
  });

  it('debug(parent) adds a group that update keeps in place, and debug(null) removes it', () => {
    const root = skeleton();
    const parent = new THREE.Group();
    const rig = createHitboxRig(root, null);
    rig.attach(spy());
    const g = rig.debug(parent);
    expect(parent.children).toContain(g);
    expect(g.children).toHaveLength(10);
    rig.update();
    const head = g.children.find((m) => m.name === 'head');
    const neck = worldOf(root, 'neck');
    const end = worldOf(root, 'head_end');
    expect(near(head.position.toArray(), [(neck[0] + end[0]) / 2, (neck[1] + end[1]) / 2, (neck[2] + end[2]) / 2])).toBe(true);
    rig.debug(null);
    expect(parent.children).not.toContain(g);
  });
});
