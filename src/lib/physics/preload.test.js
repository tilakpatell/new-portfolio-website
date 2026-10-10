import { describe, expect, it } from 'vitest';
import { createPhysics, preload } from './world';

describe('preload', () => {
  it('loads and warms the engine once, ahead of the world that needs it', async () => {
    const a = preload();
    expect(preload()).toBe(a);
    await a;
    const t = performance.now();
    const p = await createPhysics();
    p.add({ type: 'fixed', colliders: [{ shape: 'cuboid', args: [5, 0.5, 5] }] });
    p.add({ position: [0, 2, 0], colliders: [{ shape: 'ball', args: [0.5] }] });
    p.step(1 / 60);
    expect(performance.now() - t).toBeLessThan(60);
    p.dispose();
  });
});
