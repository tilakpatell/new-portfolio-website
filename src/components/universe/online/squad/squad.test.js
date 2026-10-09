import { afterEach, describe, expect, it, vi } from 'vitest';
import { schnorr } from '@noble/secp256k1';
import { hex, joinRoom } from '../nostr';
import { createRelays } from '../fakeRelays.testkit';
import { createSquad } from './squad';

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
  return { fly, pass };
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
