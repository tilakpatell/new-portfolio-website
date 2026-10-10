import { describe, expect, it } from 'vitest';
import { FIRST, MOVING, freshAim, lead, missBy, scatter, shotStep, spread } from './accuracy';

const angle = (a, b) => Math.acos(Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))));

// a repeatable roll
const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

describe('spread', () => {
  it('grows with range', () => {
    expect(spread(30)).toBeGreaterThan(spread(10));
    expect(spread(0)).toBeCloseTo(0.02);
    expect(spread(50)).toBeCloseTo(0.02 + 50 * 0.0012);
  });

  it('is wider on the first volley and while moving, and scales with suppression', () => {
    expect(spread(20, { first: true })).toBeCloseTo(spread(20) * FIRST);
    expect(spread(20, { moving: true })).toBeCloseTo(spread(20) * MOVING);
    expect(spread(20, { suppressed: 2 })).toBeCloseTo(spread(20) * 2);
    expect(FIRST).toBe(2.5);
    expect(MOVING).toBe(1.6);
  });
});

describe('scatter', () => {
  it('stays inside the cone and fills it', () => {
    const rng = seeded();
    let widest = 0;
    for (let i = 0; i < 300; i++) {
      const d = scatter([0, 0, 1], 0.1, rng);
      expect(Math.hypot(...d)).toBeCloseTo(1);
      widest = Math.max(widest, angle(d, [0, 0, 1]));
    }
    expect(widest).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(widest).toBeGreaterThan(0.08);
  });

  it('keeps at least the least it is given (a shot thrown wide)', () => {
    const rng = seeded(3);
    for (let i = 0; i < 100; i++) expect(angle(scatter([1, 0, 0], 0.2, rng, 0.15), [1, 0, 0])).toBeGreaterThanOrEqual(0.15 - 1e-9);
  });
});

describe('the streak', () => {
  it('throws the third shot wide after two hits in a row, once, and starts again', () => {
    let s = freshAim();
    expect(s.fresh).toBe(true);
    s = shotStep(s, { hit: true });
    expect(s).toMatchObject({ fresh: false, wide: false, streak: 1 });
    s = shotStep(s, { hit: true });
    expect(s.wide).toBe(true);
    expect(s.streak).toBe(0);
    s = shotStep(s, { hit: false });
    expect(s.wide).toBe(false);
    s = shotStep(s, { hit: true });
    expect(s.wide).toBe(false);
  });

  it('a miss breaks the streak', () => {
    let s = shotStep(freshAim(), { hit: true });
    s = shotStep(s, { hit: false });
    s = shotStep(s, { hit: true });
    expect(s.wide).toBe(false);
  });

  it('a wide shot misses a person’s girth at its range', () => {
    expect(Math.tan(missBy(30)) * 30).toBeGreaterThan(0.5);
    expect(Math.tan(missBy(5)) * 5).toBeGreaterThan(0.5);
  });
});

describe('lead', () => {
  it('meets a target walking 2.3 m/s across at 30 m with a bolt at 90 m/s', () => {
    const target = [30, 1, 0];
    const vel = [0, 0, 2.3];
    const from = [0, 1, 0];
    const p = lead(target, vel, from, 90);
    const t = Math.hypot(p[0] - from[0], p[1] - from[1], p[2] - from[2]) / 90;
    const there = [target[0] + vel[0] * t, target[1] + vel[1] * t, target[2] + vel[2] * t];
    expect(Math.hypot(p[0] - there[0], p[1] - there[1], p[2] - there[2])).toBeLessThan(0.05);
    expect(p[2]).toBeGreaterThan(0.7);
  });

  it('aims at the target itself when no bolt can catch it', () => {
    expect(lead([10, 0, 0], [200, 0, 0], [0, 0, 0], 90)).toEqual([10, 0, 0]);
  });
});
