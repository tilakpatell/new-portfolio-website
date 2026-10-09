// The squad's rules: who's seated, who leads, what the squad has picked and
// who's been turned out, as plain steps with no network and no clock of
// their own, so each rule is tested in Node (squadRules.test.js). squad.js
// carries the words between the pilots; this says what each makes of them.
//
// A squad is SQUAD.size seats at most, in order, and the leader's word is the
// squad (`st`, writeState's): who's in which seat, who's been turned out,
// whether it's open, the rally, the lobby (PR 3's: none yet), the private
// game. It goes out every stateMs and on each change, with an epoch (whose
// word it is: each new leader raises it) and a version (each change the
// leader makes raises it). Everyone says hello (`hi`, a card: callsign, ship,
// where, shields, level, ready) every helloMs, every seekMs till seated
// (squad.js sends those).
//
// Seating. The leader seats a hello from a pilot who isn't turned out and
// isn't blocked, while a seat is free. Quiet awayMs, a member is away (the
// seat held, so a reload comes back to it); quiet goneMs, or their goodbye,
// and the leader frees the seat. A pilot turned out goes in the out list for
// the squad's life (the newest OUT_MAX of them) and isn't seated again.
//
// Handover. A member who hasn't heard the leader's word for leaderQuietMs
// looks along the seats, the leader's left out: the first one heard within
// liveMs takes the lead, raising the epoch. (One heard but not taking it is
// passed over after a further liveMs, and the next after another, so a pilot
// who has lost the squad, an older client or a reload that kept nothing,
// can't hold it up.) A leader's goodbye counts as leaderQuietMs of quiet.
// A word is believed from the leader on record; and from a member on record
// whose word outranks the leader's (a higher epoch; at the same epoch, the
// lower seat, each in its own word, then the lower id), when it's fair: it
// keeps every seat of yours that's been heard lately, you among them, and
// turns out none of yours (so a word from a squad that went its own way can
// move yours on, but can't shed anyone). A member believes such a word at
// once while its epoch is new (two claims at once: the lower seat wins), or
// once the leader on record has been quiet liveMs (or said goodbye). A leader
// believes it once it has heard it for liveMs and it's still coming: it was
// cut off (its word lost, its page stalled), and the squad went on without
// it, so two leaders always come to one. Just back (the room online again,
// a reload resumed, or a gap in its own ticks), anyone believes a higher
// epoch from a member at once, whatever moved on while they were away; and
// being back, a member gives the leader a fresh leaderQuietMs, so it doesn't
// claim the lead for having heard nothing. A leader with seats free seats any
// pilot it hears who isn't out, the other side of a split too, which is how
// their words come to count. Nobody outside the seats is believed; a leader
// left alone that hears another leader in its room for liveMs has lost its
// squad ('quiet'). No epoch is taken by a jump to within EPOCH_ROOM of the
// most a word may carry, so the lead can always be handed on.
//
// Joining. A pilot asking in believes a word that seats it, from whoever
// leads it; one that turns it away (out, full) or doesn't seat it is an
// answer that holds only if nothing seats it by JOIN_MS ('out', 'full' or
// 'refused'; with no word at all, 'quiet': “That squad has gone.”). Asked in
// from the roster (`via`, the inviter), it hears only words from the inviter
// or that seat the inviter. What a squad keeps through a reload is its word:
// resume() reads it back as any word is read, and the room's being online
// marks the pilot back.
//
// newSquad(sid, me, now) → a squad you lead; joining(sid, me, now, via) → one
// you're asking into; resume(sid, me, wire, now) → one you were in, from its
// word as you kept it. squadStep(state, event, now) → { state, send: [[ns,
// data]] }, for { type: 'hello', from, card, blocked }, { type: 'state',
// from, wire }, { type: 'bye', from }, { type: 'tick' } (often: squad.js's
// are twice a second), { type: 'back' } (the room online), and your own
// { type: 'leave' }, { type: 'kick', id }, { type: 'rally', rally: { w, p:
// { x, y, z, sec? } | null } | null }, { type: 'open', open }, { type:
// 'lobby', lobby } (null only, till PR 3's readLobby), { type: 'instance',
// instance }. view(state, now) → { sid, leader, mine (your seat, or null),
// members: [{ id, seat, name, kind, where, shield, level, ready, away, leader
// }], open, rally, lobby, instance, gone, why ('left', 'out', 'full',
// 'quiet', 'refused' or null) }. readState(wire) → the word, or null if any
// of it is junk; readCard(data) → { name, kind, where, shield, level, ready }
// or null; writeCard(card) → a hello's data.
//
// State: { sid, me, epoch, version, leader, members: [id], out: [id], open,
// rally, lobby, instance, cards: Map(id → { …card, at }), leaderAt (the
// leader's word last heard), joinedAt (asking in since), epochAt (this
// epoch's start), backAt (last back from away), tickAt, stAt (your word last
// sent, leading), via (asked in by), answer (asking in: what you were told),
// rivals: Map(id → { since, last }) (leading: another leader's word heard),
// gone }.

