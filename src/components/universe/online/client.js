// The multiplayer link: everyone on the site who's gone online, in one
// room, browser to browser (WebRTC through Trystero; the site is static, so
// there's no server: public Nostr relays only introduce the peers). It
// keeps who's here (their callsign, ship, kills, which page they're on, and
// whether you're allies), where each was last seen on the universe map, the
// shots they fire there, and their pointer on any other page, and sends
// yours. The scene (scene.js, pilots.js) reads poses and shots from it each
// frame, Presence.jsx the pointers; the page (useOnline.js, Online.jsx)
// shows the roster and what's happening. protocol.js has the wire and the
// rules for what's believed; privacy.js what your connection gives away.
//
// Defences, since anyone can join with a client of their own: each pilot
// may send only so much of each kind of message (a flood gets them muted
// for the visit), hits must come from a shot aimed your way, kills are
// counted from what this browser saw (a shot or a hit just before, close
// by), not from what a pilot says of themselves, an alliance turned down
// can't be asked for again straight away, and anyone who goes quiet is
// dropped. A heartbeat keeps you on everyone's list while you sit still.
//
// createClient({ name, kind, where }) → { selfId, on(fn) → off, snapshot(),
//   setProfile({ name, kind, where }), pose(ship, { hidden, boost, safe,
//   shield }), shot(at, v), hit(peerId), down(byId), cursor(x, y, touch),
//   ally(peerId, 'ask' | 'accept' | 'decline' | 'end'), block(peerId, on),
//   peers, takeShots(), leave() }
// Events, to on(fn): { type: 'status' }, { type: 'roster' }, { type: 'feed',
// text, tone }, { type: 'hit', from, damage }, { type: 'downed', id, by }
// (someone was shot down: where they were, for the scene's pop; `by` is
// whoever this browser believes did it).

import { APP_ID, CURSOR_MS, DAMAGE, GUARD, POSE_MS, ROOM, allyStep, cleanName, createLimiter, hitCounts, readCursor, readHello, readHit, readPose, readShot, writeCursor, writePose, writeShot } from './protocol';
import { privatePeer, relayOnly } from './privacy';
import { UNIVERSE, placeName } from './where';

const SNAPS = 12; // poses kept per pilot
const SHOTS = 48; // shots waiting to be drawn, at most
const AIMS = 8; // each pilot's last shots, kept to check a hit against
const SHOT_GAP = 150; // ms between shots sent (the guns fire every 220)
const PILOTS = 32; // pilots kept track of, at most (a mesh of browsers gets heavy past this)
const HEARTBEAT_MS = 15000; // a hello this often, so a pilot sitting still isn't dropped
const QUIET_MS = 45000; // nothing from a pilot this long: they're gone
const ALLY_AGAIN_MS = 60000; // after you turn someone down, how long before they may ask again
// The relays that introduce the pilots (every visitor must use the same
// ones): from Trystero's own list, the ones answering when this was written
// (its default pick for our app id had a dead one in it)
const RELAYS = ['nos.lol', 'nostr-01.yakihonne.com', 'nostr-01.uid.ovh', 'purplerelay.com', 'relay.mostro.network', 'bucket.coracle.social'].map((h) => `wss://${h}`);

const loadTrystero = () => import('trystero').then((m) => ({ joinRoom: m.joinRoom, selfId: m.selfId }));

