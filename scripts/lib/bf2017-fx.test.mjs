import { describe, expect, it } from 'vitest';
import { MESHES, SHEETS, WANTED, bareGlb, gridOf, tableEntry, tableModule, upCount, wantedSizes } from './bf2017-fx.mjs';

// a GLB of one material with a basisu map named outside the file
function glb(json, bin = Buffer.alloc(8)) {
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const head = Buffer.alloc(20);
  head.write('glTF', 0, 'ascii');
  head.writeUInt32LE(2, 4);
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(bin.length, 0);
  binHead.write('BIN\0', 4, 'ascii');
  head.writeUInt32LE(20 + text.length + 8 + bin.length, 8);
  head.writeUInt32LE(text.length, 12);
  head.write('JSON', 16, 'ascii');
  return Buffer.concat([head, Buffer.from(text), binHead, bin]);
}
const readJson = (buf) => JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));

describe('the effect recipes', () => {
  it('every sheet and mesh comes from the game, nothing of the sequel era', () => {
    for (const s of Object.values(SHEETS)) expect(s.from).toMatch(/^FX\//);
    for (const from of Object.values(WANTED)) expect(from).toMatch(/^FX\//);
    for (const m of Object.values(MESHES)) for (const f of m.from) expect(f).toMatch(/^fx\//);
    const all = JSON.stringify([SHEETS, WANTED, MESHES]).toLowerCase();
    for (const sequel of ['kylo', 'starkiller', 'jakku', 'resistance', 'firstorder', 'bb8', 'bb9e', 'rey', 'finn']) expect(all, sequel).not.toContain(sequel);
  });

  it('a sheet ships no bigger than its source', () => {
    expect(wantedSizes({ sizes: [512, 1024] }, 1024)).toEqual([512, 1024]);
    expect(wantedSizes({ sizes: [512, 1024] }, 512)).toEqual([512]);
    expect(wantedSizes({ sizes: [512, 1024] }, 256)).toEqual([256]);
  });

  it('the grid is the sheet’s own where its name is wrong', () => {
    expect(gridOf(SHEETS['scorch.metal'])).toEqual([2, 2]);
    expect(gridOf({ from: 'FX/T_Wisties_5x1_01' })).toEqual([5, 1]);
    expect(gridOf(SHEETS.glow)).toEqual([1, 1]);
  });
});

describe('bareGlb', () => {
  it('takes out the images, textures and samplers, and the maps that named them', () => {
    const json = {
      asset: { version: '2.0' },
      extensionsUsed: ['KHR_texture_basisu', 'EXT_meshopt_compression'],
      extensionsRequired: ['KHR_texture_basisu'],
      images: [{ uri: '../../textures/fx/t_x.ktx2' }],
      textures: [{ extensions: { KHR_texture_basisu: { source: 0 } } }],
      samplers: [{}],
      materials: [{ name: 'm', normalTexture: { index: 0 }, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, baseColorFactor: [1, 1, 1, 1] } }],
      buffers: [{ byteLength: 8 }],
    };
    const out = bareGlb(glb(json));
    expect(out.toString('ascii', 0, 4)).toBe('glTF');
    expect(out.readUInt32LE(8)).toBe(out.length);
    expect(out.readUInt32LE(12) % 4).toBe(0);
    const j = readJson(out);
    expect(j.images).toBeUndefined();
    expect(j.textures).toBeUndefined();
    expect(j.samplers).toBeUndefined();
    expect(j.materials[0]).toEqual({ name: 'm', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] } });
    expect(j.extensionsUsed).toEqual(['EXT_meshopt_compression']);
    expect(j.extensionsRequired).toEqual([]);
    // the binary chunk comes through as it was
    expect(out.subarray(out.length - 16)).toEqual(glb(json).subarray(glb(json).length - 16));
  });
});

describe('the table', () => {
  it('a sheet’s line says its grid, its sizes and what its channels hold', () => {
    expect(tableEntry('impact', { spec: SHEETS.impact, files: [[512, 30000], [1024, 90000]] })).toEqual({
      from: SHEETS.impact.from,
      grid: [1, 1],
      sizes: { 512: 30000, 1024: 90000 },
      channels: { scorch: 'r', burst: 'g', ring: 'b' },
    });
    expect(tableEntry('debris.snow', { spec: MESHES['debris.snow'], bytes: 4000, mesh: true })).toEqual({ mesh: true, file: '/models/galaxy/bf2017/fx/debris.snow.glb', from: MESHES['debris.snow'].from, bytes: 4000 });
  });

  it('is written as a module, sorted, each path in full', () => {
    const text = tableModule({ glow: { grid: [1, 1], sizes: { 256: 9 } }, 'debris.snow': { mesh: true, file: '/models/galaxy/bf2017/fx/debris.snow.glb' } });
    expect(text).toContain('export const BF2017_FX = {');
    expect(text.indexOf("'debris.snow'")).toBeLessThan(text.indexOf("'glow'"));
    expect(text).toContain('/models/galaxy/bf2017/fx/debris.snow.glb');
  });
});

describe('upCount', () => {
  it('counts the effect textures the bucket holds, as either file', () => {
    const rows = [
      { name: 'FX/A', file: 'textures/fx/a.png' },
      { name: 'FX/B', file: 'textures/fx/b.png' },
      { name: 'fx/C', file: 'textures/fx/c.png' },
      { name: 'Characters/D', file: 'textures/characters/d.png' },
    ];
    const has = (f) => f === 'textures/fx/a.ktx2' || f === 'textures/fx/c.png';
    expect(upCount(rows, has)).toEqual({ all: 3, up: 2 });
  });
});
