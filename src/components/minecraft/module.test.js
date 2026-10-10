import { describe, expect, it, vi } from 'vitest';
import { WORLD_MB } from '../worlds/worlds';
import { IDBFactory } from 'fake-indexeddb';
import { createStore } from '../../runtime/store';
import { createRegistry } from '../worlds/registry';
import mc, { KEYS, VIEWS, distanceFor, settledOf, ticksFor } from './module';
import { newGame, wantedChunks } from './rules/game.js';
import { createStream } from './stream.js';
import { hashSeed } from './rules/noise.js';
import { SAVE } from './rules/save.js';
import { FIRST_NAME, HELD, holdWorld, keepWorld, openWorld } from './worlds';

describe('Minecraft, the world module', () => {
  it('the module has id minecraft, nodes, mb 2 matching WORLD_MB', () => {
    expect(mc).toMatchObject({ id: 'minecraft', shading: 'nodes', mb: 2 });
    expect(WORLD_MB['/dot-matrix/minecraft']).toBe(2);
    expect(typeof mc.create).toBe('function');
    expect(mc.label).toMatch(/Minecraft/);
  });

  it('binds the game’s keys', () => {
    expect(KEYS.forward).toEqual(['KeyW', 'ArrowUp']);
    expect(KEYS.jump).toEqual(['Space']);
    expect(KEYS.sneak).toEqual(['ShiftLeft', 'ShiftRight']);
    expect(KEYS.sprint).toEqual(['ControlLeft', 'ControlRight']);
    expect(KEYS.slot1).toEqual(['Digit1']);
    expect(KEYS.slot9).toEqual(['Digit9']);
    expect(KEYS.pause).toEqual(['Escape']);
  });

  it('the tick accumulator runs at most 4 ticks for a 1 s frame', () => {
    expect(ticksFor(1)).toEqual({ ticks: 4, left: 0 });
    expect(ticksFor(0.04)).toEqual({ ticks: 0, left: 0.04 });
    const r = ticksFor(0.12);
    expect(r.ticks).toBe(2);
    expect(r.left).toBeCloseTo(0.02, 10);
  });

  it('the parity check’s views: seed 1, the title and a day at noon, a night at midnight', () => {
    expect(Object.keys(VIEWS)).toEqual(['title', 'day', 'night']);
    for (const v of Object.values(VIEWS)) {
      expect(v.seed).toBe(1);
      expect(Number.isFinite(v.ticks) && Number.isFinite(v.yaw) && Number.isFinite(v.pitch)).toBe(true);
    }
    expect([VIEWS.title.time, VIEWS.day.time, VIEWS.night.time]).toEqual([6000, 6000, 18000]); // noon, noon, midnight
    expect(VIEWS.title.play).toBe(false);
    expect(VIEWS.day.play && VIEWS.night.play).toBe(true);
    expect(VIEWS.night.pitch).toBeGreaterThan(0); // (looking up)
  });

  it('settled: every chunk wanted is in, none in flight or being meshed again', () => {
    const loaded = new Set(['0,0', '1,0']);
    const at = (o) => settledOf({ wanted: ['0,0', '1,0'], has: (k) => loaded.has(k), flying: 0, remeshing: 0, ...o });
    expect(at()).toBe(true);
    expect(at({ flying: 1 })).toBe(false);
    expect(at({ remeshing: 2 })).toBe(false);
    expect(at({ wanted: ['0,0', '1,0', '2,0'] })).toBe(false);
    expect(at({ wanted: [] })).toBe(true);
  });

  it('the render distance follows the tier and steps down with the quality', () => {
    expect([distanceFor('high', 0), distanceFor('mid', 0), distanceFor('low', 0)]).toEqual([10, 6, 4]);
    expect([1, 2, 3, 4].map((l) => distanceFor('high', l))).toEqual([8, 6, 4, 4]);
    expect(distanceFor('mid', 1)).toBe(6);
  });
});

