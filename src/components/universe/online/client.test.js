import { describe, expect, it } from 'vitest';
import { createClient } from './client';

// An in-memory room: what one client sends, the others get straight away.
function createBus() {
  const rooms = [];
  const room = (id) => {
    const actions = {};
    const r = {
      id,
      onPeerJoin: null,
      onPeerLeave: null,
      makeAction(ns) {
        const a = {
          onMessage: null,
          send(data, opts) {
            const to = opts?.target;
            for (const o of rooms) {
              if (o === r || (to && to !== o.id)) continue;
              o.actions[ns]?.onMessage?.(JSON.parse(JSON.stringify(data)), { peerId: id });
            }
            return Promise.resolve();
          },
        };
        actions[ns] = a;
        return a;
      },
      leave: () => Promise.resolve(),
      actions,
    };
    rooms.push(r);
    return r;
  };
  return {
    load: (id) => () => Promise.resolve({ selfId: id, joinRoom: () => room(id) }),
    // everyone meets everyone
    meet() {
      for (const a of rooms) for (const b of rooms) if (a !== b) a.onPeerJoin?.(b.id);
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function pair() {
  const bus = createBus();
  let t = 1000;
  const now = () => t;
  const a = createClient({ name: 'Han', kind: 'falcon', load: bus.load('A'), now });
  const b = createClient({ name: 'Rick', kind: 'cruiser', load: bus.load('B'), now });
  await flush();
  bus.meet();
  const seen = { a: [], b: [] };
  a.on((e) => seen.a.push(e));
  b.on((e) => seen.b.push(e));
  return { a, b, seen, tick: (ms) => (t += ms) };
}

const ship = (x = 0) => ({ x, y: 0, z: 0, heading: 0, pitch: 0, bank: 0, speed: 0, vy: 0 });

describe('createClient', () => {
  it('each sees the other, by name and ship', async () => {
    const { a, b } = await pair();
    expect(a.snapshot().status).toBe('online');
    expect(a.snapshot().peers).toEqual([{ id: 'B', name: 'Rick', kind: 'cruiser', kills: 0, where: '/universe', ally: 'none', blocked: false }]);
    expect(b.snapshot().peers[0].name).toBe('Han');
  });

  it('passes poses along, read and timed', async () => {
    const { a, b } = await pair();
    a.pose(ship(4));
    const p = b.peers.get('A');
    expect(p.pose.x).toBe(4);
    expect(p.snaps).toHaveLength(1);
    expect(p.pose.at).toBe(1000);
  });

  it('makes an alliance only when both want one', async () => {
    const { a, b, seen } = await pair();
    a.ally('B', 'ask');
    expect(a.peers.get('B').ally).toBe('sent');
    expect(b.peers.get('A').ally).toBe('got');
    expect(seen.b.some((e) => e.type === 'feed' && /wants to be allies/.test(e.text))).toBe(true);
    b.ally('A', 'accept');
    expect(a.peers.get('B').ally).toBe('ally');
    expect(b.peers.get('A').ally).toBe('ally');
    b.ally('A', 'end');
    expect(a.peers.get('B').ally).toBe('none');
  });

  it('a hit counts after a shot, and not between allies', async () => {
    const { a, b, seen, tick } = await pair();
    b.pose(ship(0)); // b is flying, where a hit can land
    a.pose(ship(3));
    a.shot({ x: 3, y: 0, z: 0 }, [0, 0, -20]);
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(1);
    // allies can't hurt each other
    a.ally('B', 'ask');
    b.ally('A', 'accept');
    tick(300);
    a.shot({ x: 3, y: 0, z: 0 }, [0, 0, -20]);
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(1);
  });

  it('a hit with no shot first does nothing', async () => {
    const { a, b, seen } = await pair();
    b.pose(ship(0));
    a.pose(ship(3));
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(0);
  });

  it('hits on a ship that is down or just back do nothing', async () => {
    const { a, b, seen } = await pair();
    b.pose(ship(0), { safe: true });
    a.pose(ship(3));
    a.shot({ x: 3, y: 0, z: 0 }, [0, 0, -20]);
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(0);
  });

  it('credits the kill to whoever shot you down', async () => {
    const { a, b, seen } = await pair();
    b.down('A');
    expect(a.snapshot().self.kills).toBe(1);
    expect(b.peers.get('A').kills).toBe(1); // a's hello went round again
    expect(seen.a.some((e) => e.type === 'feed' && e.text === 'You shot down Rick')).toBe(true);
    expect(seen.a.some((e) => e.type === 'downed' && e.id === 'B')).toBe(true);
  });

  it('a blocked pilot is ignored', async () => {
    const { a, b } = await pair();
    b.block('A');
    a.pose(ship(4));
    a.ally('B', 'ask');
    expect(b.peers.get('A').pose).toBeNull();
    expect(b.peers.get('A').ally).toBe('none');
  });

  it('cleans a name that comes in', async () => {
    const { a, b } = await pair();
    a.setProfile({ name: '   Gold    Five   ' });
    expect(b.peers.get('A').name).toBe('Gold Five');
  });

  it('follows them round the site, pointer and all', async () => {
    const { a, b, seen } = await pair();
    b.setProfile({ where: '/middle-earth' });
    expect(a.peers.get('B').where).toBe('/middle-earth');
    expect(seen.a.some((e) => e.type === 'feed' && e.text === 'Rick went to Middle-earth')).toBe(true);
    a.setProfile({ where: '/deathstar' });
    b.setProfile({ where: '/deathstar' });
    expect(seen.a.some((e) => e.type === 'feed' && e.text === 'Rick is here')).toBe(true);
    b.cursor(-40, 1200);
    expect(a.peers.get('B').cur).toEqual({ x: -40, y: 1200, touch: false, at: 1000 });
    // a page change drops the old pointer
    b.setProfile({ where: '/home' });
    expect(a.peers.get('B').cur).toBeNull();
  });

  it('a quick move ends where the pointer stopped', async () => {
    const { a, b, tick } = await pair();
    a.setProfile({ where: '/home' });
    b.setProfile({ where: '/home' });
    b.cursor(1, 100);
    b.cursor(2, 200); // too soon: held back
    b.cursor(3, 300);
    expect(a.peers.get('B').cur.y).toBe(100);
    tick(100);
    await new Promise((r) => setTimeout(r, 120));
    expect(a.peers.get('B').cur.y).toBe(300);
  });

  it('sends no pointer from the universe map', async () => {
    const { a, b } = await pair();
    b.cursor(10, 10);
    expect(a.peers.get('B').cur).toBeNull();
  });

  it('says so if it cannot connect', async () => {
    const c = createClient({ name: 'X', load: () => Promise.reject(new Error('offline')) });
    await flush();
    expect(c.snapshot().status).toBe('failed');
  });
});
