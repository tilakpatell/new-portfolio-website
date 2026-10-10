import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAYERS } from '../../src/lib/land/layers.js';
import { readInstances } from '../../src/lib/level/instances.js';
import { arenaOf, buildPack, cropHeights, heightsLayer, mainSubs, meshCuts, packCell, readMap, rebase, rewriteImageUris, subset, terrainFrame } from './bf2017-level.mjs';
import { glbJson } from './bf2017-paths.mjs';
import { cellsOf } from './level-cells.mjs';

const FIX = join(import.meta.dirname, '..', 'fixtures', 'bf2017', 'web');
const json = JSON.parse(readFileSync(join(FIX, 'maps', 'fixture_01', 'fixture_01.json'), 'utf8'));
const bin = readFileSync(join(FIX, 'maps', 'fixture_01', 'fixture_01.bin'));
const record = JSON.parse(readFileSync(join(FIX, 'terrain.jsonl'), 'utf8').split('\n')[0]);
const png = readFileSync(join(FIX, 'terrain', 'fixture_01', 'fixture_01_height.png'));

describe('readMap', () => {
  it('counts the instances, meshes, subs and spawns', () => {
    const map = readMap(json, bin);
    expect(map.instances.count).toBe(4);
    expect(map.instances.quaternion).toBeInstanceOf(Int16Array);
    expect(map.meshes.length).toBe(3);
    expect(map.subworlds.length).toBe(3);
    expect(map.groups.length).toBe(4);
    expect(map.meshOf).toEqual(Int32Array.from([0, 1, 2, 0]));
    expect(map.vehicleSpawns[0].position).toEqual([105, 5, 205]);
    expect(map.terrain).toMatch(/Fixture_01_Terrain$/);
  });

  it('refuses a bin the wrong size for its count', () => {
    expect(() => readMap(json, bin.subarray(0, 64))).toThrow(/bytes/);
  });
});

describe('arenaOf', () => {
  it('takes the level’s own sub and Content by default, and leaves the lobby out', () => {
    const map = readMap(json, bin);
    expect(mainSubs(map)).toEqual(['fixture_01', 'content']);
    expect(arenaOf(map)).toEqual([0, 1, 2]);
  });

  it('takes the subs it is given, by their last name, any case', () => {
    const map = readMap(json, bin);
    expect(arenaOf(map, { subs: ['LOBBY'] })).toEqual([3]);
  });
});

describe('rebase', () => {
  it('puts the spot at the origin and the ground at 0', () => {
    const map = readMap(json, bin);
    const r = rebase(subset(map.instances, [0]), [100, 70.25, 200], 0);
    expect(Array.from(r.position)).toEqual([10, 5 - 70.25, 10]);
    // (and a yaw turns about it: a quarter turn takes +x to -z)
    const t = rebase(subset(map.instances, [0]), [100, 0, 200], Math.PI / 2);
    expect(t.position[0]).toBeCloseTo(10, 5);
    expect(t.position[2]).toBeCloseTo(-10, 5);
  });

  it('turns the quaternions with the frame', () => {
    const map = readMap(json, bin);
    const t = rebase(subset(map.instances, [0]), [0, 0, 0], Math.PI / 2);
    // the identity becomes the same quarter turn about y the positions took
    expect(t.quaternion[1] / 32767).toBeCloseTo(Math.SQRT1_2, 3);
    expect(t.quaternion[3] / 32767).toBeCloseTo(Math.SQRT1_2, 3);
  });
});

describe('cellsOf and packCell', () => {
  const map = readMap(json, bin);
  const arena = subset(map.instances, arenaOf(map));
  const meshOf = Int32Array.from(arenaOf(map).map((i) => map.meshOf[i]));
  const r = rebase(arena, [100, 0, 200], 0);

  it('puts the three instances in their cells and marks the mirrored one', () => {
    const cells = cellsOf(r, meshOf);
    // (10, 10) → 0,0; (200, 0) → 1,0; (0, -300) → 0,-3
    expect([...cells.keys()].sort()).toEqual(['0,-3', '0,0', '1,0']);
    expect(cells.get('0,-3').draws).toEqual([{ mesh: 2, indices: [2], mirrored: true }]);
    expect(cells.get('0,0').draws[0].mirrored).toBe(false);
  });

  it('round-trips a cell through the map’s own record reader', () => {
    const cells = cellsOf(r, meshOf);
    const { bin: out, draws } = packCell(cells.get('1,0'), r);
    expect(draws).toEqual([{ mesh: 1, offset: 0, count: 1, mirrored: false }]);
    const back = readInstances(out);
    expect(Array.from(back.position)).toEqual([200, 5, 0]);
    expect(back.quaternion[1]).toBeCloseTo(Math.SQRT1_2, 4);
    expect(Array.from(back.scale)).toEqual([2, 2, 2]);
  });
});

describe('the ground', () => {
  it('reads the record’s frame', () => {
    expect(terrainFrame(record)).toEqual({ minX: -64, minZ: -64, w: 9, h: 9, metresPerPixel: 64, scale: 1024, offset: 0, hole: 0 });
  });

  it('the image layer built from the record reads the known height at the spot', async () => {
    const layer = await heightsLayer(record, png);
    expect(LAYERS.image(100, 200, layer)).toBeCloseTo(64 + 100 / 16, 1);
    // the hole in the corner reads nothing (no far map under this one)
    expect(LAYERS.image(448, 448, layer)).toBe(0);
  });
});

