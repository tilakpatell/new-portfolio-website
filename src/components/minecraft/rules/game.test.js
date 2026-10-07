import { describe, expect, it } from 'vitest';
import { byName } from './blocks';
import { key, makeChunk } from './chunk';
import { addChunk, drain, dropFar, newGame, spawnPoint, tick, wantedChunks } from './game';
import { makeWorld } from './world';
import { SEA, makeGenerator } from './worldgen';

const idle = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false, yaw: 0, pitch: 0 };
const id = (n) => byName.get(n).id;

describe('the world', () => {
  it('reads and writes through the loaded chunks, world coordinates in', () => {
    const w = makeWorld();
    const c = makeChunk(-1, 0);
    w.chunks.set(key(-1, 0), c);
    expect(w.set(-1, 70, 5, id('stone'))).toBe(true);
    expect(w.get(-1, 70, 5)).toBe(id('stone'));
    expect(w.get(-0.5, 70.9, 5.2)).toBe(id('stone'));
    expect(c.ids[(70 * 16 + 5) * 16 + 15]).toBe(id('stone'));
    expect(w.solid(-1, 70, 5)).toBe(true);
    expect(w.chunkAt(-1, 0)).toBe(c);
  });

  it('outside a loaded chunk is stone below the sea and air above, and can’t be written', () => {
    const w = makeWorld();
    expect(w.get(500, 62, 500)).toBe(id('stone'));
    expect(w.get(500, 63, 500)).toBe(0);
    expect(w.solid(500, 10, 500)).toBe(true);
    expect(w.set(500, 70, 500, id('stone'))).toBe(false);
  });

  it('an edit on a chunk’s edge dirties the neighbour’s section too, whose face it shows', () => {
    const w = makeWorld();
    for (const [x, z] of [[0, 0], [-1, 0], [0, 1]]) w.chunks.set(key(x, z), makeChunk(x, z));
    w.set(0, 40, 15, id('stone'));
    expect([...w.chunkAt(0, 0).dirty]).toEqual([2]);
    expect([...w.chunkAt(-1, 0).dirty]).toEqual([2]);
    expect([...w.chunkAt(0, 1).dirty]).toEqual([2]);
    w.set(5, 40, 5, id('stone'));
    expect(w.chunkAt(-1, 0).dirty.size).toBe(1);
  });

  it('finds a chunk’s four neighbours', () => {
    const w = makeWorld();
    for (const [x, z] of [[0, 0], [-1, 0], [1, 0], [0, -1]]) w.chunks.set(key(x, z), makeChunk(x, z));
    const nb = w.neighbours(0, 0);
    expect(nb.nx.cx).toBe(-1);
    expect(nb.px.cx).toBe(1);
    expect(nb.nz.cz).toBe(-1);
    expect(nb.pz).toBeNull();
  });
});

describe('the game', () => {
  it('wantedChunks within distance 2 is 25 keys nearest first', () => {
    const g = newGame({ seed: 1 });
    g.renderDistance = 2;
    g.player.x = 8;
    g.player.z = 8;
    const keys = wantedChunks(g);
    expect(keys).toHaveLength(25);
    expect(keys[0]).toBe('0,0');
    expect(new Set(keys.slice(1, 5))).toEqual(new Set(['1,0', '-1,0', '0,1', '0,-1']));
    expect(keys.slice(-4).every((k) => k.split(',').every((n) => Math.abs(Number(n)) === 2))).toBe(true);
  });

  it('wantedChunks follows the player and is bounded by maxChunks', () => {
    const g = newGame({ seed: 1 });
    g.renderDistance = 10;
    g.maxChunks = 50;
    g.player.x = -40;
    g.player.z = 100;
    const keys = wantedChunks(g);
    expect(keys).toHaveLength(50);
    expect(keys[0]).toBe('-3,6');
  });

  it('a chunk beyond distance + 2 is dropped', () => {
    const g = newGame({ seed: 1 });
    g.renderDistance = 2;
    g.player.x = 8;
    g.player.z = 8;
    for (const [x, z] of [[0, 0], [4, 0], [5, 0], [0, -5]]) addChunk(g, makeChunk(x, z));
    expect(dropFar(g).sort()).toEqual(['0,-5', '5,0']);
    expect([...g.world.chunks.keys()].sort()).toEqual(['0,0', '4,0']);
  });

  it('spawn is on land above 63 with air above', () => {
    for (const seed of [1, 2, 'pumpkin']) {
      const gen = makeGenerator(seed);
      const s = spawnPoint(gen);
      expect(s.y).toBeGreaterThan(SEA);
      const c = makeChunk(Math.floor(s.x / 16), Math.floor(s.z / 16));
      gen.generate(c);
      const w = makeWorld();
      w.chunks.set(key(c.cx, c.cz), c);
      expect(w.get(s.x, s.y - 1, s.z)).not.toBe(0);
      expect(w.get(s.x, s.y - 1, s.z)).not.toBe(id('water'));
      expect(w.solid(s.x, s.y, s.z)).toBe(false);
      expect(w.solid(s.x, s.y + 1, s.z)).toBe(false);
      // under the open sky, not in a wood's shade: nothing over the head
      for (let y = s.y; y < 256; y++) expect(w.get(s.x, y, s.z), `${seed} at ${y}`).toBe(0);
    }
  });

  it('a new game stands its player at the spawn', () => {
    const g = newGame({ seed: 1 });
    expect(g.seed).toBe(1);
    expect(g.player).toMatchObject(spawnPoint(makeGenerator(1)));
    expect(g.time).toBe(6000); // Phase 1 holds noon
  });

  it('tick advances time by 1', () => {
    const g = newGame({ seed: 1 });
    const t = g.time;
    tick(g, idle);
    expect(g.time).toBe(t + 1);
    expect(g.ticks).toBe(1);
  });

  it('the player stands on the generated surface after 100 ticks', () => {
    const g = newGame({ seed: 1 });
    const gen = makeGenerator(1);
    const cx = Math.floor(g.player.x / 16);
    const cz = Math.floor(g.player.z / 16);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const c = makeChunk(cx + dx, cz + dz);
        gen.generate(c);
        addChunk(g, c);
      }
    g.player.y += 3;
    for (let i = 0; i < 100; i++) tick(g, idle);
    expect(g.player.onGround).toBe(true);
    expect(g.player.y).toBe(gen.height(Math.floor(g.player.x), Math.floor(g.player.z)) + 1);
    expect(drain(g).some((e) => e.type === 'land')).toBe(true);
    expect(drain(g)).toEqual([]);
  });

  it('tick with no chunks under the player holds him (unloaded ground is stone)', () => {
    const g = newGame({ seed: 1 });
    const y = g.player.y;
    for (let i = 0; i < 40; i++) tick(g, { ...idle, forward: 1 });
    expect(g.player.y).toBe(y);
    expect(g.player.x).toBe(spawnPoint(makeGenerator(1)).x);
  });

  it('a seed from the save wins over the one asked for', () => {
    expect(newGame({ seed: 5, save: { seed: 9 } }).seed).toBe(9);
    expect(newGame({ seed: 'pumpkin' }).seed).toBe(newGame({ seed: 'pumpkin' }).seed);
  });
});
