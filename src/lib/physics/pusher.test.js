import { describe, expect, it } from 'vitest';
import { createPhysics } from './world';
import { addPusher } from './pusher';

const ground = (p) => p.add({ type: 'fixed', position: [0, -0.5, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [40, 0.5, 40] }] });
const crate = (p, at) => p.add({ position: at, sleeping: true, mass: 0.05, colliders: [{ shape: 'cuboid', args: [0.3, 0.3, 0.3] }] });

describe('capsules and pushes', () => {
  it('stands a capsule on the ground', async () => {
    const p = await createPhysics();
    ground(p);
    const c = p.add({ position: [0, 3, 0], colliders: [{ shape: 'capsule', args: [0.6, 0.3] }] });
    for (let i = 0; i < 180; i++) p.step(1 / 60);
    expect(c.position()[1]).toBeCloseTo(0.9, 1);
    p.dispose();
  });

  it('pushes a sleeping body awake, and ignores a push that is not a number', async () => {
    const p = await createPhysics();
    ground(p);
    const b = crate(p, [0, 0.3, 0]);
    expect(b.push([NaN, 0, 0])).toBe(false);
    expect(b.sleeping).toBe(true);
    expect(b.push([0.2, 0.1, 0], [0, 0.5, 0])).toBe(true);
    expect(b.sleeping).toBe(false);
    for (let i = 0; i < 30; i++) p.step(1 / 60);
    expect(b.position()[0]).toBeGreaterThan(0.3);
    expect(b.position().every(Number.isFinite)).toBe(true);
    p.dispose();
  });
});

describe('addPusher', () => {
  it('walks into a sleeping crate and shoves it along', async () => {
    const p = await createPhysics();
    ground(p);
    const box = crate(p, [2, 0.3, 0]);
    const me = addPusher(p, { radius: 0.35, half: 0.55, position: [-2, 0.9, 0] });
    for (let i = 0; i < 180; i++) {
      me.follow([-2 + (i + 1) * (1.5 / 60), 0.9, 0], 1 / 60);
      p.step(1 / 60);
    }
    expect(box.position()[0]).toBeGreaterThan(2.4);
    // (and the pusher went where it was told, the crate no obstacle to it)
    expect(me.position()[0]).toBeCloseTo(2.5, 1);
    p.dispose();
  });

  it('jumps a long way without flinging what is where it lands', async () => {
    const p = await createPhysics();
    ground(p);
    const me = addPusher(p, { radius: 0.35, half: 0.55, position: [0, 0.9, 0] });
    me.follow([30, 0.9, 0], 1 / 60);
    p.step(1 / 60);
    expect(me.position()[0]).toBeCloseTo(30, 3);
    const v = me.body.body.linvel();
    expect(Math.hypot(v.x, v.y, v.z)).toBe(0);
    p.dispose();
  });

  it('stays put on a bad target, and goes when removed', async () => {
    const p = await createPhysics();
    const me = addPusher(p, { position: [1, 1, 1] });
    me.follow([NaN, 0, 0], 1 / 60);
    p.step(1 / 60);
    expect(me.position()).toEqual([1, 1, 1]);
    me.remove();
    me.remove();
    expect(p.world.bodies.len()).toBe(0);
    expect(() => me.follow([0, 0, 0], 1 / 60)).not.toThrow();
    p.dispose();
  });
});
