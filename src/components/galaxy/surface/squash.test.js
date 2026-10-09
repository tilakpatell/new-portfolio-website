import { describe, expect, it } from 'vitest';
import { SQUASH, createSquash } from './squash';

describe('a landing’s squash', () => {
  it('stands as it was until it lands', () => {
    const q = createSquash();
    for (let i = 0; i < 60; i++) q.step(1 / 60);
    expect(q.scale()).toEqual([1, 1, 1]);
  });
  it('squats on a hard landing, wider as it goes lower, and springs back', () => {
    const q = createSquash();
    q.land(8);
    const [sx, sy, sz] = q.scale();
    expect(sy).toBeLessThan(0.9);
    expect(sx).toBeGreaterThan(1);
    expect(sz).toBe(sx);
    // (it rings past upright once, then settles)
    const ys = [];
    for (let i = 0; i < 120; i++) {
      q.step(1 / 60);
      ys.push(q.scale()[1]);
    }
    expect(Math.max(...ys)).toBeGreaterThan(1);
    expect(Math.abs(q.scale()[1] - 1)).toBeLessThan(0.01);
  });
  it('squats more the harder it lands, never past its most', () => {
    const a = createSquash();
    const b = createSquash();
    const c = createSquash();
    a.land(4);
    b.land(8);
    c.land(80);
    expect(b.scale()[1]).toBeLessThan(a.scale()[1]);
    expect(1 - c.scale()[1]).toBeCloseTo(SQUASH.max, 9);
  });
  it('ignores a step down (under 3 m/s)', () => {
    const q = createSquash();
    q.land(2.5);
    expect(q.scale()).toEqual([1, 1, 1]);
  });
  it('holds still under reduced motion', () => {
    const q = createSquash({ calm: true });
    q.land(8);
    expect(q.scale()).toEqual([1, 1, 1]);
  });
  it('stays bounded stepped at 1/30 s', () => {
    const q = createSquash();
    q.land(20);
    for (let i = 0; i < 150; i++) {
      q.step(1 / 30);
      expect(Math.abs(q.scale()[1] - 1)).toBeLessThanOrEqual(SQUASH.max + 1e-9);
    }
  });
});
