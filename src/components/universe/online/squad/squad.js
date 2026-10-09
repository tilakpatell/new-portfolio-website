// A squad's link: its pilots in a room of their own on the relays (nostr.js's,
// app APP_ID, the room invite.js's roomOf names, so the relays never see the
// secret), each saying hello and the leader saying the squad's word, all of it
// fed to squadRules.js's steps as it's heard and twice a second. Loaded once
// you're online, as client.js is, and kept apart from it: the site's room
// is public, a squad's isn't.
//
// Every word in the room is signature-checked (none comes often), each pilot
// may send only so much of each kind (RATES: past that it's dropped; PILOTS
// are kept track of, and one new makes room by forgetting whoever's been
// heard least lately and isn't seated), and only a seated member is heard: a
// ping, a phrase or a line from anyone else (turned out, not seated yet,
// someone else with the sid) goes nowhere. A pilot you've blocked
// (`blocked(id)`) isn't seated while you lead, and isn't heard.
//
// Talking (wire2.js has the words): a ping (pg, onPing(ping, from): its kind,
// where, the point and what it marks), a quick-chat phrase (qc, onQuick(i,
// from)) and a line of text (ch, onText(text, from)), sealed (chat/seal.js,
// the key made from the sid in this page and never sent), cleaned on the way
// out and again once it's opened (chat/text.js, CHAT.squadMax). ping(),
// quick() and text() say whether it went: only while seated, and no faster
// than the others take it.
//
// A hello goes each time the room is online (at first, and again whenever
// the relays are back in reach: you're back, as someone who's been away, and
// believe whatever moved on meanwhile), then every SQUAD.helloMs (seekMs till
// you're seated), and to each pilot new in the room at once; leading, the
// squad's word goes to them too, and to anyone asking in who won't be seated
// (turned out, the squad full), so they're told at once: each at most once
// in SQUAD.stateMs, and TELLS of them at most in that time. The ticks stop
// while the relays are out of reach. Asked in from the roster, `via` is the
// inviter (client.js's invite event's `from`): only the inviter's squad is
// heard (squadRules.js's joining).
//
// Through a reload: `keep(word)` is handed the squad's word as it changes (and
// null once it's over), for the page to keep with the sid; handed back as
// `saved`, the squad's picked up where it was (squadRules.js's resume).
//
// What the page calls when: leave() when the pilot leaves the squad (a
// goodbye: the seat's freed at once, and leading, the next seat takes over);
// close() once it's done with it: the page closing or reloading (no word: the
// seat's held SQUAD.goneMs), or once it's over. It's over at status 'left'
// (left, turned out, not let in, or the squad gone: view().why says which,
// for the page to say so; asking in again, by the link once more, is a new
// one), or 'failed' (no relay answered in time: nothing more runs, and the
// room's left; a new one, handed what was kept as `saved`, tries again).
//
// createSquad({ sid, lead, via, card, load, now, blocked, saved, keep }) →
// { status ('connecting' | 'online' | 'failed' | 'left'), selfId, view()
// (squadRules.js's), on(fn) → off (fn({ type: 'squad' }) on any change of
// view() or status), leave(), close(), kick(id), rally({ w, p } | null),
// open(yes), lobby(lobby | null), instance(i | null), ping(p), quick(i),
// text(s), onPing, onQuick, onText }. `card()` gives your hello: { name,
// kind, where, shield, level, ready }.

import { SQUAD, joining, newSquad, readCard, resume, squadStep, view, writeCard, writeState } from './squadRules';
import { roomOf } from './invite';
import { createLimiter } from '../protocol';
import { readPing, readQuick, writePing } from '../wire2';
import { CHAT, cleanText } from '../chat/text';
import { seal, sealKey, unseal } from '../chat/seal';

export const APP_ID = 'tilakpatel-portfolio-squad';
const TICK_MS = 500; // (a hello till seated goes every SQUAD.seekMs, 1.5 s)
const BYE_MS = 500; // a goodbye goes in the room's next bundle: the room's left after it
const PILOTS = 32; // pilots in the room kept track of, at most
const TELLS = 4; // pilots told the squad's word on its own in any SQUAD.stateMs, at most (a crowd asking in can't swell the leader's words past what a relay takes)
// how many of each word one pilot may send: [a second, at most at once]
const RATES = { st: [2, 8], hi: [2, 6], bye: [0.2, 2], pg: [1, 3], qc: [1, 3], ch: [0.5, 3] };
const loadRoom = () => import('../nostr').then((m) => m.joinAsVisitor);

