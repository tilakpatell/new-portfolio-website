import { describe, expect, it } from 'vitest';
import { approach, damp } from './ease';

describe('damp', () => {
  it('is 1 − e^(−k·dt)', () => {
    expect(damp(10, 0.1)).toBeCloseTo(1 - Math.exp(-1), 9);
    expect(damp(10, 0)).toBe(0);
  });

  it('two half frames make one whole one', () => {
    let a = 0;
    a = approach(a, 1, 8, 1 / 120);
    a = approach(a, 1, 8, 1 / 120);
    expect(a).toBeCloseTo(approach(0, 1, 8, 1 / 60), 9);
  });
});

describe('approach', () => {
  it('moves a towards b by damp(k, dt)', () => {
    expect(approach(0, 1, 10, 0.1)).toBeCloseTo(1 - Math.exp(-1), 9);
    expect(approach(2, 2, 10, 0.1)).toBe(2);
  });
});
