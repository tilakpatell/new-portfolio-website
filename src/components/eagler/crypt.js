// Minecraft (Eaglercraft), the lock on the game files. The site is static
// (GitHub Pages), so nothing on a server can keep the game to those who know
// the password: instead the files are sealed with it. The password is
// stretched once (PBKDF2, SHA-256, many rounds, a salt in the manifest) into
// 32 bytes, and those are expanded (HKDF) into two keys: one seals with
// AES-GCM, the other picks each file's nonce (an HMAC of what it holds), so
// the same file always seals to the same bytes and a rebuild adds nothing to
// git. (One PBKDF2 block, not two: a guesser can't do less work than the
// page.) Without the password the files are noise; the password itself is
// never written anywhere.
//
// A sealed file is 'TPEG', a version byte (2), the 12-byte nonce, then the
// ciphertext with its tag. The same code runs in the page and in
// scripts/eagler-pack.mjs (Node's WebCrypto).

export const MAGIC = [0x54, 0x50, 0x45, 0x47]; // 'TPEG'
const VERSION = 2;
export const ITERATIONS = 600000;
// the line sealed into the manifest: opening it says the password is right before 20 MB are fetched
export const CHECK = 'tilakpatell.com/minecraft';

const subtle = () => globalThis.crypto.subtle;
const enc = (s) => new TextEncoder().encode(s);

async function expand(raw) {
  if (raw.length !== 32) throw new Error('a key is 32 bytes');
  const ikm = await subtle().importKey('raw', raw, 'HKDF', false, ['deriveKey']);
  const hkdf = (info) => ({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc(info) });
  const aes = await subtle().deriveKey(hkdf('tpeg aes'), ikm, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const mac = await subtle().deriveKey(hkdf('tpeg nonce'), ikm, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']);
  return { aes, mac, raw };
}

// the password stretched into the two keys (and the 32 stretched bytes, to remember on this device)
export async function deriveKeys(password, salt, iterations = ITERATIONS) {
  const base = await subtle().importKey('raw', enc(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 256);
  return expand(new Uint8Array(bits));
}
export const keysFromRaw = (raw) => expand(new Uint8Array(raw));

export async function seal(keys, bytes) {
  const iv = new Uint8Array(await subtle().sign('HMAC', keys.mac, bytes)).slice(0, 12);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, keys.aes, bytes));
  const out = new Uint8Array(5 + 12 + ct.length);
  out.set(MAGIC, 0);
  out[4] = VERSION;
  out.set(iv, 5);
  out.set(ct, 17);
  return out;
}

// what was sealed; throws on the wrong key (the tag doesn't match) or a file that isn't one
export async function open(keys, sealed) {
  if (MAGIC.some((b, i) => sealed[i] !== b) || sealed[4] !== VERSION) throw new Error('not a sealed game file (or one of another version)');
  const iv = sealed.subarray(5, 17);
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv }, keys.aes, sealed.subarray(17)));
}

export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const fromBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
