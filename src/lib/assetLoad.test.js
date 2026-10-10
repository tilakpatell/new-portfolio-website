import { afterEach, describe, expect, it } from 'vitest';
import { atPriority, loadBytes, useAssetPool, worldScope } from './assetLoad';

afterEach(() => useAssetPool(null));

// a pool that writes down how it was asked, and answers when told
function recording() {
  const asked = [];
  const pool = {
    fetch: (url, opts) =>
      new Promise((resolve, reject) => {
        asked.push({ url, ...opts, resolve });
        opts.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
  };
  return { asked, pool };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('the site’s loads, by world', () => {
  it('joins every load to the world in front, and stops them all when it ends', async () => {
    const { asked, pool } = recording();
    useAssetPool(pool);
    const world = worldScope('hoth');
    const a = loadBytes('/models/a.glb');
    const b = loadBytes('/models/b.glb');
    await tick();
    expect(asked.every((x) => x.signal === world.signal)).toBe(true);
    world.end();
    await expect(a).rejects.toMatchObject({ name: 'AbortError' });
    await expect(b).rejects.toMatchObject({ name: 'AbortError' });
    // (and after it, a load belongs to no world)
    loadBytes('/models/c.glb');
    await tick();
    expect(asked[2].signal).toBeNull();
  });

  it('a world that ends after the next began leaves the next one’s loads alone', async () => {
    const { asked, pool } = recording();
    useAssetPool(pool);
    const first = worldScope('hoth');
    const next = worldScope('endor');
    loadBytes('/models/tree.glb');
    first.end();
    await tick();
    expect(asked[0].signal).toBe(next.signal);
    expect(next.signal.aborted).toBe(false);
  });

  it('asks at the priority it was given, kept though the fetch is a moment later', async () => {
    const { asked, pool } = recording();
    useAssetPool(pool);
    atPriority(5, () => loadBytes('/models/luke.glb'));
    loadBytes('/models/crate.glb');
    await tick();
    expect(asked.map((x) => [x.url, x.priority])).toEqual([
      ['/models/luke.glb', 5],
      ['/models/crate.glb', 0],
    ]);
  });

  it('counts what its world fetched', async () => {
    const { asked, pool } = recording();
    useAssetPool(pool);
    const world = worldScope('hoth');
    const p = loadBytes('/models/a.glb');
    await tick();
    asked[0].resolve(new ArrayBuffer(12));
    await p;
    expect(world.progress()).toMatchObject({ bytes: 12, files: 1 });
    world.end();
  });
});
