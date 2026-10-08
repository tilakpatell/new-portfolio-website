import { afterEach, describe, expect, it, vi } from 'vitest';
import { LINGER_MS, poolFor, relayPool } from './pool';

// In-memory relays: each socket keeps the listening it was asked for (REQ,
// by its id; CLOSE drops one), and an event sent to a relay goes to every
// matching subscription on every socket open to it, the sender's included.
function createNet(urls) {
  const relays = new Map(urls.map((u) => [u, { up: true, open: new Set() }]));
  const made = [];
  const matches = (f, ev) => f.kinds.includes(ev.kind) && ev.tags.some((t) => t[0] === 'x' && f['#x'].includes(t[1]));
  const pass = (url, ev) => {
    for (const s of relays.get(url).open) for (const [id, f] of s.subs) if (matches(f, ev)) s.deliver(['EVENT', id, ev]);
  };
  class FakeSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.subs = new Map();
      this.sent = [];
      made.push(this);
      setTimeout(() => {
        const r = relays.get(url);
        if (!r?.up) {
          this.readyState = 3;
          this.onclose?.();
          return;
        }
        this.readyState = 1;
        r.open.add(this);
        this.onopen?.();
      }, 0);
    }
    send(s) {
      const msg = JSON.parse(s);
      this.sent.push(msg);
      if (msg[0] === 'REQ') this.subs.set(msg[1], msg[2]);
      else if (msg[0] === 'CLOSE') this.subs.delete(msg[1]);
      else if (msg[0] === 'EVENT') pass(this.url, msg[1]);
    }
    deliver(msg) {
      if (this.readyState === 1) this.onmessage?.({ data: JSON.stringify(msg) });
    }
    close() {
      if (this.readyState === 3) return;
      this.readyState = 3;
      relays.get(this.url)?.open.delete(this);
      setTimeout(() => this.onclose?.(), 0);
    }
  }
  return {
    WebSocket: FakeSocket,
    made,
    open: () => made.filter((s) => s.readyState === 1),
    socketTo: (url) => made.filter((s) => s.url === url && s.readyState === 1).at(-1),
    publish: (url, topic, content) => pass(url, { kind: 1, tags: [['x', topic]], content }),
    // a relay's own word to everyone on it (an OK, a notice)
    say(url, msg) {
      for (const s of relays.get(url).open) s.deliver(msg);
    },
    down(url) {
      relays.get(url).up = false;
      for (const s of [...relays.get(url).open]) s.close();
    },
    back(url) {
      relays.get(url).up = true;
    },
  };
}

const URLS = ['wss://one.example', 'wss://two.example', 'wss://three.example', 'wss://four.example'];
// a room: listening for its topic, keeping what it hears and how often its relays changed
const room = (pool, topic, filter = { kinds: [1], '#x': [topic] }) => {
  const got = [];
  let changes = 0;
  const sub = pool.subscribe({ filter, onEvent: (ev) => got.push(ev.content), onChange: () => (changes += 1) });
  return Object.assign(sub, { got, changes: () => changes });
};
const event = (topic, content) => JSON.stringify(['EVENT', { kind: 1, tags: [['x', topic]], content }]);
const setUp = () => {
  vi.useFakeTimers();
  const net = createNet(URLS);
  const pool = relayPool({ relays: URLS, WebSocket: net.WebSocket });
  const a = room(pool, 'one');
  const b = room(pool, 'two');
  vi.advanceTimersByTime(10); // (the sockets open)
  return { net, pool, a, b };
};

afterEach(() => vi.useRealTimers());

