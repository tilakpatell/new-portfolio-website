// Who you are online: the key every message of yours is signed with
// (nostr.js's visitKeys asks here), the same in every room of the visit,
// and kept in this browser (localStorage, through runtime/saves.js), so
// allies know you next time and a block of yours still holds. Nothing about
// you is kept anywhere else.
//
// “Remember me on this browser” is on unless you've said otherwise
// (`tp-pilot-remember` is 'off' then): off, the kept key is removed and
// each visit after flies on a key of its own, as every visit once did (the
// visit you're on carries on as it is). Storage that can't be had (a
// private window, a full disk) is the same: a key for the visit. renew() is
// “New identity”: a fresh key, kept in the old one's place, so your allies
// won't know you.
//
// Two tabs of one browser mustn't sign as the same pilot (each would take
// the other's messages for its own). So a tab first holds a roll-call on a
// BroadcastChannel ('tp-pilot'): it asks who's there ({ t: 'who', id }),
// and a tab already flying on the kept key answers ({ t: 'here', id: the
// asker's }) within ROLL_MS. Answered, this tab is a guest: it flies on a
// key of its own for the visit, never kept. Two tabs asking at once: the one
// whose id sorts first takes the key, and the other's the guest. Nothing
// signs till the roll-call's over (`ready`: nostr.js waits for it); keys()
// asked for sooner settles it there and then, this tab taking the key.
//
// createIdentity({ saves, keygen, channel, wait, later }) → { keys() → {
//   secretKey, publicKey }, remember, setRemember(yes), renew() → keys,
//   guest, ready }. keygen() makes a pair; keygen(secretKey) gives a kept
//   secret's (and throws if it isn't one). channel is BroadcastChannel-
//   shaped, or null: no other tabs to ask.

export const KEY = 'tp-pilot-key'; // the secret, as 64 hex digits
export const REMEMBER_KEY = 'tp-pilot-remember'; // 'off' once you've said not to
export const ROLL_MS = 300; // how long a tab waits for one already online to answer

const HEX = /^[0-9a-f]{64}$/i;
const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (s) => Uint8Array.from(s.match(/../g), (h) => parseInt(h, 16));

export function createIdentity({ saves = null, keygen, channel = null, wait = ROLL_MS, later = (fn, ms) => setTimeout(fn, ms) }) {
  // (storage that throws is storage that isn't there)
  const get = (k) => {
    try {
      return saves?.get(k, null) ?? null;
    } catch {
      return null;
    }
  };
  const set = (k, v) => {
    try {
      saves?.set(k, v);
    } catch {
      /* not kept */
    }
  };
  const drop = (k) => {
    try {
      saves?.remove(k);
    } catch {
      /* not kept */
    }
  };

  const id = Math.random().toString(36).slice(2); // this tab's, for the roll-call
  let remember = get(REMEMBER_KEY) !== 'off';
  let guest = false;
  let settled = false;
  let pair = null; // the visit's keys, once asked for

  // the kept key, or one made and kept in place of one that isn't any good
  const kept = () => {
    const raw = get(KEY);
    if (typeof raw === 'string' && HEX.test(raw)) {
      try {
        return keygen(fromHex(raw));
      } catch {
        /* not a key: a new one in its place */
      }
    }
    const fresh = keygen();
    set(KEY, toHex(fresh.secretKey));
    return fresh;
  };

  let readyNow = () => {};
  const ready = new Promise((resolve) => (readyNow = resolve));
  const settle = (asGuest) => {
    if (settled) return;
    settled = true;
    guest = asGuest;
    readyNow();
  };
  // flying on the kept key (or about to): the tab that answers a roll-call
  const holds = () => settled && !guest && remember;

  if (channel) {
    channel.onmessage = (e) => {
      const m = e?.data;
      if (!m || typeof m !== 'object' || typeof m.id !== 'string') return;
      if (m.t === 'who' && m.id !== id) {
        if (holds() || (!settled && remember && id < m.id)) channel.postMessage({ t: 'here', id: m.id });
        else if (!settled && remember) settle(true); // (asked at the same moment, and theirs sorts first)
      } else if (m.t === 'here' && m.id === id) settle(true);
    };
  }
  // (without the kept key, there's nothing two tabs could share)
  if (!channel || !remember) settle(false);
  else {
    try {
      channel.postMessage({ t: 'who', id });
      later(() => settle(false), wait);
    } catch {
      settle(false);
    }
  }

  return {
    get remember() {
      return remember;
    },
    get guest() {
      return guest;
    },
    ready,
    keys() {
      settle(false);
      pair ??= guest || !remember ? keygen() : kept();
      return pair;
    },
    setRemember(yes) {
      remember = Boolean(yes);
      if (!remember) {
        set(REMEMBER_KEY, 'off');
        drop(KEY);
        return;
      }
      drop(REMEMBER_KEY);
      // this visit's key is the one kept from now on (a guest's never is)
      if (!guest) set(KEY, toHex((pair ??= kept()).secretKey));
    },
    renew() {
      settle(false);
      pair = keygen();
      if (remember && !guest) set(KEY, toHex(pair.secretKey));
      return pair;
    },
  };
}