export function createSquad({ sid, lead = false, via = null, card = () => null, load = loadRoom, now = () => Date.now(), blocked = () => false, saved = null, keep = null }) {
  const listeners = new Set();
  const limits = new Map(); // pilot → { limit, at (last heard) }
  const told = new Map(); // pilot → when last told the squad's word on its own
  let status = 'connecting';
  let room = null;
  let acts = {};
  let me = null;
  let state = null;
  let shown = ''; // the view last told of
  let kept; // the word last handed to keep (undefined: none yet)
  let hiAt = -Infinity;
  let timer = 0;
  const mine = createLimiter(RATES); // your own words: never more than the others take
  let lineKey = null; // the key a line's sealed with, made from the sid (chat/seal.js)
  sealKey(sid).then(
    (k) => (lineKey = k),
    () => {},
  );

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
    if (status === 'left' || status === 'failed' || status === s) return;
    status = s;
    changed();
  };
  // no relay answered in time: nothing more runs, and the room's left (it never was online)
  const failed = () => {
    clearInterval(timer);
    room?.leave();
    setStatus('failed');
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
      // (a full table: the one heard least lately who isn't seated makes room)
      if (limits.size >= PILOTS) {
        let old = null;
        for (const [k, v] of limits) if (!state.members.includes(k) && (old === null || v.at < limits.get(old).at)) old = k;
        limits.delete(old);
      }
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
  // leading: the squad's word to one pilot, at most once in SQUAD.stateMs, and to TELLS at most in that time
  const tell = (to) => {
    const t = now();
    if (!leading() || t - (told.get(to) ?? -Infinity) < SQUAD.stateMs) return;
    for (const [id, at] of told) if (t - at >= SQUAD.stateMs) told.delete(id);
    if (told.size >= TELLS) return;
    told.set(to, t);
    acts.st.send(writeState(state), { target: to }).catch(() => {});
  };
  const tick = () => {
    if (status !== 'online' || !state || state.gone) return;
    step({ type: 'tick' });
    if (!state.gone && now() - hiAt >= (state.members.includes(me) ? SQUAD.helloMs : SQUAD.seekMs)) hello();
  };
  // you seated, online: only then do you say anything or hear anyone, and
  // then only a member seated now whom you haven't blocked
  const seated = () => status === 'online' && Boolean(state) && !state.gone && state.members.includes(me);
  const heard = (id) => seated() && id !== me && state.members.includes(id) && !blocked(id);
  // may you say this now: seated, and no faster than the others take it
  const may = (ns) => seated() && mine.allow(ns, now());

  const api = {
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
    // a ping: { kind ('go', 'help', 'foe', 'look'), where, p ([x, y, z] or none), target }
    ping(p) {
      const data = writePing(p);
      if (!data || !may('pg')) return false;
      acts.pg.send(data).catch(() => {});
      return true;
    },
    quick(i) {
      if (readQuick(i) === null || !may('qc')) return false;
      acts.qc.send(i).catch(() => {});
      return true;
    },
    text(s) {
      const t = cleanText(s, CHAT.squadMax);
      const k = lineKey;
      if (!t || !k || !may('ch')) return false;
      seal(k, t).then(
        (c) => acts.ch.send({ c }).catch(() => {}),
        () => {},
      );
      return true;
    },
    onPing: null,
    onQuick: null,
    onText: null,
  };

  Promise.all([load(), roomOf(sid)])
    .then(([joinRoom, name]) => {
      if (status === 'left') return;
      room = joinRoom({ appId: APP_ID, cheap: new Set() }, name);
      me = room.selfId;
      const t = now();
      state = lead ? newSquad(sid, me, t) : saved ? resume(sid, me, saved, t) : joining(sid, me, t, via);
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
      acts.pg.onMessage = (data, { peerId }) => {
        const ping = heard(peerId) && allow(peerId, 'pg') ? readPing(data) : null;
        if (ping) api.onPing?.(ping, peerId);
      };
      acts.qc.onMessage = (data, { peerId }) => {
        const i = heard(peerId) && allow(peerId, 'qc') ? readQuick(data) : null;
        if (i !== null) api.onQuick?.(i, peerId);
      };
      acts.ch.onMessage = (data, { peerId }) => {
        const k = lineKey;
        if (!k || !heard(peerId) || !allow(peerId, 'ch')) return;
        unseal(k, data?.c).then((opened) => {
          const text = cleanText(opened, CHAT.squadMax);
          // (still seated once it's open)
          if (text && heard(peerId)) api.onText?.(text, peerId);
        });
      };
      room.onPeerJoin = (id) => {
        if (status !== 'online' || state.gone) return;
        hello(id);
        tell(id);
      };
      // online, at first or again: back, as someone who's been away, and a hello at once
      const online = () => {
        if (status === 'online' || status === 'left' || status === 'failed') return;
        setStatus('online');
        if (state.gone) return;
        step({ type: 'back' });
        hello();
      };
      room.onStatus = (s) => (s === 'online' ? online() : setStatus('connecting'));
      if (room.ready) room.ready.then(online, failed);
      else online();
      timer = setInterval(tick, TICK_MS);
      if (state.gone) over(); // (resumed into a squad that had turned you out)
      remember();
      changed();
    })
    .catch(failed);

  return api;
}
