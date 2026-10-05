import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient } from './client';

// An in-memory room: what one client sends, the others get straight away.
// room(id) on its own is a pilot with no client, sending whatever it likes.
function createBus() {
  const rooms = [];
  const configs = {}; // what each client asked Trystero for
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
    room,
    configs,
    load: (id) => () =>
      Promise.resolve({
        selfId: id,
        joinRoom: (config) => {
          configs[id] = config;
          return room(id);
        },
      }),
    // everyone meets everyone
    meet() {
      for (const a of rooms) for (const b of rooms) if (a !== b) a.onPeerJoin?.(b.id);
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// Han (A) and Rick (B), and Morty (C) if asked for
async function pair({ three = false } = {}) {
  const bus = createBus();
  let t = 1000;
  const now = () => t;
  const a = createClient({ name: 'Han', kind: 'falcon', load: bus.load('A'), now });
  const b = createClient({ name: 'Rick', kind: 'cruiser', load: bus.load('B'), now });
  const c = three ? createClient({ name: 'Morty', kind: 'cruiser', load: bus.load('C'), now }) : null;
  await flush();
  bus.meet();
  const seen = { a: [], b: [], c: [] };
  a.on((e) => seen.a.push(e));
  b.on((e) => seen.b.push(e));
  c?.on((e) => seen.c.push(e));
  return { a, b, c, bus, seen, tick: (ms) => (t += ms) };
}

const ship = (x = 0) => ({ x, y: 0, z: 0, heading: 0, pitch: 0, bank: 0, speed: 0, vy: 0 });
// B flying at the middle, A just off it, firing straight at B
const lineUp = (a, b) => {
  b.pose(ship(0));
  a.pose(ship(3));
  a.shot({ x: 3, y: 0, z: 0 }, [-20, 0, 0]);
};
const feeds = (list) => list.filter((e) => e.type === 'feed').map((e) => e.text);

afterEach(() => vi.useRealTimers());

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
    lineUp(a, b);
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(1);
    // allies can't hurt each other
    a.ally('B', 'ask');
    b.ally('A', 'accept');
    tick(300);
    a.shot({ x: 3, y: 0, z: 0 }, [-20, 0, 0]);
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(1);
  });

  it('a hit from a shot fired the other way does nothing', async () => {
    const { a, b, seen } = await pair();
    b.pose(ship(0));
    a.pose(ship(3));
    a.shot({ x: 3, y: 0, z: 0 }, [20, 0, 0]); // away from b
    a.hit('B');
    expect(seen.b.filter((e) => e.type === 'hit')).toHaveLength(0);
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
    lineUp(a, b);
    a.hit('B');
    b.down('A');
    expect(a.snapshot().self.kills).toBe(1);
    expect(b.peers.get('A').kills).toBe(1); // b saw it: it was a's hit
    expect(feeds(seen.a)).toContain('You shot down Rick');
    expect(feeds(seen.b)).toContain('Han shot you down');
    expect(seen.a.some((e) => e.type === 'downed' && e.id === 'B' && e.by === 'A')).toBe(true);
  });

  it('a kill handed to someone who never hit them is not believed', async () => {
    const { a, b, seen } = await pair();
    b.down('A'); // (b going down "by a", to pad a's score)
    expect(a.snapshot().self.kills).toBe(0);
    expect(seen.a.some((e) => e.type === 'downed' && e.id === 'B' && e.by === null)).toBe(true);
    expect(feeds(seen.a)).not.toContain('You shot down Rick');
  });

  it('a kill between two others counts if the killer was just firing, close by', async () => {
    const { a, b, c, seen, tick } = await pair({ three: true });
    lineUp(a, b);
    a.hit('B');
    b.down('A');
    expect(c.peers.get('A').kills).toBe(1);
    expect(feeds(seen.c)).toContain('Han shot down Rick');
    // and not once a has been quiet a while
    tick(10000);
    b.pose(ship(0));
    b.down('A');
    expect(c.peers.get('A').kills).toBe(1);
  });

  it('takes no one at their word on their own kills', async () => {
    const { a, bus } = await pair();
    const x = bus.room('X');
    x.makeAction('hi').send({ n: 'Ace', k: null, c: 999, w: '/universe' });
    expect(a.peers.get('X').kills).toBe(0);
  });

  it('mutes a pilot who floods the room', async () => {
    const { a, bus, seen } = await pair();
    const x = bus.room('X');
    x.makeAction('hi').send({ n: 'Spam', k: null, c: 0, w: '/universe' });
    const pose = x.makeAction('pose');
    for (let i = 0; i < 200; i++) pose.send([i, 0, 0, 0, 0, 0, 0, 0, 0, 100]);
    const p = a.peers.get('X');
    expect(p.blocked).toBe(true);
    expect(p.snaps.length).toBe(0);
    expect(feeds(seen.a)).toContain('Muted Spam: too many messages');
  });

  it('once turned down, they cannot ask again straight away', async () => {
    const { a, b, seen, tick } = await pair();
    a.ally('B', 'ask');
    b.ally('A', 'decline');
    expect(a.peers.get('B').ally).toBe('none');
    a.ally('B', 'ask');
    expect(b.peers.get('A').ally).toBe('none'); // turned away without a word to b
    expect(a.peers.get('B').ally).toBe('none');
    expect(feeds(seen.b).filter((t) => /wants to be allies/.test(t))).toHaveLength(1);
    tick(61000);
    a.ally('B', 'ask');
    expect(b.peers.get('A').ally).toBe('got');
  });

  it('keeps a pilot who sits still, and drops one who goes quiet', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { a, b, seen, tick } = await pair();
    const beat = () => {
      tick(15000);
      vi.advanceTimersByTime(15000);
    };
    for (let i = 0; i < 4; i++) beat(); // a minute of nothing but heartbeats
    expect(a.peers.has('B')).toBe(true);
    b.leave(); // a tab that froze: no goodbye
    for (let i = 0; i < 4; i++) beat();
    expect(a.peers.has('B')).toBe(false);
    expect(feeds(seen.a)).toContain('Rick went offline');
  });

  it('keeps bare LAN addresses back, and goes through the relay when there is one', async () => {
    const bus = createBus();
    const relay = { turnConfig: [{ urls: ['turn:r.example:3478'], username: 'u', credential: 'c' }], rtcConfig: { iceTransportPolicy: 'relay' } };
    const Peer = class {};
    const a = createClient({ name: 'Han', load: bus.load('A'), privacy: { peer: Peer, relay } });
    await flush();
    expect(bus.configs.A.rtcPolyfill).toBe(Peer);
    expect(bus.configs.A.rtcConfig.iceTransportPolicy).toBe('relay');
    expect(bus.configs.A.turnConfig).toEqual(relay.turnConfig);
    expect(a.snapshot().relay).toBe(true);
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
