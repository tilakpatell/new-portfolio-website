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
