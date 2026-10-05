// A Nostr event made and checked (NIP-01): its id, the hash of it
// serialised just so, and a Schnorr signature of that id. Plain functions
// of their arguments, so they can run in the page or in signer.worker.js
// (nostr.js sends them there: each takes a few milliseconds).

import { schnorr } from '@noble/secp256k1';

export const KIND = 22742; // ephemeral (20000 to 29999): passed on, never kept

const enc = new TextEncoder();
export const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => Uint8Array.from(s.match(/../g) ?? [], (h) => parseInt(h, 16));
const sha256 = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));

// the id a Nostr event must have (NIP-01): the hash of it, serialised just so
export const eventId = async (ev) => hex(await sha256(JSON.stringify([0, ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content])));

export async function signEvent(secretKey, pubkey, { tags, content, created_at = Math.floor(Date.now() / 1000) }) {
  const ev = { pubkey, created_at, kind: KIND, tags, content };
  const id = await eventId(ev);
  const sig = hex(await schnorr.signAsync(unhex(id), secretKey));
  return { id, ...ev, sig };
}

// is this event what it says it is: its id right, and signed by its pubkey?
export async function checkEvent(ev) {
  try {
    if ((await eventId(ev)) !== ev.id) return false;
    return await schnorr.verifyAsync(unhex(ev.sig), unhex(ev.id), unhex(ev.pubkey));
  } catch {
    return false;
  }
}
