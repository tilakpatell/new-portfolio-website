import { describe, expect, it } from 'vitest';
import { createBlade } from './blade';
import { segCapsule } from './bolt';

// a body standing at x, z: a capsule from 0.35 m up to 1.45 m, 0.35 round
const body = (id, x, z, r = 0.35) => ({ id, a: [x, r, z], b: [x, 1.8 - r, z], r });

describe('createBlade', () => {
  it('a sweep whose segment crosses a capsule hits it at the nearest point on the blade', () => {
    const blade = createBlade();
    blade.push([0, 1.2, 0], [-0.9, 1.2, 0.9], 0);
    blade.push([0, 1.2, 0], [0.9, 1.2, 0.9], 1 / 60);
    const hits = blade.sweep([body('a', 0, 1)]);
    expect(hits).toHaveLength(1);
    expect(hits[0].target.id).toBe('a');
    expect(hits[0].at[1]).toBeCloseTo(1.2);
    expect(Math.hypot(hits[0].at[0], hits[0].at[2] - 1)).toBeLessThan(0.35 + 0.12 + 1e-6);
  });
  it('misses a capsule the blade passes 0.3 m above', () => {
    const blade = createBlade();
    blade.push([0, 2.2, 0], [-0.9, 2.2, 0.9], 0);
    blade.push([0, 2.2, 0], [0.9, 2.2, 0.9], 1 / 60);
    // (the capsule's top is 1.8 m up, 0.4 m under the blade)
    expect(blade.sweep([body('a', 0, 1)])).toEqual([]);
    expect(blade.sweep([{ id: 'b', a: [0, 0.35, 1], b: [0, 1.55, 1], r: 0.35 }])).toEqual([]);
  });
  it('a tip that moved 2 m in one frame is sampled between and still hits a thin body in the middle of the arc', () => {
    const blade = createBlade();
    // (round a quarter turn and more in a frame: the two ends both miss it)
    blade.push([0, 1.2, 0], [-1, 1.2, 0.2], 0);
    blade.push([0, 1.2, 0], [1, 1.2, 0.2], 1 / 60);
    const thin = { id: 't', a: [0, 0.2, 0.9], b: [0, 1.6, 0.9], r: 0.2 };
    const [first, last] = blade.history().slice(-2);
    expect(segCapsule(first.base, first.tip, thin.a, thin.b, thin.r + 0.12)).toBeNull();
    expect(segCapsule(last.base, last.tip, thin.a, thin.b, thin.r + 0.12)).toBeNull();
    expect(blade.sweep([thin]).map((h) => h.target.id)).toEqual(['t']);
  });
  it('clash finds two blades crossing, and none apart', () => {
    const a = createBlade();
    const b = createBlade();
    a.push([0, 1, 0], [0, 2, 1], 0);
    b.push([-0.5, 1.5, 0.5], [0.5, 1.5, 0.5], 0);
    expect(a.clash(b).at[1]).toBeCloseTo(1.5, 1);
    const c = createBlade();
    c.push([-0.5, 1.5, 3], [0.5, 1.5, 3], 0);
    expect(a.clash(c)).toBeNull();
  });
  it('crosses finds a bolt through the blade and not one 0.5 m beside it', () => {
    const blade = createBlade();
    blade.push([0, 1, 0.5], [0, 2, 0.5], 0);
    expect(blade.crosses([0, 1.5, 10], [0, 1.5, -10]).at[2]).toBeCloseTo(0.5);
    expect(blade.crosses([0.5, 1.5, 10], [0.5, 1.5, -10])).toBeNull();
    // (wider when asked: a bolt's streak against a held block)
    expect(blade.crosses([0.25, 1.5, 10], [0.25, 1.5, -10], 0.3)).not.toBeNull();
  });
  it('keeps the last `keep` frames, oldest first, and nothing to sweep before two', () => {
    const blade = createBlade({ keep: 3 });
    expect(blade.sweep([body('a', 0, 0)])).toEqual([]);
    for (let i = 0; i < 5; i++) blade.push([i, 0, 0], [i, 1, 0], i);
    expect(blade.history().map((h) => h.t)).toEqual([2, 3, 4]);
    blade.clear();
    expect(blade.history()).toEqual([]);
  });
});
