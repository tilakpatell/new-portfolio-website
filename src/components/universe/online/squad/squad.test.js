import { afterEach, describe, expect, it, vi } from 'vitest';
import { schnorr } from '@noble/secp256k1';
import { hex, joinRoom } from '../nostr';
import { createRelays } from '../fakeRelays.testkit';
import { seal, sealKey } from '../chat/seal';
import { roomOf } from './invite';
import { APP_ID, createSquad } from './squad';

const URLS = ['wss://one.example', 'wss://two.example'];
const SID = 'BCDFGHJKLMNP';
const squads = [];

// Pilots on the fake relays, each on a key of their own, on one clock (the
// squads' ticks are the faked intervals: time passes a second at a time)
function sky() {
  const net = createRelays(URLS);
  let t = 1000;
  const fly = (name, { lead = false, keys = schnorr.keygen(), saved = null, keep = null } = {}) => {
    const load = () => Promise.resolve((opts, room) => joinRoom({ ...opts, relays: URLS, WebSocket: net.WebSocket, keys }, room));
    const s = createSquad({ sid: SID, lead, card: () => ({ name, kind: 'falcon', where: '/universe', shield: 100, level: 1, ready: false }), load, now: () => t, saved, keep });
    squads.push(s);
    return Object.assign(s, { keys, id: hex(keys.publicKey) });
  };
  const pass = (ms) => {
    for (let i = 0; i < ms; i += 1000) {
      t += 1000;
      vi.advanceTimersByTime(1000);
    }
  };
  // a client of someone's own in the squad's room, on the keys given
  const raw = async (keys) => {
    const r = joinRoom({ appId: APP_ID, relays: URLS, WebSocket: net.WebSocket, keys, cheap: new Set() }, await roomOf(SID));
    await r.ready;
    return r;
  };
  return { net, fly, pass, raw };
}
// wait till fn() is true (signing, checking and the relays take real time)
const until = async (fn, ms = 3000) => {
  const t = Date.now();
  while (!fn()) {
    if (Date.now() - t > ms) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 10));
  }
};
const seats = (s) => s.view().members.map((m) => [m.id, m.name, m.leader]);
// three in one squad, Alpha leading
async function three() {
  const sk = sky();
  const a = sk.fly('Alpha', { lead: true });
  await until(() => a.status === 'online');
  const b = sk.fly('Bravo');
  const c = sk.fly('Charlie');
  await until(() => [a, b, c].every((s) => s.view().members.length === 3 && s.view().members.every((m) => m.name)));
  return { ...sk, a, b, c };
}

// A room of the test's own, no relays and nothing signed: what the squad
// sends is kept with the time it went, and the test speaks for everyone else
// (from(id, ns, data)). Its time passes half a second at a time.
const ME = 'a'.repeat(64);
const [L, A, B, J, X] = ['1', '2', '3', '4', 'e'].map((c) => c.repeat(64));
const HELLO = { n: 'Biggs', k: 'falcon', w: '/universe', sh: 100, lv: 1, rd: 0 };
const word = (patch = {}) => ({ e: 1, v: 1, l: L, m: [L, ME], x: [], o: 0, r: null, lb: null, i: null, ...patch });
function bench({ ready = Promise.resolve(), ...opts } = {}) {
  let t = 1000;
  const sent = [];
  const room = {
    selfId: ME,
    ready,
    left: false,
    acts: {},
    onPeerJoin: null,
    onStatus: null,
    makeAction(ns) {
      const a = { onMessage: null, send: (data, o) => (sent.push({ ns, data, to: o?.target ?? null, t }), Promise.resolve()) };
      room.acts[ns] = a;
      return a;
    },
    leave() {
      room.left = true;
    },
  };
  const s = createSquad({ sid: SID, card: () => ({ name: 'Alpha', kind: 'falcon', where: '/universe', shield: 100, level: 1, ready: false }), load: () => Promise.resolve(() => room), now: () => t, ...opts });
  squads.push(s);
  return {
    s,
    room,
    sent,
    get t() {
      return t;
    },
    from: (id, ns, data) => room.acts[ns].onMessage(data, { peerId: id }),
    pass(ms) {
      for (let i = 0; i < ms; i += 500) {
        t += 500;
        vi.advanceTimersByTime(500);
      }
    },
  };
}
const throwaway = (n) => Array.from({ length: n }, (_, i) => (i + 16).toString(16).padStart(64, '0'));

afterEach(() => {
  for (const s of squads.splice(0)) s.close();
  vi.useRealTimers();
});

