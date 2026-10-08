import { describe, expect, it } from 'vitest';
import { WORLD_MB } from '../worlds/worlds';
import { IDBFactory } from 'fake-indexeddb';
import { createStore } from '../../runtime/store';
import { createRegistry } from '../worlds/registry';
import mc, { KEYS, distanceFor, ticksFor } from './module';
import { hashSeed } from './rules/noise.js';
import { SAVE } from './rules/save.js';
import { FIRST_NAME, keepWorld, openWorld } from './worlds';

describe('Minecraft, the world module', () => {
  it('the module has id minecraft, glsl, mb 2 matching WORLD_MB', () => {
    expect(mc).toMatchObject({ id: 'minecraft', shading: 'glsl', mb: 2 });
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

  it('the render distance follows the tier and steps down with the quality', () => {
    expect([distanceFor('high', 0), distanceFor('mid', 0), distanceFor('low', 0)]).toEqual([10, 6, 4]);
    expect([1, 2, 3, 4].map((l) => distanceFor('high', l))).toEqual([8, 6, 4, 4]);
    expect(distanceFor('mid', 1)).toBe(6);
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
    expect(await s.store.get('saves', id)).toEqual({ v: 1, seed: 3, time: 1 });
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
