import { describe, expect, it } from 'vitest';
import { dictionary, hashExact, hashName, namesFrom, resolveDepot, vecOf } from './bf2017-shader-names.mjs';

// a depot row as the probe writes one, trimmed to three blocks: a tiling
// vector, a switch, and one block whose name no record uses
const vec = (x, y, z, w) => {
  const b = Buffer.alloc(16);
  [x, y, z, w].forEach((v, i) => b.writeFloatLE(v, i * 4));
  return b.toString('hex');
};
const DEPOT = {
  material: 'Shaders/Presets/SS_PropsPreset_DetailMap',
  blocks: [
    { name: hashName('GlobalTilingDetailmap'), type: hashExact('Vec'), value: vec(8, 8, 0, 1) },
    { name: hashName('ESB_PanelEnable'), type: hashExact('Boolean'), value: false },
    { name: 'deadbeef', type: hashExact('Vec'), value: vec(1, 2, 3, 4) },
  ],
};

describe('the depots’ hash', () => {
  it('is djb2-xor of the lower-cased name, 32 bits, eight hex digits', () => {
    expect(hashName('vec')).toBe('0b877b75');
    expect(hashName('Vec')).toBe('0b877b75');
    expect(hashName('Boolean')).toBe('87d71101');
    expect(hashName('smoothness')).toBe(hashName('Smoothness'));
  });

  it('keeps the case when asked to, which is how the type names hash', () => {
    expect(hashExact('Vec')).toBe('0b87fa95');
    expect(hashExact('Vec')).not.toBe(hashName('Vec'));
  });
});

describe('the dictionary', () => {
  it('takes every name the readable records use', () => {
    const materials = [{ materials: [{ textures: { CS: 'T_A_CS', NS: 'T_B_NS' }, vectors: { NormalDetailScalar: [2, 2, 0, 1] }, bools: { UseDetail: true }, conditionals: {} }] }];
    const variations = [{ $type: 'ObjectVariation', Materials: [{ VectorParameters: [{ ParameterName: 'PaintColour', Value: [1, 0, 0, 1] }], ConditionalParameters: [{ ParameterName: 'ESB_PanelEnable', Value: false }] }] }];
    const presets = '{"Parameters":[{"Name":"GlobalTilingDetailmap"}]}\n';
    const names = namesFrom({ materials, variations, presets });
    expect([...names].sort()).toEqual(['CS', 'ESB_PanelEnable', 'GlobalTilingDetailmap', 'NS', 'NormalDetailScalar', 'PaintColour', 'UseDetail']);
    const d = dictionary(names);
    expect(d.names.PaintColour).toBe(hashName('paintcolour'));
    expect(d.byHash.get(hashName('CS'))).toBe('CS');
  });

  it('names a depot’s blocks, reads a Vec as four floats, and leaves an unknown hash as the hash', () => {
    const d = dictionary(['GlobalTilingDetailmap', 'ESB_PanelEnable']);
    const r = resolveDepot(DEPOT, d);
    expect(r.resolved).toBe(2);
    expect(r.unresolved).toEqual({ deadbeef: 1 });
    expect(r.params[0]).toEqual({ name: 'GlobalTilingDetailmap', type: 'Vec', value: [8, 8, 0, 1] });
    expect(r.params[1]).toEqual({ name: 'ESB_PanelEnable', type: 'Boolean', value: false });
    expect(r.params[2]).toEqual({ hash: 'deadbeef', type: 'Vec', value: [1, 2, 3, 4] });
  });

  it('reads sixteen bytes as little-endian floats, and nothing shorter', () => {
    expect(vecOf(vec(0.5, -1, 1600, 0))).toEqual([0.5, -1, 1600, 0]);
    expect(vecOf('0000')).toBeNull();
  });
});
