// A floor bake kept between visits. The bake is the slow part of landing in
// a world, and for the same place, sun, tier and casters it comes out the
// same, so its mask is kept in IndexedDB and read back instead.
//
// Everything here fails quietly: no IndexedDB (Node, some private windows),
// a quota that's full, a blocked database all resolve null, and the caller
// bakes as it always did.

const DB = 'tp-bakes';
const STORE = 'masks';

// FNV-1a over a string, as 8 hex digits
function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const r = (n, step) => Math.round(n / step) * step;

// What stands in the way of the light: each mesh's vertex count and where it
// is in the world (to a decimetre), so anything added, swapped or moved gives
// another key.
function describeCasters(casters) {
  const parts = [];
  for (const root of casters ?? []) {
    root.updateMatrixWorld?.(true);
    root.traverse?.((o) => {
      if (!o.isMesh || !o.geometry) return;
      const n = o.geometry.attributes?.position?.count ?? 0;
      const e = o.matrixWorld?.elements;
      const p = e ? `${r(e[12], 0.1).toFixed(1)},${r(e[13], 0.1).toFixed(1)},${r(e[14], 0.1).toFixed(1)}` : '0,0,0';
      parts.push(`${n}@${p}`);
    });
  }
  return parts;
}

// The key for a bake, or null where the bake can't be told apart from
// another (no world or place named): then nothing is cached.
export function bakeKey({ world, place, sun, tier, casters } = {}) {
  if (!world || !sun) return null;
  const s = `${r(sun.x, 0.01).toFixed(2)},${r(sun.y, 0.01).toFixed(2)},${r(sun.z, 0.01).toFixed(2)}`;
  return `${world}/${place ?? ''}/${tier ?? ''}/${s}/${fnv(describeCasters(casters).join('|'))}`;
}

function open() {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        try {
          req.result.createObjectStore(STORE);
        } catch {
          // (already there)
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// { width, height, data } as it was put, or null
export async function getBake(key) {
  if (!key) return null;
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = req.result;
        db.close();
        resolve(v && v.data && v.width && v.height ? v : null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

// keeps the mask; resolves true when it was written, false where it couldn't be
export async function putBake(key, { width, height, data } = {}) {
  if (!key || !data) return false;
  const db = await open();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ width, height, data }, key);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}
