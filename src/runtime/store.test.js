import { describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createStore } from './store';

const fakeSaves = () => {
  const m = new Map();
  return { m, get: (k, f = null) => (m.has(k) ? JSON.parse(m.get(k)) : f), set: (k, v) => m.set(k, JSON.stringify(v)), remove: (k) => m.delete(k) };
};

describe('the store', () => {
  it('round-trips a value through IndexedDB', async () => {
    const s = createStore({ indexedDB: new IDBFactory() });
    expect(await s.ready).toBe('idb');
    await s.set('saves', 'minecraft:1', { seed: 1, edits: { a: [1, 2] } });
    expect(await s.get('saves', 'minecraft:1')).toEqual({ seed: 1, edits: { a: [1, 2] } });
    expect(await s.get('saves', 'nothing')).toBeNull();
    await s.remove('saves', 'minecraft:1');
    expect(await s.get('saves', 'minecraft:1')).toBeNull();
  });

  it('keeps what it holds across a second open of the same database', async () => {
    const idb = new IDBFactory();
    await createStore({ indexedDB: idb }).set('worlds', 'minecraft:5', { name: 'five' });
    expect(await createStore({ indexedDB: idb }).get('worlds', 'minecraft:5')).toEqual({ name: 'five' });
  });

  it('lists a table by prefix, sorted by key', async () => {
    const s = createStore({ indexedDB: new IDBFactory() });
    await s.set('worlds', 'minecraft:b', 2);
    await s.set('worlds', 'pocket:a', 3);
    await s.set('worlds', 'minecraft:a', 1);
    expect(await s.list('worlds', { prefix: 'minecraft:' })).toEqual([
      ['minecraft:a', 1],
      ['minecraft:b', 2],
    ]);
    expect((await s.list('worlds')).map(([k]) => k)).toEqual(['minecraft:a', 'minecraft:b', 'pocket:a']);
  });

  it('is memory when there is no IndexedDB, and set then get still works', async () => {
    const s = createStore({ indexedDB: undefined });
    expect(await s.ready).toBe('memory');
    await s.set('worlds', 'x', { a: 1 });
    expect(await s.get('worlds', 'x')).toEqual({ a: 1 });
    expect(await s.list('worlds')).toEqual([['x', { a: 1 }]]);
  });

  it('is memory when the open fails, and never throws', async () => {
    const broken = {
      open() {
        throw new Error('denied');
      },
    };
    const s = createStore({ indexedDB: broken });
    expect(await s.ready).toBe('memory');
    await expect(s.set('saves', 'k', 1)).resolves.toBe(true);
    expect(await s.get('saves', 'k')).toBe(1);
  });

  it('in memory, mirrors saves and worlds to the fallback so they survive a reload', async () => {
    const fallback = fakeSaves();
    const a = createStore({ fallback });
    await a.set('saves', 'minecraft:7', { seed: 7 });
    await a.set('worlds', 'minecraft:7', { name: 'seven' });
    expect(fallback.get('tp-store:minecraft:7')).toEqual({ seed: 7 });
    const b = createStore({ fallback });
    expect(await b.get('saves', 'minecraft:7')).toEqual({ seed: 7 });
    expect(await b.list('worlds')).toEqual([['minecraft:7', { name: 'seven' }]]);
    await b.remove('saves', 'minecraft:7');
    expect(fallback.get('tp-store:minecraft:7')).toBeNull();
    expect(await createStore({ fallback }).get('saves', 'minecraft:7')).toBeNull();
  });

  it('tells a failed read from an empty row', async () => {
    const s = createStore({ indexedDB: new IDBFactory() });
    expect(await s.read('saves', 'none')).toEqual({ ok: true, value: null });
    await s.set('saves', 'k', 1);
    expect(await s.read('saves', 'k')).toEqual({ ok: true, value: 1 });
  });

  it('is memory when the open never answers', async () => {
    vi.useFakeTimers();
    const s = createStore({ indexedDB: { open: () => ({}) } });
    vi.advanceTimersByTime(6000);
    vi.useRealTimers();
    expect(await s.ready).toBe('memory');
  });

  it('round-trips a value of 2 MB', async () => {
    const s = createStore({ indexedDB: new IDBFactory() });
    const big = 'x'.repeat(2 * 1024 * 1024);
    await s.set('blobs', 'big', { big });
    expect((await s.get('blobs', 'big')).big.length).toBe(2 * 1024 * 1024);
  });

  it('refuses an unknown table quietly', async () => {
    const s = createStore({ indexedDB: new IDBFactory() });
    await expect(s.set('nope', 'k', 1)).resolves.toBe(false);
    expect(await s.read('nope', 'k')).toEqual({ ok: false, value: null });
    expect(await s.get('nope', 'k')).toBeNull();
    expect(await s.list('nope')).toEqual([]);
  });
});