// a pool that holds every ask until the test answers it; with cancels off, a
// cancel comes too late and the worker's answer arrives anyway
const fakePool = ({ cancels = true } = {}) => {
  const held = new Map(); // key → { msg, resolve }
  const asked = [];
  return {
    asked,
    held,
    request(name, msg) {
      held.get(msg.key)?.resolve(null);
      asked.push(msg);
      return new Promise((resolve) => held.set(msg.key, { msg, resolve }));
    },
    cancel(name, key) {
      if (!cancels) return;
      held.get(key)?.resolve(null);
      held.delete(key);
    },
    close: vi.fn(),
    // answer what's held (all, or those keys), as the worker would
    async answer(keys = [...held.keys()]) {
      for (const k of keys) {
        const h = held.get(k);
        if (!h) continue;
        held.delete(k);
        h.resolve({ type: 'chunk', key: k, cx: h.msg.cx, cz: h.msg.cz, ids: new Uint16Array(4), state: new Uint8Array(4), light: new Uint8Array(4), meshes: new Array(16).fill(null) });
      }
      await new Promise((r) => setTimeout(r, 0));
    },
  };
};
const fakeChunks = () => ({ setMesh: vi.fn(), drop: vi.fn() });
const cheb = (k, cx, cz) => {
  const [x, z] = k.split(',').map(Number);
  return Math.max(Math.abs(x - cx), Math.abs(z - cz));
};

describe('Minecraft, the chunks through the runtime’s grid and pool', () => {
  const game = (seed = 1) => {
    const g = newGame({ seed });
    g.renderDistance = 4;
    Object.assign(g.player, { x: 40, y: 0, z: -20 });
    return g;
  };

  it('asks for the same chunks as wantedChunks, nearest first, eight at a time', async () => {
    const pool = fakePool();
    const s = createStream({ workers: pool, chunks: fakeChunks() });
    const g = game();
    s.begin(g);
    s.load();
    expect(pool.asked.map((m) => m.key)).toEqual(wantedChunks(g).slice(0, 8));
    for (let i = 0; i < 20 && pool.held.size; i++) await pool.answer();
    expect(new Set(pool.asked.map((m) => m.key))).toEqual(new Set(wantedChunks(g)));
    expect(pool.asked).toHaveLength(81);
    expect(new Set(g.world.chunks.keys())).toEqual(new Set(wantedChunks(g)));
    expect(s.wanted()).toEqual(wantedChunks(g));
  });

  it('drops the chunks dropFar would, more than two past the distance, with their edits kept', async () => {
    const pool = fakePool();
    const chunks = fakeChunks();
    const s = createStream({ workers: pool, chunks });
    const g = game();
    s.begin(g);
    s.load();
    for (let i = 0; i < 20 && pool.held.size; i++) await pool.answer();
    g.player.x += 16 * 5;
    const [pcx, pcz] = [Math.floor(g.player.x / 16), Math.floor(g.player.z / 16)];
    const expected = [...g.world.chunks.keys()].filter((k) => cheb(k, pcx, pcz) > 6).sort();
    expect(expected.length).toBeGreaterThan(0);
    g.world.chunks.get(expected[0]).edits.set(5, [1, 0]);
    s.load();
    expect(chunks.drop.mock.calls.map(([x, z]) => `${x},${z}`).sort()).toEqual(expected);
    expect([...g.world.chunks.keys()].some((k) => cheb(k, pcx, pcz) > 6)).toBe(false);
    expect(g.edits[expected[0]]).toBeTruthy();
  });

  it('a late answer for an older seed is not added', async () => {
    const pool = fakePool({ cancels: false });
    const chunks = fakeChunks();
    const s = createStream({ workers: pool, chunks });
    s.begin(game(1));
    s.load();
    const late = [...pool.held.keys()];
    const g2 = game(2);
    g2.player.x += 16 * 100; // (elsewhere, so the new world asks for other keys)
    s.begin(g2);
    await pool.answer(late);
    expect(g2.world.chunks.size).toBe(0);
    expect(chunks.setMesh).not.toHaveBeenCalled();
  });

  it('a late answer for a chunk let go of is not added', async () => {
    const pool = fakePool({ cancels: false });
    const chunks = fakeChunks();
    const s = createStream({ workers: pool, chunks });
    const g = game();
    s.begin(g);
    s.load();
    const first = pool.asked[0];
    g.player.x += 16 * 20;
    s.load(); // (it's let go of: too far now)
    await pool.answer([first.key]);
    expect(g.world.chunks.has(first.key)).toBe(false);
    expect(chunks.setMesh.mock.calls.some(([x, z]) => `${x},${z}` === first.key)).toBe(false);
  });

  it('dispose closes the pool’s minecraft workers', () => {
    const pool = fakePool();
    const s = createStream({ workers: pool, chunks: fakeChunks() });
    s.dispose();
    expect(pool.close).toHaveBeenCalledWith('minecraft');
  });
});

