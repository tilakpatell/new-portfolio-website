import { describe, expect, it } from 'vitest';
import { BIOME_CLIMATE, colormapAt } from './colormap';

// a 256 × 256 map whose texel (x, y) is (x, y, 7)
const map = (() => {
  const data = new Uint8ClampedArray(256 * 256 * 4);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) data.set([x, y, 7, 255], (y * 256 + x) * 4);
  return { width: 256, height: 256, data };
})();

describe('the biome colormap', () => {
  it('reads the texel the game reads: x by temperature, y by rainfall times temperature', () => {
    // plains: 0.8, 0.4 → x = 0.2 × 255, y = (1 − 0.32) × 255
    expect(colormapAt(map, 0.8, 0.4)).toEqual([51, 173, 7]);
    expect(colormapAt(map, 1, 1)).toEqual([0, 0, 7]);
    expect(colormapAt(map, 0, 0)).toEqual([255, 255, 7]);
  });

  it('clamps a desert’s 2.0 to 1', () => {
    expect(colormapAt(map, 2, 0)).toEqual([0, 255, 7]);
  });

  it('knows the climate of every first-pass biome', () => {
    for (const b of ['plains', 'forest', 'birch_forest', 'taiga', 'mountains', 'desert', 'snowy', 'ocean', 'beach']) expect(BIOME_CLIMATE[b], b).toHaveLength(2);
    expect(BIOME_CLIMATE.plains).toEqual([0.8, 0.4]);
  });
});