describe('createSquad, on the relays', () => {
  it('three pilots end with one view', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { a, b, c } = await three();
    expect(seats(b)).toEqual(seats(a));
    expect(seats(c)).toEqual(seats(a));
    expect(seats(a)[0]).toEqual([a.id, 'Alpha', true]);
    expect(seats(a).slice(1).map(([id]) => id).sort()).toEqual([b.id, c.id].sort());
    expect([a, b, c].map((s) => s.view().mine).sort()).toEqual([0, 1, 2]);
    for (const s of [a, b, c]) expect(s.view()).toMatchObject({ sid: SID, leader: a.id, gone: false });
  });

  it('the leader leaving hands over', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { a, b, c, pass } = await three();
    const next = a.view().members[1].id;
    a.leave();
    expect(a.view()).toMatchObject({ gone: true, why: 'left' });
    await until(() => [b, c].every((s) => s.view().leader === null));
    pass(1000);
    await until(() => [b, c].every((s) => s.view().leader === next && s.view().members.length === 2));
    expect(seats(c)).toEqual(seats(b));
    expect(b.view().members.map((m) => m.id)).not.toContain(a.id);
  });

  it('kick removes and keeps out', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { a, b, c, fly, net, pass } = await three();
    a.kick(c.id);
    await until(() => c.view().gone && b.view().members.length === 2);
    expect(c.view().why).toBe('out');
    expect(b.view().members.map((m) => m.id)).toEqual([a.id, b.id]);
    // back by the link again, on the same key: told so at once, and not seated;
    // an answer that holds once nothing has seated them in 15 s
    const again = fly('Charlie', { keys: c.keys });
    const told = () => net.relays[URLS[0]].log.some((ev) => ev.pubkey === a.id && JSON.parse(ev.content).some(([ns, , to]) => ns === 'st' && to === again.id));
    await until(told);
    await until(() => (pass(1000), again.view().gone));
    expect(again.view()).toMatchObject({ why: 'out', mine: null });
    expect(a.view().members.map((m) => m.id)).toEqual([a.id, b.id]);
  });

  it('squadmates hear each other’s pings, phrases and sealed lines, cleaned; nobody else is heard', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { a, b, c, net, raw } = await three();
    const got = [];
    b.onPing = (ping, from) => got.push(['pg', from, ping]);
    b.onQuick = (i, from) => got.push(['qc', from, i]);
    b.onText = (text, from) => got.push(['ch', from, text]);
    expect(a.ping({ kind: 'go', where: '/universe', p: [10, 0, -20] })).toBe(true);
    expect(a.quick(6)).toBe(true);
    expect(a.text('regroup, see https://bad.example now‮')).toBe(true);
    await until(() => got.length === 3);
    expect(got).toContainEqual(['pg', a.id, { kind: 'go', where: '/universe', p: [10, 0, -20], sec: null, target: null }]);
    expect(got).toContainEqual(['qc', a.id, 6]);
    expect(got).toContainEqual(['ch', a.id, 'regroup, see [link] now']);
    // the relays carry the line sealed
    expect(net.relays[URLS[0]].log.some((ev) => ev.content.includes('regroup'))).toBe(false);
    // a squadmate's client of their own: what it seals is cleaned once it's opened
    const out = await raw(c.keys);
    const key = await sealKey(SID);
    out.makeAction('ch').send({ c: await seal(key, 'go to evil . com ‮now') });
    await until(() => got.length === 4);
    expect(got[3]).toEqual(['ch', c.id, 'go to [link] now']);
    // turned out, they still have the sid, and the key it makes: not heard
    a.kick(c.id);
    await until(() => b.view().members.length === 2);
    out.makeAction('pg').send({ k: 'foe', w: '/universe' });
    out.makeAction('qc').send(3);
    out.makeAction('ch').send({ c: await seal(key, 'let me back in') });
    // nor is a stranger with the sid who was never seated, nor junk from a squadmate
    const stranger = await raw(schnorr.keygen());
    stranger.makeAction('qc').send(4);
    expect(a.ping({ kind: 'nuke', where: '/universe' })).toBe(false);
    expect(a.text('   ')).toBe(false);
    // (a word from a squadmate after all of them, and a moment more: by then they were all heard or dropped)
    a.quick(0);
    await until(() => got.length === 5);
    await new Promise((r) => setTimeout(r, 200));
    expect(got).toHaveLength(5);
    expect(got[4]).toEqual(['qc', a.id, 0]);
    out.leave();
    stranger.leave();
  });

  it('a reload picks the squad up from what it kept, and leaving forgets it', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { fly, pass } = sky();
    let kept = null;
    const keep = (w) => (kept = w);
    const a = fly('Alpha', { lead: true, keep });
    await until(() => a.status === 'online');
    const b = fly('Bravo');
    await until(() => kept?.m.length === 2 && b.view().mine === 1);
    // the page goes (a reload: no goodbye), and comes back with what it kept
    a.close();
    const back = fly('Alpha', { keys: a.keys, saved: kept, keep });
    await until(() => back.status === 'online');
    expect(back.view()).toMatchObject({ leader: a.id, mine: 0, members: [{ id: a.id }, { id: b.id }] });
    pass(1000);
    await until(() => b.view().members[0].name === 'Alpha' && b.view().members[0].away === false);
    expect(b.view()).toMatchObject({ leader: a.id, mine: 1 });
    back.leave();
    expect(kept).toBeNull();
  });
});