describe('Minecraft, worlds in the store', () => {
  const setup = (old) => {
    const mem = new Map();
    const saves = { get: (k, f = null) => (mem.has(k) ? mem.get(k) : f), set: (k, v) => mem.set(k, v), mem };
    if (old !== undefined) mem.set(SAVE, old);
    let t = 0;
    const store = createStore({ indexedDB: new IDBFactory() });
    const registry = createRegistry(store, { now: () => ++t });
    return { saves, store, registry };
  };
  const OLD = { v: 1, seed: -77, time: 5, edits: { '0,0': [1, 2] } };

  it('copies tp-mc to the store once, as My first world, and plays it', async () => {
    const s = setup(OLD);
    const w = await openWorld(s);
    expect(w).toMatchObject({ id: 'minecraft:-77', seed: -77 });
    expect(w.save).toMatchObject({ seed: -77, time: 5, edits: { '0,0': [1, 2] } });
    expect(await s.store.get('saves', 'minecraft:-77')).toEqual(OLD);
    expect((await s.registry.get('minecraft:-77')).name).toBe(FIRST_NAME);
    expect(s.saves.mem.get(SAVE)).toEqual(OLD); // left in place
    // a world played since and then deleted from /worlds does not come back from tp-mc
    await keepWorld({ ...s, id: 'minecraft:-77', data: { ...OLD, time: 99 } });
    await s.registry.remove('minecraft:-77');
    const again = await openWorld({ ...s, random: () => 5 });
    expect(again.id).toBe('minecraft:5');
    expect(await s.registry.get('minecraft:-77')).toBeNull();
  });

  it('a later tp-mc never overwrites the store', async () => {
    const s = setup(OLD);
    await openWorld(s);
    await keepWorld({ ...s, id: 'minecraft:-77', data: { ...OLD, time: 42 } });
    expect((await openWorld(s)).save.time).toBe(42);
  });

  it('with ?world=42 loads minecraft:42, a world of its own', async () => {
    const s = setup(OLD);
    await s.store.set('saves', 'minecraft:42', { v: 1, seed: 42, time: 7 });
    const w = await openWorld({ ...s, want: '42' });
    expect(w).toMatchObject({ id: 'minecraft:42', seed: 42 });
    expect(w.save.time).toBe(7);
    const fresh = await openWorld({ ...s, want: '7' });
    expect(fresh).toMatchObject({ id: 'minecraft:7', seed: 7, save: null });
    expect((await s.registry.list()).map((x) => x.id)).toEqual(['minecraft:7', 'minecraft:42', 'minecraft:-77']);
  });

  it('a word seed is the hashed seed, as the game makes it', async () => {
    const s = setup();
    const w = await openWorld({ ...s, want: 'marble' });
    expect(w.id).toBe(`minecraft:${hashSeed('marble')}`);
  });

  it('with no ?world, continues the world played last; with none, makes and registers one', async () => {
    const s = setup();
    const first = await openWorld({ ...s, random: () => 123 });
    expect(first).toMatchObject({ id: 'minecraft:123', save: null });
    expect((await s.registry.get('minecraft:123')).name).toBe('World 123');
    await openWorld({ ...s, want: '9' });
    expect((await openWorld({ ...s, random: () => 1 })).id).toBe('minecraft:9');
  });

  it('keepWorld writes the store, not localStorage', async () => {
    const s = setup();
    const { id } = await openWorld({ ...s, want: '3' });
    await keepWorld({ ...s, id, data: { v: 1, seed: 3, time: 1 } });
    expect(await s.store.get('saves', id)).toMatchObject({ v: 1, seed: 3, time: 1 });
    expect((await s.registry.get(id)).size).toBeGreaterThan(0);
    expect(s.saves.mem.has(SAVE)).toBe(false);
  });
});

