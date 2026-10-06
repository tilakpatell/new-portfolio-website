import { describe, expect, it, vi } from 'vitest';
import { createAssets } from './assets';

const tick = async (n = 3) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

describe('createAssets', () => {
  it('loads each URL once per cache, and counts it', async () => {
    const texture = vi.fn((u) => Promise.resolve({ url: u }));
    const gltf = vi.fn((u) => Promise.resolve({ url: u }));
    const a = createAssets({ loaders: { texture, gltf }, forget: { texture() {}, gltf() {} } });
    const [t1, t2, g] = await Promise.all([a.texture('a.webp'), a.texture('a.webp'), a.gltf('a.glb')]);
    expect(t1).toBe(t2);
    expect(texture).toHaveBeenCalledTimes(1);
    expect(g.url).toBe('a.glb');
    expect(gltf).toHaveBeenCalledWith('a.glb', {});
    expect(a.stats()).toEqual({ cached: 2, inflight: 0, queued: 0 });
  });

  it('prefetch runs by priority, two at a time', async () => {
    const started = [];
    const pending = [];
    const texture = (u) => {
      started.push(u);
      return new Promise((r) => pending.push(r));
    };
    const a = createAssets({ loaders: { texture }, forget: { texture() {} } });
    a.prefetch(['c', 'd'], { priority: 2 });
    a.prefetch(['a', 'b'], { priority: 0 });
    await tick();
    expect(started).toEqual(['a', 'b']);
    expect(a.stats()).toMatchObject({ inflight: 2, queued: 2 });
    pending[0]({});
    await tick();
    expect(started).toEqual(['a', 'b', 'c']);
    pending[1]({});
    pending[2]({});
    await tick();
    expect(started).toEqual(['a', 'b', 'c', 'd']);
    pending[3]({});
    await tick();
    expect(a.stats()).toMatchObject({ inflight: 0, queued: 0, cached: 4 });
    // a URL that is cached already isn't fetched again
    a.prefetch(['a']);
    await tick();
    expect(started.length).toBe(4);
  });

  it('a failed load is forgotten, so it can be tried again', async () => {
    let fail = true;
    const texture = vi.fn(() => (fail ? Promise.reject(new Error('404')) : Promise.resolve({})));
    const a = createAssets({ loaders: { texture }, forget: { texture() {} } });
    await expect(a.texture('x')).rejects.toThrow('404');
    fail = false;
    await expect(a.texture('x')).resolves.toEqual({});
    expect(texture).toHaveBeenCalledTimes(2);
  });

  it('drop forgets what only that owner loaded, keeps what is retained or shared', async () => {
    const forget = { texture: vi.fn(), gltf: vi.fn() };
    const loaders = { texture: () => Promise.resolve({}), gltf: () => Promise.resolve({}) };
    const a = createAssets({ loaders, forget });
    a.owner('earth');
    await a.texture('x');
    a.retain('y');
    await a.texture('y');
    await a.gltf('ship.glb');
    a.owner('galaxy');
    await a.gltf('ship.glb'); // shared by two owners
    await a.texture('z');
    a.drop('earth');
    expect(forget.texture.mock.calls.map((c) => c[0])).toEqual(['x']);
    expect(forget.gltf).not.toHaveBeenCalled();
    expect(a.stats().cached).toBe(3);
    a.release('y'); // nobody has it: forgotten now
    expect(forget.texture.mock.calls.map((c) => c[0])).toEqual(['x', 'y']);
    a.drop('galaxy');
    expect(forget.texture.mock.calls.map((c) => c[0])).toEqual(['x', 'y', 'z']);
    expect(forget.gltf.mock.calls.map((c) => c[0])).toEqual(['ship.glb']);
    expect(a.stats().cached).toBe(0);
    a.owner(null);
  });
});
