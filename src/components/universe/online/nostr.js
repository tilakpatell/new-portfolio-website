// The room the pilots meet in: public Nostr relays carrying everything, so
// it works from any network a web page can load from (each browser opens
// ordinary secure WebSockets out to the relays; nothing has to reach in, so
// no NAT or firewall gets in the way), and no pilot ever learns another's IP
// address (only the relays see yours, as any website does). The site is
// static, so there's no server of its own: these are run by others, free.
//
// What each browser sends goes out as Nostr events of an ephemeral kind
// (KIND: relays pass it on to whoever's listening and keep nothing), tagged
// with the room, to every relay in RELAYS; each listens for the same on all
// of them, and an event that comes in from more than one is taken once (by
// its id). Messages are bundled: whatever's waiting goes out together at
// most every FLUSH_MS (only the latest pose and pointer of a bundle are
// kept), which keeps each pilot well inside what the relays allow.
//
// Who you are is the key you sign with (made fresh for each visit, and the
// same in every room you join on it, visitKeys(): the site's own and each
// world's, so the person walking your Bree is the one in the roster, and a
// block holds everywhere): every event is signed, the relays check it, and
// anything that matters (a hello, a hit, being shot down, an alliance,
// leaving) is checked again here, so no one can speak as another pilot. An event much older than the pilot's
// others is dropped, so an old one can't be played back later.
//
// joinRoom({ appId, relays, WebSocket, keys }, roomId) → { selfId, ready (resolves
// once a relay's listening, rejects if none answer), makeAction(ns) →
// { send(data, { target }), onMessage(data, { peerId }) }, onPeerJoin(id),
// onPeerLeave(id), onStatus('online' | 'connecting'), leave() }: what
// client.js takes. (Other games pass `latest`, the kinds of message of
// which only the newest in a bundle matters, and `cheap`, those trusted to
// the relays' own check of the signature.)

import { schnorr } from '@noble/secp256k1';
import { KIND, checkEvent, hex, signEvent } from './events';

export { KIND, checkEvent, eventId, hex, signEvent } from './events';
// relays that took ten events a second for a minute without dropping any
// (others tried passed half, or banned the test)
export const RELAYS = ['nostr-01.uid.ovh', 'relay.mostro.network', 'bucket.coracle.social', 'nostr-01.yakihonne.com'].map((h) => `wss://${h}`);
export const FLUSH_MS = 100; // a bundle at most this often
const READY_MS = 12000; // no relay listening by now: couldn't connect
const STALE_S = 30; // an event this much older than the pilot's others is a replay
const QUIET_MS = 60000; // a pilot not heard from this long is forgotten (they'll be met again)
const CONTENT_MAX = 16000; // characters of content taken from an event
const QUEUE_MAX = 64; // messages waiting, at most
const LATEST = new Set(['pose', 'foot', 'walk', 'cur', 'pack']); // only the newest of these in a bundle
const CHEAP = new Set(['pose', 'foot', 'walk', 'cur', 'shot', 'pack']); // trusted to the relay's own check of the signature

const isHex = (s, n) => typeof s === 'string' && s.length === n && /^[0-9a-f]+$/.test(s);

// the visit's key: made the first time a room's joined, then the same for
// every room till the page goes (a room joined without it makes its own)
let visit = null;
export const visitKeys = () => (visit ??= schnorr.keygen());
// a room joined as the visit's one self (what the site's rooms all do)
export const joinAsVisitor = (opts, roomId) => joinRoom({ ...opts, keys: visitKeys() }, roomId);

// Signing and checking (events.js) in a worker of their own where the
// browser has one (signer.worker.js): each is a few milliseconds of sums on
// big numbers, and ten or more a second, in the page, would take that out of
// the universe map's frames. Where there's no worker, or it fails, here.
let worker; // undefined: not made yet; null: none to be had
let nextJob = 0;
const jobs = new Map(); // id → (reply or null) → void
function signer() {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('./signer.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const job = jobs.get(data?.id);
      jobs.delete(data?.id);
      job?.(data);
    };
    worker.onerror = () => {
      // it couldn't start (or broke): what was waiting is done here, and so is the rest
      worker?.terminate();
      worker = null;
      const waiting = [...jobs.values()];
      jobs.clear();
      for (const job of waiting) job(null);
    };
  } catch {
    worker = null;
  }
  return worker;
}
const offPage = (op, payload, here) => {
  const w = signer();
  if (!w) return here();
  return new Promise((resolve) => {
    const id = nextJob++;
    jobs.set(id, (reply) => resolve(reply && !reply.error ? reply.out : here()));
    w.postMessage({ id, op, ...payload });
  });
};
const signAway = (key, pubkey, ev) => offPage('sign', { key, pubkey, ev }, () => signEvent(key, pubkey, ev));
const checkAway = (ev) => offPage('check', { ev }, () => checkEvent(ev));

