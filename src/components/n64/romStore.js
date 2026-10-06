// The game the giant N64 plays: a ROM file the player gives it from their
// own device (the site hosts no game), kept in their browser (IndexedDB) so
// it's there the next time, until they say to forget it.
//
// romInfo(bytes) → { format, title, mario, size } or null: what the file is,
//   from its header, in any of the three byte orders dumps come in (.z64 big
//   endian, .v64 byte-swapped, .n64 little endian)
// toZ64(bytes) → the same ROM in .z64 order
// saveRom(bytes, name), loadRom() → { bytes, name, info } or null, forgetRom()

const MAGIC = {
  z64: [0x80, 0x37, 0x12, 0x40],
  v64: [0x37, 0x80, 0x40, 0x12],
  n64: [0x40, 0x12, 0x37, 0x80],
};
const HEADER = 0x40;

const formatOf = (b) => Object.keys(MAGIC).find((k) => MAGIC[k].every((v, i) => b[i] === v)) ?? null;

export function toZ64(bytes) {
  const format = formatOf(bytes);
  if (format === 'z64' || !format) return bytes;
  const out = new Uint8Array(bytes.length);
  if (format === 'v64') for (let i = 0; i < bytes.length; i++) out[i] = bytes[i ^ 1];
  else for (let i = 0; i < bytes.length; i++) out[i] = bytes[(i & ~3) + 3 - (i & 3)];
  return out;
}

export function romInfo(bytes) {
  if (!bytes || bytes.length < HEADER) return null;
  const format = formatOf(bytes);
  if (!format) return null;
  const head = toZ64(bytes.subarray(0, HEADER));
  const title = String.fromCharCode(...head.subarray(0x20, 0x34))
    .replace(/[^\x20-\x7e]/g, '')
    .trim();
  return { format, title, mario: /SUPER MARIO 64/i.test(title), size: bytes.length };
}

// ── kept in the browser ──
const DB = 'tp-n64';
const STORE = 'roms';
const KEY = 'cart';

function open() {
  return new Promise((done, fail) => {
    if (typeof indexedDB === 'undefined') return fail(new Error('no IndexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => done(req.result);
    req.onerror = () => fail(req.error);
  });
}

async function run(mode, act) {
  const db = await open();
  try {
    return await new Promise((done, fail) => {
      const tx = db.transaction(STORE, mode);
      const req = act(tx.objectStore(STORE));
      tx.oncomplete = () => done(req?.result);
      tx.onerror = () => fail(tx.error);
      tx.onabort = () => fail(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function saveRom(bytes, name) {
  const info = romInfo(bytes);
  if (!info) throw new Error('not an N64 ROM');
  await run('readwrite', (s) => s.put({ bytes, name, info }, KEY));
  return info;
}

export async function loadRom() {
  try {
    const got = await run('readonly', (s) => s.get(KEY));
    return got?.bytes ? got : null;
  } catch {
    return null;
  }
}

export async function forgetRom() {
  try {
    await run('readwrite', (s) => s.delete(KEY));
  } catch {
    // (nothing kept, or no storage: nothing to forget)
  }
}
