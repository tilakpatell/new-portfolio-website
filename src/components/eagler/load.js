// Minecraft (Eaglercraft), what the page does with the sealed files: the
// password tried against the manifest's check (the keys, or null), a client
// fetched with its progress, opened and un-gzipped back into its page.

import { CHECK, deriveKeys, fromBase64, keysFromRaw, open } from './crypt.js';

export const EAGLER = `${import.meta.env?.BASE_URL ?? '/'}eagler/`;
const KEEP = 'tp-mc-key';

// The game runs on an origin of its own (public/eagler-player/, published to
// tilakpatell.github.io/minecraft-player), so its code can't reach this
// site's storage. In development the other loopback name is another origin.
// (The file named: a dev server answers a folder with the app's own page.)
export const PLAYER = 'https://tilakpatell.github.io/minecraft-player/index.html';
export function playerUrl(loc = globalThis.location) {
  if (loc?.hostname === '127.0.0.1') return `http://localhost:${loc.port}/eagler-player/index.html`;
  if (loc?.hostname === 'localhost') return `http://127.0.0.1:${loc.port}/eagler-player/index.html`;
  return PLAYER;
}

export async function checkPassword(manifest, password) {
  const keys = await deriveKeys(password, fromBase64(manifest.kdf.salt), manifest.kdf.iterations);
  return (await opens(manifest, keys)) ? keys : null;
}
async function opens(manifest, keys) {
  try {
    return new TextDecoder().decode(await open(keys, fromBase64(manifest.check))) === CHECK;
  } catch {
    return false;
  }
}

// the key kept on this device (or for this visit), if it still opens the manifest
export async function rememberedKeys(manifest) {
  for (const store of [() => localStorage, () => sessionStorage]) {
    try {
      const b64 = store().getItem(KEEP);
      if (!b64) continue;
      const keys = await keysFromRaw(fromBase64(b64));
      if (await opens(manifest, keys)) return keys;
      store().removeItem(KEEP);
    } catch {
      /* storage blocked: ask for the password */
    }
  }
  return null;
}
export function remember(keys, b64, onDevice) {
  try {
    (onDevice ? localStorage : sessionStorage).setItem(KEEP, b64);
  } catch {
    /* storage blocked: it's asked for again next time */
  }
}
export function forget() {
  for (const s of [() => localStorage, () => sessionStorage])
    try {
      s().removeItem(KEEP);
    } catch {
      /* nothing kept */
    }
}

// a sealed client back into its page's text
export async function unpack(keys, sealed) {
  const gz = await open(keys, sealed);
  const stream = new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

// the manifest, or an error that says what went wrong (a 404 page isn't JSON)
export async function fetchManifest() {
  const res = await fetch(`${EAGLER}manifest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`the game files aren't there (${res.status})`);
  return res.json();
}

// the sealed file, reporting how much has come (0 to 1); `signal` stops it
export async function fetchSealed(url, expected, onProgress, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok || !res.body) throw new Error(`${url}: ${res.status}`);
  const total = Number(res.headers.get('content-length')) || expected || 0;
  const reader = res.body.getReader();
  const parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    if (total) onProgress?.(Math.min(1, got / total));
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
