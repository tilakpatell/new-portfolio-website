import { describe, expect, it } from 'vitest';
import { liftArray, spherifyArray } from './lib/surface-model.mjs';
import { QUATERNIUS, specFor } from './quaternius-import.mjs';

describe('specFor', () => {
  it('reads a model, its kind and its size, with the defaults', () => {
    expect(specFor(['naturemega', 'Fern_1', '--kind', 'qfern', '--metres', '0.9'])).toEqual({
      pack: 'naturemega',
      model: 'Fern_1',
      kind: 'qfern',
      metres: 0.9,
      along: 'y',
      tex: 512,
      tris: 4000,
      foliage: null,
      lod: null,
      src: 'lab/assets/naturemega/glTF/Fern_1.gltf',
    });
  });
  it('takes another axis, a map size, a budget, a foliage lift and another file', () => {
    const s = specFor(['naturemega', 'Pebble_Round_1', '--kind', 'qpebble', '--metres', '0.3', '--along', 'max', '--tex', '256', '--tris', '800', '--foliage', 'crown', '--lod', '300', '--from', 'x/y.gltf']);
    expect(s).toMatchObject({ along: 'max', tex: 256, tris: 800, foliage: 'crown', lod: 300, src: 'x/y.gltf' });
  });
  it('wants a kind and a size', () => {
    expect(() => specFor(['naturemega', 'Fern_1', '--metres', '1'])).toThrow(/--kind/);
    expect(() => specFor(['naturemega', 'Fern_1', '--kind', 'qfern'])).toThrow(/--metres/);
    expect(() => specFor(['naturemega', 'Fern_1', '--kind', 'Fern', '--metres', '1'])).toThrow(/kind/);
  });
  it('lists the seven the galaxy uses, each a q-kind', () => {
    expect(Object.keys(QUATERNIUS)).toEqual(['qfern', 'qclover', 'qmushroom', 'qpebble', 'qgrass', 'qpine', 'qdeadtree']);
    for (const [kind, args] of Object.entries(QUATERNIUS)) expect(specFor(args).kind).toBe(kind);
  });
});

describe('foliage normals, at import', () => {
  it('turns a leaf’s normals up, keeping a share of its own (a lawn’s)', () => {
    const n = liftArray(new Float32Array([1, 0, 0, 0, -1, 0]), 0.25);
    expect(n[1]).toBeGreaterThan(0.9);
    expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 5);
    // (one pointing straight down: up, not nothing)
    expect(Math.hypot(n[3], n[4], n[5])).toBeCloseTo(1, 5);
    expect(n[4]).toBeGreaterThan(0.9);
  });
  it('points a crown’s normals out from its middle', () => {
    const pos = new Float32Array([2, 5, 0, -2, 5, 0, 0, 9, 0, 0, 1, 0]);
    const nrm = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const n = spherifyArray(pos, nrm, 0);
    expect(n[0]).toBeCloseTo(1, 5);
    expect(n[3]).toBeCloseTo(-1, 5);
    expect(n[7]).toBeCloseTo(1, 5);
    expect(n[10]).toBeCloseTo(-1, 5);
  });
});
