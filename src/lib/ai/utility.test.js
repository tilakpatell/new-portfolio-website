import { describe, expect, it } from 'vitest';
import { seeded } from '../seeded';
import { consider, cooldown, curve, pick, runtime, score } from './utility';

const opt = (id, v, over = {}) => ({ id, considerations: [() => v], ...over });

describe('the curves', () => {
  it('hit their bookends', () => {
    expect(curve.poly(2)(0.5)).toBe(0.25);
    expect(curve.inverse(0.2)).toBeCloseTo(0.8);
    expect(curve.peak(0.5, 0.25)(0.5)).toBe(1);
    expect(curve.peak(0.5, 0.25)(0.75)).toBeLessThan(0.05);
    expect(curve.logistic()(0.5)).toBeCloseTo(0.5, 2);
    expect(curve.logistic()(1)).toBeGreaterThan(0.99);
  });

  it('consider clamps outside the bookends and remaps through the curve', () => {
    expect(consider(150, [0, 100])).toBe(1);
    expect(consider(-1, [0, 100])).toBe(0);
    expect(consider(25, [0, 100], curve.inverse)).toBeCloseTo(0.75);
    // (bookends the wrong way round read the other way: high is low)
    expect(consider(25, [100, 0])).toBeCloseTo(0.75);
  });

  it('runtime and cooldown', () => {
    expect(runtime(0, [0, 4])).toBe(1);
    expect(runtime(4, [0, 4])).toBe(0);
    expect(cooldown(0, 3)).toBe(0);
    expect(cooldown(3, 3)).toBe(1);
    expect(cooldown(1.5, 3)).toBeLessThan(0.05);
    expect(cooldown(1, 0)).toBe(1);
  });
});

describe('scoring and picking', () => {
  it('multiplies considerations, and a zero kills the option and stops the rest', () => {
    expect(score({ id: 'a', considerations: [() => 0.5, () => 0.5] }, {})).toBe(0.25);
    let ran = false;
    expect(score({ id: 'b', considerations: [() => 0, () => ((ran = true), 1)] }, {})).toBe(0);
    expect(ran).toBe(false);
    expect(score({ id: 'c', weight: 2, considerations: [] }, {})).toBe(2);
  });

  it('picks the best, and null when nothing scores', () => {
    expect(pick([opt('a', 0.3), opt('b', 0.6)], {}).id).toBe('b');
    expect(pick([opt('a', 0), opt('b', 0)], {})).toBeNull();
  });

  it('holds the running option within momentum and swaps past it', () => {
    expect(pick([opt('a', 0.5), opt('b', 0.56)], {}, { current: 'a' }).id).toBe('a');
    expect(pick([opt('a', 0.5), opt('b', 0.6)], {}, { current: 'a' }).id).toBe('b');
  });

  it('rank beats weight', () => {
    const out = pick([opt('eat', 1, { rank: 0 }), opt('die', 0.01, { rank: 9 })], {}, { rank: (o) => o.rank });
    expect(out.id).toBe('die');
    // (and a ranked option that scores zero doesn't block the rank below)
    expect(pick([opt('eat', 1, { rank: 0 }), opt('die', 0, { rank: 9 })], {}, { rank: (o) => o.rank }).id).toBe('eat');
  });

  it('with a spread and a rand picks among the near-best, never the poor', () => {
    const rand = seeded(5);
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(pick([opt('a', 0.9), opt('b', 0.85), opt('c', 0.1)], {}, { rand, spread: 0.2 }).id);
    expect(seen.has('a')).toBe(true);
    expect(seen.has('b')).toBe(true);
    expect(seen.has('c')).toBe(false);
  });
});