import { cleanName } from '../names';
import { cleanWhere } from '../where';
import { readPoint, writePoint } from '../wire2';
import { parseShip } from '../../crews';
import { LEVELS } from '../../economy';

export const SQUAD = { size: 4, stateMs: 2000, helloMs: 3000, seekMs: 1500, awayMs: 10000, goneMs: 45000, leaderQuietMs: 8000, liveMs: 6000 };
export const JOIN_MS = 15000; // asking in: no word of the squad by now, and it's gone
const OUT_MAX = 32; // pilots turned out, kept at most (the oldest let go past that)
const COUNT_MAX = 1e9; // an epoch or a version, at most
const EPOCH_ROOM = 1000; // no jump to an epoch closer than this to COUNT_MAX: handovers left, one at a time
const TOP = COUNT_MAX - EPOCH_ROOM;
const STRANGERS = 8; // cards kept of pilots who aren't seated, at most
const ID = /^[0-9a-f]{64}$/; // a pilot's id: their key, 64 hex digits
const INSTANCE = /^[0-9a-f]{10}$/; // invite.js's instanceOf
const NO_CARD = { name: null, kind: null, where: null, shield: null, level: null, ready: false };
const NONE = Object.freeze([]);

const isId = (v) => typeof v === 'string' && ID.test(v);
const isCount = (n) => Number.isInteger(n) && n >= 0 && n <= COUNT_MAX;
const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const distinct = (list) => new Set(list).size === list.length;

// ── the wire ──

// a hello's card as it came in, or null if it isn't one (a name cleaned, a
// ship and a place only from the lists there are, numbers clamped)
export function readCard(data) {
  if (!isObject(data)) return null;
  const shield = num(data.sh, 0, 100);
  return { name: cleanName(data.n) ?? 'Pilot', kind: parseShip(data.k), where: cleanWhere(data.w), shield: shield === null ? null : Math.round(shield), level: Math.floor(num(data.lv, 1, LEVELS.length) ?? 1), ready: data.rd === 1 };
}
export const writeCard = (c) => ({ n: c?.name ?? null, k: c?.kind ?? null, w: c?.where ?? null, sh: c?.shield ?? null, lv: c?.level ?? 1, rd: c?.ready ? 1 : 0 });

// a rally: { w: where, p: a point or null }, or null if it isn't one
const writeRally = (r) => ({ w: r.w, p: r.p ? writePoint(r.p) : null });
function readRally(data) {
  if (!isObject(data)) return null;
  const w = cleanWhere(data.w);
  const p = data.p === null || data.p === undefined ? null : readPoint(data.p);
  return w && (p || data.p == null) ? { w, p } : null;
}

export function writeState(s) {
  return { e: s.epoch, v: s.version, l: s.leader, m: [...s.members], x: [...s.out], o: s.open ? 1 : 0, r: s.rally ? writeRally(s.rally) : null, lb: s.lobby ?? null, i: s.instance ?? null };
}

