import { describe, expect, it } from 'vitest';
import { maskUv, shadowAt } from './shadowMask';

const bounds = { minX: -1000, minZ: -500, maxX: 3000, maxZ: 3500 };

describe('the far shadow’s frame', () => {
  it('maps the bounds’ corners to 0 and 1', () => {
    expect(maskUv(-1000, -500, bounds)).toEqual([0, 0]);
    expect(maskUv(3000, 3500, bounds)).toEqual([1, 1]);
    expect(maskUv(1000, 1500, bounds)).toEqual([0.5, 0.5]);
  });

  it('gives null outside', () => {
    expect(maskUv(-1001, 0, bounds)).toBeNull();
    expect(maskUv(0, 3501, bounds)).toBeNull();
  });

  it('reads 1, no shadow, outside or with no mask', () => {
    const dark = () => 0.1;
    expect(shadowAt(5000, 0, bounds, dark)).toBe(1);
    expect(shadowAt(0, 0, null, dark)).toBe(1);
    expect(shadowAt(0, 0, bounds, dark)).toBe(0.1);
  });
});
