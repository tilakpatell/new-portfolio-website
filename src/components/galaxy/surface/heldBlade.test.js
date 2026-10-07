import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bladeInHand, heldBlade } from './heldBlade';
import { meshyRig } from '../../../lib/three/meshyRig.fixture';

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

// a rigged figure as activity.js has one: its model in a holder, in a scene
const standing = () => {
  const rig = meshyRig();
  const scene = new THREE.Group();
  const holder = new THREE.Group();
  scene.add(holder);
  holder.add(rig.model);
  scene.updateMatrixWorld(true);
  return { rig, scene, holder, fig: { model: rig.model, bones: rig.bones, tall: 1.8 } };
};

describe('a duellist’s blade', () => {
  it('held where an unrigged figure’s hand would hang, lit, as before', () => {
    const h = heldBlade({ color: '#ff3b3b' }, 2);
    expect(h.arm.children).toContain(h.gun);
    expect(h.gun.getObjectByName('blade').visible).toBe(true);
    expect(h.arm.position.y).toBeCloseTo(0.94, 5);
    h.owned.forEach((o) => o.dispose?.());
  });

  it('in a rigged figure’s own right hand: the hilt a child of the hand, lit, at guard and swung', () => {
    const { rig, scene, fig } = standing();
    const b = bladeInHand(fig, { color: '#ff3b3b' }, { parent: scene });
    expect(b).not.toBeNull();
    expect(b.gun.parent).toBe(rig.bones.RightHand);
    const blade = b.gun.getObjectByName('blade');
    // lit over a few frames, at guard: the hand out before the body, the blade up and ahead
    const before = rig.bones.RightHand.getWorldPosition(new THREE.Vector3()).clone();
    for (let i = 0; i < 20; i++) {
      scene.updateMatrixWorld(true);
      b.pose(1 / 30, i / 30, { forward: FORWARD, up: UP, me: { x: 0, z: 0, yaw: 0 } });
    }
    expect(blade.visible).toBe(true);
    expect(blade.scale.y).toBeGreaterThan(0.9);
    const hand = rig.bones.RightHand.getWorldPosition(new THREE.Vector3());
    expect(hand.z).toBeGreaterThan(before.z + 0.03);
    blade.updateWorldMatrix(true, false);
    const root = new THREE.Vector3(0, 0, 0).applyMatrix4(blade.matrixWorld);
    const tip = new THREE.Vector3(0, 1, 0).applyMatrix4(blade.matrixWorld);
    expect(tip.y).toBeGreaterThan(root.y + 0.4);
    expect(tip.z).toBeGreaterThan(0.1);
    // a stroke: it's busy through it, and it ends
    expect(b.swing(1)).toBeTruthy();
    expect(b.busy).toBe(true);
    for (let i = 0; i < 60; i++) {
      scene.updateMatrixWorld(true);
      b.pose(1 / 30, 1 + i / 30, { forward: FORWARD, up: UP, me: { x: 0, z: 0, yaw: 0 } });
    }
    expect(b.busy).toBe(false);
    // put out, and gone from the hand
    b.light(false);
    b.dispose();
    expect(b.gun.parent).toBeNull();
  });

  it('nothing for a figure with no hand to hold it (heldBlade’s arm then)', () => {
    const shapes = { model: new THREE.Group(), tall: 1.8 };
    expect(bladeInHand(shapes, { color: '#f00' })).toBeNull();
    expect(bladeInHand(null, { color: '#f00' })).toBeNull();
    // (a group named like a hand isn't a bone to hold it with)
    const g = new THREE.Group();
    const fake = new THREE.Group();
    fake.name = 'RightHand';
    g.add(fake);
    expect(bladeInHand({ model: g }, { color: '#f00' })).toBeNull();
  });
});
