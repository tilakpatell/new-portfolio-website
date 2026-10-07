import { describe, expect, it } from 'vitest';
import { seeded } from '../../../lib/seeded';
import { H, W, applyEdits, blockLight, chunkOf, get, getState, index, key, local, makeChunk, packEdits, set, setLight, skyLight } from './chunk';

describe('a chunk', () => {
  it('is 16 × 16 × 256', () => {
    expect([W, H]).toEqual([16, 256]);
    const c = makeChunk(2, -3);
    expect(c).toMatchObject({ cx: 2, cz: -3, generated: false, lit: false });
    expect(c.ids).toBeInstanceOf(Uint8Array);
    expect(c.ids.length).toBe(65536);
    expect(c.light.length).toBe(65536);
    expect(c.state.length).toBe(65536);
  });

  it('index covers every cell once', () => {
    const seen = new Uint8Array(65536);
    for (let y = 0; y < 256; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) seen[index(x, y, z)]++;
    expect(seen.every((n) => n === 1)).toBe(true);
    expect(index(1, 0, 0) - index(0, 0, 0)).toBe(1);
    expect(index(0, 1, 0) - index(0, 0, 0)).toBe(256);
  });

  it('set then get at every corner (0,0,0), (15,255,15)', () => {
    const c = makeChunk(0, 0);
    for (const [x, y, z] of [[0, 0, 0], [15, 0, 0], [0, 255, 0], [0, 0, 15], [15, 255, 15]]) {
      set(c, x, y, z, 7, 3);
      expect(get(c, x, y, z)).toBe(7);
      expect(getState(c, x, y, z)).toBe(3);
    }
  });

  it('get above 255 and below 0 is air', () => {
    const c = makeChunk(0, 0);
    c.ids.fill(1);
    expect(get(c, 3, 256, 3)).toBe(0);
    expect(get(c, 3, -1, 3)).toBe(0);
    expect(get(c, 3, 255, 3)).toBe(1);
  });

  it('set marks the section dirty (y 40 is section 2)', () => {
    const c = makeChunk(0, 0);
    set(c, 1, 40, 1, 1);
    expect([...c.dirty]).toEqual([2]);
  });

  it('a set on a section’s floor or ceiling dirties its neighbour too, whose faces it shows', () => {
    const c = makeChunk(0, 0);
    set(c, 1, 32, 1, 1);
    expect([...c.dirty].sort()).toEqual([1, 2]);
    c.dirty.clear();
    set(c, 1, 47, 1, 1);
    expect([...c.dirty].sort()).toEqual([2, 3]);
  });

  it('a set with log false leaves no edit', () => {
    const c = makeChunk(0, 0);
    set(c, 1, 2, 3, 4, 0, { log: false });
    expect(c.edits.size).toBe(0);
    set(c, 1, 2, 3, 5);
    expect(c.edits.get(index(1, 2, 3))).toEqual([5, 0]);
  });

  it('keeps sky light in the high nibble and block light in the low', () => {
    const c = makeChunk(0, 0);
    setLight(c, 4, 70, 4, 15, 9);
    expect(skyLight(c, 4, 70, 4)).toBe(15);
    expect(blockLight(c, 4, 70, 4)).toBe(9);
    expect(c.light[index(4, 70, 4)]).toBe(0xf9);
  });

  it('edits round trip: 100 random sets pack and apply to an equal ids array', () => {
    const rand = seeded(3);
    const a = makeChunk(0, 0);
    for (let i = 0; i < 100; i++) set(a, Math.floor(rand() * 16), Math.floor(rand() * 256), Math.floor(rand() * 16), 1 + Math.floor(rand() * 9), Math.floor(rand() * 4));
    const packed = packEdits(a);
    const b = makeChunk(0, 0);
    applyEdits(b, packed);
    expect(b.ids).toEqual(a.ids);
    expect(b.state).toEqual(a.state);
    expect(packEdits(b)).toEqual(packed);
  });

  it('a run of 50 identical sets packs to one entry', () => {
    const c = makeChunk(0, 0);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 4; z++) if (z * 16 + x < 50) set(c, x, 10, z, 4, 1);
    expect(packEdits(c)).toEqual([index(0, 10, 0), 4, 1, 50]);
  });

  it('chunkOf(-1) is -1 and local(-1) is 15', () => {
    expect(chunkOf(-1)).toBe(-1);
    expect(local(-1)).toBe(15);
    expect(chunkOf(16)).toBe(1);
    expect(local(16)).toBe(0);
    expect(chunkOf(15.99)).toBe(0);
    expect(local(-16.5)).toBeCloseTo(15.5);
    expect(key(-2, 5)).toBe('-2,5');
  });
});
