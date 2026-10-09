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
    const { a, b, c, fly } = await three();
    a.kick(c.id);
    await until(() => c.view().gone && b.view().members.length === 2);
    expect(c.view().why).toBe('out');
    expect(b.view().members.map((m) => m.id)).toEqual([a.id, b.id]);
    // back by the link again, on the same key: told so, and not seated
    const again = fly('Charlie', { keys: c.keys });
    await until(() => again.view().gone);
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
