import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createStore } from '../../runtime/store';
import { createRegistry } from '../worlds/registry';
import { UNIVERSE, hash64 } from './gen/seed';
import { pocketName, pocketOf, registerPocket } from './pocket';

describe('pocket universes', () => {
  it('reads ?seed= as the universe seed, and the shared universe without one', () => {
    const p = pocketOf('?seed=marble');
    expect(p).toEqual({ pocket: true, word: 'marble', universe: hash64('marble'), name: 'Marble' });
    expect(pocketOf('').universe).toBe(UNIVERSE);
    expect(pocketOf('').pocket).toBe(false);
    expect(pocketOf('?seed=tilakverse').pocket).toBe(false); // (the shared one's own word)
    expect(pocketOf('?seed=%20').pocket).toBe(false);
    expect(pocketOf('?ship=xwing&seed=Blue%20Moon').word).toBe('blue moon');
    expect(pocketOf(`?seed=${'x'.repeat(80)}`).word).toHaveLength(32);
    expect(pocketName('blue moon')).toBe('Blue Moon');
  });

  it('registers a pocket universe as a world, once, and touches it when it is opened again', async () => {
    const registry = createRegistry(createStore({ indexedDB: new IDBFactory() }), { now: () => 1000 });
    const w = await registerPocket(registry, pocketOf('?seed=marble'));
    expect(w.id).toBe('pocket:marble');
    expect(w.route).toBe('/universe?seed=marble');
    expect(w.name).toBe('Marble');
    await registerPocket(registry, pocketOf('?seed=marble'));
    expect(await registry.list()).toHaveLength(1);
    expect(await registerPocket(registry, pocketOf(''))).toBeNull();
  });
});
