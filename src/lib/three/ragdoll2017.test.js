import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import book from '../../data/bf2017/physics/ragdoll.json';
import { floorCollide, ragdollOf, rig2017 } from './ragdoll2017';

const TROOPER = ragdollOf(book, 'stormtroopershared');

// a figure on the game's skeleton, standing (facing +z, its left on +x): the fifteen bodies'
// bones and the ones between them the ragdoll skips (the upper spine, the neck, the shoulders)
function skeleton() {
  const root = new THREE.Object3D();
  const bones = {};
  const add = (name, parent, x, y, z = 0) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    (parent ? bones[parent] : root).add(b);
    bones[name] = b;
  };
  add('Hips', null, 0, 1, 0);
  add('Spine', 'Hips', 0, 0.1);
  add('Spine1', 'Spine', 0, 0.15);
  add('Spine2', 'Spine1', 0, 0.15);
  add('Neck', 'Spine2', 0, 0.12);
  add('Head', 'Neck', 0, 0.1);
  for (const [s, k] of [['Left', 1], ['Right', -1]]) {
    add(`${s}Shoulder`, 'Spine2', 0.05 * k, 0.08);
    add(`${s}Arm`, `${s}Shoulder`, 0.12 * k, 0);
    add(`${s}ForeArm`, `${s}Arm`, 0.28 * k, 0);
    add(`${s}Hand`, `${s}ForeArm`, 0.25 * k, 0);
    add(`${s}UpLeg`, 'Hips', 0.1 * k, -0.05);
    add(`${s}Leg`, `${s}UpLeg`, 0, -0.43, 0.01);
    add(`${s}Foot`, `${s}Leg`, 0, -0.43, -0.01);
  }
  root.updateMatrixWorld(true);
  return bones;
}

const flat = floorCollide(() => 0);
const run = (rag, seconds, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) rag.step(dt);
};

describe('the game’s ragdoll rows', () => {
  it('gives the trooper fifteen bodies and the impulse cap', () => {
    expect(TROOPER.bodies).toHaveLength(15);
    expect(TROOPER.maxImpulse).toBe(1000);
    expect(TROOPER.impulseLifetime).toBe(10);
  });

  it('gives a partial row the trooper’s bodies, and nothing for an unknown id', () => {
    const ewok = ragdollOf(book, 'hero_lightsaber_ewok');
    expect(ewok.partial).toBe(true);
    expect(ewok.bodies).toHaveLength(15);
    expect(ragdollOf(book, 'nobody')).toBe(null);
  });
});

describe('rig2017', () => {
  it('makes a point a body and sticks along the bodies’ tree', () => {
    const rag = rig2017(skeleton(), TROOPER, { collide: flat });
    expect(rag.body.n).toBe(15);
    expect(rag.point('Spine2')).toBe(null);
    expect(rag.point('LeftHand')).toBeTruthy();
    expect(rag.mass).toBeGreaterThan(80);
    // the upper arm hangs off the spine's point, not a shoulder's: they stay as far apart as they began
    const arm = rag.point('LeftArm');
    const spine = rag.point('Spine');
    const d0 = Math.hypot(arm.x - spine.x, arm.y - spine.y, arm.z - spine.z);
    run(rag, 0.5);
    const a = rag.point('LeftArm');
    const s = rag.point('Spine');
    expect(Math.hypot(a.x - s.x, a.y - s.y, a.z - s.z)).toBeCloseTo(d0, 1);
  });

  it('caps a kick by maxImpulse over the whole mass, and a second kick in the frame takes what is left', () => {
    const rag = rig2017(skeleton(), TROOPER, { collide: flat, speed: 0 });
    const first = rag.kick([800, 0, 0]);
    const second = rag.kick([800, 0, 0]);
    expect(first).toBe(800);
    expect(second).toBeCloseTo(200, 6);
    expect(rag.kick([800, 0, 0])).toBe(0);
    const x0 = rag.point('Spine').x;
    rag.step(1 / 60);
    // 1000 N·s over ~94 kg is under 11 m/s: under 0.2 m in the first step
    expect(rag.point('Spine').x - x0).toBeLessThan(0.2);
    expect(rag.point('Spine').x - x0).toBeGreaterThan(0.1);
  });

  it('holds the falling push under the cap too, and the allowance comes back over the lifetime', () => {
    const rag = rig2017(skeleton(), TROOPER, { collide: flat, speed: 100, push: { x: 1, y: 0, z: 0 } });
    expect(rag.kick([500, 0, 0])).toBe(0); // (the fall spent it all)
    run(rag, 5);
    expect(rag.kick([1000, 0, 0])).toBeGreaterThan(400);
  });

  it('settles on a flat floor within six seconds, every point at or over it', () => {
    const rag = rig2017(skeleton(), TROOPER, { collide: flat, push: { x: 0, y: 0, z: 1 }, speed: 3 });
    run(rag, 6.5);
    expect(rag.settled).toBe(true);
    for (let i = 0; i < rag.body.n; i++) expect(rag.body.pos[i * 3 + 1]).toBeGreaterThanOrEqual(-1e-6);
    expect(rag.centre()[1]).toBeLessThan(0.4);
  });
});

describe('floorCollide', () => {
  it('reads a number, a { y } or nothing', () => {
    const p = { x: 0, y: 0.01, z: 0 };
    expect(floorCollide(() => ({ y: 0.5 }))(p, 0.1)).toBe(true);
    expect(p.y).toBeCloseTo(0.6, 9);
    expect(floorCollide(() => null)({ x: 0, y: -5, z: 0 }, 0.1)).toBe(false);
  });
});