export function createClient({ name, kind = null, where = UNIVERSE, load = loadTrystero, now = () => performance.now(), privacy = { peer: privatePeer(), relay: relayOnly() } }) {
  const self = { id: null, name: cleanName(name) ?? 'Pilot', kind, kills: 0, where };
  const peers = new Map();
  const listeners = new Set();
  let status = 'connecting'; // connecting | online | failed | left
  let room = null;
  let send = null; // the actions, once the room's there
  let me = null; // where you are, while a hit on you can count
  let lastPose = -Infinity;
  let lastShot = -Infinity;
  let lastCursor = -Infinity;
  let cursorLater = 0; // the last pointer of a quick move, sent once the gap's up
  let heartbeat = 0;
  let shots = [];

  const emit = (e) => {
    for (const fn of listeners) fn(e);
  };
  const roster = () => emit({ type: 'roster' });
  const feed = (text, tone = 'info') => emit({ type: 'feed', text, tone });
  const hello = () => ({ n: self.name, k: self.kind, c: self.kills, w: self.where });

  const peerOf = (id) => {
    let p = peers.get(id);
    if (!p && peers.size < PILOTS) {
      p = {
        id,
        name: null,
        kind: null,
        kills: 0, // the ones this browser saw
        where: null,
        ally: 'none',
        blocked: false,
        snaps: [],
        pose: null,
        cur: null,
        shots: [], // their last few, for checking a hit on you
        shotAt: -Infinity,
        hitAt: -Infinity, // their last hit on you that counted
        hitByMeAt: -Infinity, // your last hit on them
        declinedAt: -Infinity,
        seen: now(),
        limit: createLimiter(),
      };
      peers.set(id, p);
    }
    return p ?? null;
  };

  const setAlly = (p, event) => {
    const was = p.ally;
    const { state, send: say } = allyStep(was, event);
    p.ally = state;
    if (say) send?.ally({ t: say }, p.id);
    if (event === 'decline') p.declinedAt = now();
    if (state === was) return;
    const who = p.name ?? 'Someone';
    if (state === 'got') feed(`${who} wants to be allies`, 'ally');
    else if (state === 'ally') feed(`You and ${who} are allies`, 'ally');
    else if (state === 'none' && was === 'ally') feed(typeof event === 'object' ? `${who} ended your alliance` : `You ended your alliance with ${who}`, 'info');
    else if (state === 'none' && was === 'sent' && typeof event === 'object') feed(`${who} turned down the alliance`, 'info');
    roster();
  };

  const block = (p, on) => {
    if (on && p.ally !== 'none') setAlly(p, p.ally === 'got' ? 'decline' : 'end');
    p.blocked = on;
    p.snaps.length = 0;
    p.pose = null;
    p.cur = null;
    p.shots.length = 0;
    roster();
  };

  // A message from a pilot, let in or not: known (or, for a hello, new), not
  // blocked, and within what they may send. Too much, and they're muted.
  const admit = (kind, id, create = false) => {
    const p = create ? peerOf(id) : peers.get(id);
    if (!p) return null;
    const t = now();
    p.seen = t;
    if (p.blocked) return null;
    if (p.limit.allow(kind, t)) return p;
    if (p.limit.flooding(t)) {
      block(p, true);
      feed(`Muted ${p.name ?? 'a pilot'}: too many messages`, 'info');
    }
    return null;
  };

  // anyone gone quiet is gone (a missed goodbye, or a tab that froze)
  const sweep = () => {
    const t = now();
    for (const p of [...peers.values()]) {
      if (t - p.seen <= QUIET_MS) continue;
      peers.delete(p.id);
      if (p.name && !p.blocked) feed(`${p.name} went offline`, 'info');
      roster();
    }
  };

  const near = (a, b) => Boolean(a && b) && Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= GUARD.range * 1.5;

  const wire = (r, selfId) => {
    self.id = selfId;
    const action = (ns) => r.makeAction(ns);
    const hi = action('hi');
    const pose = action('pose');
    const shot = action('shot');
    const hit = action('hit');
    const down = action('down');
    const ally = action('ally');
    const cur = action('cur');
    send = {
      hi: (data, to) => hi.send(data, to ? { target: to } : undefined).catch(() => {}),
      pose: (data) => pose.send(data).catch(() => {}),
      shot: (data) => shot.send(data).catch(() => {}),
      hit: (data, to) => hit.send(data, { target: to }).catch(() => {}),
      down: (data) => down.send(data).catch(() => {}),
      ally: (data, to) => ally.send(data, { target: to }).catch(() => {}),
      cur: (data) => cur.send(data).catch(() => {}),
    };

    r.onPeerJoin = (id) => {
      if (!peerOf(id)) return;
      send.hi(hello(), id);
    };
    r.onPeerLeave = (id) => {
      const p = peers.get(id);
      if (!p) return;
      peers.delete(id);
      if (p.name && !p.blocked) feed(`${p.name} went offline`, 'info');
      roster();
    };

    hi.onMessage = (data, { peerId }) => {
      const h = readHello(data);
      const p = h && admit('hi', peerId, true);
      if (!p) return;
      const first = p.name === null;
      const was = p.where;
      const changed = first || p.name !== h.name || p.kind !== h.kind || p.where !== h.where;
      // (their own count of their kills isn't taken: p.kills is what this browser saw)
      p.name = h.name;
      p.kind = h.kind;
      p.where = h.where;
      if (was !== p.where) p.cur = null; // (a pointer is only good on the page it was on)
      if (first) feed(`${p.name} came online`, 'join');
      else if (was !== p.where) {
        // coming to your page, or leaving it
        if (p.where === self.where) feed(`${p.name} is here`, 'join');
        else if (was === self.where) feed(`${p.name} went to ${placeName(p.where)}`, 'info');
      }
      if (changed) roster();
    };
    pose.onMessage = (data, { peerId }) => {
      const s = readPose(data);
      const p = s && admit('pose', peerId);
      if (!p) return;
      s.at = now();
      p.pose = s;
      p.snaps.push(s);
      if (p.snaps.length > SNAPS) p.snaps.shift();
    };
    shot.onMessage = (data, { peerId }) => {
      const known = peers.get(peerId);
      const s = known && readShot(data, known.pose);
      const p = s && admit('shot', peerId);
      if (!p) return;
      const t = now();
      p.shotAt = t;
      p.shots.push({ p: s.p, v: s.v, at: t });
      if (p.shots.length > AIMS) p.shots.shift();
      shots.push({ id: peerId, kind: p.kind, ...s });
      if (shots.length > SHOTS) shots.shift();
    };
    hit.onMessage = (data, { peerId }) => {
      const d = readHit(data);
      const p = d && admit('hit', peerId);
      const t = now();
      if (!p || !hitCounts(p, me, t)) return;
      p.hitAt = t;
      emit({ type: 'hit', from: peerId, damage: d });
    };
    down.onMessage = (data, { peerId }) => {
      const p = data && typeof data === 'object' && admit('down', peerId);
      if (!p) return;
      const said = typeof data.b === 'string' && data.b.length <= 64 ? data.b : null;
      const t = now();
      let by = null;
      if (said && said === self.id) {
        // yours, if you'd just hit them
        if (t - p.hitByMeAt <= GUARD.killWindow) {
          by = said;
          self.kills += 1;
          feed(`You shot down ${p.name ?? 'someone'}`, 'kill');
        }
      } else if (said) {
        // someone else's, if they'd just fired and were close by
        const q = peers.get(said);
        if (q && !q.blocked && t - q.shotAt <= GUARD.killWindow && near(q.pose, p.pose)) {
          by = said;
          q.kills += 1;
          feed(`${q.name ?? 'Someone'} shot down ${p.name ?? 'someone'}`, 'kill');
        }
      }
      if (by) roster();
      emit({ type: 'downed', id: peerId, by, at: p.pose });
      p.snaps.length = 0; // they're gone till they're back
    };
    cur.onMessage = (data, { peerId }) => {
      const c = readCursor(data);
      const p = c && admit('cur', peerId);
      if (!p || p.where === UNIVERSE) return;
      c.at = now();
      p.cur = c;
    };
    ally.onMessage = (data, { peerId }) => {
      const t = data && typeof data === 'object' && ['ask', 'yes', 'no', 'end'].includes(data.t) ? data.t : null;
      const p = t && admit('ally', peerId);
      if (!p) return;
      // turned down a moment ago: not again yet
      if (t === 'ask' && p.ally === 'none' && now() - p.declinedAt < ALLY_AGAIN_MS) {
        send.ally({ t: 'no' }, p.id);
        return;
      }
      setAlly(p, { in: t });
    };

    heartbeat = setInterval(() => {
      send?.hi(hello());
      sweep();
    }, HEARTBEAT_MS);
  };

  // into the room (three.js-free, but still a download: only once asked)
  load()
    .then(({ joinRoom, selfId }) => {
      if (status === 'left') return;
      room = joinRoom({ appId: APP_ID, relayConfig: { urls: RELAYS }, rtcPolyfill: privacy.peer, ...(privacy.relay ?? {}) }, ROOM);
      wire(room, selfId);
      status = 'online';
      emit({ type: 'status' });
    })
    .catch((err) => {
      if (import.meta.env?.DEV && import.meta.env?.MODE !== 'test') console.error('[online]', err);
      if (status === 'left') return;
      status = 'failed';
      emit({ type: 'status' });
    });

  return {
    get selfId() {
      return self.id;
    },
    peers,
    // does everything go through a relay (no one sees your IP address)?
    relay: Boolean(privacy.relay),
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // for the page: who's here, as plain data
    snapshot() {
      const list = [];
      for (const p of peers.values()) if (p.name !== null) list.push({ id: p.id, name: p.name, kind: p.kind, kills: p.kills, where: p.where, ally: p.ally, blocked: p.blocked });
      list.sort((a, b) => a.name.localeCompare(b.name));
      return { status, relay: Boolean(privacy.relay), self: { name: self.name, kind: self.kind, kills: self.kills, where: self.where }, peers: list };
    },
    setProfile({ name: n = self.name, kind: k = self.kind, where: w = self.where } = {}) {
      const clean = cleanName(n) ?? self.name;
      if (clean === self.name && k === self.kind && w === self.where) return;
      self.name = clean;
      self.kind = k;
      self.where = w;
      if (!k) me = null;
      send?.hi(hello());
      roster();
    },
    // where your ship is, each frame (sent ten times a second). Hidden
    // (crashed, shot down, diving into a page) or safe (just back), hits
    // on you don't count
    pose(s, { hidden = false, boost = false, safe = false, shield = 100 } = {}) {
      me = hidden || safe || !s ? null : s;
      const t = now();
      if (!send || !s || t - lastPose < POSE_MS) return;
      lastPose = t;
      send.pose(writePose(s, (hidden ? 1 : 0) | (boost ? 2 : 0), shield));
    },
    shot(at, v) {
      const t = now();
      if (!send || t - lastShot < SHOT_GAP) return;
      lastShot = t;
      send.shot(writeShot(at, v));
    },
    // your pointer, off the universe map (x from the middle of the window,
    // y down the page, in px; with touch, where you're reading)
    cursor(x, y, touch = false) {
      if (!send || self.where === UNIVERSE) return;
      clearTimeout(cursorLater);
      const wait = lastCursor + CURSOR_MS - now();
      if (wait > 0) {
        cursorLater = setTimeout(() => this.cursor(x, y, touch), wait);
        return;
      }
      lastCursor = now();
      send.cur(writeCursor(x, y, touch));
    },
    // a bolt of yours hit them: tell them (they take it off their own shields)
    hit(id) {
      const p = peers.get(id);
      if (!send || !p || p.blocked || p.ally === 'ally') return;
      p.hitByMeAt = now();
      send.hit({ d: DAMAGE }, id);
    },
    // your shields are gone: everyone hears who did it
    down(by) {
      send?.down({ b: by ?? null });
      const p = by ? peers.get(by) : null;
      if (p) feed(`${p.name ?? 'Someone'} shot you down`, 'kill');
    },
    ally(id, what) {
      const p = peers.get(id);
      if (p && !p.blocked && send) setAlly(p, what);
    },
    block(id, on = true) {
      const p = peers.get(id);
      if (p) block(p, on);
    },
    // the shots that came in since last asked
    takeShots() {
      if (!shots.length) return shots;
      const out = shots;
      shots = [];
      return out;
    },
    leave() {
      status = 'left';
      clearTimeout(cursorLater);
      clearInterval(heartbeat);
      listeners.clear();
      peers.clear();
      shots = [];
      room?.leave().catch(() => {});
      room = null;
      send = null;
    },
  };
}
