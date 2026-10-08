import { beforeAll, describe, expect, it } from 'vitest';
import { GROUPS, createPhysics } from './world';

let physics;
beforeAll(async () => {
  physics = await createPhysics();
});

const ground = (p, at = [0, -0.5, 0], group = 'floor') => p.add({ type: 'fixed', position: at, group, colliders: [{ shape: 'cuboid', args: [20, 0.5, 20] }] });
const ball = (p, at, more = {}) => p.add({ position: at, colliders: [{ shape: 'ball', args: [0.5] }], ...more });

describe('createPhysics', () => {
  it('loads the engine and has his groups', () => {
    expect(physics.RAPIER).toBeTruthy();
    expect(physics.world).toBeTruthy();
    expect(GROUPS.floor).toBe((1 << 16) | 1);
    expect(GROUPS.object).toBe((3 << 16) | 5);
    expect(GROUPS.bumper).toBe((4 << 16) | 2);
  });

  it('brings a ball to rest on the ground', async () => {
    const p = await createPhysics();
    ground(p);
    const b = ball(p, [0, 3, 0]);
    for (let i = 0; i < 120; i++) p.step(1 / 60);
    expect(Math.abs(b.body.linvel().y)).toBeLessThan(0.01);
    expect(b.position()[1]).toBeCloseTo(0.5, 1);
    p.dispose();
  });

  it('steps fixed, at most maxSubsteps after a long pause', async () => {
    const p = await createPhysics();
    expect(p.step(60)).toBe(4);
    expect(p.step(1 / 120)).toBe(0);
    expect(p.step(1 / 120)).toBe(1);
    expect(p.step(1 / 60)).toBe(1);
    p.dispose();
    const slow = await createPhysics({ timeScale: 0.5 });
    expect(slow.step(1 / 60)).toBe(0);
    expect(slow.step(1 / 60)).toBe(1);
    slow.dispose();
  });

  it('runs its substep hooks before each substep', async () => {
    const p = await createPhysics();
    const seen = [];
    const off = p.onSubstep((dt) => seen.push(dt));
    p.step(3 / 60);
    expect(seen).toHaveLength(3);
    expect(seen[0]).toBeCloseTo(1 / 60, 9);
    off();
    p.step(1 / 60);
    expect(seen).toHaveLength(3);
    p.dispose();
  });

  it('moves every body by an origin shift, keeping their velocities', async () => {
    const p = await createPhysics();
    const b = ball(p, [10, 5, 0], { canSleep: false });
    b.body.setLinvel({ x: 3, y: 1, z: -2 }, true);
    const before = b.position()[0];
    const v = b.body.linvel();
    p.onOrigin([50000, 0, 0]);
    expect(b.position()[0]).toBeCloseTo(before - 50000, 3);
    expect(b.body.linvel()).toEqual(v);
    p.dispose();
  });

  it('lets a bumper through the floor and onto an object', async () => {
    const p = await createPhysics();
    ground(p, [0, -0.5, 0], 'floor');
    ground(p, [0, -10.5, 0], 'object');
    const b = ball(p, [0, 2, 0], { group: 'bumper' });
    for (let i = 0; i < 240; i++) p.step(1 / 60);
    expect(b.position()[1]).toBeCloseTo(-9.5, 1);
    p.dispose();
  });

  it('resets a body to where it began, asleep if it began asleep', async () => {
    const p = await createPhysics();
    ground(p);
    const b = ball(p, [0, 4, 0], { sleeping: true });
    expect(b.sleeping).toBe(true);
    b.body.wakeUp();
    for (let i = 0; i < 30; i++) p.step(1 / 60);
    expect(b.position()[1]).toBeLessThan(4);
    b.reset();
    p.step(1 / 60);
    p.step(1 / 60);
    expect(b.position()).toEqual([0, 4, 0]);
    expect(b.sleeping).toBe(true);
    p.dispose();
  });

  it('puts awake bodies far away to sleep', async () => {
    const p = await createPhysics();
    const far = ball(p, [100, 50, 0]);
    const near = ball(p, [10, 50, 0]);
    p.step(1 / 60);
    p.sleepOutside([0, 0, 0], 50);
    expect(far.sleeping).toBe(true);
    expect(near.sleeping).toBe(false);
    p.dispose();
  });

  it('calls onHit over its threshold, with the force by mass', async () => {
    for (const [threshold, want] of [[0, true], [1e6, false]]) {
      const p = await createPhysics();
      ground(p);
      let hit = null;
      ball(p, [0, 5, 0], { hitThreshold: threshold, onHit: (force, at) => (hit ??= { force, at }) });
      for (let i = 0; i < 120; i++) p.step(1 / 60);
      expect(hit !== null).toBe(want);
      if (want) {
        expect(hit.force).toBeGreaterThan(0);
        expect(hit.at).toHaveLength(3);
      }
      p.dispose();
    }
  });

  it('removes a body', async () => {
    const p = await createPhysics();
    const b = ball(p, [0, 5, 0]);
    expect(p.world.bodies.len()).toBe(1);
    p.remove(b);
    expect(p.world.bodies.len()).toBe(0);
    p.dispose();
  });
});
