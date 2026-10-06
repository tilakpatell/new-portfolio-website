// The asset cache with an owner: one texture, model or sound per URL (the
// loaders are lib/three/textures', lib/three/gltf's and lib/audio's, which
// cache per URL themselves), a prefetch queue by priority with a few in
// flight at a time, and ownership, so what a module loaded is forgotten
// when the module is dropped unless another module holds it or it was
// retained (the ship models, the crew). The core is pure: `loaders` and
// `forget` are passed in.
//
// createAssets({ loaders, forget, concurrency }) → { texture(url, opts),
//   gltf(url, opts), audio(url), prefetch(urls, { priority, kind }),
//   retain(url), release(url), owner(id), drop(id), stats() }

export function createAssets({ loaders, forget = {}, concurrency = 2 }) {
  const cached = new Map(); // url → { kind, promise, owners: Set, retained }
  let owner = null;
  const queue = []; // { url, kind, opts, priority }
  let inflight = 0;

  const load = (kind, url, opts = {}) => {
    let entry = cached.get(url);
    if (!entry || entry.pending) {
      const loader = loaders[kind];
      if (!loader) return Promise.reject(new Error(`no loader for ${kind}`));
      // (retained before it was asked for: the entry is there, empty)
      entry = entry ? { ...entry, kind, pending: false } : { kind, owners: new Set(), retained: false, promise: null };
      entry.promise = Promise.resolve()
        .then(() => loader(url, opts))
        .catch((err) => {
          if (cached.get(url) === entry) cached.delete(url); // so it can be tried again
          throw err;
        });
      cached.set(url, entry);
    }
    if (owner) entry.owners.add(owner);
    return entry.promise;
  };
  let pumping = false;
  // (after the tick, so prefetches made together are sorted by priority first)
  const pump = () => {
    if (pumping) return;
    pumping = true;
    Promise.resolve().then(run);
  };
  const run = () => {
    pumping = false;
    while (inflight < concurrency && queue.length) {
      const job = queue.shift();
      if (cached.has(job.url)) continue;
      inflight += 1;
      const next = () => {
        inflight -= 1;
        run();
      };
      load(job.kind, job.url, job.opts).then(next, next);
    }
  };
  const letGo = (url, entry) => {
    cached.delete(url);
    forget[entry.kind]?.(url);
  };

  return {
    texture: (url, opts) => load('texture', url, opts),
    gltf: (url, opts) => load('gltf', url, opts),
    audio: (url, opts) => load('audio', url, opts),
    prefetch(urls, { priority = 2, kind = 'texture', opts = {} } = {}) {
      for (const url of urls) {
        if (cached.has(url) || queue.some((j) => j.url === url)) continue;
        const job = { url, kind, opts, priority };
        // in order of priority, after what's already queued at the same one
        let i = queue.length;
        while (i > 0 && queue[i - 1].priority > priority) i--;
        queue.splice(i, 0, job);
      }
      pump();
    },
    retain(url) {
      const entry = cached.get(url);
      if (entry) entry.retained = true;
      else cached.set(url, { kind: null, owners: new Set(), retained: true, promise: null, pending: true });
    },
    // (no longer kept: forgotten now if no module has it)
    release(url) {
      const entry = cached.get(url);
      if (!entry) return;
      entry.retained = false;
      if (entry.pending) cached.delete(url);
      else if (!entry.owners.size) letGo(url, entry);
    },
    owner(id) {
      owner = id;
    },
    drop(id) {
      for (const [url, entry] of [...cached]) {
        entry.owners.delete(id);
        if (!entry.owners.size && !entry.retained && !entry.pending) letGo(url, entry);
      }
    },
    stats: () => ({ cached: [...cached.values()].filter((e) => !e.pending).length, inflight, queued: queue.length }),
  };
}

