// Allies and blocks that last: kept in this browser by the other pilot's
// key (their id online, identity.js's on their side), so a name can't be
// borrowed, and nothing about them is kept anywhere else. Pure (the store is
// runtime/saves.js's, handed in), so it's tested in Node; client.js asks it
// who's an ally and who's blocked, and the roster lists what's in it.
//
// An alliance made is saved (by both pilots, each in their own browser),
// with when it was made, when they were last seen, and which of your keys
// you flew (`as`, its first 16 hex digits: theirs is the key they know you
// by); when they're back, the client asks again in a way that says you know
// them, and they're allies once more without anyone being asked. It asks
// only from the key the alliance was made with (madeAs): from a guest tab's
// key, or after a new identity, they couldn't know you, so it's asked for
// afresh by hand. A “no” or an “end” forgets them. A block is saved with
// when it was made, and a blocked pilot is blocked from their first hello;
// blocking an ally ends the alliance.
//
// `tp-allies` (version 1) is { [id]: { name, since, seen, as? } }, ALLIES_MAX at
// most (past that, the one least recently seen goes); `tp-blocked`
// (version 1) is { [id]: { name, at } }, BLOCKED_MAX at most (past that, the
// oldest goes). What's read back is checked as anything a stranger sent
// would be: an id that isn't 64 hex digits, or an entry that isn't one, is
// left out; a name is cleaned (names.js). With no storage to be had they
// last the visit. Another tab's changes are heard (the storage event), so
// two tabs don't write over each other.
//
// createAllies({ saves, now }) → { isAlly(id), isBlocked(id), allies() →
//   [{ id, name, since, seen }] newest seen first, saveAlly(id, name, as),
//   madeAs(id) → the 16 hex digits of the key you flew, or null (not said),
//   seenAlly(id, name), dropAlly(id), block(id, name), unblock(id), on(fn)
//   → off }

import { cleanName } from './names';

export const ALLIES_KEY = 'tp-allies';
export const BLOCKED_KEY = 'tp-blocked';
export const ALLIES_MAX = 64;
export const BLOCKED_MAX = 128;
const VERSION = 1;

const ID = /^[0-9a-f]{64}$/;
const isId = (id) => typeof id === 'string' && ID.test(id);
// the key you flew, as kept: its first 16 hex digits (from a whole key, or as kept), or null
const keyOf = (k) => (typeof k === 'string' && /^[0-9a-f]{16}(?:[0-9a-f]{48})?$/.test(k) ? k.slice(0, 16) : null);
const time = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const plainObject = (o) => o && typeof o === 'object' && !Array.isArray(o);

// the newest `max` by `by` (the rest let go)
const keep = (map, max, by) => {
  if (map.size <= max) return map;
  return new Map([...map].sort((a, b) => by(b[1]) - by(a[1])).slice(0, max));
};
function readAllies(data) {
  const out = new Map();
  if (!plainObject(data)) return out;
  for (const [id, a] of Object.entries(data)) {
    if (!isId(id) || !plainObject(a)) continue;
    const since = time(a.since) ?? 0;
    const as = keyOf(a.as);
    out.set(id, { name: cleanName(a.name) ?? 'Pilot', since, seen: time(a.seen) ?? since, ...(as ? { as } : {}) });
  }
  return keep(out, ALLIES_MAX, (a) => a.seen);
}
function readBlocked(data) {
  const out = new Map();
  if (!plainObject(data)) return out;
  for (const [id, b] of Object.entries(data)) {
    if (!isId(id) || !plainObject(b)) continue;
    out.set(id, { name: cleanName(b.name), at: time(b.at) ?? 0 });
  }
  return keep(out, BLOCKED_MAX, (b) => b.at);
}

export function createAllies({ saves = null, now = () => Date.now() } = {}) {
  const read = (key) => {
    try {
      return saves?.get(key, null) ?? null;
    } catch {
      return null;
    }
  };
  saves?.register?.({ key: ALLIES_KEY, version: VERSION });
  saves?.register?.({ key: BLOCKED_KEY, version: VERSION });
  let allies = readAllies(read(ALLIES_KEY));
  let blocked = readBlocked(read(BLOCKED_KEY));
  const listeners = new Set();
  const tell = () => {
    for (const fn of [...listeners]) fn();
  };

  let writing = false; // (this store's own write, heard back: not news)
  const write = (key, map) => {
    writing = true;
    try {
      saves?.set(key, Object.fromEntries(map));
    } catch {
      /* kept for the visit only */
    } finally {
      writing = false;
    }
  };
  // another tab's change, as the storage event tells it
  saves?.watch?.(ALLIES_KEY, (data) => {
    if (writing) return;
    allies = readAllies(data);
    tell();
  });
  saves?.watch?.(BLOCKED_KEY, (data) => {
    if (writing) return;
    blocked = readBlocked(data);
    tell();
  });

  return {
    isAlly: (id) => allies.has(id),
    isBlocked: (id) => blocked.has(id),
    allies: () => [...allies].map(([id, a]) => ({ id, name: a.name, since: a.since, seen: a.seen })).sort((a, b) => b.seen - a.seen),
    madeAs: (id) => allies.get(id)?.as ?? null,
    // an alliance made (or made again): saved, and seen now; `as`, the key you fly
    saveAlly(id, name, as) {
      if (!isId(id)) return;
      const t = now();
      const was = allies.get(id);
      const key = keyOf(as) ?? was?.as ?? null;
      allies.set(id, { name: cleanName(name) ?? was?.name ?? 'Pilot', since: was?.since ?? t, seen: t, ...(key ? { as: key } : {}) });
      allies = keep(allies, ALLIES_MAX, (a) => a.seen);
      write(ALLIES_KEY, allies);
      tell();
    },
    // a saved ally here now (their hello) or just gone: last seen now
    seenAlly(id, name) {
      const was = allies.get(id);
      if (!was) return;
      allies.set(id, { ...was, name: cleanName(name) ?? was.name, seen: now() });
      write(ALLIES_KEY, allies);
      tell();
    },
    dropAlly(id) {
      if (!allies.delete(id)) return;
      write(ALLIES_KEY, allies);
      tell();
    },
    block(id, name) {
      if (!isId(id)) return;
      if (allies.delete(id)) write(ALLIES_KEY, allies);
      blocked.set(id, { name: cleanName(name), at: now() });
      blocked = keep(blocked, BLOCKED_MAX, (b) => b.at);
      write(BLOCKED_KEY, blocked);
      tell();
    },
    unblock(id) {
      if (!blocked.delete(id)) return;
      write(BLOCKED_KEY, blocked);
      tell();
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
