import { describe, expect, it } from 'vitest';
import { fold, noiseFor } from './fnl';

describe('noiseFor', () => {
  it('gives the same value for the same seed and point', () => {
    const a = noiseFor(7, { type: 'simplex' });
    const b = noiseFor(7, { type: 'simplex' });
    expect(a(123.4, -56.7)).toBe(a(123.4, -56.7));
    expect(a(123.4, -56.7)).toBe(b(123.4, -56.7));
  });

  it('differs between seeds', () => {
    expect(noiseFor(1)(10, 10)).not.toBe(noiseFor(2)(10, 10));
  });

  it('stays in [−1, 1]', () => {
    const n = noiseFor(1, { type: 'simplex' });
    for (let i = 0; i < 1000; i++) {
      const v = n(i * 37.1 - 9000, i * -13.7 + 4000);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('warps the domain', () => {
    expect(noiseFor(5, { warp: 200 })(100, 100)).not.toBe(noiseFor(5, { warp: 0 })(100, 100));
  });

  it('takes every type and fractal it names', () => {
    for (const type of ['simplex', 'cellular', 'perlin', 'value'])
      for (const fractal of ['fbm', 'ridged', 'pingpong', 'none']) expect(Number.isFinite(noiseFor(3, { type, fractal })(50, 70))).toBe(true);
  });
});

describe('fold', () => {
  it('folds a bigint to an int32, stably', () => {
    const f = fold(2n ** 40n + 5n);
    expect(Number.isInteger(f)).toBe(true);
    expect(f | 0).toBe(f);
    expect(fold(f)).toBe(f);
  });

  it('keeps a small number', () => {
    expect(fold(42)).toBe(42);
  });
});
