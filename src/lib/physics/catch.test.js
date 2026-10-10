import { describe, expect, it } from 'vitest';
import { createPhysics } from './world';
import { addCatch } from './catch';

describe('addCatch', () => {
  it('follows under the car and holds a ball up', async () => {
    const p = await createPhysics();
    const slab = addCatch(p);
    slab.follow(100, -40, 7);
    const ball = p.add({ position: [100, 9, -40], colliders: [{ shape: 'ball', args: [0.5] }] });
    for (let i = 0; i < 120; i++) p.step(1 / 60);
    expect(ball.position()[1]).toBeCloseTo(7.5, 1);
    expect(slab.body.body.translation()).toMatchObject({ x: 100, z: -40 });
    p.dispose();
  });

  it('lets things through when it is off', async () => {
    const p = await createPhysics();
    const slab = addCatch(p);
    slab.follow(0, 0, 0);
    slab.enable(false);
    const ball = p.add({ position: [0, 2, 0], colliders: [{ shape: 'ball', args: [0.5] }] });
    for (let i = 0; i < 60; i++) p.step(1 / 60);
    expect(ball.position()[1]).toBeLessThan(-1);
    p.dispose();
  });
});