describe('Minecraft, when the store fails', () => {
  const flaky = (store, failKeys) => ({ ...store, read: async (t, k) => (failKeys.has(k) ? { ok: false, value: null } : store.read(t, k)), set: async (t, k, v) => (failKeys.has(`set:${k}`) ? false : store.set(t, k, v)) });
  const base = () => {
    const store = createStore({ indexedDB: new IDBFactory() });
    return { store, registry: createRegistry(store), saves: { get: (k, f = null) => (k === SAVE ? { v: 1, seed: 5, time: 3 } : f) } };
  };

  it('a save that could not be read is not written over: the world plays unsaved', async () => {
    const b = base();
    await b.store.set('saves', 'minecraft:9', { v: 1, seed: 9, time: 50 });
    const w = await openWorld({ ...b, store: flaky(b.store, new Set(['minecraft:9'])), want: '9' });
    expect(w).toEqual({ id: null, seed: 9, save: null });
    expect((await b.store.get('saves', 'minecraft:9')).time).toBe(50);
  });

  it('a tp-mc copy that failed is tried again next time', async () => {
    const b = base();
    await openWorld({ ...b, store: flaky(b.store, new Set(['set:minecraft:5'])), random: () => 1 });
    expect(await b.store.get('saves', 'minecraft:5')).toBeNull();
    await openWorld({ ...b, random: () => 1 });
    expect(await b.store.get('saves', 'minecraft:5')).toEqual({ v: 1, seed: 5, time: 3 });
    expect((await b.registry.get('minecraft:5')).name).toBe(FIRST_NAME);
  });
});

describe('Minecraft, a save as the page goes', () => {
  const setup = () => {
    const mem = new Map();
    const saves = { get: (k, f = null) => (mem.has(k) ? mem.get(k) : f), set: (k, v) => mem.set(k, v), remove: (k) => mem.delete(k), mem };
    let t = 0;
    const store = createStore({ indexedDB: new IDBFactory() });
    return { saves, store, registry: createRegistry(store, { now: () => ++t }) };
  };

  it('a world held as the tab closed is taken back on the next open, when newer than the store', async () => {
    const s = setup();
    const { id } = await openWorld({ ...s, want: '4' });
    await keepWorld({ ...s, id, data: { v: 1, seed: 4, time: 1 }, now: () => 100 });
    holdWorld({ saves: s.saves, id, data: { v: 1, seed: 4, time: 2 }, now: () => 200 });
    const w = await openWorld({ ...s, want: '4' });
    expect(w.save.time).toBe(2);
    expect((await s.store.get('saves', id)).time).toBe(2);
    expect(s.saves.mem.has(HELD)).toBe(false);
  });

  it('a held save older than the store is dropped', async () => {
    const s = setup();
    const { id } = await openWorld({ ...s, want: '4' });
    holdWorld({ saves: s.saves, id, data: { v: 1, seed: 4, time: 2 }, now: () => 100 });
    await keepWorld({ ...s, id, data: { v: 1, seed: 4, time: 3 }, now: () => 200 });
    expect((await openWorld({ ...s, want: '4' })).save.time).toBe(3);
    expect(s.saves.mem.has(HELD)).toBe(false);
  });

  it('a held save for another world waits for that one', async () => {
    const s = setup();
    const { id } = await openWorld({ ...s, want: '4' });
    holdWorld({ saves: s.saves, id, data: { v: 1, seed: 4, time: 9 }, now: () => 100 });
    await openWorld({ ...s, want: '5' });
    expect(s.saves.mem.get(HELD).id).toBe(id);
    expect((await openWorld({ ...s, want: '4' })).save.time).toBe(9);
  });

  it('a world deleted from /worlds is not brought back by a held save or a late autosave', async () => {
    const s = setup();
    const { id } = await openWorld({ ...s, want: '4' });
    await s.registry.remove(id);
    expect(await keepWorld({ ...s, id, data: { v: 1, seed: 4, time: 5 } })).toBe(false);
    expect(await s.store.get('saves', id)).toBeNull();
    holdWorld({ saves: s.saves, id, data: { v: 1, seed: 4, time: 6 }, now: () => 100 });
    const w = await openWorld({ ...s, want: '4' });
    expect(w.save).toBeNull();
    expect(s.saves.mem.has(HELD)).toBe(false);
  });
});