describe('cropHeights', () => {
  it('resamples a square of the map to its own step, in the map’s units, holes kept', async () => {
    const { decodePng16 } = await import('../../src/lib/level/png16.js');
    const src = (await decodePng16(png)).data;
    const f = terrainFrame(record);
    const out = cropHeights(src, f, { minX: 0, minZ: 0, size: 64, metresPerPixel: 32 });
    expect([out.w, out.h]).toEqual([3, 3]);
    // x 0 → (64 + 0) / 1024; x 32 halfway to x 64
    expect(out.data[0]).toBe(src[1 * 9 + 1]);
    expect(out.data[1]).toBe(Math.round((src[10] + src[11]) / 2));
    // the hole at (448, 448) and anywhere off the map read as holes
    const edge = cropHeights(src, f, { minX: 384, minZ: 384, size: 64, metresPerPixel: 32 });
    expect(edge.data[4]).toBe(0);
    expect(edge.data[8]).toBe(0);
    expect(edge.data[0]).toBeGreaterThan(0);
  });
});

describe('buildPack', () => {
  const meshes = [
    { name: 'rock', tris: { far: 2, lod1: 4, plain: 8, ultra: 8 }, bounds: [-1, 0, -1, 1, 1, 1], mats: 1 },
    { name: 'hangar', tris: { far: 50, lod1: 100, plain: 400, ultra: 900 }, bounds: [-20, 0, -20, 20, 10, 20], mats: 2 },
    { name: 'crate', tris: { far: 2, lod1: 2, plain: 12, ultra: 12 }, bounds: [-0.5, 0, -0.5, 0.5, 1, 0.5], mats: 1 },
  ];
  const pack = buildPack({ world: 'fixture', mapName: 'levels/mp/fixture_01', map: readMap(json, bin), spot: [100, 200], groundY: 0, meshes, arena: 256 });

  it('writes the design’s level.json shape, keys sorted, a bin a cell', () => {
    const j = pack.json;
    expect(Object.keys(j)).toEqual([...Object.keys(j)].sort());
    expect(j.cell).toBe(128);
    expect(j.arena).toBe(256);
    expect(j.origin).toEqual([100, 0, 200]);
    expect(Object.keys(j.cells).sort()).toEqual(['0,0', '1,0']); // (0,-300 is outside a 256 m arena: the horizon's)
    expect(j.cells['0,0'].bin).toBe('cells/0_0.bin');
    expect(pack.files.get('cells/0_0.bin').byteLength).toBe(32);
    expect(j.horizon.draws).toEqual([expect.objectContaining({ count: 1, mesh: 2, mirrored: true, offset: 0 })]);
    expect(j.far.draws.map((d) => d.mesh)).toEqual([0, 1]);
    expect(j.far.draws[1].cells).toEqual({ '1,0': [0, 1] });
  });

  it('says per tier which cut each draw takes near, and null where it was dropped', () => {
    expect(pack.json.cells['0,0'].draws[0].lod).toEqual({ high: 'plain', low: 'lod1', mid: 'lod1', ultra: 'ultra' });
    const tight = buildPack({ world: 'fixture', mapName: 'm', map: readMap(json, bin), spot: [100, 200], groundY: 0, meshes, arena: 256, rows: { high: { tris: 500, calls: 700, near: 70, mid: 220, lod1: true } } });
    // 8 (the rock) + 400 (the hangar, one cell over) is over 70% of 500: the rock, the lighter, goes first
    expect(tight.json.cells['0,0'].draws[0].lod.high).toBe(null);
    expect(tight.table.high.dropped[0]).toMatchObject({ name: 'rock', count: 1 });
  });
});

describe('the meshes', () => {
  it('picks the four cuts from a chain: far ≤ 700 or the last, lod1, plain, ultra LOD0 when asked', () => {
    const entry = { lods: [{ lod: 0, triangles: 20000, file: 'a0' }, { lod: 1, triangles: 9000, file: 'a1' }, { lod: 2, triangles: 2000, file: 'a2' }, { lod: 3, triangles: 900, file: 'a3' }] };
    const c = meshCuts(entry, { ultra: true });
    expect(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.file]))).toEqual({ far: 'a3', lod1: 'a2', plain: 'a1', ultra: 'a0' });
    // no ultra asked: the plain cut stands in; a one-LOD chain is every cut
    const one = meshCuts({ lods: [{ lod: 0, triangles: 300, file: 'b0' }] });
    expect(new Set(Object.values(one).map((l) => l.file))).toEqual(new Set(['b0']));
  });

  it('rewrites a GLB’s image URIs and keeps the rest of the file', () => {
    const glb = readFileSync(join(FIX, 'models', 'gameplay', 'equipment', 'heroes', 'lightsaberlukeskywalker', 'lightsaberlukeskywalker_meshp_mesh.glb'));
    const out = rewriteImageUris(glb, (uri) => `../tex/${uri.split('/').pop()}`);
    const j = glbJson(out);
    expect(j.images.length).toBeGreaterThan(0);
    for (const img of j.images) if (img.uri) expect(img.uri.startsWith('../tex/')).toBe(true);
    expect(out.readUInt32LE(8)).toBe(out.length);
    // the binary chunk is the same bytes
    const binOf = (b) => b.subarray(20 + b.readUInt32LE(12));
    expect(binOf(out).equals(binOf(glb))).toBe(true);
  });
});
