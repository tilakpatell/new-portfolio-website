import { describe, expect, it } from 'vitest';
import { SEQUEL, cutsFor, isSequel, partsOf, readManifest } from './bf2017-manifest.mjs';

const VADER = 'characters/hero/darthvader/darthvader_01/darthvader_01_mesh';
const HILT = 'gameplay/equipment/heroes/lightsaberlukeskywalker/lightsaberlukeskywalker_meshp_mesh';
const chain = (tris) => tris.map((triangles, lod) => ({ lod, file: `web/models/x_lod${lod}.glb`, vertices: triangles, triangles, bytes: triangles * 40 }));
const TEXT = [
  { name: VADER, joints: 250, lods: chain([31042, 18642, 7520, 3575, 1061, 337]) },
  { name: HILT, lods: chain([920]) },
  { name: 'characters/hero/darthvader/darthvader_01/darthvader_01_cape_mesh', lods: chain([2000, 900]) },
  { name: 'characters/heads/heads_x/heads_x_01/heads_x_01_mesh', lods: chain([1500, 700]) },
]
  .map((e) => JSON.stringify(e))
  .join('\n\n');

describe('the 2017 manifest', () => {
  const m = readManifest(TEXT);

  it('reads one model a line, by name', () => {
    expect(m.size).toBe(4);
    expect(m.get(VADER).joints).toBe(250);
  });

  it('picks the cuts from the LOD chain', () => {
    const c = cutsFor(m.get(VADER));
    expect(c.plain.lod).toBe(2);
    expect(c.lod1.lod).toBe(4);
    expect(c.ultra).toBe(null);
    expect(cutsFor(m.get(VADER), { ultra: true }).ultra.lod).toBe(0);
    const d = cutsFor(m.get(VADER), { plainMax: 8000, lod1Max: 4000 });
    expect(d.plain.lod).toBe(2);
    expect(d.lod1.lod).toBe(3);
  });

  it('gives a one-LOD model its only cut, with no light or ultra one', () => {
    const c = cutsFor(m.get(HILT), { ultra: true });
    expect(c.plain.lod).toBe(0);
    expect(c.lod1).toBe(null);
    expect(c.ultra).toBe(null);
  });

  it('takes the last LOD when none is under the plain budget', () => {
    expect(cutsFor(m.get(VADER), { plainMax: 100 }).plain.lod).toBe(5);
  });

  it('finds the parts beside a model, never the model itself', () => {
    expect(partsOf(m, VADER, ['*_cape_mesh']).map((e) => e.name)).toEqual(['characters/hero/darthvader/darthvader_01/darthvader_01_cape_mesh']);
    expect(partsOf(m, VADER, ['*']).map((e) => e.name)).toEqual(['characters/hero/darthvader/darthvader_01/darthvader_01_cape_mesh']);
  });

  it('takes a part named in full from any folder (a hero’s head is under characters/heads/)', () => {
    const head = 'characters/heads/heads_x/heads_x_01/heads_x_01_mesh';
    expect(partsOf(m, VADER, [head]).map((e) => e.name)).toEqual([head]);
    expect(partsOf(m, VADER, ['*_cape_mesh', head]).map((e) => e.name)).toEqual(['characters/hero/darthvader/darthvader_01/darthvader_01_cape_mesh', head]);
    expect(partsOf(m, VADER, ['characters/heads/nobody_mesh'])).toEqual([]);
  });

  it('knows the sequel era by its folders', () => {
    expect(isSequel('characters/hero/kyloren/kyloren_01/kyloren_01_mesh')).toBe(true);
    expect(isSequel('characters/hero/luke/luke_rotj_01/luke_rotj_01_mesh')).toBe(false);
    expect(isSequel('gameplay/vehicles/air/xwing_t70/x')).toBe(true);
    expect(isSequel('gameplay/vehicles/air/xwing_t65/x')).toBe(false);
    expect(isSequel('Characters/Hero/KyloRen/x')).toBe(true);
    expect(SEQUEL).toContain('jump_cop');
  });
});
