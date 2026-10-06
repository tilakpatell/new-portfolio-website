// The rush online: one host and up to three guests, in a room named by a
// four-letter code, over the public Nostr relays the universe's multiplayer
// uses (../../universe/online/nostr.js: signed, ephemeral, no server of our
// own). ./protocol.js has the messages.
//
// The host runs the round (./rules.js) and sends it out ten times a
// second; each guest moves their own hobbit at home, so walking has no lag,
// and sends where it is, and each grab as a request with where they stood.
// The host seats guests as they say hello, and lets go of anyone who goes
// quiet. If the host goes, the room's over for everyone.
//
// createSession({ level, code, host, onChange }) → { state, hostPump(s, t)
// → grabs, hostSend(s, events, t), setPhase(phase, seed), guestPump(s, t)
// → { fresh, events }, sendGrab(p), leave() }. onChange(state) whenever the
// lobby, the phase or the connection changes.

import { createLimiter } from '../../universe/online/protocol';
import { APP_ID, LOBBY_MS, POSE_MS, QUIET_MS, RATES, STATE_MS, readEvents, readGrab, readLobby, readPose, readState, seat, writeEvents, writeGrab, writeLobby, writePose, writeState } from './protocol';
import { newPlayer } from './rules';

const loadRoom = () => import('../../universe/online/nostr').then((m) => m.joinAsVisitor);
const LATEST = new Set(['pose', 'st']);
const CHEAP = new Set(['pose']);
const HELLO_MS = 1500;
const KEEP_MS = 3000;