// One relay: kept connected (back off and try again when it drops), with
// the room's listening asked for each time it opens.
function relaySocket(url, { WebSocket, req, onEvent, onChange }) {
  let ws = null;
  let up = false;
  let closed = false;
  let retry = 0;
  let wait = 1000;
  let quietUntil = 0; // rate-limited: hold off sending till then
  const open = () => {
    try {
      ws = new WebSocket(url);
    } catch {
      return later();
    }
    ws.onopen = () => {
      wait = 1000;
      ws.send(req());
      up = true;
      onChange();
    };
    ws.onmessage = (m) => {
      let msg;
      try {
        msg = JSON.parse(typeof m.data === 'string' ? m.data : '');
      } catch {
        return;
      }
      if (!Array.isArray(msg)) return;
      if (msg[0] === 'EVENT') onEvent(msg[2]);
      else if (msg[0] === 'OK' && msg[2] === false && /rate|limit|slow/i.test(String(msg[3]))) quietUntil = Date.now() + 10000;
    };
    ws.onclose = () => {
      const was = up;
      up = false;
      if (was) onChange();
      later();
    };
    ws.onerror = () => {};
  };
  const later = () => {
    if (closed) return;
    retry = setTimeout(open, wait);
    wait = Math.min(30000, wait * 2);
  };
  open();
  return {
    get up() {
      return up;
    },
    send(s) {
      if (up && Date.now() >= quietUntil && ws.readyState === 1) ws.send(s);
    },
    close() {
      closed = true;
      clearTimeout(retry);
      up = false;
      try {
        ws?.close();
      } catch {
        /* already gone */
      }
    },
  };
}

