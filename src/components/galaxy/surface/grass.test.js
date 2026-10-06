import { describe, expect, it } from 'vitest';
import { bladeLayout, coverMap, heightTexture } from './grass';
import { HALF, heightGrid } from './terrain';

// a flat world, or one that slopes, with a lake below `water`
const flatGrid = (h = 5) => ({ heightAt: () => h, normalAt: () => [0, 1, 0] });
const site = (over = {}) => ({ ground: { seed: 3 }, land: { at: [0, 0] }, places: [], grass: { cover: 1, ...over.grass }, ...over });
const R = (map, size, x, z) => {
  const step = (2 * HALF) / size;
  const i = Math.floor((x + HALF) / step);
  const j = Math.floor((z + HALF) / step);
  return map[(j * size + i) * 4];
};

describe('where the grass grows', () => {
  it('covers open, level ground, and leaves the landing pad and the places bare', () => {
    const size = 64;
    const map = coverMap(flatGrid(), site({ places: [{ at: [200, -200], flat: { r: 40 } }] }), { size });
    expect(R(map, size, 0, 0)).toBe(0);
    expect(R(map, size, 200, -200)).toBe(0);
    // (somewhere well clear of both, on a fully covered world, it grows)
    let grown = 0;
    for (let z = -500; z <= 500; z += 100) for (let x = -500; x <= 500; x += 100) if (Math.hypot(x, z) > 60 && Math.hypot(x - 200, z + 200) > 60) grown += R(map, size, x, z) > 128 ? 1 : 0;
    expect(grown).toBeGreaterThan(60);
  });

  it('grows none on steep ground or under the water', () => {
    const size = 32;
    const steep = coverMap({ heightAt: () => 5, normalAt: () => [0.6, 0.8, 0] }, site(), { size });
    expect(Math.max(...steep.filter((_, i) => i % 4 === 0))).toBe(0);
    const drowned = coverMap(flatGrid(-1), site({ water: { level: 0 } }), { size });
    expect(Math.max(...drowned.filter((_, i) => i % 4 === 0))).toBe(0);
  });

  it('is the same every time for the same world', () => {
    const a = coverMap(flatGrid(), site({ grass: { cover: 0.6 } }), { size: 32 });
    const b = coverMap(flatGrid(), site({ grass: { cover: 0.6 } }), { size: 32 });
    expect(a).toEqual(b);
  });
});

describe('the blades', () => {
  it('lies every blade inside the patch, its two numbers in 0…1', () => {
    const offs = bladeLayout(5000, 40);
    for (let i = 0; i < 5000; i++) {
      expect(Math.abs(offs[i * 4])).toBeLessThanOrEqual(20);
      expect(Math.abs(offs[i * 4 + 1])).toBeLessThanOrEqual(20);
      expect(offs[i * 4 + 2]).toBeGreaterThanOrEqual(0);
      expect(offs[i * 4 + 3]).toBeLessThanOrEqual(1);
    }
  });

  it('spreads any first part of them over the whole patch (thinned grass stays even)', () => {
    const offs = bladeLayout(4000, 40);
    const quads = [0, 0, 0, 0];
    for (let i = 0; i < 400; i++) quads[(offs[i * 4] > 0 ? 1 : 0) + (offs[i * 4 + 1] > 0 ? 2 : 0)]++;
    for (const q of quads) expect(q).toBeGreaterThan(70);
  });
});

describe('the ground under the blades', () => {
  // the shader's groundY, line for line
  const groundY = (tex, n, cell, x, z) => {
    const { data } = tex.image;
    const at = (i, j) => data[j * (n + 1) + i];
    const gx = Math.min(Math.max((x + HALF) / cell, 0), n - 0.001);
    const gz = Math.min(Math.max((z + HALF) / cell, 0), n - 0.001);
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    const fx = gx - i;
    const fz = gz - j;
    if (fx + fz <= 1) return at(i, j) + (at(i + 1, j) - at(i, j)) * fx + (at(i, j + 1) - at(i, j)) * fz;
    const h11 = at(i + 1, j + 1);
    return h11 + (at(i, j + 1) - h11) * (1 - fx) + (at(i + 1, j) - h11) * (1 - fz);
  };

  it('stands each blade on the ground exactly as it is drawn', () => {
    const grid = heightGrid((x, z) => Math.sin(x / 37) * 6 + Math.cos(z / 23) * 4 + x * 0.01, { n: 64 });
    const { texture, n } = heightTexture(grid);
    expect(n).toBe(64);
    let s = 9;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 200; k++) {
      const x = (rand() - 0.5) * 2 * (HALF - 1);
      const z = (rand() - 0.5) * 2 * (HALF - 1);
      expect(Math.abs(groundY(texture, n, grid.cell, x, z) - grid.heightAt(x, z))).toBeLessThan(1e-4);
    }
  });
});
