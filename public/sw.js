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

const PREFIX = 'tp-pack-';
const INDEX_TTL = 5 * 60 * 1000;
const POSSIBLE = /^\/(assets|models|textures|audio|hdri|hq|cc0|mc|n64|games|eagler|albuquerque)\//;

let files = null; // pathname → cache name, for every installed pack
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
        const path = new URL(req.url).pathname;
        if (!path.startsWith('/packs/')) map.set(path, name);
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
  const name = files.get(path);
  if (!name) return fetch(request);
  if (!path.startsWith('/assets/')) {
    await readIndex();
    const { slug, v } = versionOf(name);
    if (current && current[slug] !== v) return fetch(request);
  }
  const hit = await (await caches.open(name)).match(request);
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
  if (url.origin !== self.location.origin || url.search || !POSSIBLE.test(url.pathname)) return;
  // once the caches are read, anything not in them is left alone
  if (files && !files.has(url.pathname)) return;
  event.respondWith(answer(req, url.pathname));
});
