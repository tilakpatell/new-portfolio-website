import { describe, expect, it } from 'vitest';
import { TEXTURES, byName } from './blocks';
import { makeChunk, packEdits, set } from './chunk';
import { borders, chunkKey, makeCore, makeQueue, meshKey } from './jobs';
import { meshSection, unpack } from './mesher';
import { makeGenerator } from './worldgen';

const textures = new Map(TEXTURES.map((t, i) => [t, i]));

describe('the job queue', () => {
  it('nearest first', () => {
    const q = makeQueue();
    q.push({ key: 'a', priority: 9 });
    q.push({ key: 'b', priority: 1 });
    q.push({ key: 'c', priority: 4 });
    expect([q.next().key, q.next().key, q.next().key]).toEqual(['b', 'c', 'a']);
    expect(q.next()).toBeNull();
  });

  it('cancel removes a queued job', () => {
    const q = makeQueue();
    q.push({ key: 'a', priority: 1 });
    q.push({ key: 'b', priority: 2 });
    expect(q.size).toBe(2);
    expect(q.cancel('a')).toBe(true);
    expect(q.size).toBe(1);
    expect(q.next().key).toBe('b');
    expect(q.cancel('zzz')).toBe(false);
  });

  it('a job pushed again under its key replaces the first', () => {
    const q = makeQueue();
    q.push({ key: 'a', priority: 5, n: 1 });
    q.push({ key: 'a', priority: 2, n: 2 });
    expect(q.size).toBe(1);
    expect(q.next().n).toBe(2);
  });
});

