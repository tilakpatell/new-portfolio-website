// public/sw.js itself, run in a bare context with a CacheStorage in memory:
// what it answers from an installed pack, and what it leaves alone.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CODE = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const BASE = 'https://proj.supabase.co/storage/v1/object/public/assets';
const FAR = `${BASE}/aaaaaaaaaaaa/kit/crate.glb`;

function cachesOf(all) {
  return {
    keys: async () => Object.keys(all),
    open: async (name) => ({
      keys: async () => Object.keys(all[name]).map((url) => ({ url })),
      match: async (req) => {
        const body = all[name][typeof req === 'string' ? req : req.url];
        return body === undefined ? undefined : new Response(body);
      },
    }),
  };
}

// the worker, started with or without a base, and its caches read
async function worker(base) {
  const on = {};
  const where = `https://site.test/sw.js${base ? `?base=${encodeURIComponent(base)}` : ''}`;
  const self = { location: new URL(where), addEventListener: (type, fn) => (on[type] = fn), skipWaiting() {}, clients: { claim() {} } };
  const caches = cachesOf({
    'tp-pack-kit-v1': { [FAR]: 'crate from the pack', 'https://site.test/kit/house.glb': 'house from the pack', 'https://site.test/packs/kit.json?v=v1': '{}' },
  });
  const fetch = vi.fn(async (req) => {
    if (req === '/packs/index.json') return Response.json({ '/kit': { slug: 'kit', bytes: 1, v: 'v1' } });
    return new Response('from the network');
  });
  vm.runInNewContext(CODE, { self, caches, fetch, URL, Response, Map, Date, Promise, Object, console });
  const waits = [];
  on.message({ data: { type: 'tp-packs' }, waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  // what the page's fetch of a URL gets: the worker's answer, or 'left alone'
  const ask = async (url) => {
    let answer = null;
    on.fetch({ request: new Request(url), respondWith: (p) => (answer = p) });
    return answer ? (await answer).text() : 'left alone';
  };
  return { ask, fetch };
}

describe('the service worker and the asset bucket', () => {
  it('answers an installed pack’s bucket file from its cache', async () => {
    const { ask } = await worker(BASE);
    expect(await ask(FAR)).toBe('crate from the pack');
  });

  it('answers the site’s path of that file from the same copy, after the visit fell back', async () => {
    const { ask } = await worker(BASE);
    expect(await ask('https://site.test/kit/crate.glb')).toBe('crate from the pack');
    expect(await ask('https://site.test/kit/house.glb')).toBe('house from the pack');
  });

  it('leaves alone every other bucket file, the project’s API and any other origin', async () => {
    const { ask, fetch } = await worker(BASE);
    expect(await ask(`${BASE}/bbbbbbbbbbbb/kit/other.glb`)).toBe('left alone');
    expect(await ask('https://proj.supabase.co/rest/v1/rpc/get_entities_in_bounding_box')).toBe('left alone');
    expect(await ask(`${FAR}?x=1`)).toBe('left alone');
    expect(await ask('https://elsewhere.test/kit/crate.glb')).toBe('left alone');
    expect(fetch.mock.calls.filter(([r]) => r !== '/packs/index.json')).toEqual([]);
  });

  it('without a base, touches no other origin, the bucket included', async () => {
    const { ask } = await worker('');
    expect(await ask(FAR)).toBe('left alone');
    expect(await ask('https://site.test/kit/house.glb')).toBe('house from the pack');
  });
});
