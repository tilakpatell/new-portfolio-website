import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createPhysics } from '../physics/world';
import { addPusher } from '../physics/pusher';
import { KINDS, createKnockables, knockablesWanted } from './knockables';

const ground = (p) => p.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [60, 0.5, 60] }] });
const where = (mesh, i) => {
  const m = new THREE.Matrix4();
  mesh.getMatrixAt(i, m);
  return new THREE.Vector3().setFromMatrixPosition(m);
};
const meshOf = (k, kind) => k.meshes.find((m) => m.name === `knockable-${kind}`);

describe('knockables', () => {
  it('loads the engine only where it is worth it', () => {
    expect(knockablesWanted({ tier: 'high' })).toBe(true);
    expect(knockablesWanted({ tier: 'ultra' })).toBe(true);
    expect(knockablesWanted({ tier: 'mid' })).toBe(false);
    expect(knockablesWanted({ tier: 'high', phone: true })).toBe(false);
    expect(knockablesWanted({ tier: 'high', saveData: true })).toBe(false);
  });

  it('draws each kind as one instanced mesh, standing where it was put, with no engine', () => {
    const parent = new THREE.Group();
    const k = createKnockables({ parent, count: 8 });
    expect(k.physical).toBe(false);
    expect(k.meshes).toHaveLength(Object.keys(KINDS).length);
    expect(parent.children).toHaveLength(k.meshes.length);
    k.add([
      { kind: 'cone', x: 3, y: 0, z: -2 },
      { kind: 'cone', x: 4, y: 0, z: -2 },
      { kind: 'crate', x: 0, y: 0, z: 5, yaw: 1 },
    ]);
    const cone = where(meshOf(k, 'cone'), 0);
    expect(cone.x).toBeCloseTo(3, 5);
    expect(cone.y).toBeCloseTo(KINDS.cone.lift, 5);
    expect(cone.z).toBeCloseTo(-2, 5);
    k.sync();
    k.dispose();
    expect(parent.children).toHaveLength(0);
  });

  it('drops what doesn’t fit, and throws on a kind it doesn’t know', () => {
    const k = createKnockables({ count: 2 });
    k.add([0, 1, 2, 3].map((x) => ({ kind: 'bin', x, y: 0, z: 0 })));
    expect(() => k.add([{ kind: 'piano', x: 0, y: 0, z: 0 }])).toThrow(/piano/);
    k.dispose();
  });

  it('sleeps until the car comes, then goes flying, is drawn where it went and is heard', async () => {
    const p = await createPhysics();
    ground(p);
    const impacts = { onHit: vi.fn() };
    const k = createKnockables({ physics: p, impacts, count: 4 });
    expect(k.physical).toBe(true);
    k.add([{ kind: 'cone', x: 4, y: 0, z: 0 }]);
    const car = addPusher(p, { radius: 1.7, half: 0.3, position: [-6, 1.4, 0] });
    for (let i = 0; i < 20; i++) p.step(1 / 60);
    k.sync();
    const mesh = meshOf(k, 'cone');
    const slot = 0;
    expect(where(mesh, slot).x).toBeCloseTo(4, 2);
    // the car at 15 m/s, through where the cone stands
    for (let i = 0; i < 90; i++) {
      car.follow([-6 + (i + 1) * 0.25, 1.4, 0], 1 / 60);
      p.step(1 / 60);
      k.sync();
    }
    const after = where(mesh, slot);
    expect(after.distanceTo(new THREE.Vector3(4, KINDS.cone.lift, 0))).toBeGreaterThan(1);
    expect([after.x, after.y, after.z].every(Number.isFinite)).toBe(true);
    expect(impacts.onHit).toHaveBeenCalled();
    const [force, at] = impacts.onHit.mock.calls[0];
    expect(force).toBeGreaterThan(0);
    expect(at).toHaveLength(3);
    k.dispose();
    p.dispose();
  });

  it('leaves a sleeping street alone: nothing is written while nothing moves', async () => {
    const p = await createPhysics();
    ground(p);
    const k = createKnockables({ physics: p, count: 4 });
    k.add([{ kind: 'crate', x: 0, y: 0, z: 0 }]);
    for (let i = 0; i < 30; i++) p.step(1 / 60);
    const mesh = meshOf(k, 'crate');
    const before = mesh.instanceMatrix.version;
    k.sync();
    expect(mesh.instanceMatrix.version).toBe(before);
    k.dispose();
    p.dispose();
  });
});