describe('the worker’s core', () => {
  it('makes a chunk the same as the generator does, with its sections meshed against its neighbours', () => {
    const core = makeCore({ textures });
    core.handle({ type: 'chunk', key: chunkKey(0, 0), seed: 1, cx: 0, cz: 0, priority: 0 });
    const [{ msg, transfer }] = core.run();
    const want = makeChunk(0, 0);
    makeGenerator(1).generate(want);
    expect(msg).toMatchObject({ type: 'chunk', key: '0,0', cx: 0, cz: 0 });
    expect(msg.ids).toEqual(want.ids);
    expect(msg.meshes).toHaveLength(16);
    expect(transfer).toContain(msg.ids.buffer);
    // meshed with its real neighbours: the same as meshing here with them
    const nb = {};
    for (const [k, dx, dz] of [['nx', -1, 0], ['px', 1, 0], ['nz', 0, -1], ['pz', 0, 1], ['nxnz', -1, -1], ['pxnz', 1, -1], ['nxpz', -1, 1], ['pxpz', 1, 1]]) {
      nb[k] = makeChunk(dx, dz);
      makeGenerator(1).generate(nb[k]);
    }
    const s = 4;
    const here = meshSection(want, s, nb, { textures });
    expect(msg.meshes[s].opaque?.count ?? 0).toBe(here.opaque?.count ?? 0);
    // the same quads (the worker's are lit, these aren't: their light differs)
    const shape = (m) => Array.from({ length: m?.count ?? 0 }, (_, i) => { const v = unpack(m.data, i); return [v.x, v.y, v.z, v.face, v.layer, v.u, v.v]; });
    expect(shape(msg.meshes[s].opaque)).toEqual(shape(here.opaque));
  });

  it('a chunk job carries the player’s edits: in the terrain it returns, and seen across a border', () => {
    const core = makeCore({ textures });
    const mine = makeChunk(0, 0);
    set(mine, 2, 120, 2, byName.get('glass').id);
    const west = makeChunk(-1, 0);
    set(west, 15, 121, 7, byName.get('stone').id);
    set(west, 15, 122, 7, byName.get('stone').id);
    core.handle({ type: 'chunk', key: chunkKey(0, 0), seed: 1, cx: 0, cz: 0, priority: 0, edits: { [chunkKey(0, 0)]: packEdits(mine), [chunkKey(-1, 0)]: packEdits(west) } });
    const [{ msg }] = core.run();
    expect(msg.ids[(120 * 16 + 2) * 16 + 2]).toBe(byName.get('glass').id);
    expect(msg.state).toBeInstanceOf(Uint8Array);
    // the stone on the far side of the border hides nothing here, but its faces are its own chunk’s;
    // the glass is drawn in this chunk’s section 7
    expect(msg.meshes[7].cutout.count).toBe(24);
    // and the worker’s own copy of the terrain is left as the seed made it
    core.handle({ type: 'chunk', key: chunkKey(0, 0), seed: 1, cx: 0, cz: 0, priority: 0 });
    const [{ msg: plain }] = core.run();
    expect(plain.ids[(120 * 16 + 2) * 16 + 2]).toBe(0);
  });

  it('a neighbour’s edit at the border hides this chunk’s face', () => {
    const core = makeCore({ textures });
    const mine = makeChunk(0, 0);
    set(mine, 0, 120, 7, byName.get('stone').id);
    const west = makeChunk(-1, 0);
    set(west, 15, 120, 7, byName.get('stone').id);
    core.handle({ type: 'chunk', key: chunkKey(0, 0), seed: 1, cx: 0, cz: 0, priority: 0, edits: { [chunkKey(0, 0)]: packEdits(mine) } });
    const [{ msg: alone }] = core.run();
    core.handle({ type: 'chunk', key: chunkKey(0, 0), seed: 1, cx: 0, cz: 0, priority: 0, edits: { [chunkKey(0, 0)]: packEdits(mine), [chunkKey(-1, 0)]: packEdits(west) } });
    const [{ msg: beside }] = core.run();
    expect(alone.meshes[7].opaque.count / 4).toBe(6);
    expect(beside.meshes[7].opaque.count / 4).toBe(5);
  });

  it('a chunk comes back lit, and its meshes carry the light', () => {
    const core = makeCore({ textures });
    const mine = makeChunk(0, 0);
    set(mine, 5, 200, 5, byName.get('glowstone').id);
    core.handle({ type: 'chunk', key: chunkKey(0, 0), seed: 1, cx: 0, cz: 0, priority: 0, edits: { [chunkKey(0, 0)]: packEdits(mine) } });
    const [{ msg }] = core.run();
    expect(msg.light[(250 * 16 + 1) * 16 + 1]).toBe(0xf0);
    expect(msg.light[(2 * 16 + 1) * 16 + 1] >> 4).toBe(0);
    expect(msg.light[(200 * 16 + 6) * 16 + 5]).toBe(0xf0 | 14);
    // the glowstone’s faces look into its light: block light 14 beside it
    const v = Array.from({ length: msg.meshes[12].opaque.count }, (_, i) => unpack(msg.meshes[12].opaque.data, i));
    expect(v.length).toBe(24);
    expect(v.every((p) => (p.light & 15) >= 13)).toBe(true);
  });

  it('a cancelled job is never run', () => {
    const core = makeCore({ textures });
    core.handle({ type: 'chunk', key: chunkKey(5, 5), seed: 1, cx: 5, cz: 5, priority: 0 });
    core.handle({ type: 'cancel', key: chunkKey(5, 5) });
    expect(core.run()).toEqual([]);
  });

  it('meshes an edited section from the chunk and its neighbours’ borders alone', () => {
    const core = makeCore({ textures });
    const c = makeChunk(0, 0);
    const w = makeChunk(-1, 0);
    makeGenerator(3).generate(c);
    makeGenerator(3).generate(w);
    set(c, 0, 70, 3, byName.get('glass').id);
    set(w, 15, 71, 3, byName.get('stone').id);
    const nb = { nx: w, px: null, nz: null, pz: null };
    core.handle({ type: 'mesh', key: meshKey(0, 0, 4), cx: 0, cz: 0, sections: [4], priority: 0, chunk: { ids: c.ids, state: c.state, light: c.light, lit: c.lit }, borders: borders(nb) });
    const [{ msg }] = core.run();
    const want = meshSection(c, 4, nb, { textures });
    expect(msg.meshes[0].cutout.data).toEqual(want.cutout.data);
    expect(msg.meshes[0].opaque.data).toEqual(want.opaque.data);
  });
});
