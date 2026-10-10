import { describe, expect, it } from 'vitest';
import { flatten } from './flats';

const raw = (x, z) => x * 0.5 + z * 0.25 + 20;

describe('flatten', () => {
  const f = flatten(raw, [{ at: [0, 0], r: 10, edge: 5, h: 3 }]);

  it('holds h exactly inside r', () => {
    expect(f(0, 0)).toBe(3);
    expect(f(9.9, 0)).toBe(3);
  });

  it('is the raw land past r + edge', () => {
    expect(f(15, 0)).toBe(raw(15, 0));
  });

  it('eases in between', () => {
    const v = f(12.5, 0);
    expect(v).toBeGreaterThan(3);
    expect(v).toBeLessThan(raw(12.5, 0));
  });

  it('returns raw itself with no flats', () => {
    expect(flatten(raw)).toBe(raw);
    expect(flatten(raw, [])).toBe(raw);
  });

  it('defaults edge to max(8, 0.6 r) and h to the land at the middle', () => {
    const g = flatten(raw, [{ at: [10, 0], r: 20 }]);
    expect(g(10, 0)).toBe(raw(10, 0));
    expect(g(10 + 20 + 12, 0)).toBe(raw(42, 0));
    expect(g(10 + 20 + 11, 0)).not.toBe(raw(41, 0));
  });
});