// The leader's word as it came in, or null if any of it is junk: it's taken
// whole or not at all. (A field left out is its empty value; one there of the
// wrong kind is junk.)
export function readState(w) {
  if (!isObject(w)) return null;
  const { e, v, l, m, x = [], o = 0, r = null, lb = null, i = null } = w;
  if (!isCount(e) || !isCount(v) || !isId(l)) return null;
  if (!Array.isArray(m) || !m.length || m.length > SQUAD.size || !m.every(isId) || !distinct(m) || !m.includes(l)) return null;
  if (!Array.isArray(x) || x.length > OUT_MAX || !x.every(isId) || !distinct(x) || x.some((id) => m.includes(id))) return null;
  if (o !== 0 && o !== 1) return null;
  const rally = r === null ? null : readRally(r);
  if (r !== null && !rally) return null;
  // (a lobby is PR 3's, for its readLobby to read: till then, a word with one isn't ours to take)
  if (lb !== null) return null;
  if (i !== null && !(typeof i === 'string' && INSTANCE.test(i))) return null;
  return { epoch: e, version: v, leader: l, members: [...m], out: [...x], open: o === 1, rally, lobby: null, instance: i };
}

// ── the squad ──

const base = (sid, me, now) => ({ sid, me, epoch: 0, version: 0, leader: null, members: [], out: [], open: false, rally: null, lobby: null, instance: null, cards: new Map(), leaderAt: now, joinedAt: now, epochAt: -Infinity, backAt: -Infinity, tickAt: now, stAt: -Infinity, via: null, answer: null, rivals: new Map(), gone: null });
export const newSquad = (sid, me, now) => ({ ...base(sid, me, now), epoch: 1, leader: me, members: [me], epochAt: now });
export const joining = (sid, me, now, via = null) => ({ ...base(sid, me, now), via: isId(via) ? via : null });

export function resume(sid, me, wire, now) {
  const w = readState(wire);
  if (!w) return joining(sid, me, now);
  // (everyone in it as good as heard just now: a held seat isn't freed before
  // its pilot can say hello; the room's being online marks you back)
  const cards = new Map(w.members.filter((id) => id !== me).map((id) => [id, { ...NO_CARD, at: now }]));
  const s = { ...base(sid, me, now), ...w, cards };
  return w.out.includes(me) ? { ...s, gone: 'out' } : s;
}

const seated = (s) => s.members.includes(s.me);
const leads = (s) => s.leader === s.me && seated(s);
const heardAt = (s, id, now) => (id === s.me ? now : (s.cards.get(id)?.at ?? -Infinity));
const live = (s, id, now) => now - heardAt(s, id, now) <= SQUAD.liveMs;
const same = (s) => ({ state: s, send: NONE });
// your word out now, leading (and its clock started again)
const say = (s, now) => ({ state: { ...s, stAt: now }, send: [['st', writeState(s)]] });
// a change of yours, leading: a new version, out at once
const change = (s, patch, now) => say({ ...s, ...patch, version: s.version + 1 }, now);

// Does this word's leader outrank the one you follow? A higher epoch; at the
// same epoch the lower seat, each in its own word (a split's two lists may
// differ), and then the lower id.
function outranks(w, s) {
  if (w.epoch !== s.epoch) return w.epoch > s.epoch;
  const theirs = w.members.indexOf(w.leader);
  const ours = s.members.indexOf(s.leader);
  return theirs < ours || (theirs === ours && w.leader < s.leader);
}
// Is it fair, from someone who isn't the leader on record: does it keep every
// seat of yours heard lately (you among them), and turn out none of yours?
const fair = (s, w, now) => s.members.every((id) => !live(s, id, now) || w.members.includes(id)) && !w.out.some((id) => s.members.includes(id));

// another leader's word, heard while you lead: true once it's been coming for
// liveMs (the gaps no longer than liveMs), with the tally kept
function heardLong(s, from, now) {
  const was = s.rivals.get(from);
  const since = was && now - was.last <= SQUAD.liveMs ? was.since : now;
  return { long: now - since >= SQUAD.liveMs, rivals: new Map(s.rivals).set(from, { since, last: now }) };
}

// a word believed: it's the squad now
function adopt(s, w, now) {
  const was = seated(s);
  const cards = new Map(s.cards);
  // (a seat new to you: as good as heard now, till its pilot's hello comes)
  for (const id of w.members) if (id !== s.me && !cards.has(id)) cards.set(id, { ...NO_CARD, at: now });
  const next = { ...s, ...w, cards, leaderAt: now, epochAt: w.epoch === s.epoch ? s.epochAt : now, answer: null, rivals: new Map() };
  if (w.out.includes(s.me)) return { ...next, gone: 'out' };
  if (w.members.includes(s.me)) return next;
  if (w.members.length >= SQUAD.size) return { ...next, gone: 'full' };
  // (not seated, or not any longer: asking again, from now)
  return was ? { ...next, joinedAt: now } : next;
}

