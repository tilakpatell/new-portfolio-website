// The site's service worker, and all it does: a file of an installed world's
// pack (src/runtime/install.js put it in a tp-pack-<slug>-<v> cache) is
// answered from that cache, the network after. Nothing else is touched: no
// precache, no pages (navigations), no other origin, no sockets, no ranges,
// nothing the page asked to skip the cache for (the installer's own fetches),
// nothing under /packs/. A cache of a version the build no longer lists
// (/packs/index.json) is not served from, so a file changed on deploy is
// fetched new; a hashed bundle file (/assets/) never changes, so it is served
// from any. Unregistering it leaves the site as it was. Registered by
// src/lib/sw.js only once a world is installed.
//
// The asset bucket (VITE_ASSET_BASE, given in this script's URL as ?base=):
// a pack's file from there is cached under its bucket URL, and answered for
// that URL alone of the bucket's, never the project's API; its path is a
// content hash, so any cache holding it is current. The site's own path of
// that file (the page asks it after the bucket failed once) is answered from
// the same copy, under the pack's version like any other.

const PREFIX = 'tp-pack-';
const INDEX_TTL = 5 * 60 * 1000;
const POSSIBLE = /^\/(assets|models|textures|audio|hdri|hq|cc0|mc|n64|games|eagler|albuquerque|kit)\//;

const BASE = (new URL(self.location.href).searchParams.get('base') || '').replace(/\/+$/, '');

let files = null; // pathname, or a bucket URL → { name: cache name, key: what it is cached under }
let reading = null;
let current = null; // slug → v, from the build's index (null: not known yet)
let indexAt = 0;
let indexing = null;

const versionOf = (name) => {
  const rest = name.slice(PREFIX.length);
  const cut = rest.lastIndexOf('-');
  return { slug: rest.slice(0, cut), v: rest.slice(cut + 1) };
};

function readCaches() {
  reading ??= (async () => {
    const map = new Map();
    for (const name of (await caches.keys()).filter((n) => n.startsWith(PREFIX))) {
      for (const req of await (await caches.open(name)).keys()) {
        const url = new URL(req.url);
        if (BASE && req.url.startsWith(`${BASE}/`)) {
          map.set(req.url, { name, key: req.url, far: true });
          // (its path on the site: what follows the hash)
          const local = `/${req.url.slice(BASE.length + 1).replace(/^[^/]+\//, '')}`;
          if (!map.has(local)) map.set(local, { name, key: req.url });
        } else if (url.origin === self.location.origin && !url.pathname.startsWith('/packs/')) map.set(url.pathname, { name, key: null });
      }
    }
    files = map;
  })().finally(() => {
    reading = null;
  });
  return reading;
}

function readIndex() {
  if (indexing) return indexing;
  if (current && Date.now() - indexAt < INDEX_TTL) return Promise.resolve();
  indexing = fetch('/packs/index.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((index) => {
      if (!index) return;
      current = Object.fromEntries(Object.values(index).map((e) => [e.slug, e.v]));
      indexAt = Date.now();
    })
    .catch(() => {}) // (offline: what is installed is what there is)
    .finally(() => {
      indexing = null;
    });
  return indexing;
}

async function answer(request, path) {
  if (!files) await readCaches();
  const got = files.get(path);
  if (!got) return fetch(request);
  if (!got.far && !path.startsWith('/assets/')) {
    await readIndex();
    const { slug, v } = versionOf(got.name);
    if (current && current[slug] !== v) return fetch(request);
  }
  const hit = await (await caches.open(got.name)).match(got.key ?? request);
  return hit ?? fetch(request);
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// the installer says the caches changed
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'tp-packs') return;
  current = null;
  event.waitUntil?.(Promise.all([readCaches(), readIndex()]));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.mode === 'navigate' || req.headers.has('range') || req.cache === 'no-store' || req.cache === 'no-cache' || req.cache === 'reload') return;
  const url = new URL(req.url);
  if (url.search) return;
  const key = url.origin === self.location.origin ? (POSSIBLE.test(url.pathname) ? url.pathname : null) : BASE && req.url.startsWith(`${BASE}/`) ? req.url : null;
  if (!key) return;
  // once the caches are read, anything not in them is left alone
  if (files && !files.has(key)) return;
  event.respondWith(answer(req, key));
});
