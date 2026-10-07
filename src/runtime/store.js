// The store: IndexedDB for what grows (a world's edits, the registry of the
// visitor's worlds, thumbnails), asynchronous and never throwing. Three
// tables: `saves`, `worlds`, `blobs`. Where IndexedDB is missing or will not
// open (a locked-down private window) it is a Map, and `saves` and `worlds`
// rows are mirrored to `fallback` (an rt.saves-like { get, set, remove }) as
// `tp-store:<key>` and `tp-store:worlds:<key>`, so a world survives a reload
// there too. rt.saves stays for the small keys.
//
// createStore({ indexedDB, name, version, fallback }) → { ready →
//   'idb' | 'memory', get(table, key) → value | null, read(table, key) →
//   { ok, value } (ok false: the read failed, not an empty row), set(table,
//   key, value) → true once written, remove(table, key), list(table,
//   { prefix }) → [key, value][] by key }

export const TABLES = ['saves', 'worlds', 'blobs'];
const MIRRORED = { saves: 'tp-store:', worlds: 'tp-store:worlds:' };
const INDEX = 'tp-store:keys';
const OPEN_MS = 5000; // an open that neither succeeds nor fails by then is memory

const done = (req) =>
  new Promise((ok, fail) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });

function openDb(idb, name, version) {
  return new Promise((ok, fail) => {
    const req = idb.open(name, version);
    req.onupgradeneeded = () => {
      for (const t of TABLES) if (!req.result.objectStoreNames.contains(t)) req.result.createObjectStore(t);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close(); // a newer tab upgrades
      ok(db);
    };
    req.onerror = () => fail(req.error);
    req.onblocked = () => fail(new Error('blocked'));
  });
}

export function createStore({ indexedDB = null, name = 'tp-store', version = 1, fallback = null } = {}) {
  const memory = new Map(TABLES.map((t) => [t, new Map()]));
  let db = null;

  // memory mode: what the fallback kept, back into the maps
  const recall = () => {
    if (!fallback) return;
    const keys = fallback.get(INDEX, null) ?? {};
    for (const [table, prefix] of Object.entries(MIRRORED))
      for (const k of keys[table] ?? []) {
        const v = fallback.get(prefix + k, null);
        if (v != null) memory.get(table).set(k, v);
      }
  };
  const mirror = (table, key, value) => {
    if (!fallback || !MIRRORED[table]) return;
    try {
      if (value === undefined) fallback.remove(MIRRORED[table] + key);
      else fallback.set(MIRRORED[table] + key, value);
      const keys = { ...(fallback.get(INDEX, null) ?? {}) };
      keys[table] = [...memory.get(table).keys()];
      fallback.set(INDEX, keys);
    } catch {
      /* the fallback is full or gone: memory still has it */
    }
  };

  const ready = (async () => {
    try {
      if (!indexedDB) throw new Error('no IndexedDB');
      let timer;
      const late = new Promise((_, fail) => {
        timer = setTimeout(() => fail(new Error('slow')), OPEN_MS);
      });
      db = await Promise.race([openDb(indexedDB, name, version), late]).finally(() => clearTimeout(timer));
      return 'idb';
    } catch {
      db = null;
      recall();
      return 'memory';
    }
  })();

  const tx = async (table, mode, act) => {
    const store = db.transaction(table, mode).objectStore(table);
    return done(act(store));
  };
  const known = (table) => memory.has(table);

  return {
    ready,
    async read(table, key) {
      if (!known(table)) return { ok: false, value: null };
      if ((await ready) === 'idb') {
        try {
          return { ok: true, value: (await tx(table, 'readonly', (s) => s.get(key))) ?? null };
        } catch {
          return { ok: false, value: null };
        }
      }
      return { ok: true, value: memory.get(table).get(key) ?? null };
    },
    async get(table, key) {
      return (await this.read(table, key)).value;
    },
    async set(table, key, value) {
      if (!known(table)) return false;
      if ((await ready) === 'idb') {
        try {
          await tx(table, 'readwrite', (s) => s.put(value, key));
          return true;
        } catch {
          return false; // quota or a closed database: this write is lost, the next may land
        }
      }
      memory.get(table).set(key, value);
      mirror(table, key, value);
      return true;
    },
    async remove(table, key) {
      if (!known(table)) return;
      if ((await ready) === 'idb') {
        try {
          await tx(table, 'readwrite', (s) => s.delete(key));
        } catch {
          /* nothing to remove */
        }
        return;
      }
      memory.get(table).delete(key);
      mirror(table, key, undefined);
    },
    async list(table, { prefix = '' } = {}) {
      if (!known(table)) return [];
      if ((await ready) === 'idb') {
        try {
          return await new Promise((ok, fail) => {
            const out = [];
            const req = db.transaction(table, 'readonly').objectStore(table).openCursor();
            req.onsuccess = () => {
              const c = req.result;
              if (!c) return ok(out);
              if (typeof c.key === 'string' && c.key.startsWith(prefix)) out.push([c.key, c.value]);
              c.continue();
            };
            req.onerror = () => fail(req.error);
          });
        } catch {
          return [];
        }
      }
      return [...memory.get(table)]
        .filter(([k]) => String(k).startsWith(prefix))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    },
  };
}
