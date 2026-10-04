import { describe, expect, it } from 'vitest';
import { heightToNormal } from './plating';

// a height field as an RGBA buffer (height in the red channel)
const field = (w, h, f) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[(y * w + x) * 4] = f(x, y);
  return d;
};
const at = (d, w, x, y) => [d[(y * w + x) * 4], d[(y * w + x) * 4 + 1], d[(y * w + x) * 4 + 2]];

describe('normal maps from height', () => {
  it('points straight up on flat ground', () => {
    const n = heightToNormal(field(8, 8, () => 128), 8, 8, 2);
    const [r, g, b] = at(n, 8, 4, 4);
    expect(Math.abs(r - 128)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - 128)).toBeLessThanOrEqual(1);
    expect(b).toBeGreaterThan(250);
  });

  it('tilts away from a slope rising to the right', () => {
    const n = heightToNormal(field(8, 8, (x) => x * 20), 8, 8, 2);
    const [r, , b] = at(n, 8, 4, 4);
    expect(r).toBeLessThan(110); // the normal leans to -x
    expect(b).toBeLessThan(255);
  });

  it('tilts with the green channel for a slope going down the page', () => {
    const n = heightToNormal(field(8, 8, (x, y) => y * 20), 8, 8, 2);
    const [, g] = at(n, 8, 4, 4);
    expect(g).not.toBe(128);
  });

  it('wraps at the edges, so a tiled texture has no seams', () => {
    const w = 8;
    const n = heightToNormal(field(w, 8, (x) => (x === 0 ? 255 : 0)), w, 8, 2);
    // the right edge sees the bump on the left edge as its neighbour
    expect(at(n, w, w - 1, 3)[0]).not.toBe(128);
  });
});
