import { describe, expect, it } from 'vitest';
import { SQUAD, joining, newSquad, readCard, readState, resume, squadStep, view, writeCard, writeState } from './squadRules';

const SID = 'BCDFGHJKLMNP';
// pilots by their keys (a pilot's id online: 64 hex digits)
const [L, A, B, C, D, X] = ['1', '2', '3', '4', '5', 'e'].map((c) => c.repeat(64));
const NAMES = { [L]: 'Leia', [A]: 'Ackbar', [B]: 'Biggs', [C]: 'Chewie', [D]: 'Dak', [X]: 'Xizor' };
const card = (id) => readCard({ n: NAMES[id], k: 'falcon', w: '/universe', sh: 80, lv: 3, rd: 0 });
const hello = (from, extra = {}) => ({ type: 'hello', from, card: card(from), ...extra });
// a leader's word, as the wire has it
const word = (patch = {}) => ({ e: 1, v: 0, l: L, m: [L, A], x: [], o: 0, r: null, lb: null, i: null, ...patch });

// Pilots on one clock (ms): each a state of its own. What one says (the
// steps' send) the others hear at once, unless either is `away` (asleep, or
// reloading) or the pair is `deaf` ('from>to'); every second each pilot not
// away ticks, and every helloMs says hello, unless it's `still` (says hello
// but never ticks: a pilot who's lost the squad). A `stalled` pilot's page has
// frozen: it neither ticks nor says anything, and what's said to it waits
// till it wakes. broadcast() is a word from anyone, one of the crew or a
// client of someone's own.
function crew(states) {
  const pilots = new Map(states.map((s) => [s.me, s]));
  const away = new Set();
  const deaf = new Set();
  const still = new Set();
  const stalled = new Map(); // id → what came in while frozen, in order
  const said = [];
  let t = 0;
  const hears = (from, to) => to !== from && !away.has(to) && !away.has(from) && !deaf.has(`${from}>${to}`);
  const deliver = (to, event) => (stalled.has(to) ? stalled.get(to).push(event) : run(to, event));
  const broadcast = (from, ns, data) => {
    for (const to of [...pilots.keys()]) if (hears(from, to)) deliver(to, ns === 'st' ? { type: 'state', from, wire: data } : { type: ns, from });
  };
  function run(id, event) {
    const { state, send } = squadStep(pilots.get(id), event, t);
    pilots.set(id, state);
    for (const [ns, data] of send) {
      said.push({ from: id, ns, data, t });
      broadcast(id, ns, data);
    }
  }
  const greet = (id) => {
    for (const to of [...pilots.keys()]) if (hears(id, to)) deliver(to, hello(id));
  };
  return {
    get t() {
      return t;
    },
    state: (id) => pilots.get(id),
    view: (id) => view(pilots.get(id), t),
    // (those here who think they lead)
    leaders: () => [...pilots.values()].filter((s) => s.leader === s.me && !s.gone && !away.has(s.me)).map((s) => s.me),
    put: (s) => pilots.set(s.me, s),
    // back from a reload with what the page kept, its room online
    resume(id, kept) {
      pilots.set(id, resume(SID, id, kept, t));
      run(id, { type: 'back' });
    },
    remove: (id) => pilots.delete(id),
    stall: (id) => stalled.set(id, []),
    // the page unfreezes: what came in is heard, in order, then it ticks
    wake(id) {
      const waiting = stalled.get(id) ?? [];
      stalled.delete(id);
      for (const e of waiting) run(id, e);
      run(id, { type: 'tick' });
    },
    away,
    deaf,
    still,
    said,
    run,
    greet,
    broadcast,
    pass(ms) {
      for (const end = t + ms; t < end; ) {
        t += 1000;
        for (const id of [...pilots.keys()]) if (!away.has(id) && !still.has(id) && !stalled.has(id)) run(id, { type: 'tick' });
        if (t % SQUAD.helloMs === 0) for (const id of [...pilots.keys()]) if (!away.has(id) && !stalled.has(id)) greet(id);
      }
    },
  };
}
// a squad led by the first, the rest seated in order, each having said hello
function formed(...ids) {
  const c = crew([newSquad(SID, ids[0], 0), ...ids.slice(1).map((id) => joining(SID, id, 0))]);
  for (const id of ids) c.greet(id);
  return c;
}
// each of these follows `leader`, and all list the same seats
function agree(c, leader, ids) {
  const seats = c.view(ids[0]).members.map((m) => m.id);
  for (const id of ids) {
    expect(c.view(id), id).toMatchObject({ leader, gone: false });
    expect(c.view(id).members.map((m) => m.id), id).toEqual(seats);
  }
}