export function joinRoom({ appId, relays = RELAYS, WebSocket = globalThis.WebSocket, flushMs = FLUSH_MS, readyMs = READY_MS, latest = LATEST, cheap = CHEAP, keys = schnorr.keygen() }, roomId) {
  const { secretKey, publicKey } = keys;
  const self = hex(publicKey);
  const topic = `${appId}/${roomId}`;
  const tags = [['x', topic]];
  const actions = {};
  const known = new Map(); // pilot → { heard (ms), skew (s, their clock against yours), chain }
  const seen = new Map(); // event id → ms (taken once, from whichever relay's first)
  let queue = [];
  let timer = 0;
  let lastFlush = -Infinity;
  let left = false;
  let status = 'connecting';
  let bye = null; // the goodbye, signed ahead so it can go out as the page closes

  const nowS = () => Math.floor(Date.now() / 1000);

  // a message in from a pilot (p, what's known of them): who's new, who's
  // leaving, then the room's actions
  const take = (ev, msgs, p) => {
    const id = ev.pubkey;
    if (msgs.length === 1 && msgs[0][0] === '@bye') {
      if (known.get(id) === p && p.met) {
        known.delete(id);
        room.onPeerLeave?.(id);
      }
      return;
    }
    if (!known.has(id)) known.set(id, p); // (forgotten while this was checked)
    if (!p.met) {
      p.met = true;
      room.onPeerJoin?.(id);
    }
    for (const m of msgs) {
      const [ns, data, to] = m;
      if (ns[0] === '@' || (to !== undefined && to !== self)) continue;
      actions[ns]?.onMessage?.(data, { peerId: id });
    }
  };

  const onEvent = (ev) => {
    if (left || !ev || typeof ev !== 'object' || ev.kind !== KIND || !isHex(ev.id, 64) || !isHex(ev.pubkey, 64) || !isHex(ev.sig, 128)) return;
    if (ev.pubkey === self || seen.has(ev.id)) return;
    if (!Number.isInteger(ev.created_at) || typeof ev.content !== 'string' || ev.content.length > CONTENT_MAX) return;
    if (!Array.isArray(ev.tags) || !ev.tags.some((t) => Array.isArray(t) && t[0] === 'x' && t[1] === topic)) return;
    let msgs;
    try {
      msgs = JSON.parse(ev.content);
    } catch {
      return;
    }
    if (!Array.isArray(msgs) || !msgs.length || msgs.length > QUEUE_MAX) return;
    msgs = msgs.filter((m) => Array.isArray(m) && typeof m[0] === 'string' && m[0].length <= 16);
    if (!msgs.length) return;
    seen.set(ev.id, Date.now());
    let p = known.get(ev.pubkey);
    if (!p) known.set(ev.pubkey, (p = { heard: Date.now(), skew: nowS() - ev.created_at, chain: Promise.resolve(), met: false }));
    const leaving = msgs.length === 1 && msgs[0][0] === '@bye';
    // (a goodbye's signed ahead of time, so it may be old)
    if (!leaving && nowS() - ev.created_at - p.skew > STALE_S) return;
    p.heard = Date.now();
    const check = msgs.some((m) => !cheap.has(m[0]));
    // in order, per pilot (a check takes a moment)
    p.chain = p.chain.then(async () => {
      if (check && !(await checkAway(ev))) {
        seen.delete(ev.id); // (a forged copy mustn't keep the real one out)
        return;
      }
      if (!left) take(ev, msgs, p);
    });
  };

  const req = () => JSON.stringify(['REQ', 'tp', { kinds: [KIND], '#x': [topic], since: nowS() - 10 }]);
  const setStatus = () => {
    const next = sockets.some((s) => s.up) ? 'online' : 'connecting';
    if (next === status) return;
    status = next;
    if (next === 'online') {
      readyNow();
      announce();
    }
    room.onStatus?.(next);
  };
  const sockets = relays.map((url) => relaySocket(url, { WebSocket, req, onEvent, onChange: () => setStatus() }));

  let readyNow;
  const ready = new Promise((resolve, reject) => {
    readyNow = resolve;
    setTimeout(() => (status === 'online' ? resolve() : reject(new Error('no relay answered'))), readyMs);
  });
  ready.catch(() => {});

  const broadcast = (ev) => {
    const s = JSON.stringify(['EVENT', ev]);
    for (const sock of sockets) sock.send(s);
  };

  // out with what's waiting (the newest pose and pointer only)
  const flush = async () => {
    timer = 0;
    if (!queue.length || left) return;
    lastFlush = Date.now();
    const out = [];
    const last = {};
    for (const m of queue.splice(0)) {
      if (latest.has(m[0])) last[m[0]] = m;
      else out.push(m);
    }
    out.push(...Object.values(last));
    broadcast(await signAway(secretKey, self, { tags, content: JSON.stringify(out) }));
  };
  const post = (m) => {
    if (left) return;
    queue.push(m);
    if (queue.length > QUEUE_MAX) queue.splice(0, queue.length - QUEUE_MAX);
    if (!timer) timer = setTimeout(flush, Math.max(0, lastFlush + flushMs - Date.now()));
  };
  // here: so the pilots already in meet you straight away (and the
  // goodbye's signed now, ready for when you go)
  const announce = () => {
    post(['@join']);
    if (!bye) signAway(secretKey, self, { tags, content: JSON.stringify([['@bye']]) }).then((ev) => (bye = ev));
  };

  // pilots not heard from in a while are forgotten (met again if they're back)
  const sweep = setInterval(() => {
    const t = Date.now();
    for (const [id, p] of known) if (t - p.heard > QUIET_MS) known.delete(id);
    for (const [id, at] of seen) if (t - at > QUIET_MS) seen.delete(id);
  }, QUIET_MS / 2);

  const room = {
    selfId: self,
    ready,
    onPeerJoin: null,
    onPeerLeave: null,
    onStatus: null,
    makeAction(ns) {
      const a = {
        onMessage: null,
        send(data, opts) {
          const to = opts?.target;
          post(to ? [ns, data, to] : [ns, data]);
          return Promise.resolve();
        },
      };
      actions[ns] = a;
      return a;
    },
    leave() {
      if (left) return Promise.resolve();
      left = true;
      clearTimeout(timer);
      clearInterval(sweep);
      if (bye) broadcast(bye);
      for (const s of sockets) s.close();
      known.clear();
      return Promise.resolve();
    },
  };
  return room;
}