describe('createSquad, in a room of the test’s own', () => {
  const online = (b) => until(() => b.s.status === 'online');

  it('says hello every 1.5 s till seated, then every 3 s', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const b = bench();
    await online(b);
    const hellos = () => b.sent.filter((m) => m.ns === 'hi' && !m.to).map((m) => m.t);
    const t0 = b.t;
    b.pass(6000);
    expect(hellos()).toEqual([t0, t0 + 1500, t0 + 3000, t0 + 4500, t0 + 6000]);
    b.from(L, 'st', word());
    expect(b.s.view()).toMatchObject({ leader: L, mine: 1 });
    b.pass(6000);
    expect(hellos().filter((t) => t > t0 + 6000)).toEqual([t0 + 9000, t0 + 12000]);
  });

  it('asked in from the roster, hears only the inviter’s squad', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const b = bench({ via: A });
    await online(b);
    b.from(X, 'st', word({ l: X, m: [X, ME] }));
    expect(b.s.view()).toMatchObject({ leader: null, mine: null });
    b.from(L, 'st', word({ m: [L, A, ME] }));
    expect(b.s.view()).toMatchObject({ leader: L, mine: 2 });
  });

  it('is back when the room comes online, not when it’s made: a leader reloaded on slow relays follows the one who took over', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let open;
    const b = bench({ ready: new Promise((r) => (open = r)), saved: word({ l: ME, m: [ME, A] }) });
    await until(() => b.s.view().leader === ME); // (picked up from what was kept)
    b.pass(7000); // (the relays slow to answer)
    open();
    await online(b);
    b.from(A, 'st', word({ e: 2, v: 0, l: A, m: [ME, A] })); // (A took the lead meanwhile)
    expect(b.s.view()).toMatchObject({ leader: A, mine: 0 });
    // and back again each time the relays return after being out of reach
    const c = bench({ lead: true });
    await online(c);
    c.from(A, 'hi', HELLO);
    c.pass(3000);
    c.room.onStatus('connecting');
    c.pass(5000);
    c.room.onStatus('online');
    expect(c.sent.at(-1)).toMatchObject({ ns: 'hi', to: null, t: c.t }); // (a hello at once)
    c.from(A, 'st', word({ e: 2, v: 0, l: A, m: [ME, A] }));
    expect(c.s.view()).toMatchObject({ leader: A, mine: 0 });
  });

  it('a room full of pilots heard lately still lets a new one be heard, and seated', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const b = bench({ lead: true });
    await online(b);
    for (const id of [L, A, B]) b.from(id, 'hi', HELLO);
    expect(b.s.view().members).toHaveLength(4);
    // 32 more with the sid, on keys of their own, saying hello: no seat for them
    for (const id of throwaway(32)) b.from(id, 'hi', HELLO);
    b.from(B, 'bye', null);
    b.from(J, 'hi', HELLO);
    expect(b.s.view().members.map((m) => m.id)).toEqual([ME, L, A, J]);
  });

  it('the leader tells a pilot it won’t seat at most once in 2 s, and 4 pilots at most in that time', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const b = bench({ lead: true, blocked: () => true });
    await online(b);
    const told = (id) => b.sent.filter((m) => m.ns === 'st' && m.to === id).length;
    b.room.onPeerJoin(X);
    for (let i = 0; i < 6; i++) b.from(X, 'hi', HELLO);
    expect(told(X)).toBe(1);
    b.pass(1500);
    b.from(X, 'hi', HELLO);
    expect(told(X)).toBe(1);
    b.pass(500);
    b.from(X, 'hi', HELLO);
    expect(told(X)).toBe(2);
    // a crowd at once: four told in those 2 s (X among them), the rest on a later hello
    const crowd = throwaway(5);
    for (const id of crowd) b.from(id, 'hi', HELLO);
    expect(crowd.map((id) => told(id))).toEqual([1, 1, 1, 0, 0]);
    b.pass(2000);
    for (const id of crowd.slice(3)) b.from(id, 'hi', HELLO);
    expect(crowd.map((id) => told(id))).toEqual([1, 1, 1, 1, 1]);
    expect(b.s.view().members).toHaveLength(1);
  });

  it('no relay answering in time: failed, its ticks stopped and the room left, for good', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const ready = Promise.reject(new Error('no relay answered'));
    ready.catch(() => {});
    const b = bench({ ready });
    await until(() => b.s.status === 'failed');
    expect(vi.getTimerCount()).toBe(0);
    expect(b.room.left).toBe(true);
    for (const s of ['connecting', 'online']) {
      b.room.onStatus?.(s);
      expect(b.s.status).toBe('failed');
    }
  });
});