describe('the squad’s rules', () => {
  it('has the values the design gives', () => {
    expect(SQUAD).toEqual({ size: 4, stateMs: 2000, helloMs: 3000, seekMs: 1500, awayMs: 10000, goneMs: 45000, leaderQuietMs: 8000, liveMs: 6000 });
  });

  it('the leader seats a hello', () => {
    const { state, send } = squadStep(newSquad(SID, L, 0), hello(A), 100);
    expect(state.members).toEqual([L, A]);
    expect(send).toEqual([['st', writeState(state)]]); // (told at once)
    expect(readState(send[0][1])).toMatchObject({ epoch: 1, leader: L, members: [L, A] });
    expect(view(state, 100).members[1]).toMatchObject({ id: A, seat: 1, name: 'Ackbar', kind: 'falcon', shield: 80, level: 3, ready: false, away: false, leader: false });
    // a seated pilot's hello seats nobody again
    expect(squadStep(state, hello(A), 200).send).toEqual([]);
    // and only the leader seats anyone
    const a = squadStep(joining(SID, A, 0), { type: 'state', from: L, wire: word() }, 100).state;
    expect(squadStep(a, hello(B), 200).state.members).toEqual([L, A]);
  });

  it('a fifth is not seated', () => {
    const c = formed(L, A, B, C);
    c.put(joining(SID, D, c.t));
    c.greet(D);
    expect(c.state(L).members).toEqual([L, A, B, C]);
    // the squad's word says it's full: the answer, once nothing has seated them in time
    c.pass(14000);
    expect(c.view(D)).toMatchObject({ mine: null, gone: false });
    c.pass(1000);
    expect(c.view(D)).toMatchObject({ mine: null, gone: true, why: 'full' });
  });

  it('a turned-out pilot is not seated again', () => {
    const c = formed(L, A, B);
    c.run(L, { type: 'kick', id: A });
    expect(c.state(L).members).toEqual([L, B]);
    expect(c.state(L).out).toEqual([A]);
    expect(c.view(B).members.map((m) => m.id)).toEqual([L, B]);
    expect(c.view(A)).toMatchObject({ gone: true, why: 'out' });
    // back by link, or by a reload: still out
    c.put(joining(SID, A, c.t));
    c.greet(A);
    expect(c.state(L).members).toEqual([L, B]);
    c.pass(15000);
    expect(c.view(A)).toMatchObject({ gone: true, why: 'out' });
    // nor is a pilot the leader has blocked
    expect(squadStep(c.state(L), hello(C, { blocked: true }), c.t).state.members).toEqual([L, B]);
    // and only the leader turns anyone out
    expect(squadStep(c.state(B), { type: 'kick', id: L }, c.t).send).toEqual([]);
  });

  it('quiet 10 s is away, 45 s frees the seat', () => {
    const c = formed(L, A, B);
    c.pass(3000);
    c.away.add(A);
    const heard = c.state(L).cards.get(A).at;
    c.pass(heard + 9000 - c.t);
    expect(c.view(L).members[1]).toMatchObject({ id: A, away: false });
    c.pass(1000);
    expect(c.view(L).members[1]).toMatchObject({ id: A, away: true }); // (dimmed, the seat held)
    expect(c.view(B).members[1]).toMatchObject({ id: A, away: true });
    c.pass(heard + 44000 - c.t);
    expect(c.state(L).members).toEqual([L, A, B]);
    c.pass(1000);
    expect(c.state(L).members).toEqual([L, B]);
    expect(c.state(B).members).toEqual([L, B]);
  });

  it('a reload keeps the seat', () => {
    const c = formed(L, A, B);
    c.pass(3000);
    c.away.add(A);
    c.pass(20000);
    // back, with nothing kept but the sid: the same key's hello is the same pilot
    c.away.delete(A);
    c.put(joining(SID, A, c.t));
    c.greet(A);
    c.pass(30000);
    expect(c.state(L).members).toEqual([L, A, B]);
    expect(c.view(A)).toMatchObject({ mine: 1, leader: L, gone: false });
  });

  it('the leader quiet 8 s: seat 1 leads at a higher epoch', () => {
    const c = formed(L, A, B);
    c.pass(2000);
    c.away.add(L);
    const last = c.state(A).leaderAt;
    c.pass(last + 7000 - c.t);
    expect(c.state(A)).toMatchObject({ leader: L, epoch: 1 });
    c.pass(1000);
    expect(c.state(A)).toMatchObject({ leader: A, epoch: 2 });
    expect(c.state(B)).toMatchObject({ leader: A, epoch: 2 });
    expect(c.said.filter((m) => m.ns === 'st' && m.from === B)).toEqual([]);
    // the old leader keeps their seat, away, till they're back or it's freed
    expect(c.view(B).members.map((m) => [m.id, m.leader])).toEqual([[L, false], [A, true], [B, false]]);
  });

  it('seat 2 does not claim while seat 1 is live', () => {
    const c = formed(L, A, B);
    c.pass(2000);
    c.away.add(L);
    c.still.add(A); // (heard saying hello, but not taking the lead)
    const last = c.state(B).leaderAt;
    c.pass(last + 13000 - c.t);
    expect(c.state(B)).toMatchObject({ leader: L, epoch: 1 });
    expect(c.said.filter((m) => m.ns === 'st' && m.from === B)).toEqual([]);
  });

  it('a live seat that never takes the lead is passed over after a further 6 s', () => {
    const c = formed(L, A, B);
    c.pass(2000);
    c.away.add(L);
    c.still.add(A);
    const last = c.state(B).leaderAt;
    c.pass(last + 14000 - c.t);
    expect(c.state(B)).toMatchObject({ leader: B, epoch: 2 });
    expect(c.state(A)).toMatchObject({ leader: B, epoch: 2 });
  });

  it('seat 2 leads at 8 s when seat 1 is quiet too', () => {
    const c = formed(L, A, B);
    c.pass(2000);
    c.away.add(L);
    c.away.add(A);
    c.pass(c.state(B).leaderAt + 8000 - c.t);
    expect(c.state(B)).toMatchObject({ leader: B, epoch: 2 });
  });

  it('two claims at one epoch: the lower seat wins', () => {
    const c = formed(L, A, B, C);
    c.pass(2000);
    c.away.add(L);
    // A and B don't hear each other: each thinks it's next
    c.deaf.add(`${A}>${B}`);
    c.deaf.add(`${B}>${A}`);
    c.pass(10000);
    expect(c.leaders().sort()).toEqual([A, B].sort());
    expect(c.state(C)).toMatchObject({ leader: A, epoch: 2 });
    // they hear each other again: the higher seat gives way
    c.deaf.clear();
    c.pass(2000);
    expect(c.leaders()).toEqual([A]);
    for (const id of [A, B, C]) expect(c.state(id)).toMatchObject({ leader: A, epoch: 2 });
    // and the other way round: the higher seat's claim heard first, then the lower's
    const quiet = formed(L, A, B, C);
    quiet.pass(2000);
    const t = quiet.state(C).leaderAt + 9000;
    const claim = (id) => word({ e: 2, v: 0, l: id, m: [L, A, B, C] });
    let s = squadStep(quiet.state(C), { type: 'state', from: B, wire: claim(B) }, t).state;
    expect(s.leader).toBe(B);
    s = squadStep(s, { type: 'state', from: A, wire: claim(A) }, t + 100).state;
    expect(s.leader).toBe(A);
    s = squadStep(s, { type: 'state', from: B, wire: claim(B) }, t + 200).state;
    expect(s.leader).toBe(A);
  });

  it('the leader back finds a higher epoch and is a member', () => {
    const c = formed(L, A, B);
    c.pass(2000);
    c.away.add(L); // (a tab asleep, or the relays out of its reach: no word either way)
    c.pass(12000);
    expect(c.state(A)).toMatchObject({ leader: A, epoch: 2 });
    c.away.delete(L);
    c.pass(3000);
    expect(c.state(L)).toMatchObject({ leader: A, epoch: 2 });
    expect(c.view(L)).toMatchObject({ mine: 0, leader: A });
    expect(c.leaders()).toEqual([A]);
  });

  it('a member’s word doesn’t move a live leader at once, nor a settled epoch', () => {
    const c = formed(L, A, B);
    c.pass(4000);
    const grab = word({ e: 9, v: 0, l: A, m: [L, A, B] });
    c.run(L, { type: 'state', from: A, wire: grab });
    c.run(B, { type: 'state', from: A, wire: grab });
    expect(c.state(L)).toMatchObject({ leader: L, epoch: 1 });
    expect(c.state(B)).toMatchObject({ leader: L, epoch: 1 });
    // nor at the same epoch from a lower seat, once that epoch has settled
    const d = formed(L, A, B);
    d.pass(2000);
    d.away.add(L);
    d.pass(10000);
    expect(d.state(B)).toMatchObject({ leader: A, epoch: 2 });
    d.pass(7000);
    d.run(B, { type: 'state', from: L, wire: word({ e: 2, v: 0, l: L, m: [L, A, B] }) });
    expect(d.state(B)).toMatchObject({ leader: A, epoch: 2 });
  });

  it('a leader whose word was lost while it ticked on gives way once it has heard the new one 6 s', () => {
    // (its word lost about 8 s: the relays slowing it, or one path down)
    const c = formed(L, A, B);
    c.pass(2000);
    c.deaf.add(`${L}>${A}`);
    c.deaf.add(`${L}>${B}`);
    c.pass(10000);
    expect(c.leaders().sort()).toEqual([L, A].sort());
    c.deaf.clear();
    c.pass(6000);
    expect(c.leaders()).toEqual([A]);
    agree(c, A, [L, A, B]);
    c.pass(30000);
    expect(c.leaders()).toEqual([A]);
    agree(c, A, [L, A, B]);
  });

  it('a leader back from a reload whose relays take 7 s to answer follows the one who took the lead', () => {
    const c = formed(L, A, B);
    c.pass(3000);
    const kept = writeState(c.state(L));
    c.away.add(L);
    c.pass(9000);
    expect(c.state(A)).toMatchObject({ leader: A, epoch: 2 });
    // the page is back with what it kept, its relays not answering yet
    c.put(resume(SID, L, kept, c.t));
    c.pass(7000);
    c.away.delete(L);
    c.run(L, { type: 'back' }); // (the room online at last, and ticking at once: 7 s, no gap that marks it back)
    c.run(L, { type: 'tick' });
    c.pass(4000);
    expect(c.leaders()).toEqual([A]);
    agree(c, A, [L, A, B]);
  });

  it('a leader whose page froze for 7 s, under the 8 that mark it away, gives way to the one who took the lead meanwhile', () => {
    const c = formed(L, A, B);
    c.pass(5000); // (L's word went at 4 s; the tick at 5 s said nothing)
    c.stall(L);
    c.pass(7000);
    expect(c.state(A)).toMatchObject({ leader: A, epoch: 2 });
    c.wake(L);
    expect(c.state(L)).toMatchObject({ leader: L, epoch: 1 });
    c.pass(8000);
    expect(c.leaders()).toEqual([A]);
    agree(c, A, [L, A, B]);
  });

  it('a member claiming the lead while the leader is live ends with one leader, never two', () => {
    const c = formed(L, A, B, C);
    c.pass(4000);
    // C's client is someone's own from now on: it claims the lead, again and again
    c.remove(C);
    const grab = word({ e: 2, v: 0, l: C, m: [L, A, B, C] });
    for (let i = 0; i < 10; i++) {
      c.broadcast(C, 'st', grab);
      c.greet(C);
      c.pass(2000);
    }
    agree(c, C, [L, A, B]);
    expect(c.leaders()).toEqual([]);
    // it goes quiet: the next seat takes the lead, and one leads again
    c.pass(20000);
    expect(c.leaders()).toEqual([L]);
    agree(c, L, [L, A, B]);
    // a claim that would shed a seat that's live, or turn one out, gets nowhere
    for (const unfair of [word({ e: 2, l: C, m: [L, C, B] }), word({ e: 2, l: C, m: [L, B, C], x: [A] })]) {
      const d = formed(L, A, B, C);
      d.pass(4000);
      d.remove(C);
      for (let i = 0; i < 10; i++) {
        d.broadcast(C, 'st', unfair);
        d.greet(C);
        d.pass(2000);
      }
      expect(d.leaders()).toEqual([L]);
      agree(d, L, [L, A, B]);
    }
    // nor does anyone outside the seats, however long they keep at it
    const e = formed(L, A, B, C);
    e.pass(4000);
    for (let i = 0; i < 10; i++) {
      e.broadcast(X, 'st', word({ e: 9, l: X, m: [X, L, A, B] }));
      e.greet(X);
      e.pass(2000);
    }
    expect(e.leaders()).toEqual([L]);
    agree(e, L, [L, A, B, C]);
  });

  it('both gone, both back: one leader', () => {
    // the leader and a member reload at once, and are back before anyone takes the lead
    const c = formed(L, A, B);
    c.pass(3000);
    const kept = { [L]: writeState(c.state(L)), [A]: writeState(c.state(A)) };
    c.away.add(L);
    c.away.add(A);
    c.pass(4000);
    c.away.clear();
    c.resume(L, kept[L]);
    c.resume(A, kept[A]);
    c.pass(20000);
    expect(c.leaders()).toEqual([L]);
    for (const id of [L, A, B]) expect(c.view(id)).toMatchObject({ leader: L, members: [{ id: L }, { id: A }, { id: B }] });

    // the same, slower: the one who stayed has taken the lead by the time they're back
    const d = formed(L, A, B);
    d.pass(3000);
    const kept2 = { [L]: writeState(d.state(L)), [A]: writeState(d.state(A)) };
    d.away.add(L);
    d.away.add(A);
    d.pass(12000);
    expect(d.state(B)).toMatchObject({ leader: B, epoch: 2 });
    d.away.clear();
    d.resume(L, kept2[L]);
    d.resume(A, kept2[A]);
    d.pass(6000);
    expect(d.leaders()).toEqual([B]); // (nobody's left leading a squad of ghosts)
    for (const id of [L, A, B]) expect(d.view(id)).toMatchObject({ leader: B, members: [{ id: L, away: false }, { id: A, away: false }, { id: B }] });

    // and two alone, both back from a reload: the squad's still there
    const e = formed(L, A);
    e.pass(3000);
    const kept3 = { [L]: writeState(e.state(L)), [A]: writeState(e.state(A)) };
    e.away.add(L);
    e.away.add(A);
    e.pass(5000);
    e.away.clear();
    e.resume(L, kept3[L]);
    e.resume(A, kept3[A]);
    e.pass(20000);
    expect(e.leaders()).toEqual([L]);
    expect(e.view(A)).toMatchObject({ mine: 1, leader: L, gone: false });
  });

  it('the leader’s goodbye hands over at once', () => {
    const c = formed(L, A, B);
    c.pass(3000);
    c.run(L, { type: 'leave' });
    expect(c.view(L)).toMatchObject({ gone: true, why: 'left' });
    c.away.add(L);
    c.pass(1000);
    for (const id of [A, B]) expect(c.view(id)).toMatchObject({ leader: A, members: [{ id: A }, { id: B }] });
    // a member's goodbye frees their seat
    c.run(B, { type: 'leave' });
    expect(c.state(A).members).toEqual([A]);
  });

  it('a state from a stranger is dropped', () => {
    const c = formed(L, A);
    c.pass(3000);
    const before = c.state(A);
    expect(squadStep(before, { type: 'state', from: X, wire: word({ e: 5, l: X, m: [X, A] }) }, c.t).state).toBe(before);
    // nor from someone turned out, nor a word in a leader's name from someone else
    const d = formed(L, A, B);
    d.run(L, { type: 'kick', id: A });
    const b = d.state(B);
    expect(squadStep(b, { type: 'state', from: A, wire: word({ e: 7, l: A, m: [A, B] }) }, d.t).state).toBe(b);
    expect(squadStep(b, { type: 'state', from: A, wire: word({ e: 7, l: L, m: [L, B] }) }, d.t).state).toBe(b);
  });

  it('a phantom’s “out” doesn’t turn a joiner away when the leader seats them', () => {
    // (X holds the sid, and answers anyone asking in)
    const c = formed(L, A);
    c.pass(2000);
    c.put(joining(SID, B, c.t));
    c.broadcast(X, 'st', word({ e: 7, l: X, m: [X], x: [B] }));
    c.broadcast(X, 'st', word({ e: 7, l: X, m: [X, C, D, A] }));
    expect(c.view(B)).toMatchObject({ gone: false, mine: null, leader: null });
    c.greet(B);
    expect(c.view(B)).toMatchObject({ gone: false, mine: 2, leader: L });
    // and from then on it's nobody's word
    c.broadcast(X, 'st', word({ e: 8, l: X, m: [X, B], x: [L] }));
    c.pass(20000);
    agree(c, L, [L, A, B]);
    // with nothing to seat them, the last answer holds once the time's up
    const d = formed(L, A, B, C);
    d.put(joining(SID, D, d.t));
    d.broadcast(X, 'st', word({ e: 7, l: X, m: [X], x: [D] }));
    d.greet(D);
    d.pass(15000);
    expect(d.view(D)).toMatchObject({ gone: true, why: 'full' });
  });

  it('an invite’s joiner believes only the inviter’s squad', () => {
    const c = formed(L, A);
    c.pass(2000);
    c.put(joining(SID, B, c.t, A)); // (asked in from the roster by A, a member)
    c.broadcast(X, 'st', word({ e: 7, l: X, m: [X, B] }));
    expect(c.view(B)).toMatchObject({ mine: null, leader: null });
    c.greet(B);
    expect(c.view(B)).toMatchObject({ mine: 2, leader: L });
    // asked in by the leader: the leader's word
    const d = formed(L, A);
    d.put(joining(SID, B, d.t, L));
    d.broadcast(X, 'st', word({ e: 7, l: X, m: [X, B] }));
    expect(d.view(B)).toMatchObject({ mine: null, leader: null });
    d.greet(B);
    expect(d.view(B)).toMatchObject({ mine: 2, leader: L });
  });

  it('a pilot a phantom seated comes to the squad once the phantom’s gone, and one leads', () => {
    const c = formed(L, A);
    c.pass(2000);
    c.put(joining(SID, B, c.t));
    c.broadcast(X, 'st', word({ e: 7, l: X, m: [X, B] })); // (first, and it seats B)
    expect(c.view(B)).toMatchObject({ leader: X, mine: 1 });
    // X goes; B takes its lead, seats those it hears, and the two squads become one
    c.pass(60000);
    expect(c.leaders()).toHaveLength(1);
    agree(c, c.leaders()[0], [L, A, B]);
    expect(c.view(L).members.map((m) => m.id)).toEqual(expect.arrayContaining([L, A, B]));
  });

  it('a leader left alone, hearing another leader in its room for 6 s, says its squad has gone', () => {
    // (one a phantom seated, whose phantom left, while the real squad carries on
    // in the same room, its leader turned out where it was)
    const real = word({ e: 3, l: L, m: [L, A, B] });
    let s = newSquad(SID, B, 0);
    for (let t = 1000; t <= 6000; t += 1000) {
      s = squadStep(s, { type: 'tick' }, t).state;
      if (t % 2000 === 0) s = squadStep(s, { type: 'state', from: L, wire: real }, t).state;
    }
    expect(view(s, 6000)).toMatchObject({ gone: false, leader: B });
    for (let t = 7000; t <= 8000; t += 1000) {
      s = squadStep(s, { type: 'tick' }, t).state;
      if (t % 2000 === 0) s = squadStep(s, { type: 'state', from: L, wire: real }, t).state;
    }
    expect(view(s, 8000)).toMatchObject({ gone: true, why: 'quiet' }); // (the page: “That squad has gone.”)
    // one with a squad of its own isn't moved by a stranger's word, however long
    const other = formed(B, C);
    for (let i = 0; i < 10; i++) {
      other.broadcast(L, 'st', real);
      other.pass(2000);
    }
    agree(other, B, [B, C]);
  });

  it('an epoch close to the top isn’t taken by a jump, so the lead can always be handed on', () => {
    const top = 1e9 - 1000;
    const a = squadStep(joining(SID, A, 0), { type: 'state', from: L, wire: word() }, 100).state;
    expect(squadStep(a, { type: 'state', from: L, wire: word({ e: top + 1 }) }, 200).state).toBe(a);
    const high = squadStep(a, { type: 'state', from: L, wire: word({ e: top }) }, 300).state;
    expect(high.epoch).toBe(top);
    // from there, one at a time, to the most a word carries
    expect(squadStep(high, { type: 'state', from: L, wire: word({ e: top + 1 }) }, 400).state.epoch).toBe(top + 1);
  });

  it('a state with five members, an unknown field type, or an out list over 32 is dropped whole', () => {
    const ids = (n, from = 0) => Array.from({ length: n }, (_, i) => (from + i + 16).toString(16).padStart(64, '0'));
    expect(readState(word())).toMatchObject({ epoch: 1, version: 0, leader: L, members: [L, A], out: [], open: false, rally: null, lobby: null, instance: null });
    const bad = [word({ m: [L, ...ids(4)] }), word({ x: ids(33) }), word({ e: '1' }), word({ e: -1 }), word({ e: 1.5 }), word({ v: null }), word({ l: 'han' }), word({ m: L }), word({ m: [L, 'han'] }), word({ m: [L, L] }), word({ m: [A] }), word({ x: [A] }), word({ x: 'none' }), word({ o: true }), word({ o: 2 }), word({ r: 5 }), word({ r: { w: '/universe', p: 'here' } }), word({ r: { w: 'nowhere', p: null } }), word({ i: 'abc' }), word({ i: 7 }), null, 'st', [], 42];
    for (const w of bad) expect(readState(w), JSON.stringify(w)).toBeNull();
    expect(readState(word({ x: ids(32) })).out).toHaveLength(32);
    // dropped whole: nothing of it is taken, even from the leader on record
    const a = squadStep(joining(SID, A, 0), { type: 'state', from: L, wire: word() }, 100).state;
    const after = squadStep(a, { type: 'state', from: L, wire: word({ v: 1, m: [L, A, B], o: 1, i: 'nope' }) }, 200).state;
    expect(after).toBe(a);
  });

  it('a lobby isn’t read yet: a state carrying one is dropped (PR 3’s readLobby reads them)', () => {
    expect(readState(word({ lb: null }))).not.toBeNull();
    const { lb, ...without } = word();
    expect(lb).toBeNull();
    expect(readState(without)).not.toBeNull();
    expect(readState(word({ lb: { a: 'roam', ph: 'open' } }))).toBeNull();
    // and a leader can't set one
    const s = newSquad(SID, L, 0);
    expect(squadStep(s, { type: 'lobby', lobby: { a: 'roam' } }, 100).send).toEqual([]);
  });

  it('no state within 15 s of joining: gone', () => {
    let s = joining(SID, A, 0);
    for (let t = 1000; t < 15000; t += 1000) s = squadStep(s, { type: 'tick' }, t).state;
    expect(view(s, 14000)).toMatchObject({ gone: false, mine: null });
    s = squadStep(s, { type: 'tick' }, 15000).state;
    expect(view(s, 15000)).toMatchObject({ gone: true, why: 'quiet' }); // (“That squad has gone.”)
    // one that hears the squad but isn't seated has that answer by then
    let h = squadStep(joining(SID, A, 0), { type: 'state', from: L, wire: word({ m: [L] }) }, 5000).state;
    expect(view(h, 5000)).toMatchObject({ gone: false, leader: null, mine: null });
    for (let t = 6000; t <= 15000; t += 1000) h = squadStep(h, { type: 'tick' }, t).state;
    expect(view(h, 15000)).toMatchObject({ gone: true, why: 'refused' });
  });

  it('the leader’s changes go out to everyone, and nobody else’s', () => {
    const c = formed(L, A);
    c.run(L, { type: 'rally', rally: { w: '/galaxy/hoth', p: { x: 10, y: 2, z: -30 } } });
    c.run(L, { type: 'open', open: true });
    c.run(L, { type: 'instance', instance: '0123456789' });
    expect(c.view(A)).toMatchObject({ rally: { w: '/galaxy/hoth', p: { x: 10, y: 2, z: -30 } }, open: true, instance: '0123456789' });
    c.run(L, { type: 'rally', rally: null });
    c.run(L, { type: 'instance', instance: null });
    expect(c.view(A)).toMatchObject({ rally: null, instance: null });
    // junk changes nothing, and a member's word changes nothing
    const s = c.state(L);
    for (const e of [{ type: 'rally', rally: { w: 'nowhere' } }, { type: 'instance', instance: 'xyz' }]) expect(squadStep(s, e, c.t).state).toBe(s);
    expect(squadStep(c.state(A), { type: 'open', open: false }, c.t).send).toEqual([]);
  });

  it('what a squad keeps through a reload is its word, read back as any word is', () => {
    const c = formed(L, A, B);
    c.run(L, { type: 'kick', id: B });
    const kept = writeState(c.state(A));
    const s = resume(SID, A, kept, 100);
    expect(view(s, 100)).toMatchObject({ sid: SID, leader: L, mine: 1, gone: false });
    expect(s.out).toEqual([B]);
    // turned out: still out after a reload
    expect(view(resume(SID, B, writeState(c.state(L)), 100), 100)).toMatchObject({ gone: true, why: 'out' });
    // nothing kept, or junk: asking in afresh
    expect(view(resume(SID, A, 'junk', 100), 100)).toMatchObject({ leader: null, mine: null, gone: false });
  });

  it('reads a hello’s card, and junk as none', () => {
    const c = { name: 'Leia', kind: 'falcon', where: '/galaxy/hoth', shield: 42, level: 5, ready: true };
    expect(readCard(writeCard(c))).toEqual(c);
    expect(readCard({})).toEqual({ name: 'Pilot', kind: null, where: null, shield: null, level: 1, ready: false });
    expect(readCard({ n: 'Han‮Solo', k: 'tardis', w: 'javascript:alert(1)', sh: 1e9, lv: 99, rd: true })).toEqual({ name: 'HanSolo', kind: null, where: null, shield: 100, level: 11, ready: false });
    for (const junk of [null, undefined, 'hi', 42, []]) expect(readCard(junk)).toBeNull();
  });
});
