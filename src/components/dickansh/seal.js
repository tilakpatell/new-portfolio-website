// The secret world's exhibits are sealed with its password: AES-GCM under a
// key stretched from the password (PBKDF2, SHA-256), so what's in them is
// not in the site's code for anyone to read, only ciphertext. A wrong
// password doesn't decrypt; that is the whole check. The password is read
// loosely: case, apostrophes and extra spaces don't matter.
//
// scripts/dickansh-seal.mjs seals a new set of exhibits (the plain text
// stays out of the repo).

const ITER = 250000;
// where the password is kept for the visit once it's opened the seal
// (sessionStorage), so the trip from the universe's phone doesn't ask twice
export const KEPT = 'tp-dickansh';
const enc = (s) => new TextEncoder().encode(s);
const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const normalize = (s) =>
  String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’‘`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

async function keyFor(password, salt, iterations) {
  const { subtle } = globalThis.crypto;
  const base = await subtle.importKey('raw', enc(normalize(password)), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(value, password) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(password, salt, ITER);
  const data = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc(JSON.stringify(value)));
  return { v: 1, iter: ITER, salt: toB64(salt), iv: toB64(iv), data: toB64(data) };
}

// the exhibits, or null for a wrong password (or a browser without WebCrypto)
export async function unseal(box, password) {
  if (!globalThis.crypto?.subtle || !box?.data) return null;
  try {
    const key = await keyFor(password, fromB64(box.salt), box.iter);
    const plain = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
}