describe('relayPool', () => {
  it('two rooms share one socket per relay', () => {
    const { net, pool, a, b } = setUp();
    expect(net.made).toHaveLength(4);
    expect(pool.sockets()).toBe(4);
    expect(a.up()).toBe(4);
    expect(b.up()).toBe(4);
    // each socket asked for both, under a REQ id of each one's own
    for (const s of net.made) expect([...s.subs.keys()]).toEqual(['tp1', 'tp2']);
  });

  it('each room hears only its topic', () => {
    const { net, a, b } = setUp();
    net.publish(URLS[0], 'one', 'for one');
    net.publish(URLS[1], 'two', 'for two');
    expect(a.got).toEqual(['for one']);
    expect(b.got).toEqual(['for two']);
    // and what a room sends goes out to every relay (it's for the room to take it once)
    a.send(event('two', 'from a'));
    expect(b.got.filter((c) => c === 'from a')).toHaveLength(4);
    expect(a.got).toEqual(['for one']);
  });

  it('the last leave closes after the linger', () => {
    const { net, pool, a, b } = setUp();
    a.close();
    vi.advanceTimersByTime(LINGER_MS + 1000);
    expect(net.open()).toHaveLength(4); // (one room's still there)
    b.close();
    // each relay told each room's done
    for (const s of net.made) expect(s.subs.size).toBe(0);
    expect(net.made[0].sent.filter((m) => m[0] === 'CLOSE').map((m) => m[1])).toEqual(['tp1', 'tp2']);
    expect(LINGER_MS).toBe(5000);
    vi.advanceTimersByTime(4900);
    expect(net.open()).toHaveLength(4);
    expect(pool.sockets()).toBe(4);
    vi.advanceTimersByTime(200);
    expect(net.open()).toHaveLength(0);
    expect(pool.sockets()).toBe(0);
    // and gone for good: nothing tries them again
    vi.advanceTimersByTime(60000);
    expect(net.made).toHaveLength(4);
  });

  it('a room joined inside the linger reuses the sockets', () => {
    const { net, pool, a, b } = setUp();
    a.close();
    b.close();
    vi.advanceTimersByTime(3000);
    const c = room(pool, 'three');
    vi.advanceTimersByTime(10000);
    expect(net.made).toHaveLength(4);
    expect(net.open()).toHaveLength(4);
    expect(c.up()).toBe(4);
    for (const s of net.made) expect([...s.subs.keys()]).toEqual(['tp3']);
    net.publish(URLS[2], 'three', 'hello');
    expect(c.got).toEqual(['hello']);
    // and a room gone hears nothing more, nor sends
    net.publish(URLS[2], 'one', 'late');
    expect(a.got).toEqual([]);
    a.send(event('three', 'from a ghost'));
    expect(c.got).toEqual(['hello']);
  });

  it('a relay down and back resubscribes both rooms', () => {
    vi.useFakeTimers();
    const net = createNet(URLS);
    const pool = relayPool({ relays: URLS, WebSocket: net.WebSocket });
    // (a filter asked for afresh each time a socket opens: nostr.js's has a `since`)
    let asked = 0;
    const a = room(pool, 'one', () => ({ kinds: [1], '#x': ['one'], since: ++asked }));
    const b = room(pool, 'two');
    vi.advanceTimersByTime(10);
    expect(asked).toBe(4);
    const before = a.changes();
    net.down(URLS[0]);
    vi.advanceTimersByTime(10);
    expect(a.up()).toBe(3);
    expect(b.up()).toBe(3);
    expect(a.changes()).toBe(before + 1);
    net.back(URLS[0]);
    vi.advanceTimersByTime(1000); // (tried again a second on)
    const s = net.socketTo(URLS[0]);
    expect([...s.subs.keys()]).toEqual(['tp1', 'tp2']);
    expect(s.subs.get('tp1').since).toBe(5);
    expect(a.up()).toBe(4);
    expect(b.changes()).toBeGreaterThanOrEqual(2);
    net.publish(URLS[0], 'one', 'back');
    net.publish(URLS[0], 'two', 'back too');
    expect(a.got).toEqual(['back']);
    expect(b.got).toEqual(['back too']);
  });

  it('a relay that says slow down holds every room on its socket for ten seconds', () => {
    const { net, a, b } = setUp();
    const slow = net.socketTo(URLS[0]);
    const sent = () => slow.sent.filter((m) => m[0] === 'EVENT').length;
    net.say(URLS[0], ['OK', 'f'.repeat(64), false, 'rate-limited: slow down']);
    a.send(event('one', 'a'));
    b.send(event('two', 'b'));
    expect(sent()).toBe(0);
    expect(net.socketTo(URLS[1]).sent.filter((m) => m[0] === 'EVENT')).toHaveLength(2);
    vi.advanceTimersByTime(9900);
    b.send(event('two', 'b'));
    expect(sent()).toBe(0);
    vi.advanceTimersByTime(200);
    a.send(event('one', 'a'));
    expect(sent()).toBe(1);
  });
});

describe('poolFor', () => {
  it('keeps one pool for each WebSocket class and relay list', () => {
    const net = createNet(URLS);
    const other = createNet(URLS);
    expect(poolFor(net.WebSocket, URLS)).toBe(poolFor(net.WebSocket, [...URLS]));
    expect(poolFor(other.WebSocket, URLS)).not.toBe(poolFor(net.WebSocket, URLS));
    expect(poolFor(net.WebSocket, URLS.slice(0, 2))).not.toBe(poolFor(net.WebSocket, URLS));
  });
});
