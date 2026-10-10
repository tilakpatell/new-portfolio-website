import { describe, expect, it } from 'vitest';
import { fakeRelays } from './fake-relays.mjs';

// A browser context as fake-relays.mjs sees it: routeWebSocket keeps the
// handler, and open(url) is a page's WebSocket being routed to it (what the
// page sends, what comes back to it, and its closing).
function context() {
  const routes = [];
  return {
    routes,
    routeWebSocket(pattern, handler) {
      routes.push({ pattern, handler });
      return Promise.resolve();
    },
    open(url) {
      const route = routes.find((r) => r.pattern.test(url));
      if (!route) return null;
      const got = [];
      let onMessage = null;
      let onClose = null;
      route.handler({
        url: () => url,
        onMessage: (fn) => (onMessage = fn),
        onClose: (fn) => (onClose = fn),
        send: (text) => got.push(JSON.parse(text)),
        close: () => onClose?.(),
      });
      return { got, send: (msg) => onMessage(JSON.stringify(msg)), close: () => onClose?.() };
    },
  };
}
const KIND = 22742;
const event = (topic, content = 'x', kind = KIND) => ({ id: content.padEnd(64, '0').slice(0, 64), kind, tags: [['x', topic]], content });
const events = (socket) => socket.got.filter((m) => m[0] === 'EVENT');

describe('fakeRelays', () => {
  it('answers every wss:// address a page opens, and nothing else', async () => {
    const ctx = context();
    await fakeRelays().attach(ctx);
    expect(ctx.routes).toHaveLength(1);
    expect(ctx.routes[0].pattern.test('wss://relay.mostro.network')).toBe(true);
    expect(ctx.routes[0].pattern.test('https://relay.mostro.network')).toBe(false);
    expect(ctx.routes[0].pattern.test('ws://localhost:5173/')).toBe(false);
  });

  it('passes an event to every listening that matches, in every context, the sender’s own included, with an OK', async () => {
    const relays = fakeRelays();
    const alpha = context();
    const bravo = context();
    await relays.attach(alpha);
    await relays.attach(bravo);
    const a = alpha.open('wss://one.example');
    const b = bravo.open('wss://one.example');
    a.send(['REQ', 'tp1', { kinds: [KIND], '#x': ['app/room'], since: 0 }]);
    b.send(['REQ', 'tp1', { kinds: [KIND], '#x': ['app/room'] }]);
    b.send(['REQ', 'tp2', { kinds: [KIND], '#x': ['app/elsewhere'] }]);
    const ev = event('app/room', 'hello');
    a.send(['EVENT', ev]);
    expect(a.got).toContainEqual(['OK', ev.id, true, '']);
    expect(events(a)).toEqual([['EVENT', 'tp1', ev]]);
    expect(events(b)).toEqual([['EVENT', 'tp1', ev]]);
  });

  it('matches on the kind and the room both', async () => {
    const relays = fakeRelays();
    const ctx = context();
    await relays.attach(ctx);
    const a = ctx.open('wss://one.example');
    a.send(['REQ', 'tp1', { kinds: [KIND], '#x': ['app/room'] }]);
    a.send(['EVENT', event('app/room', 'other kind', 1)]);
    a.send(['EVENT', event('app/other', 'other room')]);
    expect(events(a)).toEqual([]);
  });

  it('ends a listening on CLOSE, and forgets a socket once it closes', async () => {
    const relays = fakeRelays();
    const ctx = context();
    await relays.attach(ctx);
    const a = ctx.open('wss://one.example');
    const b = ctx.open('wss://one.example');
    a.send(['REQ', 'tp1', { kinds: [KIND], '#x': ['app/room'] }]);
    a.send(['REQ', 'tp2', { kinds: [KIND], '#x': ['app/room'] }]);
    a.send(['CLOSE', 'tp1']);
    b.send(['EVENT', event('app/room', 'one')]);
    expect(events(a).map((m) => m[1])).toEqual(['tp2']);
    a.close();
    b.send(['EVENT', event('app/room', 'two')]);
    expect(events(a)).toHaveLength(1);
  });

  it('keeps a relay for each host: what goes to one isn’t heard on another', async () => {
    const relays = fakeRelays();
    const ctx = context();
    await relays.attach(ctx);
    const one = ctx.open('wss://one.example');
    const two = ctx.open('wss://two.example');
    for (const s of [one, two]) s.send(['REQ', 'tp1', { kinds: [KIND], '#x': ['app/room'] }]);
    one.send(['EVENT', event('app/room', 'on one')]);
    expect(events(one)).toHaveLength(1);
    expect(events(two)).toHaveLength(0);
  });

  it('shrugs off what isn’t a message', async () => {
    const relays = fakeRelays();
    const ctx = context();
    await relays.attach(ctx);
    const a = ctx.open('wss://one.example');
    a.send(['REQ', 'tp1', { kinds: [KIND], '#x': ['app/room'] }]);
    a.send(['EVENT', null]);
    a.send(['REQ', 7, null]);
    a.send({ nope: true });
    a.send(['EVENT', { kind: KIND, tags: 'x', content: '' }]);
    expect(events(a)).toEqual([]);
    a.send(['EVENT', event('app/room', 'still fine')]);
    expect(events(a)).toHaveLength(1);
  });
  it('passes on, to a listening with #g, only the events tagged with one of its cells, as the real relays index single-letter tags', async () => {
    const relays = fakeRelays();
    const ctx = context();
    await relays.attach(ctx);
    const near = ctx.open('wss://one.example');
    const all = ctx.open('wss://one.example');
    near.send(['REQ', 'tp1', { kinds: [KIND], '#x': ['app/room'], '#g': ['hoth/0,0', 'hoth/1,0'] }]);
    all.send(['REQ', 'tp1', { kinds: [KIND], '#x': ['app/room'] }]);
    const tagged = (g, c) => ({ ...event('app/room', c), tags: [['x', 'app/room'], ['g', g]] });
    all.send(['EVENT', tagged('hoth/5,5', 'far')]);
    all.send(['EVENT', tagged('hoth/1,0', 'near')]);
    all.send(['EVENT', event('app/room', 'untagged')]);
    expect(events(near).map((m) => m[2].content)).toEqual(['near']);
    expect(events(all).map((m) => m[2].content)).toEqual(['far', 'near', 'untagged']);
  });

  it('publishes an event from the check itself, to every relay', async () => {
    const relays = fakeRelays();
    const ctx = context();
    await relays.attach(ctx);
    const one = ctx.open('wss://one.example');
    const two = ctx.open('wss://two.example');
    for (const s of [one, two]) s.send(['REQ', 'tp1', { kinds: [KIND], '#x': ['app/room'] }]);
    relays.publish(event('app/room', 'from-node'));
    expect(events(one)).toHaveLength(1);
    expect(events(two)).toHaveLength(1);
  });
});
