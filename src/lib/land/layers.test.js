import { describe, expect, it } from 'vitest';
import { LAYERS, fieldAt } from './layers';
import { LAYER_TYPES, makeRaw } from '../../components/galaxy/surface/terrain';

describe('the layers, shared with the galaxy', () => {
  it('has the galaxy’s nine', () => {
    expect(Object.keys(LAYERS)).toEqual(['swell', 'hills', 'dunes', 'mesas', 'ridges', 'mountains', 'channels', 'island', 'level']);
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
});
