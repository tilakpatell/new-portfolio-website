import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSaves } from '../../../runtime/saves';
import { KEY, REMEMBER_KEY, ROLL_MS, createIdentity } from './identity';

// a browser's storage in memory (`broken`: one that throws at everything)
const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const broken = () => ({
  getItem() {
    throw new Error('denied');
  },
  setItem() {
    throw new Error('denied');
  },
  removeItem() {
    throw new Error('denied');
  },
});
const savesOn = (local) => createSaves({ local, session: memory() });
// keys as nostr.js makes them: a fresh pair, or the pair of a secret given (throwing if it isn't one)
const keygen = (secret = crypto.getRandomValues(new Uint8Array(32))) => {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new Error('not a key');
  return { secretKey: secret, publicKey: secret.map((b) => b ^ 0xff) };
};
const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
// a browser's tabs: what one posts, every other gets, a moment later
const tabs = () => {
  const open = new Set();
  return () => {
    const c = {
      onmessage: null,
      postMessage(data) {
        for (const o of open) if (o !== c) setTimeout(() => o.onmessage?.({ data: JSON.parse(JSON.stringify(data)) }), 0);
      },
      close: () => open.delete(c),
    };
    open.add(c);
    return c;
  };
};
// a tab's identity, once its roll-call's over
const settled = async (opts) => {
  const me = createIdentity({ keygen, ...opts });
  vi.advanceTimersByTime(ROLL_MS + 10);
  await me.ready;
  return me;
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createIdentity', () => {
  it('the key is kept and read back', async () => {
    const saves = savesOn(memory());
    const first = await settled({ saves });
    expect(first.remember).toBe(true);
    expect(first.guest).toBe(false);
    const keys = first.keys();
    expect(first.keys()).toBe(keys); // (the same for the whole visit)
    expect(saves.get(KEY)).toBe(hex(keys.secretKey));
    // the next visit: the same pilot
    const next = await settled({ saves });
    expect(hex(next.keys().secretKey)).toBe(hex(keys.secretKey));
    expect(hex(next.keys().publicKey)).toBe(hex(keys.publicKey));
  });

  it('the switch off gives a visit’s key and removes the stored one', async () => {
    const saves = savesOn(memory());
    const me = await settled({ saves });
    const keys = me.keys();
    me.setRemember(false);
    expect(me.remember).toBe(false);
    expect(saves.get(KEY)).toBeNull();
    expect(saves.get(REMEMBER_KEY)).toBe('off');
    expect(me.keys()).toBe(keys); // (this visit flies on as it was)
    // and every visit after has a key of its own, kept nowhere
    const next = await settled({ saves });
    const after = await settled({ saves });
    expect(next.remember).toBe(false);
    expect(hex(next.keys().secretKey)).not.toBe(hex(keys.secretKey));
    expect(hex(after.keys().secretKey)).not.toBe(hex(next.keys().secretKey));
    expect(saves.get(KEY)).toBeNull();
    // on again: this visit's key is the one kept
    after.setRemember(true);
    expect(saves.get(REMEMBER_KEY)).toBeNull();
    expect(saves.get(KEY)).toBe(hex(after.keys().secretKey));
  });

  it('renew makes a different key and stores it', async () => {
    const saves = savesOn(memory());
    const me = await settled({ saves });
    const was = me.keys();
    const now = me.renew();
    expect(hex(now.secretKey)).not.toBe(hex(was.secretKey));
    expect(me.keys()).toBe(now);
    expect(saves.get(KEY)).toBe(hex(now.secretKey));
    const next = await settled({ saves });
    expect(hex(next.keys().secretKey)).toBe(hex(now.secretKey));
  });

  it('storage that throws gives a visit’s key', async () => {
    const local = broken();
    const one = await settled({ saves: savesOn(local) });
    const two = await settled({ saves: savesOn(local) });
    expect(one.keys().secretKey).toHaveLength(32);
    expect(hex(two.keys().secretKey)).not.toBe(hex(one.keys().secretKey));
    expect(() => one.setRemember(false)).not.toThrow();
    expect(() => one.renew()).not.toThrow();
    // and no storage at all is the same
    const none = await settled({ saves: null });
    expect(none.keys().secretKey).toHaveLength(32);
  });

  it('a second tab takes its own key and says guest', async () => {
    const saves = savesOn(memory());
    const channel = tabs();
    const first = await settled({ saves, channel: channel() });
    const kept = first.keys();
    const second = createIdentity({ saves, keygen, channel: channel() });
    vi.advanceTimersByTime(10); // (asked, and answered, well inside ROLL_MS)
    await second.ready;
    expect(second.guest).toBe(true);
    expect(first.guest).toBe(false);
    expect(hex(second.keys().secretKey)).not.toBe(hex(kept.secretKey));
    // the guest's key isn't kept, whatever it does
    second.setRemember(true);
    second.renew();
    expect(saves.get(KEY)).toBe(hex(kept.secretKey));
    // a third tab is a guest too (the first answers it; a guest doesn't)
    const third = createIdentity({ saves, keygen, channel: channel() });
    vi.advanceTimersByTime(10);
    await third.ready;
    expect(third.guest).toBe(true);
  });

  it('two tabs opened at once: one takes the key, the other flies as a guest', async () => {
    const saves = savesOn(memory());
    const channel = tabs();
    const a = createIdentity({ saves, keygen, channel: channel() });
    const b = createIdentity({ saves, keygen, channel: channel() });
    vi.advanceTimersByTime(ROLL_MS + 10);
    await Promise.all([a.ready, b.ready]);
    expect([a.guest, b.guest].sort()).toEqual([false, true]);
    const [owner, guest] = a.guest ? [b, a] : [a, b];
    const kept = owner.keys();
    expect(hex(guest.keys().secretKey)).not.toBe(hex(kept.secretKey));
    expect(saves.get(KEY)).toBe(hex(kept.secretKey));
  });

  it('a tab with nobody else online waits out the roll-call and takes the kept key', async () => {
    const saves = savesOn(memory());
    const me = createIdentity({ saves, keygen, channel: tabs()() });
    let done = false;
    me.ready.then(() => (done = true));
    vi.advanceTimersByTime(ROLL_MS - 50);
    await Promise.resolve();
    expect(done).toBe(false);
    vi.advanceTimersByTime(100);
    await me.ready;
    expect(me.guest).toBe(false);
    expect(ROLL_MS).toBe(300);
  });

  it('a stored value that isn’t 64 hex digits is replaced', async () => {
    for (const bad of ['nope', 'ab'.repeat(31), 'ab'.repeat(32) + 'c', 'zz'.repeat(32), 42, { k: 1 }]) {
      const saves = savesOn(memory());
      saves.set(KEY, bad);
      const me = await settled({ saves });
      expect(me.keys().secretKey).toHaveLength(32);
      expect(saves.get(KEY)).toBe(hex(me.keys().secretKey));
    }
    // and one that is 64 hex digits but no key (keygen turns it away) too
    const picky = (secret) => {
      if (secret && secret.every((b) => b === 0)) throw new Error('nought is no key');
      return keygen(secret);
    };
    const saves = savesOn(memory());
    saves.set(KEY, '0'.repeat(64));
    const me = await settled({ saves, keygen: picky });
    const keys = me.keys();
    expect(saves.get(KEY)).not.toBe('0'.repeat(64));
    expect(saves.get(KEY)).toBe(hex(keys.secretKey));
  });
});