// asking in, with nothing believed yet: a word that seats you is the squad;
// any other is an answer that holds only if nothing seats you in time. Asked
// in from the roster, only the inviter's squad is heard.
function asking(s, w, now) {
  if (s.via && w.leader !== s.via && !w.members.includes(s.via)) return same(s);
  if (w.members.includes(s.me)) return same(adopt(s, w, now));
  return same({ ...s, answer: w.out.includes(s.me) ? 'out' : w.members.length >= SQUAD.size ? 'full' : 'refused' });
}

// back from away (the room online, or a gap in the ticks): everyone as good as
// heard now, the leader given a fresh while, and any higher epoch believed for
// liveMs
const back = (s, now) => ({ ...s, cards: new Map([...s.cards].map(([id, c]) => [id, { ...c, at: now }])), backAt: now, leaderAt: now, tickAt: now, joinedAt: seated(s) ? s.joinedAt : now });

function hello(s, { from, card, blocked = false }, now) {
  if (!isId(from) || !card) return same(s);
  const cards = new Map(s.cards).set(from, { ...card, at: now });
  const next = { ...s, cards };
  if (from !== s.me && leads(s) && !s.members.includes(from) && !s.out.includes(from) && !blocked && s.members.length < SQUAD.size) return change(next, { members: [...s.members, from] }, now);
  return same(next);
}

function heard(s, { from, wire }, now) {
  const w = from === s.me ? null : readState(wire);
  // (a jump close to the top isn't taken: the lead must stay handable)
  if (!w || w.leader !== from || (w.epoch > TOP && w.epoch > s.epoch + 1)) return same(s);
  if (s.leader === null && !seated(s)) return asking(s, w, now);
  if (from === s.leader) return w.epoch > s.epoch || (w.epoch === s.epoch && w.version >= s.version) ? same(adopt(s, w, now)) : same(s);
  if (!s.members.includes(from)) {
    // nobody outside the seats is believed; left alone, hearing another
    // leader in your room for liveMs, you've lost your squad
    if (!leads(s) || s.members.length > 1) return same(s);
    const { long, rivals } = heardLong(s, from, now);
    return same({ ...s, rivals, gone: long ? 'quiet' : null });
  }
  // just back: whatever moved on while you were away
  if (w.epoch > s.epoch && now - s.backAt <= SQUAD.liveMs) return same(adopt(s, w, now));
  if (!fair(s, w, now)) return same(s);
  // the leader's said goodbye: a member taking over
  if (s.leader === null) return w.epoch > s.epoch ? same(adopt(s, w, now)) : same(s);
  if (!outranks(w, s)) return same(s);
  // two claims at one epoch, while it's new: the lower seat, at once
  if (w.epoch === s.epoch && now - s.epochAt <= SQUAD.liveMs) return same(adopt(s, w, now));
  // leading: once it has been coming for liveMs (you were cut off, and the squad went on)
  if (leads(s)) {
    const { long, rivals } = heardLong(s, from, now);
    return same(long ? adopt(s, w, now) : { ...s, rivals });
  }
  // a member: once the leader on record has been quiet liveMs
  return same(now - s.leaderAt >= SQUAD.liveMs ? adopt(s, w, now) : s);
}

function bye(s, { from }, now) {
  if (!isId(from) || from === s.me) return same(s);
  const cards = new Map(s.cards);
  cards.delete(from);
  const next = { ...s, cards };
  if (!s.members.includes(from)) return same(next);
  if (leads(s)) return change(next, { members: s.members.filter((id) => id !== from) }, now);
  // the leader's gone: as good as quiet leaderQuietMs, so the next seat takes the lead now
  if (from === s.leader) return same({ ...next, leader: null, members: s.members.filter((id) => id !== from), leaderAt: now - SQUAD.leaderQuietMs });
  return same(next);
}

// cards of pilots who aren't seated: only those heard lately, STRANGERS at most
function prune(s, now) {
  const strangers = [...s.cards].filter(([id]) => id !== s.me && !s.members.includes(id)).sort((a, b) => b[1].at - a[1].at);
  const drop = strangers.filter(([, c], n) => n >= STRANGERS || now - c.at > SQUAD.liveMs);
  if (!drop.length) return s;
  const cards = new Map(s.cards);
  for (const [id] of drop) cards.delete(id);
  return { ...s, cards };
}

