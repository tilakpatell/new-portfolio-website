import { describe, expect, it } from 'vitest';
import { coverMap } from './grass';
import { HALF } from './terrain';

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
