import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { aimBone, elbowFor, frameFrom, palmFrame, reach, setWorldQuaternion, spring } from './ik';

const V = THREE.Vector3;
const chain = (a = 1, b = 1) => {
  const root = new THREE.Object3D();
  const upper = new THREE.Object3D();
  const fore = new THREE.Object3D();
  const hand = new THREE.Object3D();
  fore.position.set(0, -a, 0); // the bones hang down at rest
  hand.position.set(0, -b, 0);
  root.add(upper);
  upper.add(fore);
  fore.add(hand);
  root.updateMatrixWorld(true);
  return { root, upper, fore, hand };
};
const world = (o) => o.getWorldPosition(new V());

describe('two-bone IK', () => {
  it('bends the elbow toward the pole, keeping both lengths', () => {
    const S = new V(0, 0, 0);
    const T = new V(0, 0, 1.5);
    const E = elbowFor(S, T, 1, 1, new V(0, -1, 0));
    expect(E.distanceTo(S)).toBeCloseTo(1, 6);
    expect(E.distanceTo(T)).toBeCloseTo(1, 6);
    expect(E.y).toBeLessThan(-0.3); // on the pole's side
    expect(Math.abs(E.x)).toBeLessThan(1e-9);
  });

  it('straightens onto the line when the target is out of reach', () => {
    const E = elbowFor(new V(0, 0, 0), new V(0, 0, 5), 1, 1, new V(0, -1, 0));
    expect(E.z).toBeCloseTo(1, 3);
    expect(Math.abs(E.y)).toBeLessThan(0.05);
  });

  it('puts a chain’s hand on the target, and half way at half weight', () => {
    const c = chain();
    const target = new V(0.6, -0.4, 1.2);
    reach(c.upper, c.fore, c.hand, target, new V(0, -1, 0), 1);
    expect(world(c.hand).distanceTo(target)).toBeLessThan(1e-4);
    // the elbow kept its length and hangs below the shoulder–hand line
    expect(world(c.fore).distanceTo(world(c.upper))).toBeCloseTo(1, 4);
    expect(world(c.fore).y).toBeLessThan(target.y / 2);
    const half = chain();
    const rest = world(half.hand);
    reach(half.upper, half.fore, half.hand, target, new V(0, -1, 0), 0.5);
    const got = world(half.hand);
    expect(got.distanceTo(rest)).toBeGreaterThan(0.2);
    expect(got.distanceTo(target)).toBeGreaterThan(0.2);
  });

  it('reaches as far as it can toward a target it can’t get to', () => {
    const c = chain();
    reach(c.upper, c.fore, c.hand, new V(0, 0, 9), new V(0, -1, 0), 1);
    const h = world(c.hand);
    expect(h.z).toBeCloseTo(2, 2); // (a hair short of straight, so the elbow never locks)
    expect(Math.abs(h.y)).toBeLessThan(0.05); // (the elbow’s slight bend carries the hand a touch off the line)
  });
});

describe('bones in world space', () => {
  it('aimBone points a bone’s child along a direction', () => {
    const c = chain();
    aimBone(c.upper, c.fore, new V(1, 0, 0), 1);
    expect(world(c.fore).x).toBeCloseTo(1, 5);
    expect(Math.abs(world(c.fore).y)).toBeLessThan(1e-5);
  });

  it('setWorldQuaternion sets a nested bone’s orientation outright, through a turned parent', () => {
    const c = chain();
    c.upper.rotation.z = 0.7;
    c.root.updateMatrixWorld(true);
    const want = new THREE.Quaternion().setFromAxisAngle(new V(0, 1, 0), 1.1);
    setWorldQuaternion(c.hand, want, 1);
    const got = c.hand.getWorldQuaternion(new THREE.Quaternion());
    expect(Math.abs(got.dot(want))).toBeCloseTo(1, 5);
  });

  it('frameFrom makes +z the forward and +y the up', () => {
    const q = frameFrom(new V(1, 0, 0), new V(0, 1, 0));
    expect(new V(0, 0, 1).applyQuaternion(q).x).toBeCloseTo(1, 6);
    expect(new V(0, 1, 0).applyQuaternion(q).y).toBeCloseTo(1, 6);
    // an up that isn't square to the forward is squared up
    const q2 = frameFrom(new V(0, 0, 1), new V(0, 1, 1));
    expect(new V(0, 1, 0).applyQuaternion(q2).y).toBeCloseTo(1, 6);
  });
});

describe('a hand’s palm', () => {
  it('finds the thin axis of a slab as the palm, the long one as the fingers', () => {
    const pts = [];
    for (let i = 0; i < 400; i++) pts.push([Math.random() * 4 - 2, Math.random() * 10, Math.random() * 1 - 0.5]);
    const f = palmFrame(pts);
    expect(Math.abs(f.normal.z)).toBeCloseTo(1, 1);
    expect(Math.abs(f.along.y)).toBeCloseTo(1, 1);
    expect(Math.abs(f.across.x)).toBeCloseTo(1, 1);
  });
  it('signs the normal toward a reference direction', () => {
    const pts = [];
    for (let i = 0; i < 200; i++) pts.push([Math.random() * 4, Math.random() * 10, Math.random() * 0.5]);
    expect(palmFrame(pts, [0, 0, -1]).normal.z).toBeLessThan(0);
    expect(palmFrame(pts, [0, 0, 1]).normal.z).toBeGreaterThan(0);
  });
});

describe('a spring', () => {
  it('settles back from a kick and never runs away', () => {
    const s = { x: 0, v: 0 };
    s.v = 8;
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      spring(s, 1 / 60, 220, 16);
      peak = Math.max(peak, Math.abs(s.x));
    }
    expect(peak).toBeGreaterThan(0.1);
    expect(Math.abs(s.x)).toBeLessThan(0.01);
    expect(Math.abs(s.v)).toBeLessThan(0.1);
    // held fire: a kick every frame still stays bounded
    for (let i = 0; i < 600; i++) {
      s.v += 8;
      spring(s, 1 / 60, 220, 16);
      expect(Math.abs(s.x)).toBeLessThan(5);
    }
  });
});
