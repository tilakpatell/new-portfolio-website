// A tally every pilot online keeps alike, without a server: the Citadel
// siege's model (siege.js), made general. Pure (no network): the galaxy's war
// keeps one of what the players have done for each system (galaxy/gcw.js),
// and the battle on keeps one of the damage on its objectives
// (galaxy/warfront.js); client.js carries their messages.
//
// Every pilot keeps their own share of each key (`mine`, which only grows),
// each other pilot's as they last told it (each speaking only for
// themselves), and the largest total anyone has told of (`floor`, so someone
// arriving late learns what was done before they came). A key's value is the
// larger of the shares' sum and the floor. Shares only grow, so two pilots
// adding at once both count, and every pilot ends up agreeing. An epoch (the
// war's campaign, the battle's id) is set by whoever keeps the tally, from the
// clock everyone shares; a message from another epoch is ignored, and a new
// one starts everything over.
//
// readTally(data) → { e, m: { key: share }, t: { key: total } } or null.
// createTally(epoch, { keys, cap }) → { epoch, reset(e), add(key, v), mine(key),
//   value(key), keys(), receive(peer, msg) → whether anything changed,
//   message(), forget(peer), save(), load(saved) }

export const TALLY = {
  keys: 96, // keys in a message, and kept, at most
  value: 1e6, // the most a value may be
  pilots: 32, // a total no more than this many pilots' shares, at the most each, could make
};
const KEY = /^[a-z0-9][a-z0-9:._-]{0,47}$/;
const EPOCH = /^[a-z0-9][a-z0-9:._-]{0,47}$/;

const value = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(TALLY.value, v) : null);

// a { key: value } map as it came in, or null if it isn't one
function readMap(o, keys = TALLY.keys) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const entries = Object.entries(o);
  if (entries.length > keys) return null;
  const out = {};
  for (const [k, raw] of entries) {
    const v = value(raw);
    if (!KEY.test(k) || v === null) return null;
    out[k] = v;
  }
  return out;
}

export function readTally(data) {
  if (!data || typeof data !== 'object') return null;
  const e = typeof data.e === 'number' && Number.isInteger(data.e) && data.e >= 0 ? String(data.e) : data.e;
  if (typeof e !== 'string' || !EPOCH.test(e)) return null;
  const m = readMap(data.m);
  const t = readMap(data.t);
  if (!m || !t) return null;
  return { e, m, t };
}

// `cap`: the most one pilot's share of a key may be (a share told as more is
// taken as that much, and a total as no more than TALLY.pilots of them)
export function createTally(epoch, { keys: most = TALLY.keys, cap = TALLY.value } = {}) {
  const capTotal = Math.min(TALLY.value, cap * TALLY.pilots);
  let mine = new Map();
  let others = new Map(); // peer → Map(key → share)
  let floor = new Map();
  const known = new Set();
  const room = (k) => known.has(k) || known.size < most;
  const learn = (k) => known.add(k);

  const sum = (k) => {
    let s = mine.get(k) ?? 0;
    for (const o of others.values()) s += o.get(k) ?? 0;
    return s;
  };
  const t = {
    epoch: String(epoch),
    reset(e) {
      t.epoch = String(e);
      mine = new Map();
      others = new Map();
      floor = new Map();
      known.clear();
    },
    add(k, v) {
      const n = value(v);
      if (!n || !KEY.test(k) || !room(k)) return;
      learn(k);
      mine.set(k, Math.min(cap, (mine.get(k) ?? 0) + n));
    },
    mine: (k) => mine.get(k) ?? 0,
    value: (k) => Math.max(sum(k), floor.get(k) ?? 0),
    keys: () => [...known],
    receive(peer, msg) {
      if (!msg || msg.e !== t.epoch) return false;
      let changed = false;
      let theirs = others.get(peer);
      if (!theirs) others.set(peer, (theirs = new Map()));
      for (const [k, raw] of Object.entries(msg.m)) {
        const v = Math.min(cap, raw);
        if (!room(k) || v <= (theirs.get(k) ?? 0)) continue;
        learn(k);
        theirs.set(k, v);
        changed = true;
      }
      for (const [k, raw] of Object.entries(msg.t)) {
        const v = Math.min(capTotal, raw);
        if (!room(k) || v <= (floor.get(k) ?? 0)) continue;
        learn(k);
        floor.set(k, v);
        changed = true;
      }
      return changed;
    },
    message() {
      const m = {};
      const tot = {};
      for (const k of known) {
        if (mine.get(k)) m[k] = mine.get(k);
        const v = t.value(k);
        if (v) tot[k] = v;
      }
      return { e: t.epoch, m, t: tot };
    },
    // a pilot gone: what they'd done stays, in the floor
    forget(peer) {
      const theirs = others.get(peer);
      if (!theirs) return;
      for (const k of theirs.keys()) floor.set(k, t.value(k));
      others.delete(peer);
    },
    save() {
      const f = {};
      for (const k of known) if (t.value(k)) f[k] = t.value(k);
      return { e: t.epoch, mine: Object.fromEntries(mine), floor: f };
    },
    load(saved) {
      if (!saved || typeof saved !== 'object' || saved.e !== t.epoch) return;
      const m = readMap(saved.mine, most);
      const f = readMap(saved.floor, most);
      if (!m || !f) return;
      for (const [k, v] of Object.entries(m)) {
        learn(k);
        mine.set(k, Math.max(mine.get(k) ?? 0, Math.min(cap, v)));
      }
      for (const [k, v] of Object.entries(f)) {
        learn(k);
        floor.set(k, Math.max(floor.get(k) ?? 0, Math.min(capTotal, v)));
      }
    },
  };
  return t;
}