export function createSession({ level, code, host, load = loadRoom, now = () => Date.now(), onChange = () => {} }) {
  const state = {
    status: 'connecting', // connecting | online | failed | left
    role: host ? 'host' : 'guest',
    code,
    phase: 'lobby',
    seed: 0,
    slots: host ? ['host', null, null, null] : [null, null, null, null],
    mine: host ? 0 : null,
    hostGone: false,
    full: false,
  };
  let room = null;
  let selfId = null;
  let hostId = null;
  const acts = {};
  const limits = new Map();
  const heard = new Map();
  const poses = new Map();
  let grabs = [];
  let snap = null;
  let events = [];
  let dropped = [];
  let lastPose = -Infinity;
  let lastState = -Infinity;
  let lastLobby = -Infinity;
  let lastHello = -Infinity;
  let left = false;
  let hostLeft = false; // (the host said goodbye, rather than going quiet)
  let lastMine = null; // the slot you last had
  let timer = 0;
  const changed = () => onChange({ ...state, slots: state.slots.slice() });
  const allow = (peerId, kind) => {
    if (!limits.has(peerId)) limits.set(peerId, createLimiter(RATES));
    return limits.get(peerId).allow(kind, now());
  };
  const send = (ns, data) => !left && acts[ns]?.send(data);
  const sendLobby = () => {
    lastLobby = now();
    send('lob', writeLobby(state));
  };

  // a guest goes: their slot's free, and their hobbit leaves the kitchen
  const unseat = (peerId) => {
    const slot = state.slots.indexOf(peerId);
    if (slot < 1) return;
    state.slots = state.slots.slice();
    state.slots[slot] = null;
    dropped.push(slot);
    poses.delete(peerId);
    heard.delete(peerId);
    sendLobby();
    changed();
  };

  // the room's pulse: the host's lobby now and then, and letting go of quiet
  // guests; a guest's hello till seated, and now and then after, and
  // noticing a quiet host
  const beat = (t) => {
    if (left || state.status !== 'online') return;
    if (state.role === 'host') {
      for (const [peerId, at] of heard) if (t - at > QUIET_MS) unseat(peerId);
      if (t - lastLobby >= LOBBY_MS) sendLobby();
      return;
    }
    if (hostId && !state.hostGone && t - (heard.get(hostId) ?? t) > QUIET_MS) {
      state.hostGone = true;
      changed();
    }
    if (!state.full && t - lastHello >= (state.mine == null ? HELLO_MS : KEEP_MS)) {
      lastHello = t;
      send('hi', 1);
    }
  };

  load()
    .then((joinRoom) => {
      if (left) return;
      room = joinRoom({ appId: APP_ID, latest: LATEST, cheap: CHEAP }, `${level.id}-${code}`);
      selfId = room.selfId;
      for (const ns of ['lob', 'st', 'ev', 'hi', 'pose', 'grab']) acts[ns] = room.makeAction(ns);
      const fromHost = (peerId) => {
        if (state.role !== 'guest') return false;
        if (!hostId) hostId = peerId;
        if (peerId !== hostId) return false;
        heard.set(peerId, now());
        // only quiet, not gone: back again
        if (state.hostGone && !hostLeft) {
          state.hostGone = false;
          changed();
        }
        return true;
      };
      acts.lob.onMessage = (data, { peerId }) => {
        if (!fromHost(peerId)) return;
        const lob = readLobby(data);
        if (!lob) return;
        const mine = lob.slots.indexOf(selfId);
        Object.assign(state, { phase: lob.phase, seed: lob.seed, slots: lob.slots.map((x) => (x === selfId ? 'you' : x)), mine: mine >= 0 ? mine : null, full: mine < 0 && lob.slots.every(Boolean) });
        changed();
      };
      acts.st.onMessage = (data, { peerId }) => {
        if (fromHost(peerId)) snap = data;
      };
      acts.ev.onMessage = (data, { peerId }) => {
        if (fromHost(peerId)) events.push(...readEvents(data, level));
      };
      acts.hi.onMessage = (_, { peerId }) => {
        if (state.role !== 'host' || !allow(peerId, 'hi')) return;
        heard.set(peerId, now());
        const r = seat(state.slots, peerId);
        if (r.slots !== state.slots) {
          state.slots = r.slots;
          changed();
        }
        sendLobby();
      };
      acts.pose.onMessage = (data, { peerId }) => {
        if (state.role !== 'host' || !state.slots.includes(peerId) || !allow(peerId, 'pose')) return;
        heard.set(peerId, now());
        poses.set(peerId, data);
      };
      acts.grab.onMessage = (data, { peerId }) => {
        if (state.role !== 'host' || !state.slots.includes(peerId) || !allow(peerId, 'grab')) return;
        heard.set(peerId, now());
        grabs.push({ peerId, data });
      };
      room.onPeerLeave = (id) => {
        if (state.role === 'host') unseat(id);
        else if (id === hostId) {
          hostLeft = true;
          state.hostGone = true;
          changed();
        }
      };
      room.onStatus = (st) => {
        if (state.status === 'failed' || left) return;
        state.status = st === 'online' ? 'online' : 'connecting';
        changed();
      };
      room.ready
        .then(() => {
          if (left) return;
          state.status = 'online';
          changed();
          if (state.role === 'host') sendLobby();
          // the lobby and the hellos go on a timer of their own, so a page
          // that's busy (or in the background) doesn't drop out of the room
          timer = setInterval(() => beat(now()), 1000);
        })
        .catch(() => {
          if (left) return;
          state.status = 'failed';
          changed();
        });
    })
    .catch(() => {
      state.status = 'failed';
      changed();
    });

  return {
    state,
    get selfId() {
      return selfId;
    },

    // ── the host ──

    // the phase moves on (and a new round's dice)
    setPhase(phase, seed = state.seed) {
      state.phase = phase;
      state.seed = seed;
      sendLobby();
      changed();
    },
    // who's seated now, as the round's hobbits should be
    seated() {
      return state.slots.map((x, slot) => (x ? slot : null)).filter((x) => x != null);
    },
    // before a step: the guests' hobbits to where they say, and their grabs
    hostPump(s, t = now()) {
      for (const slot of dropped) s.players = s.players.filter((p) => p.slot !== slot);
      dropped = [];
      beat(t);
      const playing = state.phase === 'count' || state.phase === 'play';
      const hobbit = (peerId) => {
        const slot = state.slots.indexOf(peerId);
        if (slot < 1) return null;
        let p = s.players.find((q) => q.slot === slot);
        if (!p && playing) {
          p = newPlayer(level, slot);
          s.players.push(p);
          s.players.sort((a, b) => a.slot - b.slot);
        }
        return p;
      };
      for (const [peerId, data] of poses) {
        const p = hobbit(peerId);
        const pose = p && readPose(data, s);
        if (pose) Object.assign(p, pose);
      }
      poses.clear();
      const out = [];
      for (const g of grabs) {
        const p = hobbit(g.peerId);
        const pose = p && readGrab(g.data, s);
        if (!pose) continue;
        Object.assign(p, pose);
        out.push({ p: p.slot });
      }
      grabs = [];
      return out;
    },
    // after a step: what happened, the round now and then, the lobby now and then
    hostSend(s, list = [], t = now()) {
      if (state.status !== 'online') return;
      const ev = writeEvents(list, level);
      if (ev.length) send('ev', ev);
      if (s && t - lastState >= STATE_MS) {
        lastState = t;
        send('st', writeState(s));
      }
      beat(t);
    },

    // ── a guest ──

    // each frame: the host's round into `s` (keeping your own hobbit's
    // place), what's happened, your hobbit out, and hello till you're seated
    guestPump(s, t = now()) {
      beat(t);
      let fresh = false;
      // your hobbit is yours through a round, even if the host let go of you
      // for a moment (a stalled page) and seats you again: its place stays yours
      const playing = state.phase === 'count' || state.phase === 'play';
      if (state.mine != null) lastMine = state.mine;
      const mine = state.mine ?? (playing ? lastMine : null);
      let me = mine != null ? s.players.find((p) => p.slot === mine) : null;
      if (snap) {
        fresh = readState(s, snap, mine);
        snap = null;
      }
      // your own hobbit stays in your copy (the host adds it once it hears where it is)
      if (mine != null && playing && !s.players.some((p) => p.slot === mine)) {
        me ??= newPlayer(level, mine);
        s.players.push(me);
        s.players.sort((a, b) => a.slot - b.slot);
      }
      me = mine != null ? s.players.find((p) => p.slot === mine) : null;
      const list = events;
      events = [];
      if (me && state.mine != null && t - lastPose >= POSE_MS) {
        lastPose = t;
        send('pose', writePose(me));
      }
      return { fresh, events: list };
    },
    sendGrab(p) {
      send('grab', writeGrab(p));
    },

    leave() {
      if (left) return;
      left = true;
      clearInterval(timer);
      state.status = 'left';
      room?.leave();
    },
  };
}
