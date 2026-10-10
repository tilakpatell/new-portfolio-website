import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createStore } from '../../runtime/store';
import { hashSeed } from '../minecraft/rules/noise.js';
import { createRegistry, fileId, worldId, worldUrl } from './registry';

const make = () => {
  let t = 1000;
  const store = createStore({ indexedDB: new IDBFactory() });
  return { store, reg: createRegistry(store, { now: () => (t += 10) }) };
};

describe('the world registry', () => {
  it('makes ids and links from kind and seed', () => {
    expect(worldId('minecraft', 7)).toBe('minecraft:7');
    expect(worldUrl({ kind: 'minecraft', seed: 7 })).toBe('/dot-matrix/minecraft?world=7');
    expect(worldUrl({ kind: 'pocket', seed: 'marble' })).toBe('/universe?seed=marble');
    expect(worldUrl({ kind: 'minecraft', seed: 'a b' })).toBe('/dot-matrix/minecraft?world=a%20b');
  });

  it('adds worlds and lists them by last played, newest first', async () => {
    const { reg } = make();
    const a = await reg.add({ kind: 'minecraft', seed: 1, name: 'One' });
    await reg.add({ kind: 'minecraft', seed: 2, name: 'Two' });
    expect(a).toMatchObject({ id: 'minecraft:1', kind: 'minecraft', seed: 1, name: 'One', route: '/dot-matrix/minecraft?world=1', size: 0, thumb: null });
    expect(a.created).toBe(a.played);
    expect((await reg.list()).map((w) => w.name)).toEqual(['Two', 'One']);
    await reg.touch('minecraft:1', { size: 120 });
    const list = await reg.list();
    expect(list.map((w) => w.name)).toEqual(['One', 'Two']);
    expect(list[0].size).toBe(120);
  });

  it('lists no row of a kind it no longer has (the driven planets)', async () => {
    const { store, reg } = make();
    await reg.add({ kind: 'minecraft', seed: 1, name: 'One' });
    await store.set('worlds', 'planet:7', { id: 'planet:7', kind: 'planet', seed: '7', name: 'Planet 7', played: 5000 });
    expect((await reg.list()).map((w) => w.id)).toEqual(['minecraft:1']);
    await expect(reg.add({ kind: 'planet', seed: '7' })).rejects.toThrow('not a world');
  });

  it('adding a world it has returns that one unchanged', async () => {
    const { reg } = make();
    const a = await reg.add({ kind: 'minecraft', seed: 1, name: 'One' });
    expect(await reg.add({ kind: 'minecraft', seed: 1, name: 'Other' })).toEqual(a);
    expect(await reg.list()).toHaveLength(1);
  });

  it('names a world with no name', async () => {
    const { reg } = make();
    expect((await reg.add({ kind: 'minecraft', seed: 42 })).name).toBe('World 42');
  });

  it('renames', async () => {
    const { reg } = make();
    await reg.add({ kind: 'minecraft', seed: 1, name: 'One' });
    await reg.rename('minecraft:1', '  Castle  ');
    expect((await reg.get('minecraft:1')).name).toBe('Castle');
    await reg.rename('minecraft:1', '   ');
    expect((await reg.get('minecraft:1')).name).toBe('Castle');
    expect(await reg.rename('minecraft:nope', 'x')).toBeNull();
  });

  it('remove drops the world and its save', async () => {
    const { reg, store } = make();
    await reg.add({ kind: 'minecraft', seed: 1, name: 'One' });
    await store.set('saves', 'minecraft:1', { seed: 1 });
    await reg.remove('minecraft:1');
    expect(await reg.get('minecraft:1')).toBeNull();
    expect(await store.get('saves', 'minecraft:1')).toBeNull();
    expect(await reg.list()).toEqual([]);
  });

  it('export then import round-trips a world and its save', async () => {
    const a = make();
    await a.reg.add({ kind: 'minecraft', seed: 9, name: 'Nine' });
    await a.store.set('saves', 'minecraft:9', { v: 1, seed: 9, edits: { '0,0': [1, 2, 3] } });
    const file = JSON.parse(JSON.stringify(await a.reg.exportWorld('minecraft:9')));
    expect(file.world).toMatchObject({ id: 'minecraft:9', name: 'Nine' });

    const b = make();
    const w = await b.reg.importWorld(file);
    expect(w).toMatchObject({ id: 'minecraft:9', kind: 'minecraft', seed: 9, name: 'Nine' });
    expect(await b.store.get('saves', 'minecraft:9')).toEqual({ v: 1, seed: 9, edits: { '0,0': [1, 2, 3] } });
    expect(w.size).toBeGreaterThan(0);
  });

  it('import refuses what is not a world, and takes the id from kind and seed', async () => {
    const { reg } = make();
    await expect(reg.importWorld(null)).rejects.toThrow();
    await expect(reg.importWorld({ world: { kind: 'tank', seed: 1 } })).rejects.toThrow();
    await expect(reg.importWorld({ world: { kind: 'minecraft' } })).rejects.toThrow();
    const w = await reg.importWorld({ world: { id: 'minecraft:evil', kind: 'minecraft', seed: 3, name: 'x'.repeat(200) }, save: null });
    expect(w.id).toBe('minecraft:3');
    expect(w.name.length).toBeLessThanOrEqual(40);
  });

  it('a Minecraft world file with a word seed is kept under the seed the game makes from it', async () => {
    const { reg, store } = make();
    const w = await reg.importWorld({ world: { kind: 'minecraft', seed: 'hello', name: 'Hi' }, save: { v: 1, seed: 'hello' } });
    expect(w.id).toBe(`minecraft:${hashSeed('hello')}`);
    expect(await store.get('saves', w.id)).toEqual({ v: 1, seed: 'hello' });
    expect(fileId({ world: { kind: 'minecraft', seed: '12' } })).toBe('minecraft:12');
    expect(fileId({ world: { kind: 'tank', seed: 1 } })).toBeNull();
  });

  it('export of a world it does not have is null', async () => {
    expect(await make().reg.exportWorld('minecraft:0')).toBeNull();
  });
});
