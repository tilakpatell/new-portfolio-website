import { describe, expect, it } from 'vitest';
import { heightOn } from './sample';
import { leafOf } from './quadtree';

const fill = (leaf, n, f) => {
  const step = leaf.size / (n - 1);
  const h = new Float32Array(n * n);
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) h[iz * n + ix] = f(leaf.x0 + ix * step, leaf.z0 + iz * step);
  return h;
};

describe('heightOn', () => {
  const leaf = leafOf(6, 3, -2);
  const n = 9;

  it('returns a plane exactly', () => {
    const plane = (x, z) => 0.25 * (x - 800) - 0.125 * (z + 500) + 7;
    const h = fill(leaf, n, plane);
    for (let i = 0; i < 50; i++) {
      const x = leaf.x0 + ((i * 0.618034) % 1) * leaf.size, z = leaf.z0 + ((i * 0.754877) % 1) * leaf.size;
      expect(Math.abs(heightOn(leaf, h, n, x, z) - plane(x, z))).toBeLessThan(1e-3);
    }
  });

  it('reads the grid at its points, edges included', () => {
    const h = fill(leaf, n, (x, z) => Math.sin(x * 0.01) * 30 + z * 0.1);
    const step = leaf.size / (n - 1);
    for (const [ix, iz] of [[0, 0], [8, 8], [3, 5], [8, 0]]) expect(heightOn(leaf, h, n, leaf.x0 + ix * step, leaf.z0 + iz * step)).toBe(h[iz * n + ix]);
  });

  it('follows the drawn triangles, not a bilinear blend', () => {
    // one high corner, d: the triangle a-c-b doesn't see it
    const h = new Float32Array(4);
    h[3] = 10;
    const one = { x0: 0, z0: 0, size: 1 };
    expect(heightOn(one, h, 2, 0.4, 0.4)).toBe(0);
    expect(heightOn(one, h, 2, 0.75, 0.75)).toBeCloseTo(5);
  });

  it('is NaN off the leaf', () => {
    const h = fill(leaf, n, () => 1);
    expect(heightOn(leaf, h, n, leaf.x0 - 1, leaf.z0 + 5)).toBeNaN();
    expect(heightOn(leaf, h, n, leaf.x0 + 5, leaf.z0 + leaf.size + 1)).toBeNaN();
  });
});
