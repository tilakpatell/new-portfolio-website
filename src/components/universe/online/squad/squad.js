// A squad's link: its pilots in a room of their own on the relays (nostr.js's,
// app APP_ID, the room invite.js's roomOf names, so the relays never see the
// secret), each saying hello and the leader saying the squad's word, all of it
// fed to squadRules.js's steps as it's heard and once a second. Loaded once
// you're online, as client.js is, and kept apart from it: the site's room
// is public, a squad's isn't.
//
// Every word in the room is signature-checked (none comes often), each pilot
// may send only so much of each kind (RATES: past that it's dropped), and
// only a seated member is heard: a ping, a phrase or a line from anyone else
// (turned out, not seated yet, someone else with the sid) goes nowhere. A
// pilot you've blocked (`blocked(id)`) isn't seated while you lead.
//
// A hello comes in once you're online, then every SQUAD.helloMs (seekMs till
// you're seated), and to each pilot new in the room at once; leading, the
// squad's word goes to them too, and to anyone asking in who won't be seated
// (turned out, the squad full), so they're told at once. The ticks stop
// while the relays are out of reach, so the rules see the gap and you come
// back as someone who's been away.
//
// Through a reload: `keep(word)` is handed the squad's word as it changes (and
// null once it's over), for the page to keep with the sid; handed back as
// `saved`, the squad's picked up where it was (squadRules.js's resume). leave()
// says goodbye (the seat's freed at once, and leading, the next seat takes
// over); close() goes without a word, as a page does when it's closed or
// reloaded (the seat held SQUAD.goneMs).
//
// createSquad({ sid, lead, card, load, now, blocked, saved, keep }) → { status
// ('connecting' | 'online' | 'failed' | 'left'), selfId, view()
// (squadRules.js's), on(fn) → off (fn({ type: 'squad' }) on any change of
// view() or status), leave(), close(), kick(id), rally({ w, p } | null),
// open(yes), lobby(lobby | null), instance(i | null), ping(p), quick(i),
// text(s), onPing, onQuick, onText }. `card()` gives your hello: { name,
// kind, where, shield, level, ready }.

import { SQUAD, joining, newSquad, readCard, resume, squadStep, view, writeCard, writeState } from './squadRules';
import { roomOf } from './invite';
import { createLimiter } from '../protocol';

export const APP_ID = 'tilakpatel-portfolio-squad';
const TICK_MS = 1000;
const BYE_MS = 500; // a goodbye goes in the room's next bundle: the room's left after it
const PILOTS = 32; // pilots in the room kept track of, at most
// how many of each word one pilot may send: [a second, at most at once]
const RATES = { st: [2, 8], hi: [2, 6], bye: [0.2, 2], pg: [1, 3], qc: [1, 3], ch: [0.5, 3] };
const loadRoom = () => import('../nostr').then((m) => m.joinAsVisitor);

