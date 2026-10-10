import { describe, expect, it } from 'vitest';
import { cubeFromStrip } from './gameLut';

describe('a grading LUT from its strip', () => {
  it('lays the slices side by side out as red along x, green along y, blue along z', () => {
    const n = 2;
    // the strip: n² wide, n high, RGBA; the texel for (r, g, b) at x = b·n + r, y = g
    const strip = new Uint8ClampedArray(n * n * n * 4);
    for (let g = 0; g < n; g++) {
      for (let b = 0; b < n; b++) {
        for (let r = 0; r < n; r++) {
          const i = (g * n * n + b * n + r) * 4;
          strip.set([r * 100 + 1, g * 100 + 2, b * 100 + 3, 255], i);
        }
      }
    }
    const cube = cubeFromStrip(strip, n);
    expect(cube.length).toBe(n * n * n * 4);
    const at = (r, g, b) => [...cube.slice(((b * n + g) * n + r) * 4, ((b * n + g) * n + r) * 4 + 3)];
    expect(at(0, 0, 0)).toEqual([1, 2, 3]);
    expect(at(1, 0, 0)).toEqual([101, 2, 3]);
    expect(at(0, 1, 0)).toEqual([1, 102, 3]);
    expect(at(0, 0, 1)).toEqual([1, 2, 103]);
    expect(at(1, 1, 1)).toEqual([101, 102, 103]);
  });
});