function tick(s, now) {
  // a gap in the ticks (a tab asleep, the relays out of reach): just back
  let next = now - s.tickAt >= SQUAD.leaderQuietMs ? back(s, now) : s;
  next = prune({ ...next, tickAt: now }, now);
  // (another leader's word no longer coming: forgotten)
  if ([...next.rivals.values()].some((r) => now - r.last > SQUAD.liveMs)) next = { ...next, rivals: new Map([...next.rivals].filter(([, r]) => now - r.last <= SQUAD.liveMs)) };
  if (!seated(next)) {
    if (now - next.joinedAt < JOIN_MS) return same(next);
    // (asking in: what you were told, if anything; else the squad has gone)
    return same({ ...next, gone: next.answer ?? (next.leader === null ? 'quiet' : 'refused') });
  }
  if (leads(next)) {
    const kept = next.members.filter((id) => now - heardAt(next, id, now) < SQUAD.goneMs);
    if (kept.length < next.members.length) return change(next, { members: kept }, now);
    return now - next.stAt >= SQUAD.stateMs ? say(next, now) : same(next);
  }
  // a member: the leader quiet long enough, and you next of those heard lately
  const live = next.members.filter((id) => id !== next.leader && now - heardAt(next, id, now) <= SQUAD.liveMs);
  if (now - next.leaderAt < SQUAD.leaderQuietMs + live.indexOf(next.me) * SQUAD.liveMs) return same(next);
  return say({ ...next, epoch: next.epoch + 1, version: 0, leader: next.me, leaderAt: now, epochAt: now }, now);
}

// your own changes: only the leader's count
function local(s, e, now) {
  if (e.type === 'leave') return { state: { ...s, gone: 'left' }, send: [['bye', null]] };
  if (!leads(s)) return same(s);
  if (e.type === 'kick') {
    if (e.id === s.me || !s.members.includes(e.id)) return same(s);
    const cards = new Map(s.cards);
    cards.delete(e.id);
    // (past OUT_MAX turned out, the first of them may ask in again: a squad that's turned out 32 is a rare one)
    return change({ ...s, cards }, { members: s.members.filter((id) => id !== e.id), out: [...s.out.filter((id) => id !== e.id), e.id].slice(-OUT_MAX) }, now);
  }
  if (e.type === 'rally') {
    const rally = e.rally ? readRally(writeRally(e.rally)) : null;
    return e.rally && !rally ? same(s) : change(s, { rally }, now);
  }
  if (e.type === 'open') return Boolean(e.open) === s.open ? same(s) : change(s, { open: Boolean(e.open) }, now);
  // (a lobby: none but null till PR 3's readLobby reads one)
  if (e.type === 'lobby') return e.lobby !== null || s.lobby === null ? same(s) : change(s, { lobby: null }, now);
  if (e.type === 'instance') {
    const ok = e.instance === null || (typeof e.instance === 'string' && INSTANCE.test(e.instance));
    return !ok || e.instance === s.instance ? same(s) : change(s, { instance: e.instance }, now);
  }
  return same(s);
}

export function squadStep(state, event, now) {
  if (!state || state.gone || !event) return same(state);
  switch (event.type) {
    case 'hello':
      return hello(state, event, now);
    case 'state':
      return heard(state, event, now);
    case 'bye':
      return bye(state, event, now);
    case 'tick':
      return tick(state, now);
    case 'back':
      return same(back(state, now));
    default:
      return local(state, event, now);
  }
}

export function view(s, now) {
  const mine = s.members.indexOf(s.me);
  return {
    sid: s.sid,
    leader: s.leader,
    mine: mine >= 0 ? mine : null,
    members: s.members.map((id, seat) => {
      const c = s.cards.get(id) ?? NO_CARD;
      return { id, seat, name: c.name, kind: c.kind, where: c.where, shield: c.shield, level: c.level, ready: Boolean(c.ready), away: now - heardAt(s, id, now) >= SQUAD.awayMs, leader: id === s.leader };
    }),
    open: s.open,
    rally: s.rally,
    lobby: s.lobby,
    instance: s.instance,
    gone: Boolean(s.gone),
    why: s.gone,
  };
}
