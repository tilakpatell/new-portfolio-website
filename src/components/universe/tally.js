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
// A message holds TALLY.keys keys at most, and a tally may keep more (`keys`:
// the galaxy's war keeps a campaign's). Then each message is a page: what
// you've added since the last first, then the next of the rest in turn, so
// every pilot hears all of it in time. A peer not heard from before (someone
// new, or back after a reload) is owed the whole of it, a page a message
// (`owing`: send the next soon). Nothing's folded or forgotten, so every pilot
// comes to the same values for every key.
//
// A pilot's shares are known by the tally id they tell (`id`, kept in their
// save with the shares), or by their peer id if they tell none. A reload is a
// new peer id, but the same tally id, so it's the same pilot's shares again,
// not a second pilot's. A peer speaks for one pilot only, and a message under
// your own id (another tab of yours, or your word from before a reload, heard
// late) is yours already: only its totals are taken.
//
// readTally(data) → { e, m: { key: share }, t: { key: total }, i? } or null.
// createTally(epoch, { keys, cap, id }) → { epoch, id, reset(e), add(key, v),
//   mine(key), value(key), keys(), receive(peer, msg) → whether anything
//   changed, message() → the next page, owing(), forget(peer), save(),
//   load(saved) (before anything's added: the shares come back with the id
//   they were told under) }

export const TALLY = {
  keys: 96, // keys in a message at most (and kept, unless a tally's told otherwise)
  value: 1e6, // the most a value may be
  pilots: 32, // a total no more than this many pilots' shares, at the most each, could make
};
const KEY = /^[a-z0-9][a-z0-9:._-]{0,47}$/;
const EPOCH = /^[a-z0-9][a-z0-9:._-]{0,47}$/;
const ID = /^[a-z0-9]{8,32}$/;

const isId = (s) => typeof s === 'string' && ID.test(s);
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
  if (data.i === undefined) return { e, m, t };
  return isId(data.i) ? { e, m, t, i: data.i } : null;
}

// `keys`: the most it keeps (past which a new key's let go); `cap`: the most
// one pilot's share of a key may be (a share told as more is taken as that
// much, and a total as no more than TALLY.pilots of them); `id`: the tally id
// this pilot tells (null: none)
export function createTally(epoch, { keys: most = TALLY.keys, cap = TALLY.value, id = null } = {}) {
  const capTotal = Math.min(TALLY.value, cap * TALLY.pilots);
  let mine = new Map();
  let others = new Map(); // pilot (`i:` their tally id, or `p:` their peer id) → Map(key → share)
  const speaks = new Map(); // peer → the pilot they speak for
  let floor = new Map();
  const known = new Set();
  const order = []; // the keys as they were learnt: the pages' turn
  const fresh = new Set(); // yours, added since the last message
  let turn = 0; // where in `order` the next page goes on from
  let owed = 0; // keys still to page to a pilot new to it
  const room = (k) => known.has(k) || known.size < most;
  const learn = (k) => {
    if (known.has(k)) return;
    known.add(k);
    order.push(k);
  };

  const sum = (k) => {
    let s = mine.get(k) ?? 0;
    for (const o of others.values()) s += o.get(k) ?? 0;
    return s;
  };
  const t = {
    epoch: String(epoch),
    id: isId(id) ? id : null,
    reset(e) {
      t.epoch = String(e);
      mine = new Map();
      others = new Map();
      speaks.clear();
      floor = new Map();
      known.clear();
      order.length = 0;
      fresh.clear();
      turn = 0;
      owed = 0;
    },
    add(k, v) {
      const n = value(v);
      if (!n || !KEY.test(k) || !room(k)) return;
      learn(k);
      mine.set(k, Math.min(cap, (mine.get(k) ?? 0) + n));
      fresh.delete(k); // (the newest last)
      fresh.add(k);
    },
    mine: (k) => mine.get(k) ?? 0,
    value: (k) => Math.max(sum(k), floor.get(k) ?? 0),
    keys: () => [...order],
    receive(peer, msg) {
      if (!msg || msg.e !== t.epoch) return false;
      // whose shares (a peer speaks for one pilot only), and none to take if they're yours
      const who = msg.i ? `i:${msg.i}` : `p:${peer}`;
      const was = speaks.get(peer);
      if (was && was !== who) return false;
      if (!was) {
        speaks.set(peer, who);
        owed = known.size; // someone new (or back, after a reload): all of it, from here round
      }
      const own = Boolean(t.id) && msg.i === t.id;
      let changed = false;
      let theirs = others.get(who);
      if (!theirs && !own) others.set(who, (theirs = new Map()));
      for (const [k, raw] of own ? [] : Object.entries(msg.m)) {
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
    // the next page: what you've added since the last (the newest, if it's
    // more than a page), then the rest in turn (all of it, while it fits in one)
    message() {
      const page = new Set([...fresh].slice(-TALLY.keys));
      for (const k of page) fresh.delete(k);
      let walked = 0;
      while (page.size < TALLY.keys && walked < order.length) {
        page.add(order[turn]);
        turn = (turn + 1) % order.length;
        walked += 1;
      }
      owed = Math.max(0, owed - walked);
      const m = {};
      const tot = {};
      for (const k of page) {
        if (mine.get(k)) m[k] = mine.get(k);
        const v = t.value(k);
        if (v) tot[k] = v;
      }
      return t.id ? { e: t.epoch, m, t: tot, i: t.id } : { e: t.epoch, m, t: tot };
    },
    // something to send soon: your own new share, or the rest of it for someone new
    owing: () => fresh.size > 0 || owed > 0,
    // a peer gone: what their pilot had done stays, in the floor (and if
    // they're back under another, their shares add up to it again, not on top)
    forget(peer) {
      const who = speaks.get(peer);
      speaks.delete(peer);
      const theirs = others.get(who);
      if (!theirs) return;
      for (const k of theirs.keys()) floor.set(k, t.value(k));
      others.delete(who);
    },
    save() {
      const f = {};
      for (const k of known) if (t.value(k)) f[k] = t.value(k);
      return { e: t.epoch, ...(t.id ? { i: t.id } : {}), mine: Object.fromEntries(mine), floor: f };
    },
    load(saved) {
      if (!saved || typeof saved !== 'object' || saved.e !== t.epoch) return;
      if (saved.i !== undefined && !isId(saved.i)) return;
      const m = readMap(saved.mine, most);
      const f = readMap(saved.floor, most);
      if (!m || !f) return;
      if (saved.i) t.id = saved.i;
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
