import { describe, expect, it } from 'vitest';
import { createPhysics } from './world';
import { KINDS, addProps } from './props';
import { addHeightfield } from './heightfield';

const flat = (p) => addHeightfield(p, { heights: new Float32Array(65 * 65), x: -32, z: -32 });

describe('addProps', () => {
  it('has his kinds', () => {
    expect(KINDS.crate).toMatchObject({ type: 'dynamic', mass: 0.02, hitThreshold: 0 });
    expect(KINDS.tree).toMatchObject({ type: 'fixed', friction: 0.7 });
    expect(KINDS.tree.colliders[0]).toMatchObject({ shape: 'cylinder', args: [2.5, 0.15] });
  });

  it('settles a dropped crate, and writes it only while it is awake', async () => {
    const p = await createPhysics();
    flat(p);
    const props = addProps(p, [{ kind: 'crate', x: 0, y: 0, z: 0, yaw: 0.3, scale: 1 }]);
    expect(props.bodies).toHaveLength(1);
    // asleep, as placed (resting on the ground: centre half a metre up)
    expect(props.bodies[0].sleeping).toBe(true);
    expect(props.bodies[0].position()[1]).toBeCloseTo(0.5, 5);
    const writes = [];
    const write = (i, pos, quat) => writes.push([i, [...pos], [...quat]]);
    props.sync(write);
    expect(writes).toHaveLength(0);
    props.wake(0);
    props.bodies[0].body.setTranslation({ x: 0, y: 3, z: 0 }, true);
    for (let i = 0; i < 180; i++) p.step(1 / 60);
    props.sync(write);
    expect(writes.length).toBeLessThanOrEqual(1);
    expect(props.bodies[0].position()[1]).toBeCloseTo(0.5, 1);
    props.wake(0);
    p.step(1 / 60);
    writes.length = 0;
    props.sync(write);
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe(0);
    p.dispose();
  });

  it('holds a tree still when a crate hits it', async () => {
    const p = await createPhysics();
    flat(p);
    const props = addProps(p, [
      { kind: 'tree', x: 0, y: 0, z: 0, yaw: 0, scale: 1 },
      { kind: 'crate', x: -4, y: 0, z: 0, yaw: 0, scale: 1 },
    ]);
    props.wake(1);
    props.bodies[1].body.setLinvel({ x: 6, y: 0, z: 0 }, true);
    for (let i = 0; i < 60; i++) p.step(1 / 60);
    expect(props.bodies[0].position()).toEqual([0, 2.5, 0]);
    expect(props.bodies[1].position()[0]).toBeLessThan(0);
    props.remove();
    expect(p.world.bodies.len()).toBe(1);
    p.dispose();
  });

  it('resets every prop', async () => {
    const p = await createPhysics();
    const props = addProps(p, [{ kind: 'crate', x: 5, y: 1, z: 5, yaw: 0, scale: 1 }]);
    props.wake(0);
    for (let i = 0; i < 30; i++) p.step(1 / 60);
    props.reset();
    p.step(1 / 60);
    expect(props.bodies[0].position()).toEqual([5, 1.5, 5]);
    p.dispose();
  });
});

describe('addProps, when things go wrong', () => {
  it('adds nothing for a kind it does not know', async () => {
    const p = await createPhysics();
    expect(() => addProps(p, [{ kind: 'crate', x: 0, y: 0, z: 0 }, { kind: 'piano', x: 1, y: 0, z: 0 }])).toThrow(/piano/);
    expect(p.world.bodies.len()).toBe(0);
    p.dispose();
  });

  it('does nothing once the world is gone', async () => {
    const p = await createPhysics();
    const props = addProps(p, [{ kind: 'crate', x: 0, y: 0, z: 0 }]);
    p.dispose();
    expect(() => props.sync(() => {})).not.toThrow();
    expect(() => props.wake(0)).not.toThrow();
    expect(() => props.reset()).not.toThrow();
    expect(() => props.remove()).not.toThrow();
  });
});

describe('addProps on a round planet', () => {
  it('stands each prop up the way out from the middle, and it stays there', async () => {
    const centre = [0, -100, 0];
    const p = await createPhysics({ gravity: { centre, g: 9.81 } });
    p.add({ type: 'fixed', position: centre, group: 'floor', colliders: [{ shape: 'ball', args: [100] }] });
    const a = Math.PI / 6;
    const up = [Math.sin(a), Math.cos(a), 0];
    const at = [centre[0] + up[0] * 100, centre[1] + up[1] * 100, 0];
    const props = addProps(p, [{ kind: 'crate', x: at[0], y: at[1], z: at[2], up, yaw: 0.4 }]);
    const b = props.bodies[0];
    // (its middle half a metre out along up, and its own +y pointing up)
    const pos = b.position();
    expect(Math.hypot(pos[0] - centre[0], pos[1] - centre[1], pos[2] - centre[2])).toBeCloseTo(100.5, 4);
    const [qx, qy, qz, qw] = b.quaternion();
    const yx = 2 * (qx * qy - qw * qz);
    const yy = 1 - 2 * (qx * qx + qz * qz);
    const yz = 2 * (qy * qz + qw * qx);
    expect(yx * up[0] + yy * up[1] + yz * up[2]).toBeCloseTo(1, 5);
    for (let i = 0; i < 120; i++) p.step(1 / 60);
    expect(b.sleeping).toBe(true);
    expect(b.position()[0]).toBeCloseTo(pos[0], 2);
    // knocked, it rolls about on the sphere and comes to rest on it again
    b.push([0.3, 0, 0.2]);
    for (let i = 0; i < 600; i++) p.step(1 / 60);
    const end = b.position();
    const r = Math.hypot(end[0] - centre[0], end[1] - centre[1], end[2] - centre[2]);
    expect(r).toBeGreaterThan(100.3);
    expect(r).toBeLessThan(101.3);
    p.dispose();
  });

  it('scales a hull kind, its offsets and its mass', async () => {
    const p = await createPhysics();
    const pts = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1]);
    const kinds = { h: { type: 'dynamic', mass: 0.1, lift: 0, colliders: [{ shape: 'hull', args: [pts] }] } };
    const one = addProps(p, [{ kind: 'h', x: 0, y: 0, z: 0, scale: 1 }], kinds);
    const two = addProps(p, [{ kind: 'h', x: 9, y: 0, z: 0, scale: 2 }], kinds);
    expect(two.bodies[0].body.mass() / one.bodies[0].body.mass()).toBeCloseTo(8, 3);
    expect(pts[3]).toBe(1); // (the kind's own points untouched)
    p.dispose();
  });
});
