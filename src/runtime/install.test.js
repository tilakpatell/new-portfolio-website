import { describe, expect, it, vi } from 'vitest';
import { cacheName, createInstaller } from './install';

// a CacheStorage in memory: what the browser's Cache API does, as far as the installer uses it
function fakeCaches() {
  const all = new Map(); // name → Map(url → { body, headers })
  const cacheOf = (store) => ({
    match: async (url) => {
      const hit = store.get(String(url));
      return hit ? new Response(hit.body, { headers: hit.headers }) : undefined;
    },
    put: async (url, res) => {
      store.set(String(url), { body: new Uint8Array(await res.arrayBuffer()), headers: Object.fromEntries(res.headers) });
    },
    delete: async (url) => store.delete(String(url)),
    keys: async () => [...store.keys()].map((url) => ({ url })),
  });
  return {
    all,
    open: async (name) => {
      if (!all.has(name)) all.set(name, new Map());
      return cacheOf(all.get(name));
    },
    has: async (name) => all.has(name),
    delete: async (name) => all.delete(name),
    keys: async () => [...all.keys()],
  };
}

const file = (url, bytes) => ({ url, bytes, hash: url.length.toString(16).padStart(16, '0') });
const FILES = Array.from({ length: 10 }, (_, i) => file(`/models/earth/m${i}.glb`, 100 * (i + 1)));
const manifestOf = (v, files = FILES) => ({ v, id: '/earth', bytes: files.reduce((s, f) => s + f.bytes, 0), files });

// a site with one pack; `fail` names URLs that answer 404, `v` the version the index says
function site({ v = 'v1', fail = [] } = {}) {
  const state = { v, manifests: { v1: manifestOf('v1'), v2: manifestOf('v2') }, fetched: [] };
  const fetch = vi.fn(async (url) => {
    url = String(url);
    if (url.startsWith('/packs/index.json')) return Response.json({ '/earth': { slug: 'earth', bytes: state.manifests[state.v].bytes, v: state.v } });
    if (url.startsWith('/packs/earth.json')) return Response.json(state.manifests[state.v]);
    state.fetched.push(url);
    if (fail.includes(url)) return new Response('no', { status: 404 });
    const f = FILES.find((x) => x.url === url);
    return f ? new Response(new Uint8Array(f.bytes), { headers: { 'content-type': 'model/gltf-binary' } }) : new Response('no', { status: 404 });
  });
  return { state, fetch };
}

const remember = () => {
  const m = new Map();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v) };
};

const make = (s, caches = fakeCaches(), extra = {}) => ({ caches, inst: createInstaller({ fetch: s.fetch, caches, storage: { persist: vi.fn(async () => true), estimate: async () => ({ usage: 5, quota: 50 }) }, remember: remember(), retryDelay: 0, ...extra }) });

describe('installing a world’s pack', () => {
  it('puts every file in the cache, and the progress ends whole', async () => {
    const s = site();
    const { inst, caches } = make(s);
    expect(await inst.installed('/earth')).toBeNull();
    const seen = [];
    const done = await inst.install('/earth', { onProgress: (p) => seen.push(p) });
    expect(done).toEqual({ v: 'v1', bytes: 5500 });
    const cache = caches.all.get(cacheName('earth', 'v1'));
    for (const f of FILES) expect(cache.has(f.url), f.url).toBe(true);
    const last = seen.at(-1);
    expect(last.done).toBe(last.total);
    expect(last).toMatchObject({ total: 5500, files: 10, left: 0 });
    expect(await inst.installed('/earth')).toEqual({ v: 'v1', bytes: 5500 });
  });

  it('resumes: only the missing files are fetched, and the bar starts at what is cached', async () => {
    const s = site();
    const caches = fakeCaches();
    const cache = await caches.open(cacheName('earth', 'v1'));
    for (const f of FILES.slice(0, 3)) await cache.put(f.url, new Response(new Uint8Array(f.bytes)));
    const { inst } = make(s, caches);
    const seen = [];
    await inst.install('/earth', { onProgress: (p) => seen.push(p) });
    expect(s.state.fetched).toHaveLength(7);
    expect(seen[0].done).toBe(100 + 200 + 300);
    expect(seen[0].left).toBe(7);
  });

  it('sees a new version as not installed, and drops the old cache once the new one is whole', async () => {
    const s = site();
    const { inst, caches } = make(s, undefined, { now: (() => { let t = 0; return () => (t += 60000); })() });
    await inst.install('/earth');
    s.state.v = 'v2';
    expect(await inst.installed('/earth')).toBeNull();
    s.state.fetched = [];
    await inst.install('/earth');
    // the files with the same hash came over from the old cache, not the network
    expect(s.state.fetched).toHaveLength(0);
    expect(await caches.keys()).toEqual([cacheName('earth', 'v2')]);
    expect(await inst.installed('/earth')).toEqual({ v: 'v2', bytes: 5500 });
  });

  it('fails with the URL after three tries, keeping what it had', async () => {
    const s = site({ fail: ['/models/earth/m4.glb'] });
    const { inst, caches } = make(s, undefined, { concurrency: 1 });
    await expect(inst.install('/earth')).rejects.toThrow('/models/earth/m4.glb');
    expect(s.state.fetched.filter((u) => u === '/models/earth/m4.glb')).toHaveLength(3);
    expect(caches.all.get(cacheName('earth', 'v1')).has('/models/earth/m0.glb')).toBe(true);
    expect(await inst.installed('/earth')).toBeNull();
  });

  it('asks for persistent storage once, on the first install', async () => {
    const s = site();
    const persist = vi.fn(async () => true);
    const keep = remember();
    const caches = fakeCaches();
    const inst = createInstaller({ fetch: s.fetch, caches, storage: { persist }, remember: keep, retryDelay: 0 });
    await inst.install('/earth');
    await inst.uninstall('/earth');
    await inst.install('/earth');
    expect(persist).toHaveBeenCalledTimes(1);
    expect(keep.get('tp-worlds-persist')).toBe('asked');
  });

  it('lets a pack go, and lists what is installed', async () => {
    const s = site();
    const notify = vi.fn();
    const { inst, caches } = make(s, undefined, { notify });
    await inst.install('/earth');
    expect(await inst.list()).toEqual([{ to: '/earth', slug: 'earth', v: 'v1', bytes: 5500, current: true }]);
    await inst.uninstall('/earth');
    expect(await caches.keys()).toEqual([]);
    expect(await inst.list()).toEqual([]);
    expect(notify.mock.calls.map((c) => c[0])).toEqual(['install', 'uninstall']);
    expect(await inst.estimate()).toEqual({ used: 5, quota: 50 });
  });

  it('says a pack’s size before it is installed, and nothing where there are no packs', async () => {
    const s = site();
    const { inst } = make(s);
    expect(await inst.pack('/earth')).toEqual({ slug: 'earth', bytes: 5500, v: 'v1' });
    expect(await inst.pack('/nowhere')).toBeNull();
    const none = createInstaller({ fetch: async () => new Response('', { status: 404 }), caches: fakeCaches() });
    expect(await none.pack('/earth')).toBeNull();
    const bare = createInstaller({ fetch: s.fetch, caches: undefined });
    expect(bare.supported).toBe(false);
    expect(await bare.pack('/earth')).toBeNull();
  });
});
