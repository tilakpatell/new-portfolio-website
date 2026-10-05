import { describe, expect, it } from 'vitest';
import { heightToNormal } from './texture';

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

describe('tileable noise', () => {
  it('repeats across the edge and stays within 0..1', async () => {
    const { tileFbm, tileNoise } = await import('./texture');
    const n = tileNoise(5, 8);
    expect(n(0.3, 2.7)).toBeCloseTo(n(8.3, 10.7), 6);
    const f = tileFbm(3, { base: 4, octaves: 4 });
    for (const [u, v] of [[0.1, 0.9], [0.5, 0.25], [0.99, 0.01]]) {
      expect(f(u, v)).toBeCloseTo(f(u + 1, v - 1), 6);
      expect(f(u, v)).toBeGreaterThanOrEqual(0);
      expect(f(u, v)).toBeLessThanOrEqual(1);
    }
  });

  it('is the same for the same seed and differs for another', async () => {
    const { tileFbm } = await import('./texture');
    expect(tileFbm(4)(0.37, 0.62)).toBe(tileFbm(4)(0.37, 0.62));
    expect(tileFbm(4)(0.37, 0.62)).not.toBe(tileFbm(5)(0.37, 0.62));
  });

  it('cells tile, and are zero-distance nowhere but at a point', async () => {
    const { tileCells } = await import('./texture');
    const c = tileCells(9, 6);
    expect(c(0.2, 0.8).near).toBeCloseTo(c(1.2, -0.2).near, 6);
    expect(c(0.2, 0.8).edge).toBeGreaterThanOrEqual(0);
  });

  it('packs four noises into an atlas, and maps a surface to colour, normal and roughness', async () => {
    const { noiseAtlas, surfaceMaps } = await import('./texture');
    const a = noiseAtlas(16, 2);
    expect(a.length).toBe(16 * 16 * 4);
    expect(new Set(a).size).toBeGreaterThan(40);
    const m = surfaceMaps(8, (u) => ({ r: 10, g: 20, b: 30, h: u, rough: 0.5 }));
    expect([m.color[0], m.color[1], m.color[2], m.color[3]]).toEqual([10, 20, 30, 255]);
    expect(m.rough[1]).toBeGreaterThan(120);
    expect(m.rough[1]).toBeLessThan(135);
    expect(m.normal[(4 * 8 + 4) * 4]).toBeLessThan(128); // rising to the right
  });
});
