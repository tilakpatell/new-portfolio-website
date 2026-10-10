import { describe, expect, it } from 'vitest';
import { LAYERS, fieldAt } from './layers';
import { LAYER_TYPES, makeRaw } from '../../components/galaxy/surface/terrain';

describe('the layers, shared with the galaxy', () => {
  it('has the galaxy’s nine', () => {
    expect(Object.keys(LAYERS)).toEqual(['swell', 'hills', 'dunes', 'mesas', 'ridges', 'mountains', 'channels', 'island', 'level', 'blocks']);
    expect(LAYER_TYPES).toEqual(Object.keys(LAYERS));
  });

  it('is the galaxy’s own: its land sums them as before', () => {
    const ground = { seed: 3, layers: [{ type: 'swell', scale: 600, height: 18 }, { type: 'level', height: 2 }] };
    const raw = makeRaw(ground);
    const by = (x, z) => LAYERS.swell(x, z, ground.layers[0], 3) + 2;
    for (const [x, z] of [[0, 0], [123.5, -88], [-900, 4000]]) expect(raw(x, z)).toBe(by(x, z));
  });
});

describe('fieldAt', () => {
  it('sums the relief, each layer seeded seed + i, weighted', () => {
    const spec = { seed: 11, relief: [{ type: 'hills', scale: 140, height: 9 }, { type: 'ridges', scale: 900, height: 25, weight: 0.25 }] };
    const x = 37;
    const z = -512;
    const want = LAYERS.hills(x, z, spec.relief[0], 11) + 0.25 * LAYERS.ridges(x, z, spec.relief[1], 12);
    expect(fieldAt(spec, x, z)).toBeCloseTo(want, 10);
  });

  it('is the base on an empty relief', () => {
    expect(fieldAt({ seed: 1, relief: [], base: 4 }, 10, 10)).toBe(4);
  });

  describe('the flight’s additions', () => {
    it('mountains from 0 with no `to` are a range everywhere, finite, not a ring', () => {
      const l = { type: 'mountains', from: 0, height: 300, scale: 1200 };
      let lo = Infinity;
      for (let i = 0; i < 400; i++) {
        const v = LAYERS.mountains(i * 97 - 20000, i * -53 + 9000, l, 3);
        expect(Number.isFinite(v)).toBe(true);
        lo = Math.min(lo, v);
      }
      // (the range's floor is 0.3 of its height anywhere, near the middle too)
      expect(lo).toBeGreaterThanOrEqual(0.3 * 300 - 1e-9);
      expect(LAYERS.mountains(1, 1, l, 3)).toBeGreaterThan(0);
    });

    it('ridges along a wind run long one way and short the other', () => {
      const l = { type: 'ridges', scale: 400, height: 100, wind: 0 };
      const along = [], across = [];
      for (let i = 0; i < 200; i++) {
        along.push(Math.abs(LAYERS.ridges(i * 8, 0, l, 5) - LAYERS.ridges(i * 8 + 8, 0, l, 5)));
        across.push(Math.abs(LAYERS.ridges(0, i * 8, l, 5) - LAYERS.ridges(0, i * 8 + 8, l, 5)));
      }
      const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      expect(mean(along)).toBeLessThan(mean(across) * 0.6);
      // without a wind, as it always was
      const plain = { type: 'ridges', scale: 400, height: 100 };
      expect(LAYERS.ridges(123, 456, plain, 5)).toBe(LAYERS.ridges(123, 456, { ...plain, wind: undefined }, 5));
    });

    it('blocks: flat-topped towers on a grid, nothing in the gaps, walls a ship can read', () => {
      const l = { type: 'blocks', cell: 120, gap: 24, hMin: 200, hMax: 600, cover: 0.9 };
      // the gaps, every way
      for (const [x, z] of [[5, 60], [60, 5], [119, 60], [-5, -60], [240 + 6, 300]]) expect(LAYERS.blocks(x, z, l, 9)).toBe(0);
      let towers = 0;
      for (let ix = 0; ix < 40; ix++) {
        const top = LAYERS.blocks(ix * 120 + 60, 60, l, 9);
        if (!top) continue;
        towers++;
        expect(top).toBeGreaterThanOrEqual(200);
        expect(top).toBeLessThanOrEqual(600);
        // flat on top: the same height a few metres off the middle
        expect(LAYERS.blocks(ix * 120 + 64, 57, l, 9)).toBe(top);
        // the same tower every time
        expect(LAYERS.blocks(ix * 120 + 60, 60, l, 9)).toBe(top);
      }
      expect(towers).toBeGreaterThan(28);
      // no wall steeper than the flight's limit, 60 m in 4 m
      for (let x = 0; x < 2400; x += 1) expect(Math.abs(LAYERS.blocks(x + 4, 60, l, 9) - LAYERS.blocks(x, 60, l, 9))).toBeLessThanOrEqual(60);
      expect(LAYERS.blocks(60, 60, { ...l, cover: 0 }, 9)).toBe(0);
    });
  });
});