export function createSquad({ sid, lead = false, card = () => null, load = loadRoom, now = () => Date.now(), blocked = () => false, saved = null, keep = null }) {
  const listeners = new Set();
  const limits = new Map(); // pilot → { limit, at }
  let status = 'connecting';
  let room = null;
  let acts = {};
  let me = null;
  let state = null;
  let shown = ''; // the view last told of
  let kept; // the word last handed to keep (undefined: none yet)
  let hiAt = -Infinity;
  let timer = 0;

  const changed = () => {
    const key = JSON.stringify([status, state && view(state, now())]);
    if (key === shown) return;
    shown = key;
    for (const fn of [...listeners]) fn({ type: 'squad' });
  };
  // what the page keeps for a reload: the squad's word, once there is one, and null once it's over
  const remember = () => {
    if (!keep || !state) return;
    const word = state.gone || state.leader === null ? null : writeState(state);
    const next = JSON.stringify(word);
    if (next === kept) return;
    kept = next;
    keep(word);
  };
  const setStatus = (s) => {
    if (status === 'left' || status === s) return;
    status = s;
    changed();
  };
  // over (left, turned out, full, gone): no more ticks, and out of the room once a goodbye's had time to go
  const over = () => {
    clearInterval(timer);
    status = 'left';
    const r = room;
    setTimeout(() => r?.leave(), BYE_MS);
  };
  const step = (event) => {
    if (!state) return;
    const was = state.gone;
    const { state: next, send } = squadStep(state, event, now());
    state = next;
    for (const [ns, data] of send) acts[ns]?.send(data).catch(() => {});
    remember();
    if (state.gone && !was) over();
    changed();
  };
  const allow = (id, kind) => {
    const t = now();
    let l = limits.get(id);
    if (!l) {
      if (limits.size >= PILOTS) for (const [k, v] of limits) if (t - v.at > SQUAD.goneMs) limits.delete(k);
      if (limits.size >= PILOTS) return false;
      limits.set(id, (l = { limit: createLimiter(RATES), at: t }));
    }
    l.at = t;
    return l.limit.allow(kind, t);
  };
  const leading = () => Boolean(state) && state.leader === me && !state.gone;
  // your hello: to everyone (and into your own view), or to one pilot new in the room
  const hello = (to) => {
    const c = readCard(writeCard(card()));
    if (to) {
      acts.hi.send(writeCard(c), { target: to }).catch(() => {});
      return;
    }
    hiAt = now();
    acts.hi.send(writeCard(c)).catch(() => {});
    step({ type: 'hello', from: me, card: c });
  };
  const tell = (to) => leading() && acts.st.send(writeState(state), { target: to }).catch(() => {});
  const tick = () => {
    if (status !== 'online' || !state || state.gone) return;
    step({ type: 'tick' });
    if (!state.gone && now() - hiAt >= (state.members.includes(me) ? SQUAD.helloMs : SQUAD.seekMs)) hello();
  };

  Promise.all([load(), roomOf(sid)])
    .then(([joinRoom, name]) => {
      if (status === 'left') return;
      room = joinRoom({ appId: APP_ID, cheap: new Set() }, name);
      me = room.selfId;
      const t = now();
      state = lead ? newSquad(sid, me, t) : saved ? resume(sid, me, saved, t) : joining(sid, me, t);
      for (const ns of ['st', 'hi', 'bye', 'pg', 'qc', 'ch']) acts[ns] = room.makeAction(ns);
      acts.st.onMessage = (data, { peerId }) => {
        if (allow(peerId, 'st')) step({ type: 'state', from: peerId, wire: data });
      };
      acts.hi.onMessage = (data, { peerId }) => {
        const c = readCard(data);
        if (!c || !allow(peerId, 'hi')) return;
        step({ type: 'hello', from: peerId, card: c, blocked: Boolean(blocked(peerId)) });
        // (asking in and not seated: told why at once)
        if (!state.members.includes(peerId)) tell(peerId);
      };
      acts.bye.onMessage = (data, { peerId }) => {
        if (allow(peerId, 'bye')) step({ type: 'bye', from: peerId });
      };
      room.onPeerJoin = (id) => {
        if (status !== 'online' || state.gone) return;
        hello(id);
        tell(id);
      };
      room.onStatus = (s) => setStatus(s === 'online' ? 'online' : 'connecting');
      const up = () => {
        setStatus('online');
        if (status === 'online' && !state.gone) hello();
      };
      if (room.ready) room.ready.then(up, () => setStatus('failed'));
      else up();
      timer = setInterval(tick, TICK_MS);
      if (state.gone) over(); // (resumed into a squad that had turned you out)
      remember();
      changed();
    })
    .catch(() => setStatus('failed'));

  return {
    get status() {
      return status;
    },
    get selfId() {
      return me;
    },
    view: () => (state ? view(state, now()) : { sid, leader: null, mine: null, members: [], open: false, rally: null, lobby: null, instance: null, gone: status === 'left', why: null }),
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // out of the squad, with a goodbye (nothing kept for a reload: the page forgets it)
    leave() {
      if (state && !state.gone) return step({ type: 'leave' });
      if (status !== 'left') over();
      if (keep && kept !== 'null') {
        kept = 'null';
        keep(null);
      }
    },
    // off the relays without a word (a page closing or reloading: the seat's held)
    close() {
      clearInterval(timer);
      status = 'left';
      room?.leave();
      listeners.clear();
    },
    kick: (id) => step({ type: 'kick', id }),
    rally: (rally) => step({ type: 'rally', rally }),
    open: (yes) => step({ type: 'open', open: Boolean(yes) }),
    lobby: (lobby) => step({ type: 'lobby', lobby }),
    instance: (i) => step({ type: 'instance', instance: i }),
    // pings, phrases and text: what may be said comes with chat/ (Task 2.5)
    ping() {},
    quick() {},
    text() {},
    onPing: null,
    onQuick: null,
    onText: null,
  };
}
