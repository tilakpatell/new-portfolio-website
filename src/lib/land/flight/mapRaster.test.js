import { describe, expect, it } from 'vitest';
import { MAP_DEPTH, MAP_N, rasterFor, rasterKey } from './mapRaster';
import { makeLeaf } from './leafMesh';
import { leafOf, sizeAt } from './quadtree';
import { planetField } from './field';
import { planetSpecOf } from './planetSpec';

const ms = (f) => {
  const t = performance.now();
  f();
  return performance.now() - t;
};

describe('rasterFor', () => {
  it('keeps the spec’s numbers: 32 cells a side of a 2 km square', () => {
    expect(MAP_N).toBe(32);
    expect(sizeAt(MAP_DEPTH)).toBe(2048);
    expect(rasterKey(-3, 4)).toBe('map:-3:4');
  });

  it('gives flat ground one height, and samples each cell at its centre', () => {
    const seen = [];
    const field = { heightAt: () => 7, biomeAt: (x, z) => (seen.push([x, z]), 0) };
    const r = rasterFor(field, leafOf(3, 1, -1));
    expect(r.biome).toBeInstanceOf(Uint8Array);
    expect(r.height).toBeInstanceOf(Float32Array);
    expect(r.height.length).toBe(MAP_N * MAP_N);
    expect([...r.height].every((h) => h === 7)).toBe(true);
    expect(seen[0]).toEqual([2048 + 32, -2048 + 32]);
    expect(seen.at(-1)).toEqual([4096 - 32, -32]);
  });

  it('gives each cell a biome the planet has', () => {
    for (const id of ['hoth', 'tatooine', 'kamino']) {
      const spec = planetSpecOf(id);
      const r = rasterFor(planetField(spec), leafOf(3, 0, 0));
      expect(Math.max(...r.biome)).toBeLessThan(spec.biomes.length);
      expect(r.height.every(Number.isFinite)).toBe(true);
    }
  });

  it('finds Echo Base flat, at its 12 m', () => {
    const spec = planetSpecOf('hoth');
    const r = rasterFor(planetField(spec), leafOf(3, 0, -1));
    // (1200, −800): cell (18, 19) of the square from (0, −2048)
    expect(r.height[Math.floor((-800 + 2048) / 64) * MAP_N + Math.floor(1200 / 64)]).toBe(12);
  });

  it('costs no more than three of the ground’s finest leaves on Hoth', () => {
    const spec = planetSpecOf('hoth');
    const field = planetField(spec);
    // (warm both up first: the first call builds the noises)
    rasterFor(field, leafOf(3, 9, 9));
    makeLeaf(spec, leafOf(6, 90, 90), { n: 33, field });
    const raster = ms(() => {
      for (let i = 0; i < 4; i++) rasterFor(field, leafOf(3, i, 2));
    });
    const leaf = ms(() => {
      for (let i = 0; i < 4; i++) makeLeaf(spec, leafOf(6, i, 20), { n: 33, field });
    });
    expect(raster).toBeLessThan(leaf * 3);
  });
});
