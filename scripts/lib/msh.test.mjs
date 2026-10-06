import { describe, expect, it } from 'vitest';
import { readMsh } from './msh.mjs';

// a .msh written by hand, chunk by chunk, the way the mod tools write one
const enc = new TextEncoder();
const pad4 = (n) => (n + 3) & ~3;
const u32 = (n) => new Uint8Array(new Uint32Array([n]).buffer);
const u16s = (list) => new Uint8Array(new Uint16Array(list).buffer);
const f32s = (list) => new Uint8Array(new Float32Array(list).buffer);
const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const chunk = (tag, ...parts) => {
  const body = cat(...parts);
  const padded = new Uint8Array(pad4(body.length));
  padded.set(body);
  return cat(enc.encode(tag), u32(body.length), padded);
};
const str = (s) => cat(enc.encode(s), new Uint8Array(1));

// a quad of two triangles, as a strip, in a static model wearing one textured material
const quad = (indices) =>
  chunk(
    'HEDR',
    chunk('SHVO', u32(3)),
    chunk(
      'MSH2',
      chunk('SINF', chunk('NAME', str('scene'))),
      chunk('MATL', u32(2), chunk('MATD', chunk('NAME', str('armour')), chunk('DATA', f32s([0.9, 0.9, 0.9, 1, 0.2, 0.2, 0.2, 1, 0, 0, 0, 1, 50])), chunk('ATRB', new Uint8Array([1, 0, 0, 0])), chunk('TX0D', str('imp_inf_snowtrooper.tga'))), chunk('MATD', chunk('NAME', str('plain')), chunk('DATA', f32s([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 10])))),
      chunk('MODL', chunk('MTYP', u32(3)), chunk('MNDX', u32(1)), chunk('NAME', str('bone_root')), chunk('FLGS', u32(0)), chunk('TRAN', f32s([1, 1, 1, 0, 0, 0, 1, 0, 1, 0]))),
      chunk(
        'MODL',
        chunk('MTYP', u32(4)),
        chunk('MNDX', u32(2)),
        chunk('NAME', str('body')),
        chunk('PRNT', str('bone_root')),
        chunk('FLGS', u32(0)),
        chunk('TRAN', f32s([2, 2, 2, 0, 0, 0, 1, 0.5, 0, 0])),
        chunk('GEOM', chunk('BBOX', f32s([0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1])), chunk('SEGM', chunk('MATI', u32(0)), chunk('POSL', u32(4), f32s([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0])), chunk('NRML', u32(4), f32s([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])), chunk('UV0L', u32(4), f32s([0, 0, 1, 0, 1, 1, 0, 1])), indices)),
      ),
      chunk('MODL', chunk('MTYP', u32(6)), chunk('MNDX', u32(3)), chunk('NAME', str('sv_shadow')), chunk('FLGS', u32(1)), chunk('GEOM', chunk('SEGM', chunk('MATI', u32(1)), chunk('POSL', u32(3), f32s([0, 0, 0, 1, 0, 0, 0, 1, 0])), chunk('NDXT', u32(1), u16s([0, 1, 2]))))),
    ),
    chunk('CL1L'),
  );

describe('a ZeroEngine mesh', () => {
  it('reads the materials, with the texture each wears', () => {
    const { materials } = readMsh(quad(chunk('NDXT', u32(2), u16s([0, 1, 2, 0, 2, 3]))));
    expect(materials).toHaveLength(2);
    expect(materials[0].name).toBe('armour');
    expect(materials[0].texture).toBe('imp_inf_snowtrooper.tga');
    expect(materials[0].diffuse.map((v) => +v.toFixed(2))).toEqual([0.9, 0.9, 0.9, 1]);
    expect(materials[0].flags).toBe(1);
    expect(materials[1].texture).toBeNull();
  });

  it('reads the models: their kind, parent, transform and triangles', () => {
    const { models } = readMsh(quad(chunk('NDXT', u32(2), u16s([0, 1, 2, 0, 2, 3]))));
    expect(models.map((m) => m.name)).toEqual(['bone_root', 'body', 'sv_shadow']);
    expect(models.map((m) => m.type)).toEqual(['bone', 'static', 'shadow']);
    const body = models[1];
    expect(body.parent).toBe('bone_root');
    expect(body.scale).toEqual([2, 2, 2]);
    expect(body.translation).toEqual([0.5, 0, 0]);
    expect(body.hidden).toBe(false);
    expect(models[2].hidden).toBe(true);
    expect(body.segments).toHaveLength(1);
    const seg = body.segments[0];
    expect(seg.material).toBe(0);
    expect(seg.positions.length).toBe(12);
    expect(seg.normals.length).toBe(12);
    expect(seg.uvs.length).toBe(8);
    expect([...seg.indices]).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('turns strips into triangles, alternating their winding, a strip at each flagged pair', () => {
    // one strip over the quad: 0 1 3 2 (the first two flagged), then a second strip of one triangle 0 2 3
    const strips = chunk('STRP', u32(7), u16s([0x8000 | 0, 0x8000 | 1, 3, 2, 0x8000 | 0, 0x8000 | 2, 3]));
    const { models } = readMsh(quad(strips));
    const idx = [...models[1].segments[0].indices];
    expect(idx).toEqual([0, 1, 3, 3, 1, 2, 0, 2, 3]);
  });

  it('fans polygons into triangles', () => {
    const polys = chunk('NDXL', u32(1), u16s([4, 0, 1, 2, 3]));
    const { models } = readMsh(quad(polys));
    expect([...models[1].segments[0].indices]).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('refuses a file that isn’t one', () => {
    expect(() => readMsh(new Uint8Array(16))).toThrow(/HEDR/);
    expect(() => readMsh(enc.encode('not a mesh at all, just words'))).toThrow();
  });
});
