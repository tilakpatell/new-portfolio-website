// A squad's text, sealed so the relays carry only ciphertext: AES-GCM under a
// key drawn from the squad's secret (HKDF with SHA-256, the sid's bytes, info
// 'tp-squad-chat'), a fresh 12-byte nonce for each line, the browser's own
// WebCrypto doing the work. The key is made unextractable, so it never
// leaves the page; anyone who has the sid can make it (the sid is the
// squad's door: squad.js hears only those seated).
//
// sealKey(sid) → Promise of the key; seal(key, text) → Promise of base64 of
// the nonce and the ciphertext (a text that would seal past SEALED_MAX is cut
// to what fits, a whole character at a time); unseal(key, sealed) → Promise
// of the text, or null for anything that isn't one sealed under this key
// (refused unopened past SEALED_MAX characters).

export const SEALED_MAX = 1024; // base64 characters of a sealed line, at most
const NONCE = 12;
const TAG = 16; // (AES-GCM's, at the end of the ciphertext)
const ROOM = (SEALED_MAX / 4) * 3 - NONCE - TAG; // bytes of text that fit
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

export async function sealKey(sid) {
  const secret = await crypto.subtle.importKey('raw', enc.encode(sid), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode('tp-squad-chat') }, secret, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const toBase64 = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
// as much of the text as fits in ROOM bytes, whole characters only
const fit = (text) => {
  let n = 0;
  let out = '';
  for (const ch of text) {
    n += enc.encode(ch).length;
    if (n > ROOM) break;
    out += ch;
  }
  return out;
};

export async function seal(key, text) {
  const bytes = enc.encode(fit(text));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, bytes));
  const out = new Uint8Array(NONCE + sealed.length);
  out.set(nonce);
  out.set(sealed, NONCE);
  return toBase64(out);
}

export async function unseal(key, sealed) {
  if (typeof sealed !== 'string' || sealed.length > SEALED_MAX || sealed.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(sealed)) return null;
  try {
    const bytes = Uint8Array.from(atob(sealed), (c) => c.charCodeAt(0));
    if (bytes.length <= NONCE + TAG) return null;
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, NONCE) }, key, bytes.slice(NONCE));
    return dec.decode(plain);
  } catch {
    return null;
  }
}
