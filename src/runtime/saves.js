// One save store: localStorage and sessionStorage as JSON, never throwing
// (a private window, a full disk), with the keys the worlds use today.
// A registered key carries a shape version: `get` runs `migrate(old,
// oldVersion)` once when what's stored is older (an unversioned value is
// version 0) and writes the result back as { v, data }. `watch` hears this
// tab's sets and another tab's (the storage event).
//
// createSaves({ local, session, win }) → { get, set, remove, session: {
//   get, set, remove }, watch(key, fn) → undo, register({ key, version,
//   migrate }) }

const read = (store, key, fallback) => {
  try {
    const v = store.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};
const write = (store, key, value) => {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};
const drop = (store, key) => {
  try {
    store.removeItem(key);
  } catch {
    /* storage unavailable */
  }
};
const MISSING = Symbol('missing');

export function createSaves({ local, session, win = null } = {}) {
  const versions = new Map(); // key → { version, migrate }
  const watchers = new Map(); // key → Set<fn>
  const tell = (key, value) => {
    for (const fn of watchers.get(key) ?? []) fn(value);
  };
  const onStorage = (e) => {
    if (!e?.key || !watchers.has(e.key)) return;
    let value = null;
    try {
      value = e.newValue == null ? null : JSON.parse(e.newValue);
    } catch {
      value = null;
    }
    if (versions.has(e.key)) value = value && typeof value === 'object' && 'v' in value ? value.data : value;
    tell(e.key, value);
  };
  const plain = (store) => ({
    get: (key, fallback = null) => read(store, key, fallback),
    set: (key, value) => write(store, key, value),
    remove: (key) => drop(store, key),
  });
  return {
    get(key, fallback = null) {
      const reg = versions.get(key);
      if (!reg) return read(local, key, fallback);
      const raw = read(local, key, MISSING);
      if (raw === MISSING) return fallback;
      const wrapped = raw && typeof raw === 'object' && !Array.isArray(raw) && 'v' in raw && 'data' in raw;
      const have = wrapped ? raw.v : 0;
      if (wrapped && have >= reg.version) return raw.data;
      const data = reg.migrate ? reg.migrate(wrapped ? raw.data : raw, have) : wrapped ? raw.data : raw;
      write(local, key, { v: reg.version, data });
      return data;
    },
    set(key, value) {
      const reg = versions.get(key);
      write(local, key, reg ? { v: reg.version, data: value } : value);
      tell(key, value);
    },
    remove(key) {
      drop(local, key);
      tell(key, null);
    },
    session: plain(session),
    watch(key, fn) {
      if (!watchers.size && win) win.addEventListener('storage', onStorage);
      if (!watchers.has(key)) watchers.set(key, new Set());
      watchers.get(key).add(fn);
      return () => {
        watchers.get(key)?.delete(fn);
        if (!watchers.get(key)?.size) watchers.delete(key);
        if (!watchers.size && win) win.removeEventListener('storage', onStorage);
      };
    },
    register({ key, version = 1, migrate = null }) {
      versions.set(key, { version, migrate });
    },
  };
}
