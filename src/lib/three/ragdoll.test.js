import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createRagdoll } from './ragdoll';

const V = THREE.Vector3;
// a figure: hips with two legs hanging, an arm sticking out sideways
const figure = () => {
  const root = new THREE.Object3D();
  const hips = new THREE.Object3D();
  root.add(hips);
  const legs = [-0.1, 0.1].map((x) => {
    const up = new THREE.Object3D();
    up.position.set(x, 0, 0);
    const lo = new THREE.Object3D();
    lo.position.set(0, -0.45, 0);
    up.add(lo);
    const foot = new THREE.Object3D();
    foot.position.set(0, -0.45, 0);
    lo.add(foot);
    hips.add(up);
    return { up, lo };
  });
  const arm = new THREE.Object3D();
  arm.position.set(0.2, 0.5, 0);
  arm.quaternion.setFromAxisAngle(new V(0, 0, 1), Math.PI / 2); // out to the side
  const hand = new THREE.Object3D();
  hand.position.set(0, -0.3, 0);
  arm.add(hand);
  hips.add(arm);
  root.updateMatrixWorld(true);
  return { root, hips, legs, arm, hand };
};
const run = (rd, n, dt = 1 / 60) => {
  for (let i = 0; i < n; i++) rd.step(dt);
};

describe('createRagdoll', () => {
  it('moves the joints it is given and nothing else', () => {
    const f = figure();
    const was = f.hips.quaternion.clone();
    const rd = createRagdoll([{ obj: f.legs[0].up, len: 0.45 }, { obj: f.arm, len: 0.3 }]);
    run(rd, 10);
    expect(f.legs[0].up.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(0.01);
    expect(f.legs[1].up.quaternion.angleTo(new THREE.Quaternion())).toBe(0);
    expect(f.hips.quaternion.equals(was)).toBe(true);
  });

  it('keeps every joint within its swing and settles toward hanging down', () => {
    const f = figure();
    const rd = createRagdoll([{ obj: f.arm, len: 0.3 }], { kick: 6, noise: 0 });
    run(rd, 400);
    for (const p of rd.parts) expect(p.rot.length()).toBeLessThanOrEqual(1.35 + 1e-6);
    f.root.updateMatrixWorld(true);
    const a = f.arm.getWorldPosition(new V());
    const h = f.hand.getWorldPosition(new V());
    // the arm hung out sideways at the start; gravity has it hanging lower now
    expect(h.y - a.y).toBeLessThan(-0.05);
  });

  it('starts from the pose at its first step and puts it back on dispose', () => {
    const f = figure();
    const rd = createRagdoll([{ obj: f.legs[1].up, len: 0.45 }]);
    f.legs[1].up.quaternion.setFromAxisAngle(new V(1, 0, 0), 0.4); // the clip's pose
    const base = f.legs[1].up.quaternion.clone();
    run(rd, 30);
    expect(f.legs[1].up.quaternion.equals(base)).toBe(false);
    rd.dispose();
    expect(f.legs[1].up.quaternion.equals(base)).toBe(true);
  });

  it('does nothing without joints', () => {
    const rd = createRagdoll([{ obj: null }]);
    expect(() => run(rd, 3)).not.toThrow();
  });
});
